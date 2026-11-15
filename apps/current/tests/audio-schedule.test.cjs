'use strict';
// These tests verify graph scheduling and state transitions with a mock.
// They do not establish browser sound quality, measured spectra, or device support.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
class Param{
 constructor(ctx,value=0){this.ctx=ctx;this.base=value;this.events=[]}
 get value(){return this.at(this.ctx.currentTime)}set value(v){assert(Number.isFinite(v));this.base=v;this.events=[]}
 at(t){
  let value=this.base,previous=null;
  for(const event of this.events){
   if(event.t>t){
    if(event.type==='ramp'){
     const start=previous?previous.t:0;
     const from=previous?previous.type==='curve'?previous.v[previous.v.length-1]:previous.v:this.base;
     return from+(event.v-from)*Math.max(0,Math.min(1,(t-start)/(event.t-start)));
    }
    break;
   }
   if(event.type==='curve'){
    const p=Math.min(1,(t-event.t)/event.d)*(event.v.length-1),i=Math.floor(p);
    value=event.v[i]+(event.v[Math.min(i+1,event.v.length-1)]-event.v[i])*(p-i);
   }else if(event.type==='target')value=event.v+(event.from-event.v)*Math.exp(-(t-event.t)/event.d);
   else value=event.v;
   previous=event;
  }
  return value;
 }
 add(type,v,t,d=0){assert(Number.isFinite(t)&&t>=0,`Invalid audio time ${t}`);if(type==='curve'){assert(d>0);for(const e of this.events)if(e.type==='curve')assert(!(t<e.t+e.d-1e-9&&t+d>e.t+1e-9),'Overlapping value curves')}this.events.push({type,v,t,d,from:this.at(t)});this.events.sort((a,b)=>a.t-b.t);return this}
 setValueAtTime(v,t){return this.add('value',v,t)}setTargetAtTime(v,t,d){return this.add('target',v,t,d)}linearRampToValueAtTime(v,t){return this.add('ramp',v,t)}setValueCurveAtTime(v,t,d){return this.add('curve',v,t,d)}cancelAndHoldAtTime(t){let v=this.at(t);this.events=this.events.filter(e=>e.t<t&&(e.type!=='curve'||e.t+e.d<=t));this.events.push({type:'value',t,v});return this}cancelScheduledValues(t){this.events=this.events.filter(e=>e.t<t);return this}
}
class Node{
 constructor(ctx,type){this.ctx=ctx;this.type=type;this.kind=type;this.connections=[];ctx.nodes.push(this)}connect(n,...args){this.connections.push({n,args});return n}disconnect(n){this.connections=n?this.connections.filter(x=>x.n!==n):[]}
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
 for(let i=0;i<100;i++){const mode=['isochronic','monaural','binaural','drone'][i%4];e.update({...base,mode,beat:mode==='binaural'?40:100,noise:['brown','pink','rain'],noiseGain:{brown:.4,pink:.4,rain:.4}});e.context.currentTime+=.01}
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

 await e.stop();await e.start({...base,settle:0,fade:0,minutes:1});await e.stop();e.destroy();

