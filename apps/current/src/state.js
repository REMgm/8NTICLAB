(function (root) {
  'use strict';

  const STORAGE_KEY = 'current.binaural.v1';
  const BACKUP_KEY = 'current.binaural.backup';
  const MODES = ['binaural', 'isochronic', 'monaural', 'drone'];
  const LAYERS = ['brown', 'pink', 'rain'];
  const NOISE_DEFAULTS = Object.freeze({ brown: 0.08, pink: 0.08, rain: 0.10 });
  const NUMERIC = {
    carrier: [60, 600, 1], beat: [0.5, 100, 2], volume: [0, 0.6, 2],
    minutes: [0, 90, 0], settle: [0, 300, 0], fade: [0, 300, 0],
    pulse: [40, 180, 0], pulseDepth: [0, 0.25, 2]
  };
  const BOOLS = ['pulseOn', 'accent', 'chord'];
  const ORDER = ['preset', 'mode', 'carrier', 'beat', 'align', 'volume', 'minutes',
    'settle', 'fade', 'pulseOn', 'pulse', 'tempo', 'pulseDepth', 'accent', 'noise',
    'noiseGain', 'chord', 'sequence', 'breathing', 'exportRate', 'exportDepth'];
  // Export format changes the downloaded file, not the sound or preset identity.
  const SOUND_KEYS = ORDER.filter(function (key) {
    return ['preset', 'exportRate', 'exportDepth'].indexOf(key) < 0;
  });
  const own = function (obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); };
  const object = function (value) { return value !== null && typeof value === 'object' && !Array.isArray(value); };
  const finite = function (value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    if (typeof value !== 'string' || value.trim() === '' || value.length > 100) return NaN;
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : NaN;
  };
  const clamp = function (n, min, max) { return Math.min(max, Math.max(min, n)); };
  const round = function (n, places) {
    const scale = Math.pow(10, places);
    return Math.round((n + Number.EPSILON) * scale) / scale;
  };
  function number(value, fallback, min, max, places) {
    let n = finite(value);
    if (!Number.isFinite(n)) n = fallback;
    n = clamp(n, min, max);
    if (places === 0) return Math.trunc(n);
    return round(n, places);
  }
  function bool(value, fallback) {
    if (value === true || value === 1 || value === '1') return true;
    if (value === false || value === 0 || value === '0') return false;
    return !!fallback;
  }
  function deepFreeze(value) {
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
      Object.freeze(value);
    }
    return value;
  }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }

  const ENGINE_DEFAULTS = deepFreeze({
    mode: 'binaural', carrier: 110, beat: 4, align: 'center', volume: 0.25,
    minutes: 10, settle: 120, fade: 120, pulseOn: false, pulse: 60, tempo: 'steady',
    pulseDepth: 0.12, accent: false, noise: [], noiseGain: {}, chord: false,
    sequence: 'none', breathing: 'none',
    preset: '', exportRate: 44100, exportDepth: 16
  });
  const BUILT_INS = deepFreeze({
    'calm-current': Object.assign({}, ENGINE_DEFAULTS, {
      preset: 'calm-current', slug: 'calm-current', name: 'Calm Current',
      description: 'A low, even hold for settling', builtIn: true,
      category: 'calm', purpose: 'A quiet listening ritual', guidance: 'Headphones. A gentle 60 BPM swell accompanies the tones.',
      minutes: 14, settle: 120, fade: 120, pulseOn: true, pulseDepth: 0.10
    }),
    'golden-lift': Object.assign({}, ENGINE_DEFAULTS, {
      preset: 'golden-lift', slug: 'golden-lift', name: 'Golden Lift',
      description: 'A brighter, major-key lift', builtIn: true,
      category: 'energy', purpose: 'A brighter listening ritual', guidance: 'Headphones. The pulse moves from 80 to 115 BPM, then returns to 80.',
      carrier: 220, beat: 10, align: 'right', minutes: 15, settle: 120,
      fade: 120, pulseOn: true, pulse: 80, tempo: 'golden', pulseDepth: 0.12,
      accent: true, chord: true
    }),
    'main-character-energy': Object.assign({}, ENGINE_DEFAULTS, {
      preset: 'main-character-energy', slug: 'main-character-energy', name: 'Main Character Energy',
      description: 'A bright chord with a steady, upbeat swell', builtIn: true,
      category: 'energy', purpose: 'Positivity',
      guidance: 'Headphones. A 220 / 230 Hz pair, quiet 277 + 330 Hz chord, and steady 115 BPM pulse.',
      carrier: 220, beat: 10, align: 'right', minutes: 15,
      pulseOn: true, pulse: 115, tempo: 'steady', pulseDepth: 0.12, accent: false, chord: true
    }),
    'rizz-mode': Object.assign({}, ENGINE_DEFAULTS, {
      preset: 'rizz-mode', slug: 'rizz-mode', name: 'Rizz Mode',
      description: 'A clear tone with room for an easy breath', builtIn: true,
      category: 'calm', purpose: 'Attraction',
      guidance: 'Headphones. Breathe in for 4 counts, out for 6. A 10-minute pause before heading out.',
      carrier: 528, beat: 6, align: 'center', minutes: 10, breathing: '4-6'
    }),
    'lucky-glitch': Object.assign({}, ENGINE_DEFAULTS, {
      preset: 'lucky-glitch', slug: 'lucky-glitch', name: 'Lucky Glitch',
      description: 'A crisp 300 Hz tone, pulsed at 40 Hz', builtIn: true,
      category: 'energy', purpose: 'Lucky',
      guidance: 'Headphones or speakers. Ten minutes in the morning.',
      mode: 'isochronic', carrier: 300, beat: 40, minutes: 10
    }),
    'aura-farming': Object.assign({}, ENGINE_DEFAULTS, {
      preset: 'aura-farming', slug: 'aura-farming', name: 'Aura Farming',
      description: 'Five minutes to ground, five for a brighter finish', builtIn: true,
      category: 'energy', purpose: 'Aura maxing',
      guidance: 'Headphones. Five minutes at 136 Hz, then five at 220 / 230 Hz. Hum along gently if you like.',
      carrier: 136, beat: 7.83, align: 'center', minutes: 10, settle: 10, fade: 10, sequence: 'aura'
    }),
    'locked-in': Object.assign({}, ENGINE_DEFAULTS, {
      preset: 'locked-in', slug: 'locked-in', name: 'Locked In',
      description: 'A steady sound for a 25-minute work block', builtIn: true,
      category: 'focus', purpose: 'Focus',
      guidance: 'Headphones. Set aside 25 minutes for one task.',
      carrier: 200, beat: 15, align: 'center', minutes: 25
    }),
    'soft-life': Object.assign({}, ENGINE_DEFAULTS, {
      preset: 'soft-life', slug: 'soft-life', name: 'Soft Life',
      description: 'Low tones and a slow, even swell', builtIn: true,
      category: 'calm', purpose: 'Calm',
      guidance: 'Headphones. A 108 / 112 Hz pair with a gentle 60 BPM pulse.',
      carrier: 110, beat: 4, align: 'center', minutes: 14,
      pulseOn: true, pulse: 60, pulseDepth: 0.10
    }),
    'dream-portal': Object.assign({}, ENGINE_DEFAULTS, {
      preset: 'dream-portal', slug: 'dream-portal', name: 'Dream Portal',
      description: 'Twenty quiet minutes with a soft tone pair', builtIn: true,
      category: 'calm', purpose: 'Creative drift',
      guidance: 'Headphones. Close your eyes and give yourself 20 minutes to drift.',
      carrier: 150, beat: 6, align: 'center', minutes: 20
    }),
    'deep-reset': Object.assign({}, ENGINE_DEFAULTS, {
      preset: 'deep-reset', slug: 'deep-reset', name: 'Deep Reset',
      description: 'A low, slow pair with a five-minute fade', builtIn: true,
      category: 'calm', purpose: 'Sleep',
      guidance: 'Headphones. A 30-minute session with a gradual five-minute fade.',
      carrier: 100, beat: 2, align: 'center', minutes: 30, fade: 300
    }),
    'vibe-tuned': Object.assign({}, ENGINE_DEFAULTS, {
      preset: 'vibe-tuned', slug: 'vibe-tuned', name: 'Vibe Tuned',
      description: 'One continuous 432 Hz tone, on your time', builtIn: true,
      category: 'drone', purpose: 'Warmth',
      guidance: 'Headphones or speakers. A continuous 432 Hz drone; stop whenever you like.',
      mode: 'drone', carrier: 432, beat: 0, minutes: 0, settle: 0, fade: 0, pulseOn: false
    }),
    'body-bass': Object.assign({}, ENGINE_DEFAULTS, {
      preset: 'body-bass', slug: 'body-bass', name: 'Body Bass',
      description: 'A low 50 Hz drone and an optional breath guide', builtIn: true,
      category: 'drone', purpose: 'Grounded',
      guidance: 'Route your device audio to a compatible vibration pad or chair. Breathe in for 4 counts and out for 6.',
      mode: 'drone', carrier: 50, beat: 0, minutes: 10, breathing: '4-6', pulseOn: false
    })
  });
  const DEFAULTS = deepFreeze(Object.assign({}, ENGINE_DEFAULTS,
    Object.fromEntries(ORDER.map(function (key) {
      return [key, copy(BUILT_INS['calm-current'][key])];
    }))));

  const BANDS = deepFreeze([
    { id: 'delta', name: 'Delta', min: 0.5, max: 4, value: 2.5, description: 'Deep rest' },
    { id: 'theta', name: 'Theta', min: 4, max: 8, value: 6, description: 'Quiet, inward attention' },
    { id: 'alpha', name: 'Alpha', min: 8, max: 13, value: 10, description: 'Relaxed alertness' },
    { id: 'beta', name: 'Beta', min: 13, max: 30, value: 18, description: 'Active attention' },
    { id: 'gamma', name: 'Gamma', min: 30, max: 100, value: 40, description: 'Intense concentration' }
  ]);

  // Policy is expressed in seconds; short-session percentages are not minutes.
  function defaultPhases(minutes, preset) {
    const total = number(minutes, 10, 0, 90, 0) * 60;
    if (total === 0) return { settle: 0, core: 0, fade: 0, total: 0 };
    if (preset === 'deep-reset' && total === 1800) return { settle: 120, core: 1380, fade: 300, total: total };
    let edge;
    if (preset === 'aura-farming' && total === 600) edge = 10;
    else if (preset === 'calm-current' && total === 600) edge = 90;
    else if (total >= 360) edge = 120;
    else if (total >= 180) edge = 60;
    else edge = Math.round(total * 0.15);
    return { settle: edge, core: total - 2 * edge, fade: edge, total: total };
  }

  function phases(state) {
    state = object(state) ? state : DEFAULTS;
    const policy = defaultPhases(state.minutes, state.preset);
    if (policy.total === 0) return policy;
    let settle = number(state.settle, policy.settle, 0, 300, 0);
    let fade = number(state.fade, policy.fade, 0, 300, 0);
    if (settle + fade > policy.total) {
      settle = Math.round(policy.total * settle / (settle + fade));
      fade = policy.total - settle;
    }
    return { settle: settle, core: policy.total - settle - fade, fade: fade, total: policy.total };
  }

  function normalize(input, base) {
    input = object(input) ? input : {};
    base = object(base) ? base : DEFAULTS;
    const raw = {};
    ORDER.forEach(function (key) {
      raw[key] = own(input, key) ? input[key] : (own(base, key) ? base[key] : ENGINE_DEFAULTS[key]);
    });
    const result = {};
    result.mode = MODES.indexOf(raw.mode) >= 0 ? raw.mode :
      (MODES.indexOf(base.mode) >= 0 ? base.mode : ENGINE_DEFAULTS.mode);
    result.align = raw.align === 'right' || raw.align === 'center' ? raw.align :
      (base.align === 'right' ? 'right' : 'center');
    Object.keys(NUMERIC).forEach(function (key) {
      const limits = NUMERIC[key];
      const fallback = Number.isFinite(finite(base[key])) ? finite(base[key]) : ENGINE_DEFAULTS[key];
      result[key] = number(raw[key], fallback, key === 'carrier' && result.mode === 'drone' ? 40 : limits[0],
        key === 'beat' && result.mode === 'binaural' ? 40 : limits[1], limits[2]);
    });
    BOOLS.forEach(function (key) { result[key] = bool(raw[key], base[key]); });
    result.preset = typeof raw.preset === 'string' && /^[a-z0-9-]{1,40}$/.test(raw.preset) ? raw.preset : '';
    // Tempo automation is sound data, independent of a saved preset's name.
    // Legacy built-in settings infer a map only when tempo is not explicit;
    // partial updates preserve a listener's explicitly selected steady tempo.
    if (own(input, 'tempo')) {
      result.tempo = input.tempo === 'steady' || input.tempo === 'golden' ? input.tempo :
        (base.tempo === 'golden' ? 'golden' : 'steady');
    } else if (own(input, 'preset') && own(BUILT_INS, input.preset)) {
      result.tempo = BUILT_INS[input.preset].tempo;
    } else if (base.tempo === 'steady' || base.tempo === 'golden') {
      result.tempo = base.tempo;
    } else {
      result.tempo = own(BUILT_INS, result.preset) ? BUILT_INS[result.preset].tempo : 'steady';
    }
    ['sequence', 'breathing'].forEach(function (key) {
      const values = key === 'sequence' ? ['none', 'aura'] : ['none', '4-6'];
      if (own(input, key)) result[key] = values.indexOf(input[key]) >= 0 ? input[key] :
        (values.indexOf(base[key]) >= 0 ? base[key] : 'none');
      else if (own(input, 'preset') && own(BUILT_INS, input.preset)) result[key] = BUILT_INS[input.preset][key];
      else result[key] = values.indexOf(base[key]) >= 0 ? base[key] : 'none';
    });
    if (result.mode === 'drone') {
      result.beat = 0;
      result.pulseOn = false;
      result.accent = false;
      result.chord = false;
    }
    // A sequence defines its pitches; normal manual tuning clears its marker in the UI.
    if (result.mode !== 'binaural') result.sequence = 'none';
    if (result.sequence === 'aura') {
      if (result.minutes === 0) result.minutes = 10;
      result.carrier = 136;
      result.beat = 7.83;
      result.align = 'center';
    }
    result.exportRate = [44100, 48000].indexOf(Number(raw.exportRate)) >= 0 ? Number(raw.exportRate) :
      ([44100, 48000].indexOf(Number(base.exportRate)) >= 0 ? Number(base.exportRate) : 44100);
    result.exportDepth = [16, 24].indexOf(Number(raw.exportDepth)) >= 0 ? Number(raw.exportDepth) :
      ([16, 24].indexOf(Number(base.exportDepth)) >= 0 ? Number(base.exportDepth) : 16);

    const layers = Array.isArray(raw.noise) ? raw.noise :
      (typeof raw.noise === 'string' ? raw.noise.split(',') : []);
    result.noise = LAYERS.filter(function (key) { return layers.indexOf(key) >= 0; });
    result.noiseGain = {};
    const gains = object(raw.noiseGain) ? raw.noiseGain : {};
    LAYERS.forEach(function (key) {
      if (own(gains, key) || result.noise.indexOf(key) >= 0) {
        result.noiseGain[key] = number(gains[key], NOISE_DEFAULTS[key], 0, 0.4, 6);
      }
    });
    const sum = result.noise.reduce(function (total, key) { return total + result.noiseGain[key]; }, 0);
    if (sum > 0.4) {
      let used = 0;
      result.noise.forEach(function (key, index) {
        const gain = index === result.noise.length - 1 ? Math.max(0, 0.4 - used) :
          Math.floor(result.noiseGain[key] * 0.4 / sum * 1000000) / 1000000;
        result.noiseGain[key] = round(gain, 6);
        used += result.noiseGain[key];
      });
    }
    const timing = phases(result);
    result.settle = timing.settle;
    result.fade = timing.fade;
    return result;
  }

  // UI duration edits call this instead of retaining the previous default phase lengths.
  // Pass preserveCustom:true only after the listener deliberately edited advanced phases.
  function withDuration(state, minutes, options) {
    state = normalize(state);
    options = options || {};
    const value = number(minutes, state.minutes, 0, 90, 0);
    // Aura needs a midpoint. An untimed UI request must not erase the existing
    // envelope before normalize restores a timed programme.
    if (state.sequence === 'aura' && value === 0) return state;
    const timing = options.preserveCustom ?
      phases(Object.assign({}, state, { minutes: value })) : defaultPhases(value, state.preset);
    return normalize({ minutes: value, settle: timing.settle, fade: timing.fade }, state);
  }

  function frequencies(state) {
    state = normalize(state);
    let effectiveCarrier = state.carrier;
    if (state.mode === 'monaural' || (state.mode === 'binaural' && state.align === 'center')) {
      effectiveCarrier = Math.max(state.carrier, 40 + state.beat / 2);
    }
    if (state.mode === 'isochronic' || state.mode === 'drone') return {
      left: effectiveCarrier, right: effectiveCarrier, effectiveCarrier: effectiveCarrier, raised: false
    };
    const offsetRight = state.mode === 'binaural' && state.align === 'right';
    return {
      left: offsetRight ? effectiveCarrier : effectiveCarrier - state.beat / 2,
      right: offsetRight ? effectiveCarrier + state.beat : effectiveCarrier + state.beat / 2,
      effectiveCarrier: effectiveCarrier, raised: effectiveCarrier > state.carrier + 0.00001
    };
  }

  // Display-ready stage numbers are 1-based. All timing is in seconds from Start.
  // The audio engine schedules the same midpoint on the AudioContext clock.
  function sequenceAt(input, elapsedSeconds) {
    const state = normalize(input);
    const total = state.minutes * 60;
    const elapsed = Math.max(0, Number.isFinite(finite(elapsedSeconds)) ? finite(elapsedSeconds) : 0);
    const sequenced = state.sequence === 'aura';
    const stageCount = sequenced ? 2 : 1;
    const duration = total > 0 ? total / stageCount : null;
    const stageIndex = sequenced && elapsed >= duration ? 2 : 1;
    const stageElapsed = duration === null ? elapsed : Math.min(duration, Math.max(0, elapsed - (stageIndex - 1) * duration));
    let active = copy(state);
    if (sequenced && stageIndex === 2) {
      // Keep sequence on the stage view for UI metadata; do not renormalize it
      // back to the programme's initial settings after applying this stage.
      active.carrier = 220; active.beat = 10; active.align = 'right';
    }
    const freq = sequenced && stageIndex === 2 ?
      {left: 220, right: 230, effectiveCarrier: 220, raised: false} : frequencies(active);
    return {
      sequence: state.sequence, stageIndex: stageIndex, stageCount: stageCount,
      stageName: sequenced ? (stageIndex === 1 ? 'Ground' : 'Lift') : 'Listening',
      stageElapsed: stageElapsed, stageRemaining: duration === null ? null : Math.max(0, duration - stageElapsed),
      stageDuration: duration, state: active, frequencies: freq
    };
  }

  function band(value) {
    if (finite(value) === 0) return {id: 'drone', name: 'Steady tone', min: 0, max: 0, value: 0, description: 'One continuous tone'};
    const n = clamp(Number.isFinite(finite(value)) ? finite(value) : 4, 0.5, 100);
    return copy(BANDS.find(function (entry) { return n < entry.max; }) || BANDS[BANDS.length - 1]);
  }

  function parseNoiseGain(value, layers) {
    const out = {};
    if (typeof value !== 'string' || value.length > 300) return out;
    if (value.indexOf(':') < 0) {
      const n = finite(value);
      if (Number.isFinite(n)) layers.forEach(function (key) { out[key] = n; });
    } else value.split(',').forEach(function (pair) {
      const parts = pair.split(':');
      const key = parts[0];
      if (LAYERS.indexOf(key) >= 0 && Number.isFinite(finite(parts[1]))) out[key] = finite(parts[1]);
    });
    return out;
  }

  function fromURL(search, userPresets) {
    let text = typeof search === 'string' ? search : '';
    const warnings = [];
    if (text.length > 8192) {
      text = text.slice(0, 8192);
      warnings.push('Some link values were adjusted to stay in range.');
    }
    text = text.split('#')[0];
    const query = new URLSearchParams(text.charAt(0) === '?' ? text.slice(1) : text);
    const hasSessionParam = ORDER.some(function (key) { return query.has(key); });
    if (!hasSessionParam) return { state: normalize(DEFAULTS), warnings: warnings };
    let base = ENGINE_DEFAULTS;
    const requested = query.get('preset');
    const users = Array.isArray(userPresets) ? userPresets : [];
    if (requested) {
      const selected = own(BUILT_INS, requested) ? BUILT_INS[requested] : users.find(function (p) {
        return object(p) && p.slug === requested;
      });
      if (selected) base = normalize(Object.assign({}, selected, { preset: requested }), ENGINE_DEFAULTS);
      else warnings.push('That preset is not on this device.');
    }
    const input = {};
    Object.keys(NUMERIC).forEach(function (key) {
      if (!query.has(key)) return;
      const n = finite(query.get(key));
      if (Number.isFinite(n)) input[key] = n;
      else warnings.push('Some link values were adjusted to stay in range.');
    });
    ['mode', 'align', 'tempo', 'sequence', 'breathing'].forEach(function (key) { if (query.has(key)) input[key] = query.get(key); });
    BOOLS.forEach(function (key) {
      if (query.get(key) === '1' || query.get(key) === '0') input[key] = query.get(key) === '1';
    });
    ['exportRate', 'exportDepth'].forEach(function (key) {
      if (query.has(key)) input[key] = query.get(key);
    });
    if (query.has('noise')) input.noise = query.get('noise').split(',');
    if (query.has('noiseGain')) input.noiseGain = parseNoiseGain(query.get('noiseGain'),
      Array.isArray(input.noise) ? input.noise.filter(function (key) { return LAYERS.indexOf(key) >= 0; }) : base.noise);

    // A preset supplies its phases unless the duration is explicitly changed.
    if (own(input, 'minutes')) {
      const policy = defaultPhases(input.minutes, base.preset);
      if (!own(input, 'settle')) input.settle = policy.settle;
      if (!own(input, 'fade')) input.fade = policy.fade;
    }
    const raw = Object.assign({}, base, input);
    if ((raw.mode === 'binaural' || MODES.indexOf(raw.mode) < 0) && finite(raw.beat) > 40) {
      warnings.push('Beat limited to 40 Hz in binaural mode');
    }
    const nsum = (Array.isArray(raw.noise) ? raw.noise : []).filter(function (key) { return LAYERS.indexOf(key) >= 0; })
      .reduce(function (sum, key) { return sum + number((raw.noiseGain || {})[key], NOISE_DEFAULTS[key], 0, 0.4, 6); }, 0);
    if (nsum > 0.4) warnings.push('Noise mix capped at 40%');
    if (raw.minutes > 0 && Number(raw.settle) + Number(raw.fade) > raw.minutes * 60) {
      warnings.push('Settle and fade were shortened to fit the session');
    }
    const state = normalize(input, base);
    if (Object.keys(NUMERIC).some(function (key) {
      return own(input, key) && Math.abs(input[key] - state[key]) > 0.011;
    })) warnings.push('Some link values were adjusted to stay in range.');
    const sounding = frequencies(state);
    if (sounding.raised) warnings.push('Carrier raised to ' + sounding.effectiveCarrier.toFixed(1) + ' Hz so both ears stay above 40 Hz');
    return { state: state, warnings: Array.from(new Set(warnings)) };
  }

  function equalValue(a, b) {
    if (Array.isArray(a) || object(a)) return JSON.stringify(a) === JSON.stringify(b);
    return a === b;
  }
  function formatNumber(n) { return String(round(n, 6)); }

  function toQuery(input) {
    const state = normalize(input);
    const builtin = own(BUILT_INS, state.preset);
    const base = builtin ? normalize(BUILT_INS[state.preset], ENGINE_DEFAULTS) : ENGINE_DEFAULTS;
    const userPreset = !!state.preset && !builtin;
    const query = new URLSearchParams();
    const sounding = frequencies(state);
    state.carrier = sounding.effectiveCarrier;
    ORDER.forEach(function (key) {
      if (key === 'preset') {
        if (state.preset) query.set(key, state.preset);
        return;
      }
      const required = ['mode', 'carrier', 'beat'].indexOf(key) >= 0;
      if (!required && !userPreset && equalValue(state[key], base[key])) return;
      let value = state[key];
      if (BOOLS.indexOf(key) >= 0) value = value ? '1' : '0';
      else if (key === 'noise') value = state.noise.join(',');
      else if (key === 'noiseGain') value = LAYERS.filter(function (layer) {
        return own(state.noiseGain, layer);
      }).map(function (layer) { return layer + ':' + formatNumber(state.noiseGain[layer]); }).join(',');
      else if (typeof value === 'number') value = formatNumber(value);
      query.set(key, String(value));
    });
    // Duration-derived defaults can differ from a preset's initial phase lengths.
    // Write actual lengths whenever parsing the emitted duration would recompute them.
    if (query.has('minutes')) {
      const policy = defaultPhases(state.minutes, builtin ? state.preset : '');
      if (state.settle !== policy.settle && !query.has('settle')) query.set('settle', String(state.settle));
      if (state.fade !== policy.fade && !query.has('fade')) query.set('fade', String(state.fade));
    }
    // Restore prescribed order after a derived phase key was appended.
    const ordered = new URLSearchParams();
    ORDER.forEach(function (key) { if (query.has(key)) ordered.set(key, query.get(key)); });
    return ordered.toString();
  }

  function slugify(name, existingSlugs) {
    let slug = typeof name === 'string' ? name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '') : '';
    slug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
    if (!slug) slug = 'my-session';
    const existing = new Set(Array.isArray(existingSlugs) ? existingSlugs : []);
    Object.keys(BUILT_INS).forEach(function (key) { existing.add(key); });
    const original = slug;
    let i = 2;
    while (existing.has(slug)) {
      const suffix = '-' + i++;
      slug = original.slice(0, 40 - suffix.length).replace(/-+$/g, '') + suffix;
    }
    return slug;
  }

  function storageDefaults() {
    let reduceMotion = false;
    try { reduceMotion = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) {}
    return {
      version: 1, dismissedSafety: false,
      prefs: { wakeLock: true, reduceMotion: reduceMotion, lastExportRate: 44100, lastExportDepth: 16 },
      lastSession: null, presets: []
    };
  }
  function cleanStorage(raw) {
    const out = storageDefaults();
    if (!object(raw)) return out;
    out.dismissedSafety = bool(raw.dismissedSafety, false);
    if (object(raw.prefs)) {
      out.prefs.wakeLock = bool(raw.prefs.wakeLock, true);
      out.prefs.reduceMotion = bool(raw.prefs.reduceMotion, out.prefs.reduceMotion);
      if ([44100, 48000].indexOf(Number(raw.prefs.lastExportRate)) >= 0) out.prefs.lastExportRate = Number(raw.prefs.lastExportRate);
      if ([16, 24].indexOf(Number(raw.prefs.lastExportDepth)) >= 0) out.prefs.lastExportDepth = Number(raw.prefs.lastExportDepth);
    }
    const used = [];
    if (Array.isArray(raw.presets)) raw.presets.slice(0, 200).forEach(function (item) {
      if (out.presets.length >= 24 || !object(item) || item.builtIn === true) return;
      const name = typeof item.name === 'string' ? item.name.trim().slice(0, 40) : '';
      if (!name) return;
      const preferred = typeof item.slug === 'string' && /^[a-z0-9-]{1,40}$/.test(item.slug) ? item.slug : name;
      const slug = slugify(preferred, used);
      used.push(slug);
      const preset = normalize(item, ENGINE_DEFAULTS);
      preset.slug = slug;
      preset.preset = slug;
      preset.name = name;
      preset.builtIn = false;
      if (typeof item.createdAt === 'string' && item.createdAt.length <= 40) preset.createdAt = item.createdAt;
      out.presets.push(preset);
    });
    if (object(raw.lastSession)) {
      out.lastSession = normalize(raw.lastSession);
      if (typeof raw.lastSession.updatedAt === 'string' && raw.lastSession.updatedAt.length <= 40) {
        out.lastSession.updatedAt = raw.lastSession.updatedAt;
      }
    }
    return out;
  }
  function backup(raw) {
    try {
      if (root.localStorage.getItem(BACKUP_KEY) === null) root.localStorage.setItem(BACKUP_KEY, raw);
    } catch (_) {}
  }
  function loadStorage() {
    let text;
    try { text = root.localStorage.getItem(STORAGE_KEY); } catch (_) { return storageDefaults(); }
    if (!text) return storageDefaults();
    let raw;
    try { raw = JSON.parse(text); } catch (_) { backup(text); return storageDefaults(); }
    if (!object(raw) || typeof raw.version !== 'number' || raw.version > 1 || raw.version < 0) {
      backup(text);
      return storageDefaults();
    }
    const out = cleanStorage(raw);
    if (raw.version < 1) saveStorage(out);
    return out;
  }
  function saveStorage(data) {
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanStorage(data)));
      return true;
    } catch (_) { return false; }
  }

  function matchesPreset(input, preset) {
    const state = normalize(input);
    const compare = normalize(preset, ENGINE_DEFAULTS);
    return SOUND_KEYS.every(function (key) { return equalValue(state[key], compare[key]); });
  }

  root.CurrentState = Object.freeze({
    DEFAULTS: DEFAULTS, ENGINE_DEFAULTS: ENGINE_DEFAULTS, BUILT_INS: BUILT_INS,
    BANDS: BANDS, NOISE_DEFAULTS: NOISE_DEFAULTS, STORAGE_KEY: STORAGE_KEY,
    normalize: normalize, phases: phases, defaultPhases: defaultPhases, withDuration: withDuration,
    frequencies: frequencies, sequenceAt: sequenceAt, band: band, fromURL: fromURL, toQuery: toQuery,
    loadStorage: loadStorage, saveStorage: saveStorage, slugify: slugify, matchesPreset: matchesPreset
  });
})(typeof window !== 'undefined' ? window : globalThis);
