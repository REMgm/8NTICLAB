/* Current: dependency-free Web Audio engine. All sources start in a user gesture.
 * AudioNode.connect(AudioParam) is a native Web Audio feature. Audio-rate pulse
 * modulation avoids a JavaScript look-ahead timer stopping in background tabs.
 * https://developer.mozilla.org/en-US/docs/Web/API/AudioNode/connect
 */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const NOISE_TYPES = ['brown', 'pink', 'rain'];
  const noiseCache = new WeakMap();
  const pulseCache = new WeakMap();
  const clamp = (n, lo, hi, fallback) => Number.isFinite(+n) ? Math.max(lo, Math.min(hi, +n)) : fallback;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const raised = x => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x)));
  const makeCurve = (from, to, count = 129) => Float32Array.from({length: count}, (_, i) => from + (to - from) * raised(i / (count - 1)));
  const error = (code, message) => Object.assign(new Error(message), {code});

  function normalize(input = {}) {
    const mode = ['binaural', 'isochronic', 'monaural'].includes(input.mode) ? input.mode : 'binaural';
    const s = {
      mode, carrier: clamp(input.carrier, 60, 600, 110),
      beat: clamp(input.beat, 0.5, mode === 'binaural' ? 40 : 100, 4),
      align: input.align === 'right' ? 'right' : 'center',
      volume: clamp(input.volume, 0, 0.6, 0.25),
      minutes: Math.round(clamp(input.minutes, 0, 90, 14)),
      settle: clamp(input.settle, 0, 300, 120),
      fade: clamp(input.fade, 0, 300, 120),
      pulseOn: input.pulseOn === undefined ? true : !!input.pulseOn,
      pulse: clamp(input.pulse, 40, 180, 60),
      pulseDepth: clamp(input.pulseDepth, 0, 0.25, 0.1),
      accent: !!input.accent,
      chord: !!input.chord,
      noise: NOISE_TYPES.filter(n => Array.isArray(input.noise) && input.noise.includes(n)),
      noiseGain: {},
      tempo: ['steady', 'golden'].includes(input.tempo) ? input.tempo : (input.preset === 'golden-lift' ? 'golden' : 'steady'),
      preset: typeof input.preset === 'string' ? input.preset : ''
    };
    for (const n of NOISE_TYPES) s.noiseGain[n] = clamp(input.noiseGain && input.noiseGain[n], 0, 0.4, n === 'rain' ? 0.1 : 0.08);
    const sum = s.noise.reduce((v, n) => v + s.noiseGain[n], 0);
    if (sum > 0.4) for (const n of s.noise) s.noiseGain[n] *= 0.4 / sum;
    if (s.minutes > 0 && s.settle + s.fade > s.minutes * 60) {
      const ratio = s.minutes * 60 / (s.settle + s.fade);
      s.settle *= ratio;
      s.fade *= ratio;
    }
    return s;
  }

  function frequencies(s) {
    if (s.mode === 'isochronic') return {left: s.carrier, right: s.carrier, carrier: s.carrier};
    if (s.mode === 'binaural' && s.align === 'right') return {left: s.carrier, right: s.carrier + s.beat, carrier: s.carrier};
    const carrier = Math.max(s.carrier, 40 + s.beat / 2);
    return {left: carrier - s.beat / 2, right: carrier + s.beat / 2, carrier};
  }

  function hold(param, at) {
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(at);
    else {
      const value = param.value;
      // Cancel the start of any curve in progress as well as future events.
      param.cancelScheduledValues(0);
      param.setValueAtTime(value, at);
    }
  }

  function target(param, value, at, timeConstant = 0.05) {
    hold(param, at);
    param.setTargetAtTime(value, at, timeConstant);
  }

  function gain(ctx, value, list) {
    const node = ctx.createGain();
    node.gain.value = value; // A newly created, unconnected graph is silent.
    if (list) list.push(node);
    return node;
  }

  function stopSource(source, at) {
    try { source.stop(at); } catch (_) { /* Already stopped. */ }
  }

  function disconnect(node) {
    try { node.disconnect(); } catch (_) { /* Already disconnected. */ }
  }

  function makeLimiter(ctx, destination, list) {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;
    limiter.connect(destination);
    if (list) list.push(limiter);
    return limiter;
  }

  function routeChannel(ctx, node, destination, side, nodes) {
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = side;
      node.connect(panner).connect(destination);
      nodes.push(panner);
    } else {
      const merger = ctx.createChannelMerger(2);
      node.connect(merger, 0, side < 0 ? 0 : 1);
      merger.connect(destination);
      nodes.push(merger);
    }
  }

  function noiseBuffer(ctx, kind) {
    let cache = noiseCache.get(ctx);
    if (!cache) { cache = {}; noiseCache.set(ctx, cache); }
    if (cache[kind]) return cache[kind];
    const seconds = kind === 'rain' ? 8 : 4;
    const length = Math.round(ctx.sampleRate * seconds);
    const seam = Math.round(ctx.sampleRate * 0.1);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const raw = new Float32Array(length + seam);
      let seed = ((kind === 'brown' ? 0x4c9287 : kind === 'pink' ? 0x19a72e : 0x614289) + channel * 1928371) >>> 0;
      const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      let brown = 0, drop = 0, smoothDrop = 0, low = 0;
      for (let i = 0; i < raw.length; i++) {
        const white = random() * 2 - 1;
        if (kind === 'brown') {
          brown = (brown + 0.02 * white) / 1.02;
          raw[i] = brown;
        } else {
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
          if (kind === 'rain') {
            // A steady, filtered bed with soft droplets, never thunder/transients.
            if (random() < 22 / ctx.sampleRate) drop += (random() * 2 - 1) * 0.4;
            drop *= Math.exp(-1 / (ctx.sampleRate * 0.012));
            smoothDrop += 0.075 * (drop - smoothDrop);
            low += 0.025 * (pink - low);
            raw[i] = (pink - low) * 0.7 + smoothDrop * 0.35;
          } else raw[i] = pink;
        }
      }
      const data = buffer.getChannelData(channel);
      data.set(raw.subarray(0, length));
      // Overlap the extended tail into the head: the loop boundary follows
      // contiguous samples, and the blend rejoins the original head smoothly.
      for (let i = 0; i < seam; i++) {
        const blend = raised(i / (seam - 1));
        data[i] = raw[length + i] * (1 - blend) + raw[i] * blend;
      }
      let mean = 0;
      for (let i = 0; i < length; i++) mean += data[i];
      mean /= length;
      let peak = 0;
      for (let i = 0; i < length; i++) { data[i] -= mean; peak = Math.max(peak, Math.abs(data[i])); }
      const scale = (kind === 'rain' ? 0.25 : 0.9) / Math.max(peak, 0.000001);
      for (let i = 0; i < length; i++) data[i] *= scale;
    }
    cache[kind] = buffer;
    return buffer;
  }

  function pulseBuffers(ctx) {
    if (pulseCache.has(ctx)) return pulseCache.get(ctx);
    const rate = 8000, length = rate * 4;
    const regular = ctx.createBuffer(1, length, rate);
    const accent = ctx.createBuffer(1, length, rate);
    const regularData = regular.getChannelData(0), accentData = accent.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const position = i / rate;
      const value = 0.5 - 0.5 * Math.cos(TAU * position);
      regularData[i] = value;
      accentData[i] = position >= 3 ? value : 0;
    }
    const result = {regular, accent};
    pulseCache.set(ctx, result);
    return result;
  }

  function isoCurve(beat) {
    const curve = new Float32Array(4097);
    // At high rates, two 10 ms edges do not fit inside a half-cycle. Shorten
    // each to a quarter-cycle, preserving 50% duty and a smooth pulse.
    const edgeFraction = Math.min(0.01 * beat, 0.25);
    const threshold = Math.sin(TAU * edgeFraction);
    for (let i = 0; i < curve.length; i++) {
      const x = i * 2 / (curve.length - 1) - 1;
      curve[i] = x <= 0 ? 0 : x >= threshold ? 1 : raised(Math.asin(x) / (TAU * edgeFraction));
    }
    return curve;
  }

  function buildMode(ctx, s, at, destination, finalStop, initialGain = 1) {
    const sources = [], nodes = [];
    const output = gain(ctx, initialGain, nodes);
    output.connect(destination);
    const f = frequencies(s);
    const oscillators = [];
    const oscillator = frequency => {
      const source = ctx.createOscillator();
      source.type = 'sine';
      source.frequency.value = frequency;
      sources.push(source); nodes.push(source); oscillators.push(source);
      source.start(at);
      if (Number.isFinite(finalStop)) source.stop(finalStop);
      return source;
    };
    let isoLFO = null;
    const shapers = [];
    let pulseAmp = null;

    function setIsoShape(beat, time, initial) {
      const shape = ctx.createWaveShaper();
      shape.curve = isoCurve(beat);
      const weight = gain(ctx, initial ? 1 : 0, nodes);
      isoLFO.connect(shape).connect(weight).connect(pulseAmp.gain);
      nodes.push(shape);
      const item = {shape, weight};
      const old = shapers.splice(0);
      shapers.push(item);
      if (!initial) {
        target(weight.gain, 1, time);
        for (const previous of old) {
          target(previous.weight.gain, 0, time);
          setTimeout(() => {
            try { isoLFO.disconnect(previous.shape); } catch (_) {}
            disconnect(previous.shape); disconnect(previous.weight);
            for (const node of [previous.shape, previous.weight]) {
              const index = nodes.indexOf(node);
              if (index >= 0) nodes.splice(index, 1);
            }
          }, 350);
        }
      }
    }

    if (s.mode === 'binaural') {
      routeChannel(ctx, oscillator(f.left), output, -1, nodes);
      routeChannel(ctx, oscillator(f.right), output, 1, nodes);
    } else if (s.mode === 'monaural') {
      oscillator(f.left).connect(gain(ctx, 0.5, nodes)).connect(output);
      oscillator(f.right).connect(gain(ctx, 0.5, nodes)).connect(output);
    } else {
      pulseAmp = gain(ctx, 0, nodes);
      oscillator(s.carrier).connect(pulseAmp).connect(output);
      isoLFO = ctx.createOscillator();
      isoLFO.type = 'sine';
      isoLFO.frequency.value = s.beat;
      sources.push(isoLFO); nodes.push(isoLFO);
      setIsoShape(s.beat, at, true);
      isoLFO.start(at);
      if (Number.isFinite(finalStop)) isoLFO.stop(finalStop);
    }
    return {
      mode: s.mode, output, sources, nodes, oscillators,
      update(next, time, previous) {
        const values = frequencies(next);
        target(oscillators[0].frequency, values.left, time);
        if (oscillators[1]) target(oscillators[1].frequency, values.right, time);
        if (isoLFO) {
          target(isoLFO.frequency, next.beat, time);
          if (Math.abs(next.beat - previous.beat) > 0.00001) setIsoShape(next.beat, time, false);
        }
      },
      stop(time) { for (const source of sources) stopSource(source, time); },
      dispose() { for (const source of sources) stopSource(source); for (const node of nodes) disconnect(node); }
    };
  }

  function buildGraph(ctx, input, start, destination) {
    let state = normalize(input);
    const session = {...state};
    const duration = state.minutes * 60;
    const end = duration > 0 ? start + duration : Infinity;
    const finalStop = Number.isFinite(end) ? end + 0.05 : Infinity;
    const nodes = [], sources = [], modes = [], noises = {};
    const sum = gain(ctx, 1, nodes);
    sum.channelCount = 2;
    sum.channelCountMode = 'explicit';
    const pulse = gain(ctx, 1, nodes);
    const volume = gain(ctx, state.volume, nodes);
    const transport = gain(ctx, 0, nodes);
    const envelope = gain(ctx, state.settle > 0 && duration > 0 ? 0 : 1, nodes);
    const duck = gain(ctx, 1, nodes);
    const limiter = makeLimiter(ctx, destination, nodes);
    sum.connect(pulse).connect(volume).connect(transport).connect(envelope).connect(duck).connect(limiter);
    transport.gain.setValueCurveAtTime(makeCurve(0, 1), start, 0.75);
    if (duration > 0) {
      if (state.settle > 0) envelope.gain.setValueCurveAtTime(makeCurve(0, 1), start, state.settle);
      if (state.fade > 0) envelope.gain.setValueCurveAtTime(makeCurve(1, 0), end - state.fade, state.fade);
      // Include the final transport ramp in the stated duration, also when Fade=0.
      transport.gain.setValueCurveAtTime(makeCurve(1, 0), end - 1, 1);
    }
    let activeMode = buildMode(ctx, state, start, sum, finalStop);
    modes.push(activeMode);
    const buffers = pulseBuffers(ctx);
    const pulseSources = [];
    const pulseDepth = gain(ctx, state.pulseOn ? -state.pulseDepth : 0, nodes);
    const accentDepth = gain(ctx, state.pulseOn && state.accent ? -Math.min(state.pulseDepth * 0.25, 0.25 - state.pulseDepth) : 0, nodes);
    for (const [buffer, depth] of [[buffers.regular, pulseDepth], [buffers.accent, accentDepth]]) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.value = state.pulse / 60;
      source.connect(depth).connect(pulse.gain);
      sources.push(source); nodes.push(source); pulseSources.push(source);
      source.start(start);
      if (Number.isFinite(finalStop)) source.stop(finalStop);
    }
    let tempoAuto = state.tempo === 'golden';

    function tempoAt(time) {
      if (!tempoAuto) return state.pulse;
      const elapsed = Math.max(0, time - start);
      if (duration <= 0 || elapsed < session.settle) return 80;
      const fadeStart = duration - session.fade;
      if (elapsed < fadeStart || session.fade === 0) return 115;
      return 115 - 35 * Math.min(1, (elapsed - fadeStart) / session.fade);
    }

    function scheduleTempo(time, initial) {
      for (const source of pulseSources) {
        const param = source.playbackRate;
        if (!initial) hold(param, time);
        const bpm = tempoAt(time);
        if (initial) param.setValueAtTime(bpm / 60, time);
        else param.setTargetAtTime(bpm / 60, time, 0.08);
        if (tempoAuto && duration > 0) {
          const coreStart = start + session.settle;
          const fadeStart = end - session.fade;
          if (coreStart > time && coreStart < end) param.setTargetAtTime(115 / 60, coreStart, 0.08);
          if (session.fade > 0 && fadeStart >= time) param.setValueAtTime(115 / 60, Math.max(fadeStart, time + 0.001));
          if (session.fade > 0 && end > time) param.linearRampToValueAtTime(80 / 60, end);
        }
      }
    }
    scheduleTempo(start, true);

    const chords = [];
    for (const hz of [277, 330]) {
      const source = ctx.createOscillator();
      source.type = 'sine'; source.frequency.value = hz;
      const level = gain(ctx, state.chord ? 0.12 : 0, nodes);
      source.connect(level).connect(sum);
      source.start(start);
      if (Number.isFinite(finalStop)) source.stop(finalStop);
      sources.push(source); nodes.push(source); chords.push(level);
    }

    function syncNoise(time) {
      for (const kind of NOISE_TYPES) {
        const enabled = state.noise.includes(kind);
        if (enabled && !noises[kind]) {
          const source = ctx.createBufferSource();
          source.buffer = noiseBuffer(ctx, kind);
          source.loop = true;
          const level = gain(ctx, 0, nodes);
          source.connect(level).connect(sum);
          source.start(time);
          if (Number.isFinite(finalStop)) source.stop(finalStop);
          sources.push(source); nodes.push(source);
          noises[kind] = {source, level};
        }
        if (noises[kind]) target(noises[kind].level.gain, enabled ? state.noiseGain[kind] : 0, time, 0.04);
      }
    }
    syncNoise(start);

    let stopping = false, disposed = false;
    return {
      ctx, start, end, duration, session, sum, volume, transport, envelope, duck, limiter,
      get state() { return state; },
      get mode() { return activeMode; },
      get tempoAuto() { return tempoAuto; },
      tempoAt,
      update(inputState) {
        if (stopping || disposed) return;
        const next = normalize(inputState), previous = state;
        const time = ctx.currentTime;
        state = next;
        target(volume.gain, state.volume, time);
        if (state.mode !== previous.mode) {
          const old = activeMode;
          const replacement = buildMode(ctx, state, time + 0.005, sum, finalStop, 0);
          const transition = ctx.currentTime;
          const inCurve = Float32Array.from({length: 129}, (_, i) => Math.sin(i / 128 * Math.PI / 2));
          const outCurve = Float32Array.from({length: 129}, (_, i) => Math.cos(i / 128 * Math.PI / 2));
          replacement.output.gain.setValueCurveAtTime(inCurve, transition, 0.2);
          hold(old.output.gain, transition);
          const oldGain = old.output.gain.value;
          for (let i = 0; i < outCurve.length; i++) outCurve[i] *= oldGain;
          old.output.gain.setValueCurveAtTime(outCurve, transition, 0.2);
          old.stop(transition + 0.25);
          setTimeout(() => {
            old.dispose();
            const index = modes.indexOf(old);
            if (index >= 0) modes.splice(index, 1);
          }, 300);
          activeMode = replacement;
          modes.push(replacement);
        } else activeMode.update(state, time, previous);
        target(pulseDepth.gain, state.pulseOn ? -state.pulseDepth : 0, time);
        target(accentDepth.gain, state.pulseOn && state.accent ? -Math.min(state.pulseDepth * 0.25, 0.25 - state.pulseDepth) : 0, time);
        if (state.pulse !== previous.pulse || state.tempo !== previous.tempo) {
          tempoAuto = state.tempo === 'golden';
          scheduleTempo(time, false);
        }
        for (const level of chords) target(level.gain, state.chord ? 0.12 : 0, time);
        syncNoise(time);
      },
      fadeStop(time) {
        if (stopping || disposed) return time;
        stopping = true;
        hold(transport.gain, time);
        const level = transport.gain.value;
        transport.gain.setValueCurveAtTime(makeCurve(level, 0), time, 1);
        for (const source of sources) stopSource(source, time + 1.05);
        for (const mode of modes) mode.stop(time + 1.05);
        return time + 1.05;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const source of sources) stopSource(source);
        for (const mode of modes) mode.dispose();
        for (const node of nodes) disconnect(node);
      }
    };
  }

  class Engine {
    constructor({onState = () => {}, onEnd = () => {}, onError = () => {}} = {}) {
      this.onState = onState;
      this.onEnd = onEnd;
      this.onError = onError;
      this.context = null;
      this.graph = null;
      this.playing = false;
      this.stopping = false;
      this.lastState = normalize();
      this._timer = null;
      this._stopPromise = null;
      this._starting = false;
      this._tests = new Set();
    }

    async _ensureContext() {
      if (!this.context || this.context.state === 'closed') {
        const AudioContextClass = global.AudioContext || global.webkitAudioContext;
        if (!AudioContextClass) throw error('E001', 'This browser cannot create an audio engine.');
        try {
          this.context = new AudioContextClass();
          this.context.addEventListener('statechange', () => this.onState(this.getSnapshot()));
        } catch (_) { throw error('E001', 'This browser cannot create an audio engine.'); }
      }
      try { await this.context.resume(); } catch (_) {}
      if (this.context.state !== 'running') throw error('E002', 'The browser blocked audio. Tap Start again, and on iPhone turn the silent switch off.');
      return this.context;
    }

    async start(input) {
      if (this.stopping) return;
      if (this.playing) { await this.resume(); return; }
      if (this._starting) return;
      this._starting = true;
      try {
        const ctx = await this._ensureContext();
        this.lastState = normalize(input);
        this.graph = buildGraph(ctx, this.lastState, ctx.currentTime + 0.02, ctx.destination);
        this.playing = true;
        this.stopping = false;
        clearInterval(this._timer);
        this._timer = setInterval(() => {
          if (this.graph && !this.stopping && Number.isFinite(this.graph.end) && ctx.currentTime >= this.graph.end + 0.05) this._finish(true);
          else this.onState(this.getSnapshot());
        }, 100);
        this.onState(this.getSnapshot());
      } catch (failure) {
        if (this.graph) this.graph.dispose();
        this.graph = null; this.playing = false;
        this.onError(failure.message, failure.code || 'E001');
        throw failure;
      } finally { this._starting = false; }
    }

    update(input) {
      this.lastState = normalize(input);
      if (this.graph && !this.stopping) this.graph.update(this.lastState);
      this.onState(this.getSnapshot());
    }

    async resume() {
      try { await this._ensureContext(); this.onState(this.getSnapshot()); }
      catch (failure) { this.onError(failure.message, failure.code || 'E002'); throw failure; }
    }

    async stop() {
      if (this._stopPromise) return this._stopPromise;
      if (!this.graph || !this.playing) return;
      if (this.context.state !== 'running') { this._finish(false); return; }
      this.stopping = true;
      const graph = this.graph;
      graph.fadeStop(this.context.currentTime);
      this.onState(this.getSnapshot());
      this._stopPromise = wait(1060).then(() => {
        if (this.graph === graph) this._finish(false);
        this._stopPromise = null;
      });
      return this._stopPromise;
    }

    _finish(natural) {
      if (!this.graph && !this.playing) return;
      clearInterval(this._timer); this._timer = null;
      if (this.graph) this.graph.dispose();
      this.graph = null;
      this.playing = false;
      this.stopping = false;
      this.onState(this.getSnapshot());
      if (natural) this.onEnd();
    }

    getSnapshot() {
      const graph = this.graph;
      const s = graph ? graph.state : this.lastState;
      const f = frequencies(s);
      let left = f.left, right = f.right;
      if (graph && graph.mode.oscillators.length) {
        left = graph.mode.oscillators[0].frequency.value;
        right = graph.mode.oscillators[1] ? graph.mode.oscillators[1].frequency.value : left;
      }
      const elapsed = graph ? Math.max(0, this.context.currentTime - graph.start) : 0;
      const total = graph ? graph.duration : s.minutes * 60;
      const remaining = total > 0 ? Math.max(0, total - elapsed) : null;
      const phases = graph ? graph.session : s;
      let phase = this.playing ? 'Core' : 'Ready', phaseRemaining = remaining;
      if (this.playing && total > 0) {
        if (elapsed < phases.settle) { phase = 'Settle'; phaseRemaining = phases.settle - elapsed; }
        else if (elapsed < total - phases.fade) { phase = 'Core'; phaseRemaining = total - phases.fade - elapsed; }
        else { phase = 'Fade'; phaseRemaining = Math.max(0, total - elapsed); }
      }
      if (this.stopping) phase = 'Stopping';
      return {playing: this.playing, stopping: this.stopping, elapsed, remaining, duration: total,
        phase, phaseRemaining, left, right, pulse: graph ? graph.tempoAt(this.context.currentTime) : s.pulse,
        contextState: this.context ? this.context.state : 'uninitialized', tempoAuto: !!(graph && graph.tempoAuto)};
    }

    async testChannel(side) {
      if (side !== 'left' && side !== 'right') return;
      let ctx;
      try { ctx = await this._ensureContext(); }
      catch (failure) { this.onError(failure.message, failure.code || 'E002'); throw failure; }
      const at = ctx.currentTime + 0.02;
      const nodes = [];
      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine'; oscillator.frequency.value = 440;
      const level = gain(ctx, 0, nodes);
      const ownLimiter = this.graph ? null : makeLimiter(ctx, ctx.destination, nodes);
      const limiter = this.graph ? this.graph.limiter : ownLimiter;
      oscillator.connect(level);
      routeChannel(ctx, level, limiter, side === 'left' ? -1 : 1, nodes);
      level.gain.setValueCurveAtTime(makeCurve(0, 0.2, 33), at, 0.02);
      level.gain.setValueAtTime(0.2, at + 0.02);
      level.gain.setValueCurveAtTime(makeCurve(0.2, 0, 33), at + 0.48, 0.02);
      if (this.graph) {
        const duck = this.graph.duck.gain;
        target(duck, Math.pow(10, -12 / 20), at, 0.02);
        duck.setTargetAtTime(1, at + 0.7, 0.04);
      }
      const test = {oscillator, nodes};
      this._tests.add(test);
      oscillator.onended = () => {
        disconnect(oscillator);
        for (const node of nodes) disconnect(node);
        this._tests.delete(test);
      };
      oscillator.start(at); oscillator.stop(at + 0.52);
    }

    destroy() {
      this._finish(false);
      for (const test of this._tests) {
        stopSource(test.oscillator); disconnect(test.oscillator);
        for (const node of test.nodes) disconnect(node);
      }
      this._tests.clear();
      if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    }
  }

  function wavHeader(frames, sampleRate, bitDepth) {
    const bytes = bitDepth / 8, dataSize = frames * 2 * bytes;
    const header = new ArrayBuffer(44), view = new DataView(header);
    const ascii = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    ascii(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); ascii(8, 'WAVE');
    ascii(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 2, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2 * bytes, true); view.setUint16(32, 2 * bytes, true);
    view.setUint16(34, bitDepth, true); ascii(36, 'data'); view.setUint32(40, dataSize, true);
    return header;
  }

  async function renderWav(input, {sampleRate = 44100, bitDepth = 16, onProgress = () => {}, signal} = {}) {
    if (Number(input.minutes) > 90) throw error('E009', 'Exports are limited to 90 minutes.');
    if (signal && signal.aborted) throw error('E008', 'Export stopped.');
    const state = normalize(input);
    if (state.minutes <= 0) throw error('E009', 'Choose a duration from 1 to 90 minutes before exporting.');
    sampleRate = sampleRate === 48000 ? 48000 : 44100;
    bitDepth = bitDepth === 24 ? 24 : 16;
    const duration = state.minutes * 60;
    const frames = Math.round(duration * sampleRate);
    const OfflineContext = global.OfflineAudioContext || global.webkitOfflineAudioContext;
    if (!OfflineContext) throw error('E001', 'This browser cannot create an offline audio engine.');
    let ctx;
    try { ctx = new OfflineContext(2, frames, sampleRate); }
    catch (_) { throw error('E001', 'This export is too large for this browser. Try a shorter session.'); }
    let graph, aborted = false, abortListener;
    const abortError = () => error('E008', 'Export stopped.');
    try {
      // Same graph as live playback; offline starts at zero to keep WAV duration exact.
      graph = buildGraph(ctx, state, 0, ctx.destination);
      onProgress(0);
      const step = Math.max(2, duration / 80);
      if (typeof ctx.suspend === 'function') {
        for (let at = step; at < duration - 0.05; at += step) {
          const progressTime = at;
          ctx.suspend(at).then(async () => {
            if (!aborted) onProgress(Math.min(85, progressTime / duration * 85));
            await wait(0); // Let the Cancel button respond during offline rendering.
            try { await ctx.resume(); } catch (_) {}
          }).catch(() => {});
        }
      }
      const abortPromise = new Promise((_, reject) => {
        abortListener = () => {
          aborted = true;
          graph.dispose();
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          reject(abortError());
        };
        if (signal) signal.addEventListener('abort', abortListener, {once: true});
      });
      const rendered = await Promise.race([ctx.startRendering(), abortPromise]);
      if (aborted || (signal && signal.aborted)) throw abortError();
      const channels = [rendered.getChannelData(0), rendered.getChannelData(1)];
      const parts = [wavHeader(frames, sampleRate, bitDepth)];
      const bytes = bitDepth / 8, chunkFrames = sampleRate * 4;
      for (let from = 0; from < frames; from += chunkFrames) {
        if (aborted || (signal && signal.aborted)) throw abortError();
        const count = Math.min(chunkFrames, frames - from);
        const chunk = new ArrayBuffer(count * 2 * bytes), view = new DataView(chunk);
        let offset = 0;
        for (let i = 0; i < count; i++) {
          for (let channel = 0; channel < 2; channel++) {
            const value = Math.max(-1, Math.min(1, channels[channel][from + i]));
            if (bitDepth === 16) { view.setInt16(offset, Math.round(value * (value < 0 ? 32768 : 32767)), true); offset += 2; }
            else {
              const integer = Math.round(value * (value < 0 ? 8388608 : 8388607));
              view.setUint8(offset++, integer & 255);
              view.setUint8(offset++, (integer >> 8) & 255);
              view.setUint8(offset++, (integer >> 16) & 255);
            }
          }
        }
        parts.push(chunk);
        onProgress(85 + Math.min(1, (from + count) / frames) * 15);
        await wait(0);
      }
      const slug = (state.preset || 'custom').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'custom';
      const effective = frequencies(state);
      const filename = `current-${slug}-${state.mode}-${+effective.carrier.toFixed(1)}hz-${+state.beat.toFixed(2)}hz-${state.minutes}m.wav`;
      return {blob: new Blob(parts, {type: 'audio/wav'}), filename};
    } catch (failure) {
      if (aborted || (signal && signal.aborted)) throw abortError();
      if (failure.code) throw failure;
      throw error('E008', 'Could not finish this export. Try a shorter session or another browser.');
    } finally {
      if (signal && abortListener) signal.removeEventListener('abort', abortListener);
      if (graph) graph.dispose();
    }
  }

  global.CurrentAudio = Object.freeze({Engine, renderWav, frequencies});
})(window);
