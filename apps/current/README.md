# Current

**A personal browser sound studio. Three tone modes, gentle sessions, and a little space to listen.**

Current implements the independent Current build briefing under its own name and visual identity. It synthesizes audio locally with the Web Audio API. There is no backend, account, package installation, runtime dependency, or API key.

The ready-to-use deliverable is **`index.html`**: a self-contained page with its CSS, JavaScript, icons, and player artwork included. Open it in a desktop browser and press **Start**. Audio never starts automatically.

## Release status

The application is published on a feature branch in the existing public **`REMgm/8NTICLAB`** product repository, isolated under **`apps/current`**. The repository's existing Git integration has already reported a successful Vercel preview deployment. Its existing root files and other applications are outside this change.

**Current's production release and public route verification are still pending.** After the reviewed commit is fast-forwarded to `main`, the existing Vercel integration deploys the repository. The expected Current URL is **`https://8-nticlab.vercel.app/apps/current/`**; this is a release target, not yet a verified production result. No new repository, separate Vercel project, or account authorization is required for this publishing path.

See [ACCEPTANCE.md](ACCEPTANCE.md) for completed checks and remaining validation. Use the publishing steps below, then record the verified production URL and commit.

## Use it

1. Open `index.html` in a recent browser.
2. Use stereo headphones for **Binaural** mode. **Isochronic** and **Monaural** also work with speakers.
3. Leave the default Calm Current session selected, or choose Golden Lift.
4. Press **Start** and adjust your device to a comfortable, low listening level.
5. Shape the carrier, beat, volume, and optional background layers. Press **Stop** to end the session with a smooth fade.

No installation or development server is needed for the portable file. A hosted version uses the same page. Phones may restrict direct HTML file opening, audio in background tabs, or playback while the device is locked; the HTTPS version is the intended mobile entry point.

## Audio and session controls

| Mode | Signal | Frequency display |
| --- | --- | --- |
| Binaural | Separate continuous sine tones in the left and right channels | Normally `carrier − beat/2` and `carrier + beat/2`; Golden Lift can use left `carrier`, right `carrier + beat` |
| Isochronic | One carrier tone with a smooth amplitude pulse at the beat rate | Both channels use the carrier frequency |
| Monaural | The two tone frequencies mixed into both channels | Both component frequencies are shown |

Carrier controls span **60–600 Hz**. The beat spans **0.5–40 Hz** in binaural mode and **0.5–100 Hz** in the other modes. A low carrier is raised internally when needed to keep the lowest component at 40 Hz. The actual sounding frequencies are displayed and exported in session links.

The volume starts at **25%** of full-scale gain and is capped at **60%**. This is a software gain limit, not a guarantee about headphone sound pressure: the device, amplifier, and headphones still determine the physical listening level. Frequency and gain changes are smoothed; mode changes crossfade.

The native compressor is followed by a fixed **0.40 output gain** to counter its standard automatic makeup gain. This conservative attenuation applies to playback, channel checks, and WAV rendering. With the configured −12 dB threshold, the compensation keeps the compressor/output stage's calculated maximum net gain below unity. See the [W3C Web Audio makeup-gain definition](https://www.w3.org/TR/webaudio-1.0/#computing-the-makeup-gain) and the implementation note in `src/engine.js`; reassess the bound if compressor settings change.

### Built-in sessions

| Preset | Tones | Session phases | Pulse and layers |
| --- | --- | --- | --- |
| Calm Current | 110 Hz carrier, 4 Hz beat, centered: **108 / 112 Hz** | **14 minutes:** 2-minute Settle, 10-minute Core, 2-minute Fade | 60 BPM, 10% pulse depth; ambient layers off |
| Golden Lift | 220 Hz carrier, 10 Hz beat, right-aligned: **220 / 230 Hz** | **15 minutes:** 2-minute Settle, 11-minute Core, 2-minute Fade | 80 BPM in Settle, 115 BPM in Core, returning to 80 during Fade; fourth-beat accent and a quiet 277 + 330 Hz chord |

Golden Lift's **Centre the beat** switch changes the pair to **215 / 225 Hz**. Editing the tempo changes it to a steady pulse. Calm Current also has a compact 10-minute variant with 90-second Settle and Fade phases.

Session duration is editable from **1 to 90 minutes**. Custom Settle and Fade durations share the total with the derived Core phase; oversized edges are shortened proportionally. Timing edits during playback apply to the next session. An untimed session is supported through `minutes=0` in the URL.

### Included tools

- Linked frequency sliders and numeric inputs, with clamping and readable values.
- Delta, Theta, Alpha, Beta, and Gamma reference chips, plus a 7.83 Hz Schumann reference. These labels make no promise about a listener's brain activity.
- Independently adjustable, locally generated **brown noise, pink noise, and rain**. Enabled noise gains are capped at a combined 40%; no rain download is needed.
- Left and right headphone checks; a running session is briefly ducked during a check.
- Optional BPM pulse, fourth-beat accent, chord layer, and centered/right-aligned binaural tones.
- Up to **24 personal presets**, with names up to 40 characters, overwrite confirmation, and deletion of user-created presets.
- **Copy link** to share the actual sound settings. The recipient does not need your locally saved preset.
- **WAV export** while stopped: stereo PCM, 44.1 or 48 kHz, 16 or 24 bit, selected duration, progress display, and cancellation. Long renders require substantial memory; shorter exports suit phones better.
- **Download offline copy**, containing the current sound settings and the complete player.
- A screen wake-lock preference, reduced-motion support, keyboard shortcuts, accessible dialogs, and persistent mobile transport controls.

