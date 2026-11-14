#!/usr/bin/env python3
"""Current integration checks in an isolated Chromium profile.

Requires the already-installed Python Playwright package and Chromium; no downloads.
Run against a local server or a deployed preview:
    python tests/test_ui.py --url http://127.0.0.1:8000

These tests exercise a desktop browser at responsive viewport sizes. They do not
substitute for a physical iPhone/Safari listening check. A failed browser launch is
a failed/unavailable check, never reported as a passing test.
"""
import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright


INSTRUMENT_AUDIO = """(() => {
  window.__currentQaContexts = [];
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const Original = window[name];
    if (!Original) continue;
    window[name] = new Proxy(Original, {
      construct(Target, args) {
        const context = Reflect.construct(Target, args);
        window.__currentQaContexts.push(context);
        return context;
      }
    });
  }
})();"""


async def run(args):
    artifacts = Path(args.artifacts).resolve()
    artifacts.mkdir(parents=True, exist_ok=True)
    results = []
    errors = []
    base = args.url.rstrip('/') + '/'

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=args.browser,
            headless=True,
            args=['--no-sandbox', '--disable-dev-shm-usage'],
        )
        context = await browser.new_context(
            viewport={'width': 1440, 'height': 1000},
            reduced_motion='reduce',
            accept_downloads=True,
        )
        await context.add_init_script(INSTRUMENT_AUDIO)
        page = await context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('dialog', lambda dialog: asyncio.create_task(dialog.accept()))

        async def visit(query=''):
            await page.goto(base + query, wait_until='load')
            await page.wait_for_function('!!window.CurrentState && !!window.CurrentAudio')

        async def set_number(selector, value):
            field = page.locator(selector)
            await field.fill(str(value))
            await field.press('Enter')
            await page.wait_for_timeout(350)

        async def state_from_url():
            return await page.evaluate('CurrentState.fromURL(location.search).state')

        async def check(name, work):
            try:
                await work()
                results.append({'name': name, 'status': 'PASS'})
                print('PASS', name, flush=True)
            except Exception as error:
                results.append({'name': name, 'status': 'FAIL', 'error': str(error)})
                print('FAIL', name, str(error), flush=True)
                await page.screenshot(path=str(artifacts / ('failed-' + str(len(results)) + '.png')), full_page=True)

        async def boot():
            await visit()
            assert await page.locator('#start').get_attribute('aria-pressed') == 'false'
            assert await page.evaluate('window.__currentQaContexts.length') == 0, 'AudioContext created before a user gesture'
            assert await page.locator('#timer').inner_text() == '14:00'
            assert '108.0' in await page.locator('#left-frequency').inner_text()
            assert '112.0' in await page.locator('#right-frequency').inner_text()
            assert 'Theta' in await page.locator('#band-label').inner_text()
            assert await page.locator('#volume').input_value() == '0.25'
            assert not errors, '\n'.join(errors)

        async def caps():
            await visit()
            await set_number('#volume-number', 90)
            assert float(await page.locator('#volume').input_value()) == 0.6
            await set_number('#carrier-number', 900)
            assert float(await page.locator('#carrier').input_value()) == 600
            await set_number('#beat-number', 99)
            assert float(await page.locator('#beat').input_value()) == 40
            current = await state_from_url()
            assert current['volume'] == 0.6 and current['carrier'] == 600 and current['beat'] == 40
            await page.locator('[data-mode="isochronic"]').click()
            await set_number('#beat-number', 99)
            assert float(await page.locator('#beat').input_value()) == 99
            await page.locator('[data-mode="binaural"]').click()
            assert float(await page.locator('#beat').input_value()) == 40

        async def preset_frequencies():
            await visit()
            await page.locator('[data-preset="golden-lift"]').click()
            assert '220.0' in await page.locator('#left-frequency').inner_text()
            assert '230.0' in await page.locator('#right-frequency').inner_text()
            assert await page.locator('#timer').inner_text() == '15:00'
            await page.locator('#advanced').evaluate('(el) => { el.open = true; }')
            await page.locator('#center-beat').check()
            assert '215.0' in await page.locator('#left-frequency').inner_text()
            assert '225.0' in await page.locator('#right-frequency').inner_text()
            await page.locator('[data-preset="calm-current"]').click()
            await page.locator('[data-minutes="10"]').click()
            assert await page.locator('#settle-readout').inner_text() == '1:30'
            assert await page.locator('#core-readout').inner_text() == '7:00'
            assert await page.locator('#fade-readout').inner_text() == '1:30'

        async def query_restoration():
            await visit('?mode=monaural&carrier=60&beat=100&volume=0.6&minutes=2&settle=18&fade=18&pulseOn=1&pulse=93&noise=brown,pink,rain&noiseGain=0.4&foo=ignored')
            assert await page.locator('[data-mode="monaural"]').get_attribute('aria-pressed') == 'true'
            assert float(await page.locator('#beat').input_value()) == 100
            assert float(await page.locator('#volume').input_value()) == 0.6
            assert '40.0' in await page.locator('#live-readout').inner_text()
            assert '140.0' in await page.locator('#live-readout').inner_text()
            gains = [float(await page.locator('#gain-' + key).input_value()) for key in ['brown','pink','rain']]
            assert sum(gains) <= 0.40001
            await set_number('#carrier-number', 164.3)
            current = await state_from_url()
            url = page.url
            await page.goto(url, wait_until='load')
            restored = await state_from_url()
            assert current == restored
            assert float(await page.locator('#carrier-number').input_value()) == 164.3

        async def keyboard():
            await visit()
            await page.locator('h1').click()
            await page.keyboard.press('ArrowUp')
            assert float(await page.locator('#carrier').input_value()) == 111
            await page.keyboard.press('Shift+ArrowRight')
            assert float(await page.locator('#beat').input_value()) == 5
            await page.keyboard.press('Alt+ArrowRight')
            assert float(await page.locator('#beat').input_value()) == 5.01
            await page.keyboard.press('m')
            assert await page.locator('[data-mode="isochronic"]').get_attribute('aria-pressed') == 'true'
            await page.locator('#carrier-number').focus()
            await page.keyboard.press('m')
            assert await page.locator('[data-mode="isochronic"]').get_attribute('aria-pressed') == 'true', 'Typing triggered global shortcut'
            await page.keyboard.press('Escape')
            await page.locator('#open-shortcuts').click()
            assert await page.locator('#shortcuts-dialog').is_visible()
            await page.keyboard.press('Escape')
            assert not await page.locator('#shortcuts-dialog').is_visible()

        async def saved_presets():
            await visit()
            await set_number('#carrier-number', 136.1)
            await set_number('#beat-number', 7.83)
            await page.locator('#save-preset').click()
            await page.locator('#preset-name').fill('QA evening <quiet>')
            await page.locator('#save-form button[type="submit"]').click()
            await page.wait_for_timeout(650)
            assert await page.locator('.user-preset').count() == 1
            assert 'QA evening <quiet>' in await page.locator('#user-presets').inner_text()
            assert await page.locator('#user-presets quiet').count() == 0, 'Preset name parsed as markup'
            await page.reload(wait_until='load')
            assert await page.locator('.user-preset').count() == 1
            await page.locator('[data-preset="golden-lift"]').click()
            await page.locator('.user-preset > button').first.click()
            assert float(await page.locator('#carrier').input_value()) == 136.1
            assert float(await page.locator('#beat').input_value()) == 7.83
            await page.locator('.delete-preset').click()
            await page.wait_for_timeout(650)
            assert await page.locator('.user-preset').count() == 0
            await page.reload(wait_until='load')
            assert await page.locator('.user-preset').count() == 0
            assert await page.locator('[data-preset="calm-current"]').count() == 1
            assert await page.locator('[data-preset="golden-lift"]').count() == 1

        async def audio_lifecycle():
            await visit('?preset=calm-current&settle=0')
            await page.locator('#start').click()
            await page.wait_for_function("document.querySelector('#start').getAttribute('aria-pressed') === 'true'")
            assert await page.evaluate('window.__currentQaContexts.length') == 1
            assert await page.evaluate("window.__currentQaContexts[0].state") == 'running'
            assert await page.locator('#open-export').is_disabled()
            await page.locator('[data-mode="isochronic"]').click()
            await set_number('#beat-number', 10)
            await page.locator('[data-mode="monaural"]').click()
            await page.locator('#advanced').evaluate('(el) => { el.open = true; }')
            await page.locator('#test-left').click()
            await page.wait_for_timeout(750)
            assert await page.locator('#start').get_attribute('aria-pressed') == 'true'
            await page.locator('#start').click()
            await page.wait_for_function("document.querySelector('#start').getAttribute('aria-pressed') === 'false'")
            await page.wait_for_timeout(1200)
            assert not await page.locator('#start').is_disabled()
            assert not await page.locator('#open-export').is_disabled()
            assert not errors, '\n'.join(errors)

        async def mobile_layout():
            for width,height in [(390,844),(768,1024),(320,700)]:
                await page.set_viewport_size({'width':width,'height':height})
                await visit()
                metrics=await page.evaluate('({scroll:document.documentElement.scrollWidth,width:innerWidth})')
                assert metrics['scroll'] <= metrics['width'] + 1, f'Horizontal overflow at {width}: {metrics}'
                if width < 480:
                    assert await page.locator('#mobile-start').is_visible()
                    button=await page.locator('#mobile-start').bounding_box()
                    assert button['height'] >= 44 and button['width'] >= 44
                await page.screenshot(path=str(artifacts / f'current-{width}x{height}.png'),full_page=True)
            await page.set_viewport_size({'width':1440,'height':1000})

        async def offline_download():
            await visit()
            await page.locator('#advanced').evaluate('(el) => { el.open = true; }')
            async with page.expect_download() as download_info:
                await page.locator('#download-app').click()
            download=await download_info.value
            downloaded=artifacts/'current-offline.html'
            await download.save_as(str(downloaded))
            text=downloaded.read_text()
            assert 'CURRENT_APP' not in text and 'CURRENT_ENGINE' not in text and '@@WATER_IMAGE@@' not in text
            assert 'CurrentAudio' in text and 'CurrentState' in text
            await context.set_offline(True)
            try:
                await page.goto(downloaded.as_uri(),wait_until='load')
                await page.wait_for_function('!!window.CurrentState && !!window.CurrentAudio')
                await page.locator('#start').click()
                await page.wait_for_function("document.querySelector('#start').getAttribute('aria-pressed') === 'true'")
                await page.locator('#start').click()
                await page.wait_for_timeout(1250)
            finally:
                await context.set_offline(False)

        await check('Boot, exact Calm readouts, no autoplay',boot)
        await check('Input/URL caps and mode changes',caps)
        await check('Built-in frequencies, alignment, compact phases',preset_frequencies)
        await check('URL import, low carrier, noise cap and reload',query_restoration)
        await check('Keyboard controls and typing isolation',keyboard)
        await check('Preset save, literal names, restore and delete',saved_presets)
        if not args.skip_audio:
            await check('Gesture audio, live controls, tests and teardown',audio_lifecycle)
        await check('390px, 768px and 320px responsive overflow',mobile_layout)
        if not args.skip_audio:
            await check('Downloaded single HTML plays offline',offline_download)
        await browser.close()

    report={'browser':'Chromium','physical_phone_tested':False,'url':args.url,'results':results,'page_errors':errors}
    (artifacts/'ui-results.json').write_text(json.dumps(report,indent=2))
    failed=sum(item['status']=='FAIL' for item in results)
    print(f'\n{len(results)-failed} passed; {failed} failed. Results: {artifacts / "ui-results.json"}')
    return 1 if failed else 0


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--url',required=True)
    parser.add_argument('--browser',default='/usr/bin/chromium')
    parser.add_argument('--artifacts',default='tests/artifacts')
    parser.add_argument('--skip-audio',action='store_true',help='Only run interface checks; report contains no audio pass.')
    args=parser.parse_args()
    try:
        sys.exit(asyncio.run(run(args)))
    except Exception as error:
        print('UI verification could not complete:',error,file=sys.stderr)
        sys.exit(2)
