/* Focused acceptance checks for Current's ten-preset expansion.
 * Uses an already provisioned Playwright/Chromium; installs nothing.
 * Browser interactions use an isolated profile. Audio checks render the real
 * production Web Audio graph through renderWav, not a scheduling mock.
 *
 * CURRENT_PLAYWRIGHT: optional path to the existing Playwright package.
 * CURRENT_TEST_URL: optional hosted app URL; default is the portable index.html.
 * CURRENT_PRESET_RESULTS: optional JSON report path.
 */
'use strict';

const { chromium } = require(process.env.CURRENT_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const base = process.env.CURRENT_TEST_URL || pathToFileURL(path.join(root, 'index.html')).href;
const reportPath = process.env.CURRENT_PRESET_RESULTS || path.join(root, 'tests', 'preset-browser-results.json');
const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'current-presets-'));
const results = [], errors = [];

// Independent expected values from the requested listening sessions.
const presets = [
  {slug:'calm-current', mode:'binaural', carrier:110, beat:4, align:'center', minutes:14, left:108, right:112, pulseOn:true, pulse:60, pulseDepth:.10, chord:false, tempo:'steady', sequence:'none', breathing:'none'},
  {slug:'golden-lift', mode:'binaural', carrier:220, beat:10, align:'right', minutes:15, left:220, right:230, pulseOn:true, pulse:80, chord:true, tempo:'golden', sequence:'none', breathing:'none'},
  {slug:'main-character-energy', mode:'binaural', carrier:220, beat:10, align:'right', minutes:15, left:220, right:230, pulseOn:true, pulse:115, pulseDepth:.12, accent:false, chord:true, tempo:'steady', sequence:'none', breathing:'none'},
  {slug:'rizz-mode', mode:'binaural', carrier:528, beat:6, align:'center', minutes:10, left:525, right:531, pulseOn:false, chord:false, sequence:'none', breathing:'4-6'},
  {slug:'lucky-glitch', mode:'isochronic', carrier:300, beat:40, minutes:10, left:300, right:300, pulseOn:false, chord:false, sequence:'none', breathing:'none'},
  {slug:'aura-farming', mode:'binaural', carrier:136, beat:7.83, align:'center', minutes:10, settle:10, fade:10, left:132.085, right:139.915, pulseOn:false, chord:false, sequence:'aura', breathing:'none'},
  {slug:'locked-in', mode:'binaural', carrier:200, beat:15, align:'center', minutes:25, left:192.5, right:207.5, pulseOn:false, chord:false, sequence:'none', breathing:'none'},
  {slug:'soft-life', mode:'binaural', carrier:110, beat:4, align:'center', minutes:14, left:108, right:112, pulseOn:true, pulse:60, pulseDepth:.10, chord:false, sequence:'none', breathing:'none'},
  {slug:'dream-portal', mode:'binaural', carrier:150, beat:6, align:'center', minutes:20, left:147, right:153, pulseOn:false, chord:false, sequence:'none', breathing:'none'},
  {slug:'deep-reset', mode:'binaural', carrier:100, beat:2, align:'center', minutes:30, fade:300, left:99, right:101, pulseOn:false, chord:false, sequence:'none', breathing:'none'},
  {slug:'vibe-tuned', mode:'drone', carrier:432, beat:0, minutes:0, settle:0, fade:0, left:432, right:432, pulseOn:false, chord:false, sequence:'none', breathing:'none'},
  {slug:'body-bass', mode:'drone', carrier:50, beat:0, minutes:10, left:50, right:50, pulseOn:false, chord:false, sequence:'none', breathing:'4-6'}
];

async function check(name, work) {
  try {
    const detail = await work();
    results.push({name, status:'PASS', detail});
    console.log('PASS ' + name + (detail ? ' ' + JSON.stringify(detail) : ''));
  } catch (error) {
    results.push({name, status:'FAIL', error:error.message});
    console.error('FAIL ' + name + ': ' + error.message);
  }
}

function queryURL(query = '') {
  const url = new URL(base);
  url.search = query;
  url.hash = '';
  return url.href;
}

async function openDetails(page, selector) {
  const details = page.locator(selector);
  if (await details.getAttribute('open') === null) await details.locator('summary').click();
}

async function stop(page) {
  if (await page.evaluate(() => CurrentApp.getSnapshot().playing)) {
    await page.locator('#start').click();
    await page.waitForFunction(() => !CurrentApp.getSnapshot().playing && !CurrentApp.getSnapshot().stopping);
  }
}

