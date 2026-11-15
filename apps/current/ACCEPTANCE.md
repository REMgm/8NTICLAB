# Current — acceptance and release evidence

**Initial release verified:** 14 November 2026  
**Application path:** `REMgm/8NTICLAB/apps/current`  
**Live application:** [https://8-nticlab.vercel.app/apps/current/](https://8-nticlab.vercel.app/apps/current/)  
**Browser-tested implementation:** `645e618c346e43b0a3a17853985e9d38540bc27d`  
**Verified production implementation:** `090a2fc594a6dc6e9279d4237db8bcba2dd1ce9b`  
**Initial-release status:** Published and publicly verified. All 12 real Chromium checks passed, alongside 36 state checks and mocked scheduling checks. Live production playback and HTTPS offline navigation/playback also passed.  
**Ten-preset expansion status:** Implemented in the working source, with 46 state checks passed. Focused browser/audio results and production verification for the expansion are pending; the initial-release results below are not a blanket pass for the new implementation.

The production implementation includes cover/canonical-URL metadata and release evidence added after the full browser suite, without changes to playback behavior. Documentation-only commits may follow the verified production implementation without changing the application.

This report distinguishes completed checks from intended behavior. A test script's presence does not establish a pass, a mocked graph does not establish the sound of a real browser, and a successful preview deployment does not establish that Current is publicly accessible.

## Ten-preset expansion: specification and verification scope

The update retains Calm Current and Golden Lift and adds the following ten requested sessions. This table records the intended audio contract, not an efficacy claim about a preset's purpose label.

| Preset | Mode and carrier | Left / right frequencies or pulse | Duration and other settings |
| --- | --- | --- | --- |
| Main Character Energy | Binaural, 220 Hz | **220 / 230 Hz**, 10 Hz beat | **15 min**; **277 + 330 Hz** chord; steady **115 BPM** swell, 12% depth, no accent |
| Rizz Mode | Binaural, 528 Hz | **525 / 531 Hz**, 6 Hz beat | **10 min**; visual **4-in / 6-out** breathing guide |
| Lucky Glitch | Isochronic, 300 Hz | **40 Hz** amplitude pulse | **10 min** |
| Aura Farming | Binaural, first 136 Hz, then 220 Hz | Exact **132.085 / 139.915 Hz**, 7.83 Hz difference, then **220 / 230 Hz**, 10 Hz difference | **10 min**; default midpoint at **300 seconds**; 250 ms pitch transition; 10-second Settle and Fade |
| Locked In | Binaural, 200 Hz | **192.5 / 207.5 Hz**, 15 Hz beat | **25 min** |
| Soft Life | Binaural, 110 Hz | **108 / 112 Hz**, 4 Hz beat | **14 min**; **60 BPM** swell at 10% depth |
| Dream Portal | Binaural, 150 Hz | **147 / 153 Hz**, 6 Hz beat | **20 min** |
| Deep Reset | Binaural, 100 Hz | **99 / 101 Hz**, 2 Hz beat | **30 min**, including a **5-minute fade** |
| Vibe Tuned | Pure tone / drone, 432 Hz | Identical **432 Hz** signal in both channels, **zero beat** | **Untimed**; pulse, accent, and chord off |
| Body Bass | Pure tone / drone, 50 Hz | Identical **50 Hz** signal in both channels, **zero beat** | **10 min**; visual **4-in / 6-out** breathing guide; pulse, accent, and chord off |

The exact Aura pair is rounded to **132.1 / 139.9 Hz** only in the one-decimal UI. Synthesis and serialization preserve the **7.83 Hz** difference. The sequence uses native audio scheduling for live playback and the same graph for WAV export. A changed duration splits equally between the two stages; manual pitch/alignment edits leave the sequence. Body Bass does not directly integrate with haptic hardware: a compatible pad or chair receives the device's normal audio output.

The state fields `sequence: 'none' | 'aura'` and `breathing: 'none' | '4-6'` are part of the saved and shared sound. Drone mode forces beat zero and disables pulse, accent, and chord. The breathing guide follows the audio clock through a four-second inhale and six-second exhale; it is visual guidance, not a sensor or medical intervention.

| Expansion check | Status and scope |
| --- | --- |
| `tests/state.test.cjs` | **46 checks passed**, covering the new definitions, precise frequency math, drone invariants, Aura stage metadata, new-field URL/storage round trips, export-format-independent preset identity, and preservation of Aura duration/envelope when Untimed is rejected |
| `tests/audio-schedule.test.cjs` | Updated mocked scheduling checks reported passing by the engine implementation task; real rendered audio is a separate check |
| `tests/preset-browser-check.cjs` syntax | **Passed** with `node --check`; no browser pass inferred |
| All twelve menu/library selectors and visible exact/rounded readouts | Focused browser result pending |
| Real 4-in / 6-out UI cycle, saved preset, fresh-context shared link, and downloaded offline copy | Focused browser result pending |
| Live Aura midpoint/readouts, volume rerender, manual beat edit, and fade-before-loading a silent new preset | Focused browser result pending |
| Pure 50 Hz and 432 Hz drone WAVs | Real PCM measurement pending |
| Full ten-minute Aura WAV before and after 300 seconds | Real PCM measurement pending |
| Existing twelve-check browser regression suite against the expansion | Rerun pending |
| Expanded production deployment and live HTTPS offline playback | Pending |

The focused browser harness uses an already provisioned Playwright/Chromium installation and an isolated browser profile; it installs no dependencies. It checks both the native selector and the expandable twelve-button library, confirms silent preset loading, observes the first breathing cycle, saves and reloads a custom Aura session with breathing enabled, restores that sound in a fresh browser context, and downloads/plays its complete offline HTML with network access disabled.

A live Aura fixture uses a one-minute duration with zero Settle/Fade and waits for actual audio elapsed time to reach **30.35 seconds**. It must show stage **2 / 2 · Lift**, **220 / 230 Hz**, and the **10 Hz** beat. Editing volume must preserve those active readouts through a full UI render. Editing the beat to **12 Hz** must leave the sequence, retain the active **220 Hz / right-aligned** configuration, and settle at **220 / 232 Hz**. A separate interaction observes a running preset's faded stop before a newly selected preset loads silently. These are real audio-clock and UI checks, not an accelerated JavaScript timer simulation.

Its real-audio probes call the production `CurrentAudio.renderWav` graph. The two drone fixtures use a one-minute finite duration with zero Settle/Fade to measure a stable tone; this diagnostic override does not change Vibe Tuned's untimed default. They measure each tone's amplitude, concentration of energy at the requested frequency, and left/right equality. The Aura probe renders the complete **600-second** stereo **44.1 kHz / 16-bit** WAV and measures four-second windows beginning at **295 seconds** and **301 seconds**, plus adjacent-sample continuity around the midpoint. A pass must come from the resulting PCM, not from querying configured frequencies alone.

Reproduction in a prepared browser environment:

```bash
node tests/preset-browser-check.cjs
```

Optional environment variables are `CURRENT_PLAYWRIGHT` (existing package path), `CURRENT_TEST_URL` (hosted target; otherwise the local `index.html`), and `CURRENT_PRESET_RESULTS` (report path; otherwise `tests/preset-browser-results.json`). Record the completed report and released implementation before marking expansion checks passed.

## Initial-release evidence

The numbered sections below describe the previously verified implementation identified at the top of this report. Their precise measurements remain useful as the regression baseline, but do not replace the expansion checks above.

## 1. Completed state checks

**Result: 36 checks passed** in `tests/state.test.cjs`.

Coverage includes silent-ready Calm Current defaults, exact frequency formulas and band boundaries, Golden Lift alignment and tempo maps, invalid input handling, volume and mode caps, low-carrier normalization, generic and preset phase policies, proportional noise scaling, canonical URL round trips, user presets on another device, bounded preset names/counts, immutable built-ins, storage migration, and nonfatal unavailable storage.

Reproduction:

```bash
node tests/state.test.cjs
```

These checks exercise state logic. They do not create a browser audio output or measure headphones.

## 2. Completed audio scheduling checks

**Result: passed with mocked Web Audio nodes and parameters** in `tests/audio-schedule.test.cjs`.

The checks cover:

- Expected left/right frequencies and scheduled phase lengths.
- Volume and noise caps, including defensive normalization within the engine.
- 100 rapid mode switches without overlapping automation-curve errors.
- Left/right test scheduling, stop/restart cleanup, and running-session timing isolation.
- Golden Lift tempo persistence after save/rename, explicit steady-tempo overrides, and equal-BPM automation-mode changes.
- Frequency readouts that follow the oscillator's slew rather than immediately showing only its target.
- Fixed post-compressor attenuation in the live output and channel-test paths, including the calculated no-boost bound for the configured threshold.

Reproduction:

```bash
node tests/audio-schedule.test.cjs
```

The mock validates scheduling and graph structure. Real-browser measurements are listed separately below.

## 3. Completed Chromium interaction and layout checks

Real Chromium exercised the authored portable page in an isolated browser profile. **The complete suite finished with all 12 checks passing and no uncaught application errors.** Its interface and layout groups covered the following:

| Area | Completed observation |
| --- | --- |
| Initial state | Calm Current loads with the correct frequency readouts and does not autoplay |
| Presets and phases | Golden Lift's right-aligned and centered alternatives, plus Calm Current's compact 10-minute phases, match the intended values |
| Input boundaries | Carrier, beat, and volume controls clamp correctly; switching back to binaural clamps its beat range; URL inputs are normalized |
| Noise and sharing | Enabled noise gains respect the combined cap, low-carrier readouts reflect the effective tones, and custom settings survive a URL round trip |
| Keyboard operation | Carrier/beat adjustments and modifiers work; text entry does not trigger unrelated global shortcuts; dialogs close correctly |
| Local presets | Save, reload, restore, and delete work; a name containing angle brackets remains literal text; Golden tempo automation survives saving and reloading |
| Transport and live changes | Start, mode changes, frequency edits, channel checks, faded Stop, restart, and Escape handling work without an application failure in those cases |
| Responsive layout | No horizontal overflow at **320, 390, 768, or 1440 px**; reduced-motion state is applied |
| Visual review | Desktop and mobile screenshots were inspected for hierarchy, legibility, and fit |

The preset-save regression found in an earlier run was traced to reloading before a debounced URL update had been written. Preset saving now flushes the current URL immediately, and the formerly failing Golden tempo save/reload case passed on the subsequent run.

These are Chromium checks. They do not establish iOS Safari behavior or a complete accessibility conformance audit.

## 4. Completed portable-file checks

**Result: passed in Chromium.**

- The downloaded HTML contains the embedded water artwork, application source, and current-session boot data.
- Opening that file restores the intended settings and permits gesture-driven playback and Stop.
- Changing settings in the downloaded copy and reloading preserves the updated state.
- Downloading a second copy from that file retains the newly changed settings rather than reverting to the original boot snapshot.

This validates the self-contained file path. It does **not** validate service-worker caching on the production HTTPS route; that remains a separate release check.

## 5. Compressor output correction

The standard `DynamicsCompressorNode` includes automatic makeup gain, even though Current does not request a separate user-facing boost control. The implementation therefore places a fixed **0.40 gain stage after the compressor** in live playback, isolated channel checks, and offline rendering.

The [W3C Web Audio specification's makeup-gain algorithm](https://www.w3.org/TR/webaudio-1.0/#computing-the-makeup-gain) defines the gain from the compressor curve at full scale. With Current's −12 dB threshold and a monotone curve that is identity up to that threshold, the conservative bound is:

```text
maximum automatic makeup gain = (10^(-12/20))^(-0.6) ≈ 2.2909
maximum compensated gain      ≈ 0.91635 < 1
```

This addresses unintended gain from that stage; it is not a calibrated sound-pressure limiter for the user's headphones. Device volume, amplifiers, transducers, and browser behavior still matter. Any change to compressor parameters must revisit this bound. The rendered measurements below were obtained after this correction.

## 6. Final real-browser audio measurements

**Status: passed after the 0.40 attenuation change.** These are measured PCM outputs from real Chromium, not values produced by the scheduling mock.

The spectral probes render 60-second fixtures with zero Settle/Fade, the additional BPM pulse disabled, and ambient noise off. The Golden Lift probe enables its chord layer. The complete 14-minute export separately uses the unchanged default session and its envelopes.

| Check | Measured result | Status |
| --- | --- | --- |
| One-minute PCM WAV | 44.1 kHz, 16-bit, stereo, exactly 60 seconds | Pass |
| Calm Current stereo separation | Left 108 Hz amplitude **0.186920401**; right 112 Hz amplitude **0.186920111**; measured opposite-tone leakage at most **2.11 × 10⁻⁷** | Pass |
| Golden Lift | Left 220 Hz and right 230 Hz amplitudes approximately **0.18290**; 277/330 Hz chord amplitudes approximately **0.02164 / 0.02194** | Pass |
| Centered Golden Lift | 215/225 Hz channel amplitudes approximately **0.18692** | Pass |
| Monaural routing | Maximum measured left/right sample difference **0** | Pass |
| Isochronic rate | 10 Hz modulation produced a measured **100 ms** envelope period | Pass |
| Complete default export | Stereo 44.1 kHz/16-bit; **37,044,000 frames**, **840 seconds**, **148,176,044 bytes**; final-second peak **0.0000305176** | Pass |
| Higher-resolution export | Stereo 48 kHz/24-bit; **2,880,000 frames**, **60 seconds**, **17,280,044 bytes** | Pass |
| Final browser error collection | **No uncaught application errors** across all 12 checks | Pass |

Amplitudes above are dimensionless digital-signal measurements, not headphone sound-pressure levels. The probe results establish the configured tone frequencies, channel routing, modulation period, and file encoding for the tested implementation.

The real-browser suite is `tests/browser-check.cjs`, using an already available Chromium/Playwright environment. The application itself has no Playwright or other runtime dependency.

## 7. Completed production release and live checks

Current is published on `main` in the public [REMgm/8NTICLAB repository](https://github.com/REMgm/8NTICLAB/tree/main/apps/current). The branch was fast-forwarded with an expected-previous-head guard and **without force**, preserving the root site's existing files. The repository's existing Git-to-Vercel integration deployed the release; no separate project or account authorization was needed.

| Release evidence | Verified result |
| --- | --- |
| Production implementation commit | `090a2fc594a6dc6e9279d4237db8bcba2dd1ce9b` |
| Release tree | `82157d8c053a34641825dc2c12d73d74491bda09` |
| Vercel deployment status | **SUCCESS** — [deployment dashboard](https://vercel.com/remgms-projects/8-nticlab/4CMw78nDnYth7dz3Xp8ZukfRJfEM) |
| Public Current URL | `https://8-nticlab.vercel.app/apps/current/` — **HTTP 200**, **154,669 bytes** |
| Public HTML SHA-256 | `c79cdcb29a6b2490b608ba8b5fc7f22d8c51b05ce43bc23a865ecbbd4b0c1e15`, exactly matching the released local HTML |
| Existing root URL | `https://8-nticlab.vercel.app/` — **HTTP 200**, **11,714 bytes**, unchanged |
| Root Git blob SHA | `cbbd64b8de5ebc7d7b2c08a4c809c9befc2c937b`, unchanged from before the release |
| App service worker | `sw.js` — **HTTP 200**, **1,166 bytes**, JavaScript |
| Social cover | `assets/current-cover.jpg` — **HTTP 200**, **64,455 bytes**, `image/jpeg` |

**Live Chromium verification completed on 14 November 2026 at 22:02:45 Europe/Amsterdam (`2026-11-14T21:02:45Z`).** It exercised the real public production origin:

| Live production check | Completed observation | Result |
| --- | --- | --- |
| Silent startup | Initial state was stopped; no audio context had been initialized | Pass |
| Gesture Start | Clicking Start changed the session to playing and the audio context to running | Pass |
| Faded Stop | Stop completed its fade and returned the session to stopped | Pass |
| Service-worker installation | Ready and controlling the page; scope `https://8-nticlab.vercel.app/apps/current/`, script `https://8-nticlab.vercel.app/apps/current/sw.js` | Pass |
| Offline session navigation | With the browser context explicitly offline, navigation to `?preset=golden-lift` loaded Current and restored carrier **220 Hz** / beat **10 Hz**, still silent | Pass |
| Offline playback | A gesture started the offline Golden Lift session; Stop worked afterward | Pass |
| Application errors | **Zero page errors** during the live checks | Pass |

The public release, root integrity, session query handling, scoped cache, and offline playback are therefore completed checks. The remaining limitations below concern physical devices, other browser engines, and assistive technology; they are not unresolved publication steps.

## 8. Practical limits still requiring device checks

- Physical headphone channel routing, audible transitions, and listening comfort.
- iPhone/iPad Safari, device-lock behavior, background interruption, and real wake-lock availability.
- Other browser engines, including Firefox and WebKit, beyond the completed Chromium run.
- Long exports on memory-constrained phones; the 90-minute maximum is not a claim that every device can render it.
- Full keyboard/screen-reader testing with assistive technology, beyond implemented semantics and the automated interaction checks.

Current is a personal listening tool. This engineering report does not establish medical effectiveness, therapeutic benefit, or guaranteed entrainment.
