'use strict';
// These tests verify graph scheduling and state transitions with a mock.
// They do not establish browser sound quality, measured spectra, or device support.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
class Param{
 constructor(ctx,value=0){this.ctx=ctx;this.base=value;this.events=[]}
 get value(){return this.at(this.ctx.currentTime)}set value(v){assert(Number.isFinite(v));this.base=v;this.events=[]}
 at(t){let value=this.base;for(const e of this.events){if(e.t>t)break;if(e.type==='curve'){let p=Math.min(1,(t-e.t)/e.d)*(e.v.length-1),i=Math.floor(p);value=e.v[i]+(e.v[Math.min(i+1,e.v.length-1)]-e.v[i])*(p-i)}else if(e.type==='target')value=e.v+(e.from-e.v)*Math.exp(-(t-e.t)/e.d);else value=e.v}return value}
 add(type,v,t,d=0){assert(Number.isFinite(t)&&t>=0,`Invalid audio time ${t}`);if(type==='curve'){assert(d>0);for(const e of this.events)if(e.type==='curve')assert(!(t<e.t+e.d-1e-9&&t+d>e.t+1e-9),'Overlapping value curves')}this.events.push({type,v,t,d,from:this.at(t)});this.events.sort((a,b)=>a.t-b.t);return this}
 setValueAtTime(v,t){return this.add('value',v,t)}setTargetAtTime(v,t,d){return this.add('target',v,t,d)}linearRampToValueAtTime(v,t){return this.add('ramp',v,t)}setValueCurveAtTime(v,t,d){return this.add('curve',v,t,d)}cancelAndHoldAtTime(t){let v=this.at(t);this.events=this.events.filter(e=>e.t<t&&(e.type!=='curve'||e.t+e.d<=t));this.events.push({type:'value',t,v});return this}cancelScheduledValues(t){this.events=this.events.filter(e=>e.t<t);return this}
}
class Node{
 constructor(ctx,type){this.ctx=ctx;this.type=type;this.connections=[];ctx.nodes.push(this)}connect(n,...args){this.connections.push({n,args});return n}disconnect(n){this.connections=n?this.connections.filter(x=>x.n!==n):[]}
 start(at=0){assert(!this.started,'source double start');this.started=true;this.startAt=at}stop(at){this.stopAt=at===undefined?this.ctx.currentTime:at}
}
class Context{
 constructor(){this.currentTime=0;this.sampleRate=8000;this.nodes=[];this.state='suspended';this.destination=new Node(this,'destination')}
 async resume(){this.state='running'}async close(){this.state='closed'}addEventListener(){}
 createGain(){let n=new Node(this,'gain');n.gain=new Param(this,1);return n}
 createOscillator(){let n=new Node(this,'oscillator');n.frequency=new Param(this,440);return n}
 createBufferSource(){let n=new Node(this,'bufferSource');n.playbackRate=new Param(this,1);return n}
 createStereoPanner(){let n=new Node(this,'panner');n.pan=new Param(this);return n}
 createChannelMerger(){return new Node(this,'merger')}
 createWaveShaper(){return new Node(this,'shaper')}
 createDynamicsCompressor(){let n=new Node(this,'compressor');for(const p of ['threshold','knee','ratio','attack','release'])n[p]=new Param(this);return n}
 createBuffer(channels,length,rate){const data=Array.from({length:channels},()=>new Float32Array(length));return{numberOfChannels:channels,length,sampleRate:rate,getChannelData:c=>data[c]}}
}
const window={AudioContext:Context};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/engine.js'),'utf8'),{window,Float32Array,Math,Number,Object,Array,Map,WeakMap,Set,Promise,Error,setTimeout,clearTimeout,setInterval,clearInterval,Blob,ArrayBuffer,DataView});
const base={mode:'binaural',carrier:110,beat:4,align:'center',volume:.25,minutes:14,settle:120,fade:120,pulseOn:true,pulse:60,tempo:'steady',pulseDepth:.1,accent:false,chord:false,noise:[],noiseGain:{},preset:'calm-current'};
(async()=>{

 const assertCompensated = limiter => {
  assert.equal(limiter.type,'compressor');
  assert.equal(limiter.threshold.value,-12);
  assert.equal(limiter.connections.length,1);
  const output=limiter.connections[0].n;
  assert.equal(output.type,'gain');
  assert.equal(output.gain.value,.4);
  assert.equal(output.connections[0].n.type,'destination');
  // W3C: a monotone compression curve is identity up to the threshold;
  // automatic makeup = curve(1)^(-0.6). Net gain must never exceed unity.
  const maximumMakeup=Math.pow(Math.pow(10,limiter.threshold.value/20),-.6);
  assert(output.gain.value*maximumMakeup<=1);
 };
 let e=new window.CurrentAudio.Engine();assert.equal(e.context,null);await e.start(base);assertCompensated(e.graph.limiter);assert.equal(e.getSnapshot().left,108);
assert.equal(e.getSnapshot().right,112);assert.equal(e.graph.duration,840);assert.equal(e.graph.session.settle,120);assert.equal(e.graph.end,840.02);
 e.context.currentTime=.1;
 for(let i=0;i<100;i++){const mode=['isochronic','monaural','binaural'][i%3];e.update({...base,mode,beat:mode==='binaural'?40:100,noise:['brown','pink','rain'],noiseGain:{brown:.4,pink:.4,rain:.4}});e.context.currentTime+=.01}
 assert(e.graph.state.noise.reduce((s,n)=>s+e.graph.state.noiseGain[n],0)<=.40000000001);
 e.update({...base,volume:9,carrier:60,beat:100,mode:'monaural'});assert.equal(e.graph.state.volume,.6);e.context.currentTime+=1;assert.equal(e.getSnapshot().left,40);assert.equal(e.getSnapshot().right,140);

 await e.testChannel('left');await e.testChannel('right');
 assertCompensated(e.graph.limiter); // Running channel tests share this output path.
 await e.stop();assert.equal(e.playing,false);
 await e.testChannel('left');
 assertCompensated(e.context.nodes.filter(n=>n.type==='compressor').at(-1));

 await e.start({...base,preset:'golden-lift',tempo:'golden',minutes:15,carrier:220,beat:10,align:'right',pulse:80,chord:true,accent:true});assert.equal(e.getSnapshot().left,220);assert.equal(e.getSnapshot().right,230);e.context.currentTime=e.graph.start+120;assert.equal(e.getSnapshot().pulse,115);e.context.currentTime=e.graph.start+840;assert.equal(e.getSnapshot().pulse,97.5);

 const golden={...base,preset:'golden-lift',tempo:'golden',minutes:20,carrier:220,beat:10,align:'right',pulse:80,chord:true,accent:true};
 e.update(golden);assert.equal(e.graph.duration,900);
 // A save/rename or unrelated edit must not destroy the explicit tempo map.
 e.update({...golden,preset:'my-saved-lift',volume:.2});
 assert.equal(e.getSnapshot().tempoAuto,true);assert.equal(e.getSnapshot().pulse,97.5);
 // Manual BPM must disable automation even while the named preset is retained.
 e.update({...golden,pulse:90,tempo:'steady'});
 assert.equal(e.getSnapshot().tempoAuto,false);assert.equal(e.getSnapshot().pulse,90);
 // Equal-BPM switches must still update the automation mode.
 e.update({...golden,pulse:80,tempo:'steady'});
 assert.equal(e.getSnapshot().pulse,80);
 e.update({...golden,pulse:80,tempo:'golden'});
 assert.equal(e.getSnapshot().tempoAuto,true);assert.equal(e.getSnapshot().pulse,97.5);
 e.update({...golden,pulse:80,tempo:'steady'});
 assert.equal(e.getSnapshot().tempoAuto,false);assert.equal(e.getSnapshot().pulse,80);
 // Invalid/missing tempo supports older Golden links but explicit steady wins.
 e.update({...golden,tempo:undefined});assert.equal(e.getSnapshot().tempoAuto,true);
 e.update({...golden,tempo:'steady'});assert.equal(e.getSnapshot().tempoAuto,false);
 // Readouts follow the live oscillator slew; they are not target-only labels.
 const before=e.getSnapshot().left;
 e.update({...golden,tempo:'steady',carrier:330});
 assert.equal(e.getSnapshot().left,before);
 e.context.currentTime+=.05;
 assert(e.getSnapshot().left>before&&e.getSnapshot().left<330);
 e.context.currentTime+=1;assert(Math.abs(e.getSnapshot().left-330)<.001);

 await e.stop();await e.start({...base,settle:0,fade:0,minutes:1});await e.stop();e.destroy();console.log('PASS: no-boost compensated live/test output paths; defensive cap/routing state; phase automation; 100 rapid switches without curve-overlap errors; noise cap; channel test schedule; exact scheduled lengths; Golden tempo persistence/manual override/equal-BPM toggles; live frequency slew readouts; live duration isolation; stop/restart lifecycle. Mock schedule checks only; no audible/FFT verification.');
})().catch(e=>{console.error(e);process.exit(1)});