function assertAuraState(state) {
  assert.equal(state.sequence, 'aura');
  assert.equal(state.breathing, '4-6');
  assert.equal(state.mode, 'binaural');
  assert.equal(state.carrier, 136);
  assert.equal(state.beat, 7.83);
  assert.equal(state.align, 'center');
  assert.equal(state.minutes, 10);
}

let browser;
(async () => {
  try {
    browser = await chromium.launch({headless:true, args:['--no-sandbox', '--disable-dev-shm-usage']});
    const context = await browser.newContext({viewport:{width:1440, height:1100}, reducedMotion:'reduce', acceptDownloads:true});
    await context.addInitScript(() => {
      window.__presetContexts = [];
      const Original = window.AudioContext;
      if (Original) window.AudioContext = new Proxy(Original, {
        construct(Target, args) {
          const ctx = Reflect.construct(Target, args);
          window.__presetContexts.push(ctx);
          return ctx;
        }
      });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    const visit = async (query = '') => {
      await page.goto(queryURL(query));
      await page.waitForFunction(() => !!window.CurrentApp && !!window.CurrentAudio && !!window.CurrentState);
    };

    await check('All twelve built-ins are available and load the requested settings', async () => {
      await visit();
      const expectedSlugs = presets.map(p => p.slug).sort();
      const menuSlugs = await page.locator('#preset-select option').evaluateAll(options => options.map(o => o.value).filter(Boolean));
      assert.deepEqual(menuSlugs.sort(), expectedSlugs);
      await openDetails(page, '#preset-library');
      const buttonSlugs = await page.locator('#preset-library [data-preset]').evaluateAll(buttons => buttons.map(b => b.dataset.preset));
      assert.deepEqual(buttonSlugs.sort(), expectedSlugs);
      for (const expected of presets) {
        await page.locator('#preset-select').selectOption(expected.slug);
        const state = await page.evaluate(() => CurrentApp.getState());
        assert.equal(state.preset, expected.slug);
        for (const [key, value] of Object.entries(expected)) {
          if (['slug', 'left', 'right'].includes(key)) continue;
          assert.equal(state[key], value, expected.slug + ': ' + key);
        }
        const frequencies = await page.evaluate(() => CurrentState.frequencies(CurrentApp.getState()));
        assert.ok(Math.abs(frequencies.left - expected.left) < 1e-8, expected.slug + ': precise left frequency');
        assert.ok(Math.abs(frequencies.right - expected.right) < 1e-8, expected.slug + ': precise right frequency');
        assert.equal(parseFloat(await page.locator('#left-frequency').innerText()), Number(expected.left.toFixed(1)), expected.slug + ': displayed left');
        assert.equal(parseFloat(await page.locator('#right-frequency').innerText()), Number(expected.right.toFixed(1)), expected.slug + ': displayed right');
        assert.equal(await page.locator('#start').getAttribute('aria-pressed'), 'false');
      }
      assert.equal(await page.evaluate(() => window.__presetContexts.length), 0, 'Selecting presets must not initialize live audio');
      await page.locator('#preset-library [data-preset="main-character-energy"]').click();
      assert.equal(await page.locator('#preset-select').inputValue(), 'main-character-energy');
      const main = await page.evaluate(() => CurrentApp.getState());
      assert.equal(main.tempo, 'steady');
      assert.equal(main.pulse, 115);
      assert.equal(main.chord, true);
      return {builtIns:12, newPresets:10, auraExactHz:[132.085,139.915], auraDisplayedHz:[132.1,139.9], mainBPM:115, vibeMinutes:0, bodyMinutes:10};
    });

    await check('Breathing guidance follows the audio-clock four-in six-out cycle', async () => {
      await visit('?preset=rizz-mode');
      assert.equal(await page.locator('#breathing-guide').isVisible(), true);
      await page.locator('#start').click();
      await page.waitForFunction(() => CurrentApp.getSnapshot().playing);
      await page.waitForFunction(() => /breathe in/i.test(document.querySelector('#breath-phase').textContent));
      assert.match(await page.locator('#breath-count').innerText(), /\d+\s*\/\s*4/);
      await page.waitForFunction(() => CurrentApp.getSnapshot().elapsed >= 4.35, null, {timeout:7000});
      await page.waitForFunction(() => /breathe out/i.test(document.querySelector('#breath-phase').textContent));
      assert.match(await page.locator('#breath-count').innerText(), /\d+\s*\/\s*6/);
      await stop(page);
      await page.locator('#preset-select').selectOption('body-bass');
      assert.equal(await page.locator('#breathing-guide').isVisible(), true);
      assert.equal(await page.evaluate(() => CurrentApp.getState().breathing), '4-6');
      return {inhaleSeconds:4, exhaleSeconds:6, guidedPresets:['rizz-mode','body-bass']};
    });

    await check('Live Aura readouts survive the midpoint, a volume edit, and manual tuning', async () => {
      // A real one-minute session exercises the UI boundary without faking the
      // audio clock. The separate full WAV probe verifies the default 300 s split.
      await visit('?preset=aura-farming&minutes=1&settle=0&fade=0');
      const configured = await page.evaluate(() => CurrentApp.getState());
      assert.equal(configured.minutes,1); assert.equal(configured.settle,0); assert.equal(configured.fade,0);
      await page.locator('#start').click();
      await page.waitForFunction(() => CurrentApp.getSnapshot().playing);
      await page.waitForFunction(() => {
        const current=CurrentApp.getSnapshot();
        return current.elapsed>=30.35 && current.stageIndex===2;
      }, null, {timeout:40000});
      const atLift = await page.evaluate(() => CurrentApp.getSnapshot());
      assert.equal(atLift.stageIndex,2); assert.equal(atLift.stageName,'Lift');
      assert.ok(Math.abs(atLift.left-220)<.001 && Math.abs(atLift.right-230)<.001);
      await page.waitForFunction(() => parseFloat(document.querySelector('#left-frequency').textContent)===220 && parseFloat(document.querySelector('#right-frequency').textContent)===230);
      assert.equal(parseFloat(await page.locator('#left-frequency').innerText()),220);
      assert.equal(parseFloat(await page.locator('#right-frequency').innerText()),230);
      assert.match(await page.locator('#band-label').innerText(),/10\.00\s*Hz/);
      assert.match(await page.locator('#sequence-guide').innerText(),/2\s*\/\s*2\s*·\s*Lift/);

      await page.locator('#volume-number').fill('20');
      await page.locator('#volume-number').press('Enter');
      assert.equal(await page.evaluate(() => CurrentApp.getState().volume),.20);
      assert.equal(parseFloat(await page.locator('#left-frequency').innerText()),220,'Full render must retain the active left tone');
      assert.equal(parseFloat(await page.locator('#right-frequency').innerText()),230,'Full render must retain the active right tone');
      assert.match(await page.locator('#band-label').innerText(),/10\.00\s*Hz/);
      assert.match(await page.locator('#sequence-guide').innerText(),/2\s*\/\s*2\s*·\s*Lift/);

      await page.locator('#beat-number').fill('12');
      await page.locator('#beat-number').press('Enter');
      const edited = await page.evaluate(() => CurrentApp.getState());
      assert.equal(edited.sequence,'none'); assert.equal(edited.carrier,220);
      assert.equal(edited.beat,12); assert.equal(edited.align,'right');
      await page.waitForFunction(() => {
        const current=CurrentApp.getSnapshot();
        return Math.abs(current.left-220)<.02 && Math.abs(current.right-232)<.02;
      }, null, {timeout:3000});
      await page.waitForFunction(() => parseFloat(document.querySelector('#left-frequency').textContent)===220 && parseFloat(document.querySelector('#right-frequency').textContent)===232);
      assert.match(await page.locator('#band-label').innerText(),/12\.00\s*Hz/);
      assert.equal(await page.locator('#sequence-guide').isVisible(),false);
      await stop(page);
      return {sessionSeconds:60,observedLiftSeconds:atLift.elapsed,stageIndex:2,stageHz:[220,230],volumeEditKeptReadouts:true,manualState:{carrier:220,beat:12,align:'right',sequence:'none'},manualHz:[220,232]};
    });

    await check('Selecting another preset fades the running sound and does not autoplay', async () => {
      await visit('?preset=main-character-energy');
      await page.locator('#start').click();
      await page.waitForFunction(() => CurrentApp.getSnapshot().playing);
      const fading = page.waitForFunction(() => CurrentApp.getSnapshot().stopping, null, {timeout:3000});
      await page.locator('#preset-select').selectOption('rizz-mode');
      await fading;
      await page.waitForFunction(() => {
        const current=CurrentApp.getSnapshot();
        return CurrentApp.getState().preset==='rizz-mode' && !current.playing && !current.stopping;
      });
      assert.equal(await page.locator('#start').getAttribute('aria-pressed'),'false');
      assert.equal(await page.locator('#preset-select').inputValue(),'rizz-mode');
      assert.equal(parseFloat(await page.locator('#left-frequency').innerText()),525);
      assert.equal(parseFloat(await page.locator('#right-frequency').innerText()),531);
      assert.equal(await page.evaluate(() => CurrentApp.getSnapshot().elapsed),0);
      return {from:'main-character-energy',to:'rizz-mode',fadeObserved:true,newPresetStopped:true};
    });

    await check('Aura sequence and breathing persist in a saved preset and fresh-context link', async () => {
      await visit('?preset=aura-farming&breathing=4-6');
      assert.equal(await page.locator('#sequence-guide').isVisible(), true);
      assertAuraState(await page.evaluate(() => CurrentApp.getState()));
      await page.locator('#save-preset').click();
      await page.locator('#preset-name').fill('QA Aura <two-stage>');
      await page.locator('#save-form button[type=submit]').click();
      assert.equal(await page.locator('[data-user-preset]').last().innerText(), 'QA Aura <two-stage>');
      const shared = page.url();
      assert.equal(new URL(shared).searchParams.get('sequence'), 'aura');
      assert.equal(new URL(shared).searchParams.get('breathing'), '4-6');
      await page.reload();
      await page.waitForFunction(() => !!window.CurrentApp);
      assertAuraState(await page.evaluate(() => CurrentApp.getState()));
      await page.locator('#preset-select').selectOption('calm-current');
      await page.locator('[data-user-preset]').last().click();
      assertAuraState(await page.evaluate(() => CurrentApp.getState()));
      const clean = await browser.newContext();
      try {
        const other = await clean.newPage();
        other.on('pageerror', error => errors.push(error.message));
        await other.goto(shared);
        await other.waitForFunction(() => !!window.CurrentApp);
        assertAuraState(await other.evaluate(() => CurrentApp.getState()));
        assert.equal(await other.locator('[data-user-preset]').count(), 0, 'Fresh context must not have the saved local preset');
      } finally { await clean.close(); }
      return {sequence:'aura', breathing:'4-6', savedPreset:true, freshContext:true};
    });

    await check('The offline Aura copy retains both new fields and plays without a network', async () => {
      await visit('?preset=aura-farming&breathing=4-6');
      await openDetails(page, '#advanced');
      const downloadPromise = page.waitForEvent('download');
      await page.locator('#download-app').click();
      const download = await downloadPromise;
      const filename = path.join(artifacts, 'current-aura-offline.html');
      await download.saveAs(filename);
      assert.match(fs.readFileSync(filename, 'utf8'), /data:image\/webp;base64,/);
      try {
        await context.setOffline(true);
        await page.goto(pathToFileURL(filename).href);
        await page.waitForFunction(() => !!window.CurrentApp);
        assertAuraState(await page.evaluate(() => CurrentApp.getState()));
        await page.locator('#start').click();
        await page.waitForFunction(() => CurrentApp.getSnapshot().playing);
        const live = await page.evaluate(() => CurrentApp.getSnapshot());
        assert.equal(live.sequence, 'aura');
        assert.equal(live.stageIndex, 1);
        assert.equal(live.stageCount, 2);
        await stop(page);
      } finally { await context.setOffline(false); }
      return {offline:true, sequence:'aura', breathing:'4-6', stageIndex:1, stageCount:2};
    });

    await check('Real stereo WAVs contain pure 50 Hz and 432 Hz drones with no beat', async () => {
      await visit();
      const measurements = await page.evaluate(async () => {
        const reports = [];
        for (const [slug, hz] of [['body-bass',50], ['vibe-tuned',432]]) {
          // A timed diagnostic export is needed for the untimed Vibe preset.
          // Keep its actual drone mode; remove only the session-edge envelopes.
          const state = {...CurrentState.BUILT_INS[slug], minutes:1, settle:0, fade:0};
          const output = await CurrentAudio.renderWav(state);
          const bytes = await output.blob.arrayBuffer();
          const view = new DataView(bytes), rate = view.getUint32(24,true);
          const channelCount = view.getUint16(22,true), bits = view.getUint16(34,true);
          const frames = view.getUint32(40,true) / (channelCount * bits / 8);
          let re=0, im=0, energy=0, channelDifference=0;
          const start=rate*2, n=rate*2;
          for (let i=0;i<n;i++) {
            const offset=44+(start+i)*4;
            const left=view.getInt16(offset,true)/32768, right=view.getInt16(offset+2,true)/32768;
            const angle=2*Math.PI*hz*i/rate;
            re+=left*Math.cos(angle); im-=left*Math.sin(angle); energy+=left*left;
            channelDifference=Math.max(channelDifference,Math.abs(left-right));
          }
          const amplitude=2*Math.hypot(re,im)/n, rms=Math.sqrt(energy/n);
          reports.push({slug,hz,rate,bits,channelCount,duration:frames/rate,amplitude,rms,purity:amplitude*amplitude/(2*rms*rms),channelDifference});
        }
        return reports;
      });
      for (const m of measurements) {
        assert.equal(m.rate,44100); assert.equal(m.bits,16); assert.equal(m.channelCount,2); assert.equal(m.duration,60);
        assert.ok(m.amplitude>.05 && m.amplitude<.26, m.slug+': tone amplitude');
        assert.ok(m.purity>.995, m.slug+': energy must be concentrated in the one requested tone');
        assert.equal(m.channelDifference,0, m.slug+': both channels carry the same tone');
      }
      return measurements;
    });

    await check('A real ten-minute Aura WAV changes tones at the five-minute boundary', async () => {
      await visit();
      const measured = await page.evaluate(async () => {
        const output = await CurrentAudio.renderWav(CurrentState.BUILT_INS['aura-farming']);
        const bytes = await output.blob.arrayBuffer();
        const view = new DataView(bytes), rate=view.getUint32(24,true), bits=view.getUint16(34,true), channels=view.getUint16(22,true);
        const frames=view.getUint32(40,true)/(channels*bits/8);
        function amplitude(channel,hz,startSeconds,seconds=4) {
          let re=0,im=0;
          const n=Math.round(seconds*rate), start=Math.round(startSeconds*rate);
          for(let i=0;i<n;i++) {
            const value=view.getInt16(44+(start+i)*4+channel*2,true)/32768;
            const angle=2*Math.PI*hz*i/rate;
            re+=value*Math.cos(angle); im-=value*Math.sin(angle);
          }
          return 2*Math.hypot(re,im)/n;
        }
        const before={fromSeconds:295,left132085:amplitude(0,132.085,295),right139915:amplitude(1,139.915,295),left139915:amplitude(0,139.915,295),right132085:amplitude(1,132.085,295),left220:amplitude(0,220,295),right230:amplitude(1,230,295)};
        const after={fromSeconds:301,left220:amplitude(0,220,301),right230:amplitude(1,230,301),left230:amplitude(0,230,301),right220:amplitude(1,220,301),left132085:amplitude(0,132.085,301),right139915:amplitude(1,139.915,301)};
        let largestAdjacentStep=0;
        for(let frame=Math.floor(299.9*rate);frame<Math.ceil(300.5*rate);frame++) {
          for(let channel=0;channel<2;channel++) {
            const now=view.getInt16(44+frame*4+channel*2,true)/32768;
            const next=view.getInt16(44+(frame+1)*4+channel*2,true)/32768;
            largestAdjacentStep=Math.max(largestAdjacentStep,Math.abs(next-now));
          }
        }
        return {rate,bits,channels,frames,duration:frames/rate,bytes:bytes.byteLength,before,after,largestAdjacentStep};
      });
      assert.equal(measured.rate,44100); assert.equal(measured.bits,16); assert.equal(measured.channels,2); assert.equal(measured.duration,600);
      assert.ok(measured.before.left132085>.05 && measured.before.right139915>.05, 'Stage one must sound at the exact centered 7.83 Hz pair');
      assert.ok(measured.before.left139915<measured.before.left132085*.1 && measured.before.right132085<measured.before.right139915*.1, 'Stage one channels must remain separate');
      assert.ok(measured.before.left220<.005 && measured.before.right230<.005, 'Stage two must not sound before the midpoint');
      assert.ok(measured.after.left220>.05 && measured.after.right230>.05, 'Stage two must sound at 220 / 230 Hz after the midpoint');
      assert.ok(measured.after.left230<.005 && measured.after.right220<.005, 'Stage two channels must remain separate');
      assert.ok(measured.after.left132085<.005 && measured.after.right139915<.005, 'Stage one tones must be absent after the transition');
      assert.ok(measured.largestAdjacentStep<.05, 'Midpoint transition must not contain a large sample discontinuity');
      return measured;
    });

    await check('No uncaught application errors during the preset expansion checks', async () => {
      assert.deepEqual(errors,[]);
    });
  } catch (error) {
    results.push({name:'Preset browser harness execution',status:'FAIL',error:error.message});
    console.error(error);
  } finally {
    if (browser) await browser.close();
    fs.mkdirSync(path.dirname(reportPath), {recursive:true});
    fs.writeFileSync(reportPath, JSON.stringify({createdAt:new Date().toISOString(),browser:'Chromium',input:base,results,errors,physicalPhoneTest:false},null,2));
    fs.rmSync(artifacts,{recursive:true,force:true});
    const failed=results.filter(result=>result.status==='FAIL').length;
    console.log(`${results.length-failed} passed; ${failed} failed. Report: ${reportPath}`);
    if(failed) process.exitCode=1;
  }
})();