 const near=(actual,expected,tolerance=1e-8)=>assert(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
 const aura={...base,preset:'aura',sequence:'aura',carrier:136,beat:7.83,align:'center',minutes:10,settle:10,fade:10,pulseOn:false,tempo:'steady'};
 const drone={...base,preset:'body-bass',mode:'drone',carrier:50,beat:99,minutes:10,pulseOn:true,accent:true,chord:true,sequence:'aura',noise:[]};

 // A fresh drone has one audible oscillator and no hidden chord/pulse sources.
 const d=new window.CurrentAudio.Engine();await d.start(drone);
 assert.equal(d.graph.state.carrier,50);assert.equal(d.graph.state.beat,0);
 assert.equal(d.graph.state.pulseOn,false);assert.equal(d.graph.state.accent,false);assert.equal(d.graph.state.chord,false);
 assert.equal(d.getSnapshot().left,50);assert.equal(d.getSnapshot().right,50);assert.equal(d.getSnapshot().activeBeat,0);
 assert.equal(d.getSnapshot().sequence,'none');assert.equal(d.graph.mode.oscillators.length,1);
 assert.equal(d.context.nodes.filter(n=>n.kind==='oscillator').length,1);
 assert.equal(d.context.nodes.filter(n=>n.kind==='bufferSource').length,0);
 d.update({...drone,carrier:432,minutes:0});assert.equal(d.graph.duration,600);
 d.context.currentTime+=1;near(d.getSnapshot().left,432,.001);d.destroy();
 const vibe=new window.CurrentAudio.Engine();await vibe.start({...drone,preset:'vibe',carrier:432,minutes:0});
 assert.equal(vibe.getSnapshot().remaining,null);assert.equal(vibe.graph.end,Infinity);assert.equal(vibe.getSnapshot().left,432);
 vibe.update({...base,carrier:110,mode:'isochronic'});assert.equal(vibe.graph.mode.mode,'isochronic');
 vibe.update({...base,carrier:50,mode:'drone'});await new Promise(r=>setTimeout(r,450));
 assert.equal(vibe.context.nodes.filter(n=>n.kind==='bufferSource'&&n.connections.length).length,0);
 assert.equal(vibe.getSnapshot().activeBeat,0);vibe.destroy();

 const a=new window.CurrentAudio.Engine();await a.start(aura);
 const start=a.graph.start;
 near(a.getSnapshot().left,132.085);near(a.getSnapshot().right,139.915);
 assert.equal(a.getSnapshot().stageIndex,1);assert.equal(a.getSnapshot().stage,'Ground');assert.equal(a.getSnapshot().stageCount,2);
 assert.equal(a.getSnapshot().stageRemaining,300);
 const planned=a.graph.mode.oscillators.map(n=>JSON.stringify(n.frequency.events));
 a.context.currentTime=start+10;
 a.update({...aura,preset:'saved-aura',minutes:20,settle:30,fade:60,volume:.2,noise:['brown']});
 assert.equal(a.graph.duration,600);assert.equal(a.graph.session.settle,10);
 a.graph.mode.oscillators.forEach((n,i)=>assert.equal(JSON.stringify(n.frequency.events),planned[i]));
 // Advancing only the audio clock (without awaiting any timer) changes stage.
 a.context.currentTime=start+299.9;near(a.getSnapshot().left,132.085);assert.equal(a.getSnapshot().stageIndex,1);
 a.context.currentTime=start+300.125;near(a.getSnapshot().left,(132.085+220)/2);near(a.getSnapshot().right,(139.915+230)/2);
 near(a.getSnapshot().activeBeat,8.915);assert.equal(a.getSnapshot().stageIndex,2);assert.equal(a.getSnapshot().stage,'Lift');near(a.getSnapshot().stageRemaining,299.875);
 a.context.currentTime=start+300.25;near(a.getSnapshot().left,220);near(a.getSnapshot().right,230);near(a.getSnapshot().activeBeat,10);
 assert.equal(a.getSnapshot().activeAlign,'right');near(a.getSnapshot().activeCarrier,220);a.destroy();

 // Disabling before the midpoint removes the future transition entirely.
 const cancel=new window.CurrentAudio.Engine();await cancel.start(aura);cancel.context.currentTime=cancel.graph.start+100;
 cancel.update({...aura,sequence:'none',carrier:180,beat:12});cancel.context.currentTime=cancel.graph.start+400;
 near(cancel.getSnapshot().left,174);near(cancel.getSnapshot().right,186);assert.equal(cancel.getSnapshot().sequence,'none');cancel.destroy();
 // Disabling midway through a ramp begins from the current audible frequency.
 const mid=new window.CurrentAudio.Engine();await mid.start(aura);mid.context.currentTime=mid.graph.start+300.125;
 const midway=mid.getSnapshot().left;mid.update({...aura,sequence:'none',carrier:250,beat:8});near(mid.getSnapshot().left,midway);
 mid.context.currentTime+=1;near(mid.getSnapshot().left,246,.001);near(mid.getSnapshot().right,254,.001);mid.destroy();
 // Stop freezes a pending stage change while the transport fades out.
 const stopping=new window.CurrentAudio.Engine();await stopping.start(aura);stopping.context.currentTime=stopping.graph.start+299.9;
 const stopped=stopping.stop();stopping.context.currentTime+=.3;
 near(stopping.getSnapshot().left,132.085);assert.equal(stopping.getSnapshot().stageIndex,1);await stopped;
 await stopping.start({...aura,minutes:0});assert.equal(stopping.graph.duration,600);stopping.context.currentTime=stopping.graph.start+1;
 near(stopping.getSnapshot().left,132.085);stopping.destroy();

 const mainCharacter=new window.CurrentAudio.Engine();await mainCharacter.start({...base,preset:'main-character',carrier:220,beat:10,align:'right',pulse:115,tempo:'steady',chord:true});
 assert.equal(mainCharacter.getSnapshot().left,220);assert.equal(mainCharacter.getSnapshot().right,230);
 assert.equal(mainCharacter.getSnapshot().pulse,115);assert.equal(mainCharacter.getSnapshot().tempoAuto,false);
 assert(mainCharacter.context.nodes.some(n=>n.kind==='oscillator'&&n.frequency.value===277));assert(mainCharacter.context.nodes.some(n=>n.kind==='oscillator'&&n.frequency.value===330));mainCharacter.destroy();

 // Probe the real renderWav entry point's native automation plan, stopping
 // before PCM synthesis. Browser spectral tests cover actual rendered sound.
 let offlineProbe;
 class OfflineProbeContext extends Context{
  constructor(channels,length,sampleRate){super();this.sampleRate=sampleRate;this.length=length;this.numberOfChannels=channels;}
  suspend(){return new Promise(()=>{});}
  startRendering(){
   const oscillators=this.nodes.filter(n=>n.kind==='oscillator');
   offlineProbe={sampleRate:this.sampleRate,length:this.length,channels:this.numberOfChannels,
    oscillators:oscillators.map(n=>({before:n.frequency.at(295),middle:n.frequency.at(300.125),after:n.frequency.at(305)})),
    pulseSources:this.nodes.filter(n=>n.kind==='bufferSource').length};
   return Promise.reject(Object.assign(new Error('Graph scheduling probe complete'),{code:'TEST_GRAPH_ONLY'}));
  }
 }
 window.OfflineAudioContext=OfflineProbeContext;
 await assert.rejects(window.CurrentAudio.renderWav(aura),e=>e.code==='TEST_GRAPH_ONLY');
 assert.equal(offlineProbe.length,600*44100);assert.equal(offlineProbe.channels,2);assert.equal(offlineProbe.oscillators.length,2);
 near(offlineProbe.oscillators[0].before,132.085);near(offlineProbe.oscillators[1].before,139.915);
 near(offlineProbe.oscillators[0].middle,(132.085+220)/2);near(offlineProbe.oscillators[0].after,220);near(offlineProbe.oscillators[1].after,230);
 await assert.rejects(window.CurrentAudio.renderWav({...drone,minutes:1}),e=>e.code==='TEST_GRAPH_ONLY');
 assert.equal(offlineProbe.oscillators.length,1);assert.equal(offlineProbe.oscillators[0].before,50);assert.equal(offlineProbe.pulseSources,0);
 console.log('PASS: compensated output; caps; phase and tempo automation; 100 four-mode switches; zero-beat 50/432Hz pure drones; chord/pulse source lifecycle; Aura audio-clock stages and 250ms glide; live edits preserve captured timing; cancelled/stopped sequences remove stale transitions; actual-frequency snapshots; offline renderWav schedule parity. Mock graph checks only; browser spectra require the separate browser test.');

})().catch(e=>{console.error(e);process.exit(1)});
