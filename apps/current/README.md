# Current

**A personal browser sound studio. Three tone modes, gentle sessions, and a little space to listen.**

Current implements the independent Current build briefing under its own name and visual identity. It synthesizes audio locally with the Web Audio API. There is no backend, account, package installation, runtime dependency, or API key.

The ready-to-use deliverable is **`index.html`**: a self-contained page with its CSS, JavaScript, icons, and player artwork included. Open it in a desktop browser and press **Start**. Audio never starts automatically.

## Release status

The application and static hosting configuration are prepared. **Production deployment is pending.** The intended source destination is the isolated **`apps/current`** directory in the existing public **`REMgm/8NTICLAB`** product repository. Its existing root files and other applications are outside this change.

Use the publishing steps below, then record the verified production URL and commit. Credentials and consent links do not belong in this repository.

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
| `tests/test_ui.py` | Browser integration checks for an environment with Playwright and Chromium already available |

**Only run the assembler after editing `src/` or the embedded artwork:**

```bash
python3 tools/build.py
```

It uses the Python standard library and writes the updated `index.html`. Consumers and the static host do not need to run it. Commit the regenerated HTML alongside source changes.

The state checks use Node's built-in runtime:

```bash
node tests/state.test.cjs
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
| Audio scheduling checks | **Passed using mocked audio nodes/parameters**; validates scheduling logic, not acoustic output |
| Browser integration and responsive rendering | **Pending**; a test script is provided, but its presence is not a passing result |
| Real browser audio rendering and WAV output | **Pending** |
| Physical headphones, iPhone/iPad Safari, background interruption, and wake lock | **Pending device validation** |
| GitHub publication, Vercel deployment, and public HTTPS offline cache | **Pending access prerequisites and post-publication verification** |

Update this table only from completed results. A desktop Chromium viewport test does not establish physical Safari or headphone behavior.

## Publish to GitHub and Vercel

1. Use the existing public GitHub repository **`REMgm/8NTICLAB`** and add Current under **`apps/current`**. Read the latest `main` head before writing; base the new tree on that existing tree and use the expected branch-head SHA when updating the ref. Preserve all existing root files and unrelated app directories.
2. Publish the complete reviewed Current project, including the already assembled `index.html`, `sw.js`, assets, source, and documentation. Do not publish credentials, browser traces, authentication state, or private briefing exports.
3. Authorize the existing Vercel connection for the intended team through its supported consent flow, then inspect the team and project before release.
4. Create a separate Vercel project named **`current-audio`**, linked to `REMgm/8NTICLAB`. Use **Framework Preset: Other**, **no build command**, **no install command**, **Root Directory: `apps/current`**, and **Output Directory: `.`** relative to that app directory. The app's `vercel.json` supplies the static settings. No environment variables or server functions are needed. Do not retarget an existing Vercel project that serves the repository root or another application.
5. Deploy the reviewed commit to production. Verify that the deployment reaches READY, the production URL serves the correct version, playback starts only after a gesture, and a second visit works offline after the service worker has installed.
6. Record the actual production URL, repository URL, commit, and completed verification results in this README.

This source location is public. No custom domain or unrelated project settings need to be changed for this release. If a dedicated private repository is preferred later, copy this app directory to a new private `REMgm/current-audio` repository and set that new Vercel project's Root Directory to its repository root; the app itself needs no code changes.

## Design and asset provenance

The interface uses an independent Current identity: deep blue-black surfaces, restrained teal controls, a warm gold accent for Golden Lift, and a quiet water image. See [DESIGN.md](DESIGN.md) for the design decisions, exact color values, and Higgsfield generation job provenance.