Current provides session envelopes and Golden Lift's defined tempo progression. It does not provide a separate arbitrary pitch-glide editor, Pomodoro work/break scheduler, account system, or cloud sync.

## Privacy and offline use

Audio is generated and rendered on the device. The application does not add accounts, analytics, cookies, microphone access, or audio uploads. Presets, preferences, and the last sound settings use this browser's `localStorage`; they are not synchronized with another device or browser. Storage may be unavailable in restricted browsing contexts, and playback is designed to continue without it. Browser storage is not encrypted private vault storage.

A shared URL contains sound settings and a preset identifier where applicable. It does not contain listening history. As with any hosted page, the hosting provider can receive ordinary page requests and URLs; this app does not collect separate usage analytics.

There are two offline paths:

- **Portable file:** open the self-contained `index.html`, or use **Download offline copy**. Playing the saved file needs no network. Local-file storage and clipboard behavior depend on the browser.
- **Hosted page:** on HTTPS, `sw.js` caches the page for subsequent offline navigation after a successful first visit. It uses network-first navigation with a cached-page fallback. First-time offline access cannot fetch a page that has never been cached, and browser cache eviction can remove that copy.

The social cover is a hosting asset; it is not required for audio playback. The player artwork itself is embedded in the portable HTML.

## About the evidence

Current is for personal listening and makes no medical, therapeutic, or guaranteed entrainment claims. The application's **About the sound** dialog explains the three modes and links to the [2023 PLOS ONE systematic review of binaural beats and brainwave entrainment](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0286023). The page also includes listening cautions and a nonblocking first-use note.

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

As of this prepared release on **14 November 2026**:

| Check | Status and scope |
| --- | --- |
| State and serialization suite | **36 checks passed**: defaults, frequency math, mode and volume caps, phase policies, noise scaling, URL round trips, and storage resilience |
| Audio scheduling checks | **Passed using mocked audio nodes/parameters**, including the compensated output path, rapid mode changes, timing, and lifecycle; these are not acoustic measurements |
| Real Chromium suite | **All 12 checks passed, with no uncaught application errors**: controls, persistence, layout, transport, portable files, measured audio, and full WAV renders |
| Responsive rendering | **Passed** at 320, 390, 768, and 1440 px without horizontal overflow; desktop/mobile screenshots reviewed |
| Portable offline copy | **Passed**: complete self-contained download, current-session restoration, playback, and a second download retaining changed settings |
| Final measured audio and WAV export | **Passed after output attenuation**: correct channel frequencies/routing, 10 Hz isochronic period, complete 14-minute 44.1 kHz/16-bit export, and one-minute 48 kHz/24-bit export |
| Physical headphones, iPhone/iPad Safari, background interruption, and wake lock | **Pending device validation** |
| GitHub and Vercel preview | **Published feature branch; Vercel reports successful deployment**. Preview is authentication-protected, so public app delivery is not claimed from that status alone |
| Current production route and HTTPS offline cache | **Pending main-branch release and post-publication verification** |

Update this table only from completed results. A desktop Chromium viewport test does not establish physical Safari or headphone behavior.

The browser-tested implementation is commit **`645e618c346e43b0a3a17853985e9d38540bc27d`**; subsequent cover/canonical-URL metadata changes do not alter playback behavior. Detailed measured values, file sizes, and remaining production checks are recorded in [ACCEPTANCE.md](ACCEPTANCE.md).

## Publish to GitHub and Vercel

1. Keep Current isolated under **`apps/current`** in **`REMgm/8NTICLAB`**. Publish the reviewed sources, regenerated `index.html`, `sw.js`, assets, and documentation on the feature branch. Do not publish credentials, browser traces, authentication state, or private briefing exports.
2. Complete the acceptance checks. Inspect the latest feature and `main` heads and the additive diff. If `main` has not diverged, fast-forward it to the exact reviewed commit using the expected previous SHA. Preserve all existing root files and unrelated applications; do not force-overwrite concurrent changes.
3. Let the repository's **existing Git-to-Vercel integration** deploy that main-branch commit. Check its Vercel commit status through completion. No new project, credentials, build command, package installation, or environment variables are required.
4. Verify the public Current page at **`https://8-nticlab.vercel.app/apps/current/`**. Confirm that it serves the released HTML, the root site's content is unchanged, audio requires a gesture, session links resolve under the app path, and the scoped service worker supports a subsequent offline visit.
5. Record the actual production verification and released commit in this README and `ACCEPTANCE.md`.

The repository root remains the existing static site. Current's files use app-relative paths so the player can live in its subdirectory. The app's nested `vercel.json` is available for a future standalone deployment; the existing root integration is the publishing path for this release, and no new response-header configuration is claimed without checking the deployed responses.

## Design and asset provenance

The interface uses an independent Current identity: deep blue-black surfaces, restrained teal controls, a warm gold accent for Golden Lift, and a quiet water image. See [DESIGN.md](DESIGN.md) for the design decisions, exact color values, and Higgsfield generation job provenance.
