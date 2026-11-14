(function () {
  'use strict';
  const S = window.CurrentState;
  const A = window.CurrentAudio;
  const $ = id => document.getElementById(id);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const originalHTML = '<!doctype html>\n' + document.documentElement.outerHTML;
  const storage = S.loadStorage();
  const parsed = S.fromURL(location.search, storage.presets);
  let embedded = null;
  try { embedded = JSON.parse($('current-boot').textContent); } catch (_) {}
  const urlParams = new URLSearchParams(location.search);
  const explicitSession = Object.keys(S.DEFAULTS).some(key=>urlParams.has(key));
  let state = embedded && !explicitSession ? S.normalize(embedded) : parsed.state;
  let live = {playing:false,stopping:false,elapsed:0,contextState:'uninitialized'};
  let starting = false;
  let audioUnavailable = false;
  let phasesEdited = urlParams.has('settle') || urlParams.has('fade') || customPhases(state);
  let comfortShown = false;
  let saveTimer, urlTimer, toastTimer, wakeLock, exportController;
  let storageWarning = false;
  let lastAnnouncement = '', announcementAt = 0;
  let lastClockSecond = -1;
  const mediaReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefs = Object.assign({wakeLock:true,reduceMotion:mediaReduce.matches,lastExportRate:44100,lastExportDepth:16},storage.prefs);
  prefs.reduceMotion = prefs.reduceMotion || mediaReduce.matches;
  if(!urlParams.has('exportRate')&&!embedded)state.exportRate=prefs.lastExportRate;
  if(!urlParams.has('exportDepth')&&!embedded)state.exportDepth=prefs.lastExportDepth;
  const engine = new A.Engine({onState: onAudioState, onEnd: onSessionEnd, onError: onAudioError});
  // Exposed for local diagnostics; contains no credentials or external services.
  window.CurrentApp = Object.freeze({getState:()=>S.normalize(state),getSnapshot:()=>engine.getSnapshot()});

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '--:--';
    const n = Math.max(0, Math.ceil(seconds));
    return String(Math.floor(n / 60)).padStart(2,'0') + ':' + String(n % 60).padStart(2,'0');
  }
  function shortTime(seconds) { return formatTime(seconds).replace(/^0(\d:)/,'$1'); }
  function announce(message, force) {
    const now = performance.now();
    if (!force && (now - announcementAt < 700 || message === lastAnnouncement)) return;
    $('live-readout').textContent = message;
    announcementAt = now; lastAnnouncement = message;
  }
  function toast(message, isError) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.toggle('error',!!isError);
    $('toast').hidden = false;
    toastTimer = setTimeout(()=>{$('toast').hidden=true;},isError ? 8000 : 5000);
  }
  function persist() {
    clearTimeout(saveTimer);
    storage.prefs = prefs;
    storage.lastSession = Object.assign({},state,{updatedAt:new Date().toISOString()});
    const saved=S.saveStorage(storage);
    if (!saved && !storageWarning) {
      storageWarning=true;
      toast('Could not save presets in this browser.',true);
    }
    return saved;
  }
  function canonicalURL() {
    const url = new URL(location.href);
    url.search = S.toQuery(state); url.hash='';
    return url.href;
  }
  function writeURL() {
    clearTimeout(urlTimer);
    try { history.replaceState(null,'',canonicalURL()); } catch (_) {}
  }
  function queueSave() {
    clearTimeout(saveTimer); clearTimeout(urlTimer);
    saveTimer=setTimeout(persist,500); urlTimer=setTimeout(writeURL,250);
  }
  function setState(patch, options) {
    options=options||{};
    const before=state;
    const raw=Object.assign({},state,patch);
    if (raw.mode==='binaural' && Number(raw.beat)>40) toast('Beat limited to 40 Hz in binaural mode');
    const noiseSum=(raw.noise||[]).reduce((sum,n)=>sum+Number((raw.noiseGain||{})[n] ?? S.NOISE_DEFAULTS[n]),0);
    if(noiseSum>0.4000001) toast('Noise mix capped at 40%');
    if(raw.minutes>0 && Number(raw.settle)+Number(raw.fade)>raw.minutes*60) toast('Settle and fade were shortened to fit the session');
    state=S.normalize(raw);
    if(state.volume>0.4 && before.volume<=0.4 && !comfortShown){comfortShown=true;toast('Keep this below conversation level');}
    engine.update(state);
    if((patch.minutes!==undefined || patch.settle!==undefined || patch.fade!==undefined) && live.playing && !options.silentTiming) {
      $('next-session-hint').hidden=false;
      if(options.notifyTiming) toast('Timing changes are saved for the next session.');
    }
    render(); queueSave();
  }
  function presetEntry() {return S.BUILT_INS[state.preset] || storage.presets.find(p=>p.slug===state.preset);}
  function activePreset() {const entry=presetEntry(); return entry && S.matchesPreset(state,entry) ? entry : null;}
  function displayName() {const entry=activePreset();return entry?entry.name:'Custom sound';}
  function customPhases(s){const p=S.defaultPhases(s.minutes,s.preset);return s.settle!==p.settle||s.fade!==p.fade;}
  function loadPreset(slug) {
    const preset=S.BUILT_INS[slug] || storage.presets.find(p=>p.slug===slug);
    if(!preset){toast('That preset is not on this device.');return;}
    phasesEdited=customPhases(S.normalize(preset));
    setState(S.normalize(preset),{notifyTiming:true});writeURL();
    announce(preset.name+' loaded.',true);
  }
  function assign(id,value) {
    const el=$(id);
    if(document.activeElement!==el || el.type==='range') el.value=String(value);
  }
  function rangeFill(el){const amount=(Number(el.value)-Number(el.min))/(Number(el.max)-Number(el.min));el.style.setProperty('--progress',(Math.max(0,Math.min(1,amount))*100)+'%');}
  function renderUserPresets() {
    const holder=$('user-presets');
    const key=storage.presets.map(p=>p.slug+':'+p.name).join('|');
    if(holder.dataset.key!==key){
      holder.replaceChildren();holder.dataset.key=key;
      storage.presets.forEach(p=>{
        const row=document.createElement('div');row.className='user-preset';
        const button=document.createElement('button');button.type='button';button.textContent=p.name;button.dataset.userPreset=p.slug;
        button.addEventListener('click',()=>loadPreset(p.slug));
        const remove=document.createElement('button');remove.type='button';remove.className='delete-preset';remove.textContent='×';remove.setAttribute('aria-label','Delete '+p.name);
        remove.addEventListener('click',()=>{if(window.confirm('Delete “'+p.name+'” from this device?')){storage.presets=storage.presets.filter(x=>x.slug!==p.slug);if(state.preset===p.slug){state.preset='';queueSave();}persist();render();toast('Preset removed');}});
        row.append(button,remove);holder.append(row);
      });
    }
    $$('[data-user-preset]').forEach(el=>el.setAttribute('aria-pressed',String(state.preset===el.dataset.userPreset && !!activePreset())));
  }
  function render() {
    const freq=S.frequencies(state), band=S.band(state.beat), p=S.phases(state), active=activePreset();
    document.body.classList.toggle('golden-session',state.preset==='golden-lift');
    document.body.classList.toggle('reduced-motion',prefs.reduceMotion || mediaReduce.matches);
    $('session-title').textContent=displayName();
    $('band-label').textContent=band.name+' · '+state.beat.toFixed(2)+' Hz';
    $('left-label').textContent=state.mode==='monaural'?'TONE A':state.mode==='isochronic'?'LEFT':'LEFT EAR';
    $('right-label').textContent=state.mode==='monaural'?'TONE B':state.mode==='isochronic'?'RIGHT':'RIGHT EAR';
    $('left-frequency').replaceChildren(document.createTextNode(freq.left.toFixed(1)+' '),Object.assign(document.createElement('small'),{textContent:'Hz'}));
    $('right-frequency').replaceChildren(document.createTextNode(freq.right.toFixed(1)+' '),Object.assign(document.createElement('small'),{textContent:'Hz'}));
    const raised='Carrier raised to '+freq.effectiveCarrier.toFixed(1)+' Hz so both ears stay above 40 Hz';
    $('carrier-warning').hidden=!freq.raised;$('carrier-warning').textContent=raised;
    $$('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.mode===state.mode)));
    const hints={binaural:'Headphones required. A different tone in each ear.',isochronic:'Headphones or speakers. One tone, smoothly pulsed.',monaural:'Headphones or speakers. Both tones in both channels.'};
    $('mode-help').querySelector('span').textContent=hints[state.mode];
    $('beat').max=state.mode==='binaural'?'40':'100';$('beat-max').textContent=$('beat').max+' Hz';
    $('beat-help').textContent=state.mode==='binaural'?'Binaural beats are limited to 40 Hz; use another mode up to 100 Hz.':'Beat rate up to 100 Hz. Try isochronic for a clearer pulse above 30 Hz.';
    assign('carrier',state.carrier);assign('carrier-number',state.carrier.toFixed(1));
    assign('beat',state.beat);assign('beat-number',state.beat.toFixed(2));
    assign('volume',state.volume);assign('volume-number',Math.round(state.volume*100));
    $('volume').setAttribute('aria-valuetext',Math.round(state.volume*100)+' percent, maximum 60 percent');
    assign('minutes',state.minutes||'Off');assign('settle',state.settle);assign('fade',state.fade);
    assign('pulse',state.pulse);assign('pulse-number',state.pulse);assign('pulse-depth',state.pulseDepth);
    $('pulse-on').checked=state.pulseOn;$('accent').checked=state.accent;$('chord').checked=state.chord;$('center-beat').checked=state.align==='center';
    $('center-beat').disabled=state.mode!=='binaural';
    $('align-help').textContent=state.align==='center'?'Equal distance from the carrier':'Carrier in left ear, offset in right';
    ['pulse','pulse-number','pulse-depth','accent'].forEach(id=>$(id).disabled=!state.pulseOn);
    const autoTempo=state.tempo==='golden';
    $('tempo-note').textContent=autoTempo?'Golden Lift: 80 BPM to settle, 115 in Core, then back to 80. Editing tempo sets a steady pulse.':'A slow swell, separate from the beat offset.';
    $('pulse-depth-value').textContent=Math.round(state.pulseDepth*100)+'%';
    $('wake-lock').checked=prefs.wakeLock;$('reduce-motion').checked=prefs.reduceMotion||mediaReduce.matches;
    $$('[data-preset]').forEach(el=>{const selected=!!active&&active.slug===el.dataset.preset;el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected));});
    $$('[data-minutes]').forEach(el=>{const yes=Number(el.dataset.minutes)===state.minutes;el.classList.toggle('selected',yes);el.setAttribute('aria-pressed',String(yes));});
    $$('[data-beat]').forEach(el=>el.setAttribute('aria-pressed',String(Math.abs(Number(el.dataset.beat)-state.beat)<.009)));
    $('settle-readout').textContent=shortTime(p.settle);$('core-readout').textContent=shortTime(p.core);$('fade-readout').textContent=shortTime(p.fade);
    ['settle','core','fade'].forEach(phase=>document.querySelector('.phase-'+phase).style.width=(p.total?p[phase]/p.total*100:phase==='core'?100:0)+'%');
    ['brown','pink','rain'].forEach(n=>{const on=state.noise.includes(n),value=state.noiseGain[n]??S.NOISE_DEFAULTS[n];$('noise-'+n).checked=on;$('gain-'+n).disabled=!on;assign('gain-'+n,value);$('level-'+n).textContent=Math.round(value*100)+'%';});
    $$('input[type=range]').forEach(rangeFill);
    $('safety-note').hidden=!!storage.dismissedSafety;
    renderUserPresets();renderTransport();
    let readout=state.mode==='monaural'?'Both '+freq.left.toFixed(1)+' + '+freq.right.toFixed(1)+' Hz':'Left '+freq.left.toFixed(1)+' Hz · Right '+freq.right.toFixed(1)+' Hz';
    if(state.mode==='isochronic') readout+=' · pulse '+state.beat.toFixed(2)+' Hz';
    announce(readout+'. '+band.name+' · '+state.beat.toFixed(2)+' Hz.');
  }
  function renderTransport() {
    const isPlaying=live.playing, isStopping=live.stopping;
    document.body.classList.toggle('playing',isPlaying);
    const interrupted=isPlaying && live.contextState!=='running' && !isStopping;
    ['start','mobile-start'].forEach(id=>{
      const button=$(id);button.disabled=isStopping||starting||audioUnavailable;
      button.setAttribute('aria-pressed',String(isPlaying));
      const word=starting?'Starting…':isStopping?'Fading out…':interrupted?'Resume':isPlaying?'Stop':'Start';
      button.setAttribute('aria-label',interrupted?'Resume generator':isPlaying?'Stop generator':'Start generator');
      button.querySelector('.start-label').textContent=word;
      button.querySelector('use').setAttribute('href',isPlaying&&!interrupted?'#i-stop':'#i-play');
    });
    $('open-export').disabled=isPlaying||starting||isStopping;
    $('open-export').title=isPlaying?'Stop playback before exporting your session.':'Export this session as a stereo WAV';
    const timed=isPlaying?live.duration>0:state.minutes>0;
    const remaining=isPlaying?(timed?live.remaining:live.elapsed):state.minutes*60;
    const timer=timed?formatTime(remaining):isPlaying?formatTime(live.elapsed):'--:--';
    $('timer').textContent=timer;$('mobile-timer').textContent=timer;
    $('phase-label').textContent=isStopping?'A gentle finish':interrupted?'Tap Resume to keep listening':isPlaying?(timed?live.phase+' · '+shortTime(live.phaseRemaining):'Untimed · stay as long as you like'):state.minutes?'minutes for yourself':'untimed · stop whenever you like';
    $('play-state').textContent=isStopping?'Finishing':interrupted?'Audio paused':isPlaying?'Listening':'Ready to listen';
    $('mobile-status').textContent=isPlaying?(live.phase||'Listening'):displayName();
  }
  function onAudioState(snapshot){live=snapshot;renderTransport();if(live.playing&&Number.isFinite(live.left)&&Number.isFinite(live.right)){[['left-frequency',live.left],['right-frequency',live.right]].forEach(([id,hz])=>{$(id).firstChild.textContent=hz.toFixed(1)+' ';});}if(!live.playing&&!live.stopping){releaseWakeLock();} }
  function onAudioError(message,code){$('audio-error').textContent=message;$('audio-error').hidden=false;toast(message,true);if(code==='E001'){audioUnavailable=true;['start','mobile-start'].forEach(id=>$(id).disabled=true);} }
  function onSessionEnd(){releaseWakeLock();persist();$('next-session-hint').hidden=true;toast('Session ended. Take your time.');announce('Session ended.',true);render();}
  async function requestWakeLock(){
    if(!prefs.wakeLock||!live.playing||document.visibilityState!=='visible'||wakeLock)return;
    if(!navigator.wakeLock){$('wake-hint').textContent='Screen may sleep';return;}
    try {wakeLock=await navigator.wakeLock.request('screen');$('wake-hint').textContent='Screen awake';wakeLock.addEventListener('release',()=>{wakeLock=null;$('wake-hint').textContent=live.playing?'Screen may sleep':'';});}
    catch(_){$('wake-hint').textContent='Screen may sleep';}
  }
  async function releaseWakeLock(){if(wakeLock){try{await wakeLock.release();}catch(_){}wakeLock=null;}$('wake-hint').textContent='';}
  async function togglePlayback(){
    if(starting||live.stopping||exportController||audioUnavailable)return;
    $('audio-error').hidden=true;
    if(live.playing&&live.contextState!=='running'){
      try{await engine.resume();live=engine.getSnapshot();renderTransport();if(live.contextState==='running')requestWakeLock();}catch(e){onAudioError(e.message,e.code);}return;
    }
    if(live.playing){await engine.stop();live=engine.getSnapshot();releaseWakeLock();persist();$('next-session-hint').hidden=true;render();return;}
    starting=true;renderTransport();comfortShown=false;
    try{await engine.start(state);live=engine.getSnapshot();$('ios-hint').hidden=true;$('next-session-hint').hidden=true;requestWakeLock();announce('Session started. '+displayName()+'.',true);}
    catch(e){onAudioError(e.message,e.code);}
    finally{starting=false;renderTransport();}
  }
  async function testChannel(side){
    try{await engine.testChannel(side);$('ios-hint').hidden=true;announce((side==='left'?'Left':'Right')+' channel test, 440 hertz.',true);toast((side==='left'?'Left':'Right')+' channel · 440 Hz');}
    catch(e){onAudioError(e.message,e.code);}
  }
  function bindNumeric(id,key,options){
    options=options||{};const el=$(id);let dirty=false;
    el.addEventListener('input',()=>{dirty=true;});
    function commit(){
      if(!dirty){el.value=options.format?options.format(state[key]):String(state[key]);return;}
      dirty=false;
      const text=el.value.trim();let n=Number(text);
      if(!text||!Number.isFinite(n)){el.value=options.format?options.format(state[key]):String(state[key]);return;}
      if(options.transform)n=options.transform(n);
      if(options.min!==undefined)n=Math.max(options.min,n);
      if(options.max!==undefined)n=Math.min(options.max,n);
      if(options.duration){setState(S.withDuration(state,Math.trunc(n),{preserveCustom:phasesEdited}),{notifyTiming:true});}
      else{if(key==='settle'||key==='fade')phasesEdited=true;setState(key==='pulse'?{pulse:n,tempo:'steady'}:{[key]:n},{notifyTiming:key==='settle'||key==='fade'});}
      el.value=options.format?options.format(state[key]):String(state[key]);
      if(key==='carrier'){const f=S.frequencies(state);if(f.raised){setState({carrier:f.effectiveCarrier});el.value=state.carrier.toFixed(1);}}
    }
    el.addEventListener('blur',commit);
    el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();el.blur();}if(e.key==='Escape'){dirty=false;el.value=options.format?options.format(state[key]):String(state[key]);el.blur();}});
  }
  function changeDuration(minutes){setState(S.withDuration(state,Math.max(1,Math.min(90,minutes)),{preserveCustom:phasesEdited}),{notifyTiming:true});}
  async function copyLink(){
    writeURL();try{await navigator.clipboard.writeText(canonicalURL());toast('Link copied');}catch(_){toast('Could not copy. Select the address bar instead.',true);}
  }
  function openDialog(id){$(id).showModal();}
  function closeDialog(dialog){if(dialog.id==='export-dialog'&&exportController)exportController.abort();dialog.close();}
  function savePreset(e){
    e.preventDefault();const name=$('preset-name').value.trim();
    if(!name||name.length>40){$('save-error').textContent='Name must be 1–40 characters.';$('save-error').hidden=false;return;}
    const existing=storage.presets.find(p=>p.name.toLocaleLowerCase()===name.toLocaleLowerCase());
    if(existing&&!window.confirm('Replace your saved preset “'+existing.name+'”?'))return;
    if(!existing&&storage.presets.length>=24){$('save-error').textContent='Remove a saved preset first (limit 24).';$('save-error').hidden=false;return;}
    const slug=existing?existing.slug:S.slugify(name,storage.presets.map(p=>p.slug).concat(Object.keys(S.BUILT_INS)));
    const preset=Object.assign({},state,{slug,name,builtIn:false,preset:slug,createdAt:existing?.createdAt||new Date().toISOString()});
    if(existing)storage.presets=storage.presets.map(p=>p.slug===slug?preset:p);else storage.presets.push(preset);
    state=Object.assign({},state,{preset:slug});
    const saved=persist();queueSave();writeURL();$('save-dialog').close();render();if(saved)toast('Preset saved on this device');else toast('Could not save presets in this browser. Kept for this visit only.',true);
  }
  function exportSize(){const min=Math.max(1,Math.min(90,Number($('export-minutes').value)||10));const rate=Number($('export-rate').value),depth=Number($('export-depth').value);const mb=min*60*rate*2*(depth/8)/1e6;$('export-size').textContent=shortTime(min*60)+' · Stereo · About '+Math.round(mb)+' MB';}
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  async function exportWav(e){
    e.preventDefault();if(live.playing||exportController)return;
    const minutes=Number($('export-minutes').value),rate=Number($('export-rate').value),depth=Number($('export-depth').value);
    if(!Number.isFinite(minutes)||minutes<1||minutes>90){$('export-error').textContent='Choose a duration from 1 to 90 minutes.';$('export-error').hidden=false;return;}
    if(minutes>30&&!window.confirm('This export is over 30 minutes and can use substantial memory. At 44.1 kHz / 16-bit, 90 minutes is about 954 MB. Continue?'))return;
    const exportState=state.minutes===minutes?state:S.withDuration(state,minutes,{preserveCustom:phasesEdited});
    exportController=new AbortController();$('export-error').hidden=true;$('export-progress').hidden=false;$('cancel-export').hidden=false;$('export-submit').disabled=true;
    ['export-rate','export-depth','export-minutes'].forEach(id=>$(id).disabled=true);
    prefs.lastExportRate=rate;prefs.lastExportDepth=depth;setState({exportRate:rate,exportDepth:depth});persist();
    try{
      const result=await A.renderWav(exportState,{sampleRate:rate,bitDepth:depth,signal:exportController.signal,onProgress:n=>{$('export-progress-bar').value=n;$('export-progress-label').textContent=n>=99?'Preparing your download…':n<5?'Preparing audio…':'Rendering audio · approximately '+Math.floor(n)+'%';}});
      downloadBlob(result.blob,result.filename);$('export-progress-label').textContent='Your WAV is ready.';toast('WAV exported');
    }catch(err){$('export-error').textContent=err.code==='E008'?'Export stopped.':err.message||'Could not render this session. Try a shorter duration.';$('export-error').hidden=false;}
    finally{exportController=null;$('cancel-export').hidden=true;$('export-submit').disabled=false;['export-rate','export-depth','export-minutes'].forEach(id=>$(id).disabled=false);}
  }
  function downloadApp(){
    const copy=new DOMParser().parseFromString(originalHTML,'text/html');
    copy.getElementById('current-boot').textContent=JSON.stringify(S.normalize(state));
    const html='<!doctype html>\n'+copy.documentElement.outerHTML;
    downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),'current-offline.html');toast('Offline copy downloaded');
  }

  $('start').addEventListener('click',togglePlayback);$('mobile-start').addEventListener('click',togglePlayback);
  $('test-left').addEventListener('click',()=>testChannel('left'));$('test-right').addEventListener('click',()=>testChannel('right'));
  $('copy-link').addEventListener('click',copyLink);$('download-app').addEventListener('click',downloadApp);
  $$('[data-mode]').forEach(el=>el.addEventListener('click',()=>setState({mode:el.dataset.mode})));
  $$('[data-preset]').forEach(el=>el.addEventListener('click',()=>loadPreset(el.dataset.preset)));
  $$('[data-beat]').forEach(el=>el.addEventListener('click',()=>{setState({beat:Number(el.dataset.beat)});if(state.beat>=30&&state.mode==='binaural')toast('Try isochronic mode for a clearer pulse at this frequency.');}));
  $$('[data-minutes]').forEach(el=>el.addEventListener('click',()=>changeDuration(Number(el.dataset.minutes))));
  [['carrier','carrier'],['beat','beat'],['volume','volume'],['pulse','pulse'],['pulse-depth','pulseDepth']].forEach(([id,key])=>$(id).addEventListener('input',()=>setState(key==='pulse'?{pulse:Number($(id).value),tempo:'steady'}:{[key]:Number($(id).value)})));
  bindNumeric('carrier-number','carrier',{format:n=>n.toFixed(1)});bindNumeric('beat-number','beat',{format:n=>n.toFixed(2)});
  bindNumeric('volume-number','volume',{transform:n=>n/100,format:n=>String(Math.round(n*100))});
  bindNumeric('minutes','minutes',{duration:true,min:1,max:90,format:n=>n?String(n):'Off'});
  bindNumeric('pulse-number','pulse');bindNumeric('settle','settle');bindNumeric('fade','fade');
  [['pulse-on','pulseOn'],['accent','accent'],['chord','chord']].forEach(([id,key])=>$(id).addEventListener('change',()=>setState({[key]:$(id).checked})));
  $('center-beat').addEventListener('change',()=>setState({align:$('center-beat').checked?'center':'right'}));
  ['brown','pink','rain'].forEach(n=>{
    $('noise-'+n).addEventListener('change',()=>{const noise=state.noise.filter(x=>x!==n);if($('noise-'+n).checked)noise.push(n);setState({noise,noiseGain:Object.assign({},state.noiseGain,{[n]:state.noiseGain[n]??S.NOISE_DEFAULTS[n]})});});
    $('gain-'+n).addEventListener('input',()=>setState({noiseGain:Object.assign({},state.noiseGain,{[n]:Number($('gain-'+n).value)})}));
  });
  $('wake-lock').addEventListener('change',()=>{prefs.wakeLock=$('wake-lock').checked;if(prefs.wakeLock)requestWakeLock();else releaseWakeLock();persist();});
  $('reduce-motion').addEventListener('change',()=>{prefs.reduceMotion=$('reduce-motion').checked;persist();render();});
  mediaReduce.addEventListener('change',()=>render());
  $('dismiss-safety').addEventListener('click',()=>{storage.dismissedSafety=true;persist();render();});
  $('save-preset').addEventListener('click',()=>{$('preset-name').value='';$('save-error').hidden=true;openDialog('save-dialog');});
  $('save-form').addEventListener('submit',savePreset);
  $('open-shortcuts').addEventListener('click',()=>openDialog('shortcuts-dialog'));
  $('open-about').addEventListener('click',()=>openDialog('about-dialog'));
  $('open-export').addEventListener('click',()=>{if(live.playing)return;$('export-minutes').value=state.minutes||10;$('export-rate').value=state.exportRate;$('export-depth').value=state.exportDepth;$('export-error').hidden=true;$('export-progress').hidden=true;exportSize();openDialog('export-dialog');});
  ['export-rate','export-depth','export-minutes'].forEach(id=>$(id).addEventListener('input',exportSize));
  $('export-form').addEventListener('submit',exportWav);$('cancel-export').addEventListener('click',()=>exportController?.abort());
  $$('.dialog-close').forEach(el=>el.addEventListener('click',()=>closeDialog(el.closest('dialog'))));
  $$('dialog').forEach(dialog=>{dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog(dialog);});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(dialog);}});});
  document.addEventListener('keydown',e=>{
    const dialog=document.querySelector('dialog[open]');
    if(dialog){if(e.key==='Escape'){e.preventDefault();closeDialog(dialog);}return;}
    const typing=e.target.closest('input,textarea,select,[contenteditable=true]');
    if(e.key==='Escape'){if(typing)e.target.blur();if(live.playing)engine.stop();return;}
    if(typing||e.ctrlKey||e.metaKey||e.repeat)return;
    const focusedButton=e.target.closest('button,a,summary');
    if((e.key===' '||e.key==='Enter')&&focusedButton)return;
    const key=e.key.toLowerCase();let handled=true;
    if(key===' '){togglePlayback();}
    else if(key==='arrowup'||key==='arrowdown'){const step=e.altKey?.1:e.shiftKey?10:1;setState({carrier:state.carrier+(key==='arrowup'?step:-step)});}
    else if(key==='arrowright'||key==='arrowleft'){const step=e.altKey?.01:e.shiftKey?1:.1;setState({beat:state.beat+(key==='arrowright'?step:-step)});}
    else if(key==='m'){const modes=['binaural','isochronic','monaural'];setState({mode:modes[(modes.indexOf(state.mode)+1)%3]});}
    else if(key==='p')setState({pulseOn:!state.pulseOn});
    else if(key==='['||key===',')setState({volume:state.volume-.05});
    else if(key===']'||key==='.')setState({volume:state.volume+.05});
    else if(key==='1')loadPreset('calm-current');
    else if(key==='2')loadPreset('golden-lift');
    else if(key==='l')testChannel('left');
    else if(key==='r')testChannel('right');
    else if(key==='c')copyLink();
    else if(key==='?')openDialog('shortcuts-dialog');
    else handled=false;
    if(handled)e.preventDefault();
  });
  document.addEventListener('visibilitychange',async()=>{
    if(document.visibilityState==='hidden'){releaseWakeLock();persist();return;}
    if(live.playing){try{await engine.resume();}catch(_){}live=engine.getSnapshot();renderTransport();if(live.contextState!=='running')toast('Audio was paused by the phone. Tap Resume to continue.',true);else requestWakeLock();}
  });
  window.addEventListener('pagehide',persist);
  window.addEventListener('popstate',()=>{state=S.fromURL(location.search,storage.presets).state;if(live.playing)engine.update(state);render();queueSave();});
  setInterval(()=>{
    live=engine.getSnapshot();renderTransport();
    const sec=Math.floor(live.remaining);
    if(live.playing&&sec!==lastClockSecond){lastClockSecond=sec;if(sec%30===0||sec<10)announce(live.phase+'. '+formatTime(live.remaining)+' remaining.');}
  },250);
  if(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)) $('ios-hint').hidden=false;
  engine.update(state);render();writeURL();parsed.warnings.forEach((message,i)=>setTimeout(()=>toast(message),i*5200));
  if(!('AudioContext' in window)&&!('webkitAudioContext' in window))onAudioError('This browser cannot create an audio engine. Try a recent Chrome, Firefox, Edge or Safari.','E001');
  if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
