/* Browser checks run against the authored portable page in an isolated profile.
 * Uses an already provisioned Playwright. No package installation or remote code.
 */
const { chromium } = require(process.env.CURRENT_PLAYWRIGHT || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const results = [];
(async () => {
  const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context = await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce',acceptDownloads:true});
  await context.addInitScript(() => {
    window.__contexts = [];
    const Original = window.AudioContext;
    if(Original) window.AudioContext = new Proxy(Original,{construct(Target,args){const ctx=Reflect.construct(Target,args);window.__contexts.push(ctx);return ctx;}});
  });
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',dialog=>dialog.accept());
  const base='file://'+path.join(root,'index.html');
  const visit=async(query='')=>{await page.goto(base+query);await page.waitForFunction(()=>!!window.CurrentApp);};
  // The card library is deliberately collapsed; use the primary native selector.
  // A preset change may fade existing playback before applying its new state.
  const selectPreset=async(slug)=>{
    await page.locator('#preset-select').selectOption(slug);
    await page.waitForFunction(value=>{
      const select=document.getElementById('preset-select');
      return !select.disabled&&select.value===value&&CurrentApp.getState().preset===value;
    },slug);
  };
  const numeric=async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.locator('#'+id).press('Enter');await page.waitForTimeout(300);};
  async function check(name,fn){try{const detail=await fn();results.push({name,status:'PASS',detail});console.log('PASS '+name+(detail?' '+JSON.stringify(detail):''));}catch(e){results.push({name,status:'FAIL',error:e.message});console.log('FAIL '+name+' '+e.message);}}
  await check('Initial silent state and default frequencies',async()=>{
    await visit();assert.equal(await page.locator('#start').getAttribute('aria-pressed'),'false');
    assert.equal(await page.evaluate(()=>window.__contexts.length),0);
    assert.equal(await page.locator('#timer').innerText(),'14:00');
    assert.match(await page.locator('#left-frequency').innerText(),/108\.0/);assert.match(await page.locator('#right-frequency').innerText(),/112\.0/);
    assert.equal(await page.locator('#volume').inputValue(),'0.25');
  });
  await check('Preset alignment and 10-minute phase variant',async()=>{
    await selectPreset('golden-lift');
    assert.match(await page.locator('#left-frequency').innerText(),/220\.0/);assert.match(await page.locator('#right-frequency').innerText(),/230\.0/);
    await page.locator('#advanced summary').click();await page.locator('#center-beat').check();
    assert.match(await page.locator('#left-frequency').innerText(),/215\.0/);assert.match(await page.locator('#right-frequency').innerText(),/225\.0/);
    await selectPreset('calm-current');await page.locator('[data-minutes="10"]').click();
    assert.equal(await page.locator('#settle-readout').innerText(),'1:30');assert.equal(await page.locator('#core-readout').innerText(),'7:00');
  });
  await check('Volume, beat, carrier and URL input clamps',async()=>{
    await numeric('volume-number',90);assert.equal(await page.locator('#volume').inputValue(),'0.6');
    await numeric('carrier-number',900);assert.equal(await page.locator('#carrier').inputValue(),'600');
    await page.locator('[data-mode="isochronic"]').click();await numeric('beat-number',99);assert.equal(await page.locator('#beat').inputValue(),'99');
    await page.locator('[data-mode="binaural"]').click();assert.equal(await page.locator('#beat').inputValue(),'40');
    await visit('?mode=binaural&beat=80&volume=3&carrier=8&foo=ignore');
    const s=await page.evaluate(()=>CurrentApp.getState());assert.equal(s.beat,40);assert.equal(s.volume,.6);assert.equal(s.carrier,60);
  });
  await check('Noise cap and shared custom session roundtrip',async()=>{
    await visit('?mode=monaural&carrier=60&beat=100&volume=.2&minutes=2&settle=18&fade=18&noise=brown,pink,rain&noiseGain=.4&pulseOn=1&pulse=93');
    let s=await page.evaluate(()=>CurrentApp.getState());assert.ok(s.noise.reduce((a,k)=>a+s.noiseGain[k],0)<=.400001);
    assert.match(await page.locator('#left-frequency').innerText(),/40\.0/);assert.match(await page.locator('#right-frequency').innerText(),/140\.0/);
    await numeric('carrier-number',164.3);s=await page.evaluate(()=>CurrentApp.getState());const url=page.url();await page.goto(url);assert.deepEqual(await page.evaluate(()=>CurrentApp.getState()),s);
  });
  await check('Keyboard and text-field shortcut isolation',async()=>{
    await visit();await page.locator('h1').click();await page.keyboard.press('ArrowUp');assert.equal(await page.locator('#carrier').inputValue(),'111');
    await page.keyboard.press('Shift+ArrowRight');assert.equal(await page.locator('#beat').inputValue(),'5');
    await page.keyboard.press('Alt+ArrowRight');assert.equal(await page.locator('#beat').inputValue(),'5.01');
    await page.locator('#carrier-number').focus();await page.keyboard.press('m');assert.equal(await page.locator('[data-mode="binaural"]').getAttribute('aria-pressed'),'true');await page.keyboard.press('Escape');
    await page.locator('h1').click();
    for(const mode of ['isochronic','monaural','drone','binaural']){
      await page.keyboard.press('m');
      assert.equal(await page.locator('[data-mode="'+mode+'"]').getAttribute('aria-pressed'),'true');
      assert.equal(await page.evaluate(()=>CurrentApp.getState().mode),mode);
      if(mode==='drone'){
        assert.equal(await page.locator('#beat').inputValue(),'0');
        assert.equal(await page.locator('#beat').isDisabled(),true);
        assert.equal(await page.locator('#carrier').getAttribute('min'),'40');
        const before=await page.evaluate(()=>CurrentApp.getState().beat);
        await page.keyboard.press('ArrowRight');
        assert.equal(await page.evaluate(()=>CurrentApp.getState().beat),before);
      }
    }
    assert.equal(await page.locator('#beat').isDisabled(),false);
    assert.equal(await page.locator('#carrier').getAttribute('min'),'60');
    await page.locator('#open-shortcuts').click();assert.equal(await page.locator('#shortcuts-dialog').isVisible(),true);await page.keyboard.press('Escape');
  });
  await check('Safe local preset save, reload, delete and Golden tempo',async()=>{
    await visit();await selectPreset('golden-lift');
    await page.locator('#save-preset').click();await page.locator('#preset-name').fill('Evening <quiet>');await page.locator('#save-form button[type=submit]').click();
    assert.equal(await page.locator('[data-user-preset]').last().innerText(),'Evening <quiet>');
    assert.equal(await page.evaluate(()=>CurrentApp.getState().tempo),'golden');
    await page.reload();assert.equal(await page.locator('[data-user-preset]').last().innerText(),'Evening <quiet>');
    await page.locator('#advanced summary').click();await page.locator('#pulse-number').focus();await page.locator('h1').click();assert.equal(await page.evaluate(()=>CurrentApp.getState().tempo),'golden');await page.locator('#pulse-number').fill('99');await page.locator('#pulse-number').press('Escape');assert.equal(await page.evaluate(()=>CurrentApp.getState().tempo),'golden');await numeric('pulse-number',95);assert.equal(await page.evaluate(()=>CurrentApp.getState().tempo),'steady');
    await page.locator('.delete-preset').last().click();assert.equal(await page.locator('[data-user-preset]').count(),0);
  });
  await check('Start, live controls, stereo test, fade Stop, restart',async()=>{
    await visit('?preset=calm-current&settle=0&fade=0');await page.locator('#start').click();await page.waitForTimeout(350);
    assert.equal(await page.locator('#start').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#open-export').isDisabled(),true);
    await page.locator('[data-mode="isochronic"]').click();await numeric('beat-number',10);await page.locator('[data-mode="monaural"]').click();
    await page.locator('#advanced summary').click();await page.locator('#test-left').click();await page.waitForTimeout(600);
    await page.locator('#start').click();await page.waitForTimeout(1200);assert.equal(await page.locator('#start').getAttribute('aria-pressed'),'false');
    await page.locator('#start').click();await page.waitForTimeout(100);await page.keyboard.press('Escape');await page.waitForTimeout(1200);assert.equal(await page.locator('#start').getAttribute('aria-pressed'),'false');
  });
  await check('Responsive widths and reduced motion',async()=>{
    await visit();const widths=[320,390,768,1440];
    for(const width of widths){await page.setViewportSize({width,height:width===390?844:1024});await page.waitForTimeout(60);const sizes=await page.evaluate(()=>({page:document.documentElement.scrollWidth,view:innerWidth}));assert.ok(sizes.page<=sizes.view,JSON.stringify(sizes));}
    assert.ok(await page.evaluate(()=>document.body.classList.contains('reduced-motion')));
  });
  await check('Portable HTML download contains complete app and current session',async()=>{
    await visit('?preset=golden-lift&volume=.17');await page.locator('#advanced summary').click();
    const downloadPromise=page.waitForEvent('download');await page.locator('#download-app').click();const dl=await downloadPromise;const saved=path.join(root,'offline-check.html');await dl.saveAs(saved);
    const html=fs.readFileSync(saved,'utf8');assert.match(html,/data:image\/webp;base64,/);assert.match(html,/<script id="current-boot" type="application\/json">\{/);
    await page.goto('file://'+saved);assert.equal(await page.evaluate(()=>CurrentApp.getState().volume),.17);assert.equal(await page.evaluate(()=>CurrentApp.getState().tempo),'golden');
    await numeric('volume-number',21);await page.reload();assert.equal(await page.evaluate(()=>CurrentApp.getState().volume),.21);
    await page.locator('#advanced summary').click();const secondDownload=page.waitForEvent('download');await page.locator('#download-app').click();const second=await secondDownload;const savedAgain=path.join(root,'offline-check-again.html');await second.saveAs(savedAgain);await page.goto('file://'+savedAgain);assert.equal(await page.evaluate(()=>CurrentApp.getState().volume),.21);
    await page.locator('#start').click();await page.waitForTimeout(150);assert.equal(await page.locator('#start').getAttribute('aria-pressed'),'true');await page.locator('#start').click();await page.waitForTimeout(1200);
  });
  await check('Measured WAV spectra, routing, PCM headers and isochronic periods',async()=>{
    await visit();const measurements=await page.evaluate(async()=>{
      function amplitude(samples,rate,hz,from=1,seconds=2){let real=0,imag=0;const offset=Math.floor(from*rate),n=Math.floor(seconds*rate);for(let i=0;i<n;i++){const v=samples[offset+i];const phase=2*Math.PI*hz*i/rate;real+=v*Math.cos(phase);imag-=v*Math.sin(phase);}return 2*Math.hypot(real,imag)/n;}
      async function render(extra){const state=Object.assign({},CurrentState.DEFAULTS,{minutes:1,settle:0,fade:0,pulseOn:false,noise:[],chord:false},extra);const out=await CurrentAudio.renderWav(state);const bytes=await out.blob.arrayBuffer();const d=new DataView(bytes),rate=d.getUint32(24,true),frames=(bytes.byteLength-44)/4,channels=[new Float32Array(frames),new Float32Array(frames)];for(let i=0;i<frames;i++){channels[0][i]=d.getInt16(44+i*4,true)/32768;channels[1][i]=d.getInt16(46+i*4,true)/32768;}return {rate,frames,bits:d.getUint16(34,true),channelCount:d.getUint16(22,true),channels};}
      const calm=await render({});const [l,r]=calm.channels;
      const golden=await render({carrier:220,beat:10,align:'right',chord:true,tempo:'golden'});
      const center=await render({carrier:220,beat:10,align:'center'});
      const mono=await render({mode:'monaural'});
      const iso=await render({mode:'isochronic',carrier:220,beat:10});
      let channelDiff=0;for(let i=44100;i<88200;i++)channelDiff=Math.max(channelDiff,Math.abs(mono.channels[0][i]-mono.channels[1][i]));
      const rms=[];for(let n=44100;n<132300;n+=441){let sum=0;for(let j=0;j<441;j++)sum+=iso.channels[0][n+j]**2;rms.push(Math.sqrt(sum/441));}
      return {rate:calm.rate,bits:calm.bits,channels:calm.channelCount,duration:calm.frames/calm.rate,
        calmLeft108:amplitude(l,calm.rate,108),calmLeft112:amplitude(l,calm.rate,112),calmRight112:amplitude(r,calm.rate,112),calmRight108:amplitude(r,calm.rate,108),
        goldenLeft220:amplitude(golden.channels[0],golden.rate,220),goldenRight230:amplitude(golden.channels[1],golden.rate,230),chord277:amplitude(golden.channels[0],golden.rate,277),chord330:amplitude(golden.channels[0],golden.rate,330),
        centeredLeft215:amplitude(center.channels[0],center.rate,215),centeredRight225:amplitude(center.channels[1],center.rate,225),monauralChannelDiff:channelDiff,isoRms:rms.slice(0,30)};
    });
    assert.equal(measurements.rate,44100);assert.equal(measurements.bits,16);assert.equal(measurements.channels,2);assert.equal(measurements.duration,60);
    assert.ok(measurements.calmLeft108>.1&&measurements.calmRight112>.1);assert.ok(measurements.calmLeft112<.005&&measurements.calmRight108<.005);
    assert.ok(measurements.goldenLeft220>.1&&measurements.goldenRight230>.1);assert.ok(measurements.chord277>.005&&measurements.chord330>.005);
    assert.ok(measurements.centeredLeft215>.1&&measurements.centeredRight225>.1);assert.equal(measurements.monauralChannelDiff,0);
    const rms=measurements.isoRms;let best=0,bestErr=Infinity;for(let lag=7;lag<=13;lag++){let err=0;for(let i=0;i<rms.length-lag;i++)err+=(rms[i]-rms[i+lag])**2;if(err<bestErr){bestErr=err;best=lag;}}assert.equal(best,10);measurements.isoPeriodMs=best*10;delete measurements.isoRms;return measurements;
  });
  await check('Complete default 14-minute WAV and 48kHz 24-bit export',async()=>{
    const details=await page.evaluate(async()=>{
      async function header(blob){const d=new DataView(await blob.slice(0,44).arrayBuffer());return {bytes:blob.size,rate:d.getUint32(24,true),bits:d.getUint16(34,true),channels:d.getUint16(22,true),frames:d.getUint32(40,true)/(d.getUint16(22,true)*d.getUint16(34,true)/8)};}
      const full=await CurrentAudio.renderWav(CurrentState.DEFAULTS);
      const first=await header(full.blob);
      const tail=new DataView(await full.blob.slice(-44100*4).arrayBuffer());let peak=0;for(let i=0;i<tail.byteLength;i+=2)peak=Math.max(peak,Math.abs(tail.getInt16(i,true)/32768));first.lastSecondPeak=peak;
      const high=await CurrentAudio.renderWav({...CurrentState.DEFAULTS,minutes:1,settle:9,fade:9},{sampleRate:48000,bitDepth:24});
      return {default:first,highResolution:await header(high.blob)};
    });
    assert.equal(details.default.rate,44100);assert.equal(details.default.bits,16);assert.equal(details.default.channels,2);assert.equal(details.default.frames/44100,840);assert.equal(details.default.bytes,148176044);assert.ok(details.default.lastSecondPeak<.001);
    assert.equal(details.highResolution.rate,48000);assert.equal(details.highResolution.bits,24);assert.equal(details.highResolution.frames/48000,60);return details;
  });
  await check('No uncaught application errors',async()=>{assert.deepEqual(errors,[]);});
  await visit();await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:path.join(root,'desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'mobile.png'),fullPage:true});
  fs.writeFileSync(path.join(root,'browser-results.json'),JSON.stringify({results,errors,physicalPhoneTest:false},null,2));
  await browser.close();
  if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
})();
