# Current

**A personal browser sound studio. Twelve listening presets, three beat modes, pure tones, and a little space to listen.**

Current implements the independent Current build briefing under its own name and visual identity. It synthesizes audio locally with the Web Audio API. There is no backend, account, package installation, runtime dependency, or API key.

The ready-to-use deliverable is **`index.html`**: a self-contained page with its CSS, JavaScript, icons, and player artwork included. Open it in a desktop browser and press **Start**. Audio never starts automatically.

## Release status

**Current is live:** [8-nticlab.vercel.app/apps/current/](https://8-nticlab.vercel.app/apps/current/). The ten-preset expansion described below is implemented in the working source; its focused browser/audio checks and production publication are still awaiting completed results.

The [source is published on `main`](https://github.com/REMgm/8NTICLAB/tree/main/apps/current) in the public **`REMgm/8NTICLAB`** product repository, isolated under **`apps/current`**. Verified initial production implementation: **`090a2fc594a6dc6e9279d4237db8bcba2dd1ce9b`**. The repository's existing Git integration completed that Vercel production deployment after a guarded fast-forward; the existing root site remained byte-for-byte unchanged.

For that initial release, the public page matched the released HTML. Live Chromium verified silent startup, gesture-driven playback, faded Stop, the scoped service worker, and offline navigation and playback of a shared Golden Lift session, with no page errors. Those measurements are retained as release evidence; they do not establish that a later source change passed the same checks.

See [ACCEPTANCE.md](ACCEPTANCE.md) for completed measurements and the remaining physical-device limitations.

## Use it

1. Open [Current online](https://8-nticlab.vercel.app/apps/current/), or open `index.html` in a recent desktop browser.
2. Use stereo headphones for **Binaural** mode. **Isochronic**, **Monaural**, and **Pure tone** also work with speakers.
3. Leave the default Calm Current session selected, choose a session from the preset menu, or open **Explore all 12 presets** for the complete library.
4. Press **Start** and adjust your device to a comfortable, low listening level.
5. Shape the carrier, beat, volume, and optional background layers. Follow the optional breathing guide on Rizz Mode or Body Bass. Press **Stop** to end the session with a smooth fade.

Keep the volume comfortable and never listen while driving. Preset names and purpose labels describe the intended listening ritual, not a promised effect.

No installation or development server is needed for the portable file. A hosted version uses the same page. Phones may restrict direct HTML file opening, audio in background tabs, or playback while the device is locked; the HTTPS version is the intended mobile entry point.

## Audio and session controls

| Mode | Signal | Frequency display |
| --- | --- | --- |
| Binaural | Separate continuous sine tones in the left and right channels | Normally `carrier − beat/2` and `carrier + beat/2`; Golden Lift can use left `carrier`, right `carrier + beat` |
| Isochronic | One carrier tone with a smooth amplitude pulse at the beat rate | Both channels use the carrier frequency |
| Monaural | The two tone frequencies mixed into both channels | Both component frequencies are shown |
| Pure tone / drone | One continuous sine tone in both channels, with no beat or BPM pulse | Both channels use the carrier frequency |

Carrier controls span **60–600 Hz** for the three beat modes and **40–600 Hz** for pure tones. The beat spans **0.5–40 Hz** in binaural mode and **0.5–100 Hz** in isochronic and monaural modes. Pure tones force the beat to zero and turn off the BPM pulse, accent, and chord. A low carrier is raised internally when needed to keep the lowest beat-mode component at 40 Hz. The actual sounding frequencies are displayed and exported in session links.

The volume starts at **25%** of full-scale gain and is capped at **60%**. This is a software gain limit, not a guarantee about headphone sound pressure: the device, amplifier, and headphones still determine the physical listening level. Frequency and gain changes are smoothed; mode changes crossfade.

The native compressor is followed by a fixed **0.40 output gain** to counter its standard automatic makeup gain. This conservative attenuation applies to playback, channel checks, and WAV rendering. With the configured −12 dB threshold, the compensation keeps the compressor/output stage's calculated maximum net gain below unity. See the [W3C Web Audio makeup-gain definition](https://www.w3.org/TR/webaudio-1.0/#computing-the-makeup-gain) and the implementation note in `src/engine.js`; reassess the bound if compressor settings change.

### Built-in sessions

All twelve presets are available in the menu and the expandable preset library. Loading a preset stays silent until **Start** is pressed. The ten requested additions are:

| Preset and purpose | Signal and exact frequencies | Duration | Listening details |
| --- | --- | --- | --- |
| **Main Character Energy — Positivity** | Binaural, carrier **220 Hz**, beat **10 Hz**, left/right **220 / 230 Hz** | **15 min** | Quiet **277 + 330 Hz** chord; steady **115 BPM** swell at 12% depth, with no fourth-beat accent |
| **Rizz Mode — Attraction** | Binaural, carrier **528 Hz**, beat **6 Hz**, left/right **525 / 531 Hz** | **10 min** | Optional **4-count inhale / 6-count exhale** guide; a pause before heading out |
| **Lucky Glitch — Lucky** | Isochronic, **300 Hz** carrier pulsed at **40 Hz** | **10 min** | Morning listening; headphones or speakers |
| **Aura Farming — Aura maxing** | Binaural: first carrier **136 Hz**, beat **7.83 Hz**, exact left/right **132.085 / 139.915 Hz**; then **220 / 230 Hz**, beat **10 Hz** | **10 min**, split **5 + 5** | Stage 1 **Ground**, stage 2 **Lift**; hum along gently if you like |
| **Locked In — Focus** | Binaural, carrier **200 Hz**, beat **15 Hz**, left/right **192.5 / 207.5 Hz** | **25 min** | A listening session for one work block |
| **Soft Life — Calm** | Binaural, carrier **110 Hz**, beat **4 Hz**, left/right **108 / 112 Hz** | **14 min** | Gentle **60 BPM** swell at 10% depth |
| **Dream Portal — Creative drift** | Binaural, carrier **150 Hz**, beat **6 Hz**, left/right **147 / 153 Hz** | **20 min** | Close your eyes if comfortable |
| **Deep Reset — Sleep** | Binaural, carrier **100 Hz**, beat **2 Hz**, left/right **99 / 101 Hz** | **30 min** | A gradual **5-minute fade** at the end |
| **Vibe Tuned — Warmth** | Pure **432 Hz** sine in both channels; **no beat** | **Untimed** | Stop whenever you like; no BPM pulse or chord |
| **Body Bass — Grounded** | Pure **50 Hz** sine in both channels; **no beat** | **10 min** | Optional **4-count inhale / 6-count exhale** guide; route device audio to a compatible vibration pad or chair |

The original presets remain available:

| Preset | Tones | Session phases | Pulse and layers |
| --- | --- | --- | --- |
| Calm Current | 110 Hz carrier, 4 Hz beat, centered: **108 / 112 Hz** | **14 minutes:** 2-minute Settle, 10-minute Core, 2-minute Fade | 60 BPM, 10% pulse depth; ambient layers off |
| Golden Lift | 220 Hz carrier, 10 Hz beat, right-aligned: **220 / 230 Hz** | **15 minutes:** 2-minute Settle, 11-minute Core, 2-minute Fade | 80 BPM in Settle, 115 BPM in Core, returning to 80 during Fade; fourth-beat accent and a quiet 277 + 330 Hz chord |

Golden Lift's **Centre the beat** switch changes the pair to **215 / 225 Hz**. Editing the tempo changes it to a steady pulse. Calm Current also has a compact 10-minute variant with 90-second Settle and Fade phases.

Aura's first tone pair is stored and synthesized at **132.085 / 139.915 Hz** to preserve the exact **7.83 Hz** difference. The screen rounds those readouts to **132.1 / 139.9 Hz**. At the default five-minute midpoint, both oscillators transition smoothly over 250 ms to **220 / 230 Hz**. The sequence is scheduled by the audio engine and is included in WAV exports; it does not depend on a browser timer firing at the midpoint. Changing the total duration divides it equally between the two stages. Editing the carrier, beat, or alignment changes Aura into a single custom sound. Its normal session envelope has a 10-second Settle and 10-second Fade.

The breathing guide is optional visual guidance: four seconds in, six seconds out, repeated against the audio clock. It pauses with a suspended audio context. It does not use the microphone or control breathing. Body Bass uses the device's ordinary audio output; Current has no direct vibration-chair hardware connection or intensity control.

Session duration is editable from **1 to 90 minutes**, with an **Untimed** option. Custom Settle and Fade durations share the total with the derived Core phase; oversized edges are shortened proportionally. Timing edits during playback apply to the next session. Most presets use a 2-minute Settle and Fade; Aura uses 10 seconds each, Deep Reset uses a 5-minute Fade, and untimed Vibe Tuned has neither timed edge. WAV export always requires a finite duration, which can be selected separately from untimed playback.

### Included tools

- Linked frequency sliders and numeric inputs, with clamping and readable values.
- Delta, Theta, Alpha, Beta, and Gamma reference chips, plus a 7.83 Hz Schumann reference. These labels make no promise about a listener's brain activity.
- Independently adjustable, locally generated **brown noise, pink noise, and rain**. Enabled noise gains are capped at a combined 40%; no rain download is needed.
- Left and right headphone checks; a running session is briefly ducked during a check.
- Optional BPM pulse, fourth-beat accent, chord layer, and centered/right-aligned binaural tones.
- The two-stage Aura sequence and optional breathing setting survive saved presets, shared links, reloads, and portable-file downloads.
- Up to **24 personal presets**, with names up to 40 characters, overwrite confirmation, and deletion of user-created presets.
- **Copy link** to share the actual sound settings. The recipient does not need your locally saved preset.
- **WAV export** while stopped: stereo PCM, 44.1 or 48 kHz, 16 or 24 bit, selected duration, progress display, and cancellation. Long renders require substantial memory; shorter exports suit phones better.
- **Download offline copy**, containing the current sound settings and the complete player.
- A screen wake-lock preference, reduced-motion support, keyboard shortcuts, accessible dialogs, and persistent mobile transport controls.

Current provides session envelopes, Golden Lift's defined tempo progression, and Aura's two-stage pitch sequence. It does not provide a separate arbitrary pitch-glide editor, Pomodoro work/break scheduler, account system, or cloud sync.

## Privacy and offline use

Audio is generated and rendered on the device. The application does not add accounts, analytics, cookies, microphone access, or audio uploads. Presets, preferences, and the last sound settings use this browser's `localStorage`; they are not synchronized with another device or browser. Storage may be unavailable in restricted browsing contexts, and playback is designed to continue without it. Browser storage is not encrypted private vault storage.

A shared URL contains sound settings and a preset identifier where applicable. It does not contain listening history. As with any hosted page, the hosting provider can receive ordinary page requests and URLs; this app does not collect separate usage analytics.

There are two offline paths:

- **Portable file:** open the self-contained `index.html`, or use **Download offline copy**. Playing the saved file needs no network. Local-file storage and clipboard behavior depend on the browser.
- **Hosted page:** on HTTPS, `sw.js` caches the page for subsequent offline navigation after a successful first visit. It uses network-first navigation with a cached-page fallback. First-time offline access cannot fetch a page that has never been cached, and browser cache eviction can remove that copy.

The social cover is a hosting asset; it is not required for audio playback. The player artwork itself is embedded in the portable HTML.

## About the evidence

Current is for personal listening and makes no medical, therapeutic, or guaranteed entrainment claims. Names such as Lucky Glitch, Aura Farming, and Deep Reset are creative session labels; they do not establish effects on luck, attraction, aura, sleep, health, or brain activity. The application's **About the sound** dialog explains the three beat modes and pure tones, and links to the [2023 PLOS ONE systematic review of binaural beats and brainwave entrainment](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0286023). The page also includes listening cautions and a nonblocking first-use note.

## Files and optional development workflow

| Path | Purpose |
| --- | --- |
| `index.html` | Generated, ready-to-use portable application; publish this file |
| `src/index.template.html` | Semantic interface, copy, dialogs, and metadata |
| `src/styles.css` | Responsive visual system and accessibility preferences |
| `src/state.js` | Defaults, presets, normalization, URL serialization, and storage handling |
| `src/engine.js` | Web Audio synthesis, session scheduling, channel tests, and WAV rendering |
| `src/app.js` | UI behavior, transport, persistence, sharing, export, and wake lock |
| `assets/current-water.webp` | Generated player artwork, embedded during assembly |
| `assets/current-cover.jpg` / `.webp` | Generated launch/social cover |
| `assets/design-direction.webp` | Higgsfield-generated design reference board |
| `sw.js` | Hosted offline-page cache |
| `vercel.json` | Static hosting configuration and response headers |
| `tools/build.py` | Optional standard-library assembly of the readable sources into `index.html` |
| `tests/state.test.cjs` | Dependency-free state and serialization checks |
| `tests/audio-schedule.test.cjs` | Mocked graph, scheduling, lifecycle, and compensated-output checks |
| `tests/browser-check.cjs` | Real Chromium interaction, responsive, portable-file, and WAV-render checks using an already available Playwright installation |
| `tests/preset-browser-check.cjs` | Focused real-browser checks for all twelve preset selectors, breathing, live Aura midpoint/readout edits, stopped preset switching, local/shared/offline state, 50/432 Hz drones, and both stages of a complete ten-minute Aura WAV |
| `tests/test_ui.py` | Browser integration checks for an environment with Playwright and Chromium already available |
| `ACCEPTANCE.md` | Verification evidence, release status, and explicit limits |

**Only run the assembler after editing `src/` or the embedded artwork:**

```bash
python3 tools/build.py
```

It uses the Python standard library and writes the updated `index.html`. Consumers and the static host do not need to run it. Commit the regenerated HTML alongside source changes.

The state checks use Node's built-in runtime:

```bash
node tests/state.test.cjs
node tests/audio-schedule.test.cjs
```

For local hosted inspection, a standard static server is sufficient:

```bash
python3 -m http.server 8000
```

`http://localhost:8000` supports UI inspection; the app registers its service worker only on HTTPS. Do not equate an HTTP local-server test with verification of hosted offline caching.

## Verification status

### Ten-preset expansion

| Check | Current status |
| --- | --- |
| State and serialization suite | **46 checks passed**, including all twelve preset definitions, exact Aura frequencies, drone normalization, sequence timing, saved/shared new fields, preset identity independent of export format, and Aura duration/envelope preservation when Untimed is rejected |
| Focused preset browser harness | **Prepared; execution results pending**. Syntax checked with Node; real UI, breathing, drone, and Aura-render outcomes are not yet claimed |
| Existing browser regression suite | **Update rerun pending**; initial-release results below remain the baseline |
| New production publication and live HTTPS offline checks | **Pending for this expansion**; existing production route and Git integration are available |

Run the focused browser harness only in an environment with Playwright and Chromium already provisioned. It installs nothing:

```bash
node tests/preset-browser-check.cjs
```

`CURRENT_PLAYWRIGHT` can point to an existing Playwright package, `CURRENT_TEST_URL` can select a hosted page instead of the default local `index.html`, and `CURRENT_PRESET_RESULTS` can choose the JSON report path. The default report is `tests/preset-browser-results.json`. A real one-minute Aura session crosses its midpoint at 30 seconds to check active readouts through a volume change and manual beat edit. The two drone probes use one-minute finite exports with the session-edge envelopes removed for measurement; Vibe Tuned's actual playback preset remains untimed. Aura is also rendered for its full ten minutes and measured on both sides of the default five-minute boundary.

### Initial release verified on 14 November 2026

| Check | Status and scope |
| --- | --- |
| State and serialization suite | **36 checks passed**: defaults, frequency math, mode and volume caps, phase policies, noise scaling, URL round trips, and storage resilience |
| Audio scheduling checks | **Passed using mocked audio nodes/parameters**, including the compensated output path, rapid mode changes, timing, and lifecycle; these are not acoustic measurements |
| Real Chromium suite | **All 12 checks passed, with no uncaught application errors**: controls, persistence, layout, transport, portable files, measured audio, and full WAV renders |
| Responsive rendering | **Passed** at 320, 390, 768, and 1440 px without horizontal overflow; desktop/mobile screenshots reviewed |
| Portable offline copy | **Passed**: complete self-contained download, current-session restoration, playback, and a second download retaining changed settings |
| Final measured audio and WAV export | **Passed after output attenuation**: correct channel frequencies/routing, 10 Hz isochronic period, complete 14-minute 44.1 kHz/16-bit export, and one-minute 48 kHz/24-bit export |
| Physical headphones, iPhone/iPad Safari, background interruption, and wake lock | **Pending device validation** |
| GitHub and Vercel production | **Published on `main`; Vercel status SUCCESS** for production implementation `090a2fc594a6dc6e9279d4237db8bcba2dd1ce9b`; public HTML exactly matches the release |
| Current production route and HTTPS offline cache | **Passed live in Chromium**: silent startup, gesture Start/Stop, scoped service-worker control, offline Golden Lift navigation and playback, and zero page errors |
| Existing root site | **Unchanged**: HTTP 200 and the same 11,714-byte content/hash as before the release |

Update this table only from completed results. A desktop Chromium viewport test does not establish physical Safari or headphone behavior.

The full 12-check browser/DSP suite tested implementation commit **`645e618c346e43b0a3a17853985e9d38540bc27d`**. The production implementation **`090a2fc594a6dc6e9279d4237db8bcba2dd1ce9b`** incorporates cover/canonical-URL metadata and release evidence without changing playback behavior, and passed the live-hosted checks above. Detailed measured values, file sizes, and release hashes are recorded in [ACCEPTANCE.md](ACCEPTANCE.md).

## Publishing updates

The initial production release is complete. Future updates use the same existing Git-to-Vercel integration:

1. Keep Current isolated under **`apps/current`** in **`REMgm/8NTICLAB`**. Publish the reviewed sources, regenerated `index.html`, `sw.js`, assets, and documentation on the feature branch. Do not publish credentials, browser traces, authentication state, or private briefing exports.
2. Complete the acceptance checks. Inspect the latest feature and `main` heads and the additive diff. If `main` has not diverged, fast-forward it to the exact reviewed commit using the expected previous SHA. Preserve all existing root files and unrelated applications; do not force-overwrite concurrent changes.
3. Let the repository's **existing Git-to-Vercel integration** deploy that main-branch commit. Check its Vercel commit status through completion. No new project, credentials, build command, package installation, or environment variables are required.
4. Verify the public Current page at **`https://8-nticlab.vercel.app/apps/current/`**. Confirm that it serves the released HTML, the root site's content is unchanged, audio requires a gesture, session links resolve under the app path, and the scoped service worker supports a subsequent offline visit.
5. Record the actual production verification and released commit in this README and `ACCEPTANCE.md`.

The repository root remains the existing static site. Current's files use app-relative paths so the player can live in its subdirectory. The app's nested `vercel.json` is available for a future standalone deployment; the existing root integration is the publishing path for this release, and no new response-header configuration is claimed without checking the deployed responses.

## Design and asset provenance

The interface uses an independent Current identity: deep blue-black surfaces, restrained teal controls, a warm gold accent for Golden Lift, and a quiet water image. See [DESIGN.md](DESIGN.md) for the design decisions, exact color values, and Higgsfield generation job provenance.
