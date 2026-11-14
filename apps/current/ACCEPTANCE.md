# Current — acceptance and release evidence

**Prepared:** 14 November 2026  
**Application path:** `REMgm/8NTICLAB/apps/current`  
**Release target:** `https://8-nticlab.vercel.app/apps/current/`  
**Browser-tested implementation:** `645e618c346e43b0a3a17853985e9d38540bc27d`  
**Status:** All 12 real Chromium checks passed, alongside 36 state checks and mocked scheduling checks. Current's production-route verification is pending.

Subsequent cover and canonical-URL metadata edits do not change audio or application behavior. Record the final released commit separately when production verification is complete.

This report distinguishes completed checks from intended behavior. A test script's presence does not establish a pass, a mocked graph does not establish the sound of a real browser, and a successful preview deployment does not establish that Current is publicly accessible.

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

## 7. Publication evidence and remaining release check

The source is already on a feature branch in the public `REMgm/8NTICLAB` repository. The following existing integration evidence was observed:

| Evidence | Result |
| --- | --- |
| Existing public root `https://8-nticlab.vercel.app/` | HTTP 200, 11,714 bytes |
| Root content identity | Git blob SHA `cbbd64b8de5ebc7d7b2c08a4c809c9befc2c937b`, exactly matching the existing main-branch `index.html` |
| Existing main commit `27a0ebadb3334506d5f390cd44cd5d5514affc23` | GitHub Vercel status: success, “Deployment has completed” |
| Current feature commit `5cf431de94edc9eb65652a34be7b44d7ff1e2f41` | GitHub Vercel status: success, “Deployment has completed,” 14 November 2026 at 20:52:17 UTC |
| Browser-tested implementation `645e618c346e43b0a3a17853985e9d38540bc27d` | Vercel preview check: success |
| Feature preview | Exists, but redirects public requests to Vercel authentication; app content was not claimed as publicly verified |

This evidence establishes a functioning existing Git-to-Vercel path. It does not yet establish the final Current production release. Publishing uses the additive app directory and the existing integration: **no separate Vercel project, new account authorization, or changes to the root site's content are required.**

After the final tested commit is fast-forwarded to `main`, complete these checks and record the outcome:

| Production check | Status |
| --- | --- |
| Released commit recorded and Vercel status completed | Pending |
| `https://8-nticlab.vercel.app/apps/current/` returns the released Current HTML publicly | Pending |
| Root site's content remains unchanged | Pending |
| Session-link parameters resolve under the app subdirectory | Pending |
| `sw.js` loads with the intended app scope and installs | Pending |
| A later offline visit uses the cached Current page | Pending |
| Browser playback at the production origin starts only after a user gesture | Pending |

## 8. Practical limits still requiring device checks

- Physical headphone channel routing, audible transitions, and listening comfort.
- iPhone/iPad Safari, device-lock behavior, background interruption, and real wake-lock availability.
- Other browser engines, including Firefox and WebKit, beyond the completed Chromium run.
- Long exports on memory-constrained phones; the 90-minute maximum is not a claim that every device can render it.
- Full keyboard/screen-reader testing with assistive technology, beyond implemented semantics and the automated interaction checks.

Current is a personal listening tool. This engineering report does not establish medical effectiveness, therapeutic benefit, or guaranteed entrainment.
