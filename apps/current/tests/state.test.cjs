'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/state.js'), 'utf8');
function createAPI(options = {}) {
  const memory = new Map();
  const localStorage = {
    getItem(key) { if (options.blocked) throw new Error('storage blocked'); return memory.has(key) ? memory.get(key) : null; },
    setItem(key, value) { if (options.blocked || options.quota) throw new Error('storage unavailable'); memory.set(key, String(value)); },
    removeItem(key) { memory.delete(key); }
  };
  const window = { localStorage, matchMedia() { return { matches: !!options.reduceMotion }; } };
  vm.runInNewContext(source, { window, URLSearchParams }, { filename: 'state.js' });
  return { S: window.CurrentState, memory };
}
const { S, memory } = createAPI();
const plain = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => assert.deepEqual(plain(a), plain(b));
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }

test('boot state is silent-ready Calm Current configuration', () => {
  const x = S.fromURL('').state;
  assert.equal(x.preset, 'calm-current');
  assert.equal(x.volume, 0.25);
  assert.equal(x.pulseOn, true);
  assert.equal(x.pulseDepth, 0.10);
  same(S.frequencies(x), { left: 108, right: 112, effectiveCarrier: 110, raised: false });
  same(S.phases(x), { settle: 120, core: 600, fade: 120, total: 840 });
});
test('unknown parameters and hash fragments do not change boot state', () => {
  same(S.fromURL('?foo=bar#beat=80').state, S.DEFAULTS);
});
test('Gamma / Theta / Alpha / Beta boundaries', () => {
  [[0.5,'Delta'],[3.99,'Delta'],[4,'Theta'],[7.83,'Theta'],[8,'Alpha'],[13,'Beta'],[30,'Gamma'],[100,'Gamma']]
    .forEach(([hz,name]) => assert.equal(S.band(hz).name,name));
});
test('Golden Lift right alignment and centered alternative', () => {
  const golden = S.fromURL('?preset=golden-lift').state;
  same(S.frequencies(golden), { left: 220, right: 230, effectiveCarrier: 220, raised: false });
  assert.equal(golden.chord, true);
  assert.equal(golden.accent, true);
  assert.equal(golden.pulse, 80);
  same(S.phases(golden), { settle: 120, core: 660, fade: 120, total: 900 });
  const centered = S.fromURL('?preset=golden-lift&align=center').state;
  assert.equal(S.frequencies(centered).left, 215);
  assert.equal(S.frequencies(centered).right, 225);
});
test('tempo maps belong to sound state and legacy named presets infer their map', () => {
  assert.equal(S.DEFAULTS.tempo, 'steady');
  assert.equal(S.ENGINE_DEFAULTS.tempo, 'steady');
  assert.equal(S.fromURL('?preset=golden-lift').state.tempo, 'golden');
  assert.equal(S.normalize({preset:'golden-lift'}).tempo, 'golden');
  assert.equal(S.normalize({preset:'calm-current'}, S.BUILT_INS['golden-lift']).tempo, 'steady');
  const legacy = Object.assign({}, S.BUILT_INS['golden-lift']);
  delete legacy.tempo;
  assert.equal(S.normalize(legacy).tempo, 'golden');
});
test('manual steady tempo overrides Golden and survives partial updates and URL reload', () => {
  const manual = S.normalize({pulse:94,tempo:'steady'}, S.BUILT_INS['golden-lift']);
  assert.equal(manual.preset,'golden-lift');
  assert.equal(manual.tempo,'steady');
  assert.equal(S.normalize({volume:0.21},manual).tempo,'steady');
  const query = S.toQuery(manual);
  assert.equal(new URLSearchParams(query).get('tempo'),'steady');
  same(S.fromURL(query).state,manual);
  assert.equal(S.fromURL('?preset=golden-lift&pulse=94&tempo=steady').state.tempo,'steady');
});
test('explicit Golden tempo works without a named preset and ignores invalid enum values', () => {
  const custom = S.normalize({preset:'',tempo:'golden',pulse:80});
  assert.equal(new URLSearchParams(S.toQuery(custom)).get('tempo'),'golden');
  same(S.fromURL(S.toQuery(custom)).state,custom);
  assert.equal(S.fromURL('?tempo=unsupported').state.tempo,'steady');
  assert.equal(S.fromURL('?preset=golden-lift&tempo=unsupported').state.tempo,'golden');
});
test('invalid enum values preserve valid defaults', () => {
  const x = S.fromURL('?preset=golden-lift&mode=evil&align=left').state;
  assert.equal(x.mode, 'binaural');
  assert.equal(x.align, 'right');
});
test('volume cap survives URL and preset normalization', () => {
  assert.equal(S.fromURL('?volume=999').state.volume, 0.6);
  assert.equal(S.normalize({ volume: 0.61 }).volume, 0.6);
  assert.equal(S.normalize({ volume: -4 }).volume, 0);
});
test('binaural beat cap with exact warning; other modes allow 100', () => {
  const result = S.fromURL('?mode=binaural&beat=80');
  assert.equal(result.state.beat, 40);
  assert.ok(result.warnings.includes('Beat limited to 40 Hz in binaural mode'));
  assert.equal(S.fromURL('?mode=isochronic&beat=100').state.beat, 100);
  assert.equal(S.fromURL('?mode=monaural&beat=100').state.beat, 100);
});
test('bad numeric values do not yield NaN or Infinity', () => {
  const result = S.fromURL('?carrier=Infinity&beat=NaN&volume=bogus&minutes=-4');
  assert.equal(result.state.carrier, 110);
  assert.equal(result.state.beat, 4);
  assert.equal(result.state.volume, 0.25);
  assert.equal(result.state.minutes, 0);
  assert.ok(result.warnings.length);
});
test('numeric units are stripped and steps are enforced', () => {
  const state = S.fromURL('?carrier=136.14Hz&beat=7.832Hz&pulse=98bpm').state;
  assert.equal(state.carrier, 136.1);
  assert.equal(state.beat, 7.83);
  assert.equal(state.pulse, 98);
});
test('lowest binaural frequencies stay at 40Hz', () => {
  const x = S.normalize({ carrier: 60, beat: 40 });
  assert.equal(S.frequencies(x).left, 40);
  assert.equal(S.frequencies(x).right, 80);
});
test('monaural carrier rises while control value stays unchanged', () => {
  const x = S.normalize({ mode: 'monaural', carrier: 60, beat: 100, align: 'right' });
  assert.equal(x.carrier, 60);
  same(S.frequencies(x), { left: 40, right: 140, effectiveCarrier: 90, raised: true });
  const restored = S.fromURL(S.toQuery(x)).state;
  assert.equal(restored.carrier, 90);
  same(S.frequencies(restored), { left: 40, right: 140, effectiveCarrier: 90, raised: false });
});
test('isochronic uses identical carrier pitch in both ears', () => {
  const x = S.normalize({ mode: 'isochronic', carrier: 60, beat: 100 });
  assert.equal(S.frequencies(x).left, 60);
  assert.equal(S.frequencies(x).right, 60);
});
test('Calm compact URL has 90 / 420 / 90 phases', () => {
  const x = S.fromURL('?preset=calm-current&minutes=10').state;
  same(S.phases(x), { settle: 90, core: 420, fade: 90, total: 600 });
  same(S.phases(S.fromURL(S.toQuery(x)).state), S.phases(x));
});
test('generic phase policies handle 1, 2, 3, 5 and 6 minutes', () => {
  [[1,9,42,9],[2,18,84,18],[3,60,60,60],[5,60,180,60],[6,120,120,120]].forEach(([minutes, settle, core, fade]) => {
    same(S.phases(S.fromURL('?minutes=' + minutes).state), { settle, core, fade, total: minutes * 60 });
  });
});
test('custom phase ratio is preserved when session is shortened', () => {
  const result = S.fromURL('?minutes=2&settle=300&fade=100');
  same(S.phases(result.state), { settle: 90, core: 0, fade: 30, total: 120 });
  assert.ok(result.warnings.includes('Settle and fade were shortened to fit the session'));
});
test('duration helper chooses defaults or preserves custom phases explicitly', () => {
  same(S.phases(S.withDuration(S.DEFAULTS, 10)), { settle: 90, core: 420, fade: 90, total: 600 });
  const custom = S.normalize({ settle: 30, fade: 90 });
  same(S.phases(S.withDuration(custom, 2, { preserveCustom: true })), { settle: 30, core: 0, fade: 90, total: 120 });
});
test('untimed state has no session envelope phases', () => {
  same(S.phases(S.fromURL('?minutes=0').state), { settle: 0, core: 0, fade: 0, total: 0 });
});
test('noise cap scales enabled gains proportionally', () => {
  const result = S.fromURL('?noise=brown,pink,rain,unknown&noiseGain=0.4');
  const x = result.state;
  same(x.noise, ['brown','pink','rain']);
  const sum = x.noise.reduce((n,k) => n + x.noiseGain[k], 0);
  assert.ok(sum <= 0.400000000001);
  assert.ok(Math.abs(x.noiseGain.brown - x.noiseGain.rain) < 0.00001);
  assert.ok(result.warnings.includes('Noise mix capped at 40%'));
});
test('disabled layer gains do not count toward active cap', () => {
  const x = S.normalize({ noise: ['rain'], noiseGain: {brown:0.4,pink:0.4,rain:0.4} });
  assert.equal(x.noiseGain.rain, 0.4);
});
test('all custom parameters roundtrip including disabled layer gains', () => {
  const x = S.normalize({ preset:'', mode:'monaural', carrier:184.5, beat:77.25, align:'right', volume:0.58,
    minutes:29,settle:17,fade:37,pulseOn:true,pulse:137,pulseDepth:0.23,accent:true,noise:['pink','rain'],
    noiseGain:{brown:0.31,pink:0.12,rain:0.27},chord:true,exportRate:48000,exportDepth:24 });
  same(S.fromURL(S.toQuery(x)).state, x);
});
test('built-in query is compact and canonical order is stable', () => {
  assert.equal(S.toQuery(S.DEFAULTS), 'preset=calm-current&mode=binaural&carrier=110&beat=4');
  const custom = S.normalize({ minutes:3,settle:120,fade:60 });
  const query = S.toQuery(custom);
  assert.equal(S.toQuery(S.fromURL(query).state), query);
});
test('built-in modifications retain actual phase lengths on URL roundtrip', () => {
  const x = S.normalize({ minutes:10, settle:120,fade:120 });
  same(S.fromURL(S.toQuery(x)).state, x);
});
test('user preset link carries values to a different device', () => {
  const x = S.normalize({ preset:'night-ocean', carrier:172.8,beat:7.83,minutes:23,settle:76,fade:94,
    pulseOn:true,pulse:88,chord:true,noise:['rain'],noiseGain:{rain:0.14} });
  const query = S.toQuery(x);
  const unknown = S.fromURL(query);
  assert.ok(unknown.warnings.includes('That preset is not on this device.'));
  same(Object.assign({}, unknown.state, {preset:x.preset}), x);
  const known = S.fromURL(query,[Object.assign({},x,{slug:'night-ocean'})]);
  same(known.state,x);
});
test('saved custom Golden session keeps its tempo map in storage and on another device', () => {
  const custom = S.normalize({preset:'my-golden',volume:0.2}, S.BUILT_INS['golden-lift']);
  assert.equal(custom.tempo,'golden');
  const data = S.loadStorage();
  data.presets = [Object.assign({},custom,{slug:'my-golden',name:'My golden',builtIn:false})];
  data.lastSession = custom;
  assert.equal(S.saveStorage(data),true);
  const saved = S.loadStorage();
  assert.equal(saved.presets[0].tempo,'golden');
  assert.equal(saved.lastSession.tempo,'golden');
  const known = S.fromURL('?preset=my-golden',saved.presets).state;
  assert.equal(known.tempo,'golden');
  const query = S.toQuery(known);
  assert.equal(new URLSearchParams(query).get('tempo'),'golden');
  const elsewhere = S.fromURL(query).state;
  assert.equal(elsewhere.tempo,'golden');
  same(Object.assign({},elsewhere,{preset:known.preset}),known);
});
test('overlong hostile query remains finite and unknown prototype keys ignored', () => {
  const result = S.fromURL('?carrier=' + '9'.repeat(9000) + '&__proto__=evil');
  assert.equal(result.state.carrier,110);
  assert.ok(result.warnings.length);
  assert.equal({}.evil,undefined);
});
test('slug names are safe, bounded, unique and cannot shadow built-ins', () => {
  assert.equal(S.slugify('Café quiet'), 'cafe-quiet');
  assert.equal(S.slugify('Calm Current'), 'calm-current-2');
  assert.equal(S.slugify('quiet',['quiet','quiet-2']), 'quiet-3');
  assert.ok(S.slugify('a'.repeat(100),['a'.repeat(40)]).length <= 40);
});
test('presets survive save/load with caps and metadata', () => {
  const data=S.loadStorage();
  data.dismissedSafety=true;
  data.lastSession=S.DEFAULTS;
  data.presets=[Object.assign({},S.DEFAULTS,{name:'Evening',slug:'evening',builtIn:false,volume:5})];
  assert.equal(S.saveStorage(data),true);
  const loaded=S.loadStorage();
  assert.equal(loaded.dismissedSafety,true);
  assert.equal(loaded.presets.length,1);
  assert.equal(loaded.presets[0].volume,.6);
  assert.equal(loaded.presets[0].slug,'evening');
});
test('storage sanitization limits preset count and filters unusable entries', () => {
  const data=S.loadStorage();
  data.presets=Array.from({length:30},(_,i)=>({name:'Preset '+i,slug:'preset-'+i,volume:9}));
  S.saveStorage(data);
  assert.equal(S.loadStorage().presets.length,24);
});
test('future-version storage is preserved once rather than deleted', () => {
  const raw=JSON.stringify({version:99,presets:[{name:'future'}]});
  memory.set(S.STORAGE_KEY,raw);
  assert.equal(S.loadStorage().presets.length,0);
  assert.equal(memory.get(S.STORAGE_KEY),raw);
  assert.equal(memory.get('current.binaural.backup'),raw);
  memory.set(S.STORAGE_KEY,'not valid JSON');
  assert.equal(S.loadStorage().presets.length,0);
  assert.equal(memory.get('current.binaural.backup'),raw);
});
test('older storage migrates to supported version', () => {
  memory.set(S.STORAGE_KEY,JSON.stringify({version:0,dismissedSafety:true,presets:[]}));
  const loaded=S.loadStorage();
  assert.equal(loaded.version,1);
  assert.equal(JSON.parse(memory.get(S.STORAGE_KEY)).version,1);
});
test('blocked or quota-limited storage remains nonfatal', () => {
  const blocked=createAPI({blocked:true}).S;
  assert.equal(blocked.loadStorage().presets.length,0);
  assert.equal(blocked.saveStorage({}),false);
  const quota=createAPI({quota:true}).S;
  assert.equal(quota.saveStorage({}),false);
});
test('default motion preference follows the operating system', () => {
  assert.equal(createAPI({reduceMotion:true}).S.loadStorage().prefs.reduceMotion,true);
});
test('published defaults and built-ins are immutable', () => {
  assert.equal(Object.isFrozen(S.BUILT_INS),true);
  assert.equal(Object.isFrozen(S.BUILT_INS['golden-lift'].noiseGain),true);
  assert.equal(Object.isFrozen(S.DEFAULTS),true);
});
console.log('\n' + passed + ' state tests passed.');
