# Current — design notes

## Intent

Current is a small personal sound instrument. The useful action is to hear and shape a session, so the first screen gives the timer, true frequency readouts, Start/Stop, volume, mode, and preset choices visual priority. The wording is direct and unhurried: **“Find your quiet.”** and **“A little space between you and the noise.”** describe a listening ritual without promising a health outcome.

The supplied build guide informed the functionality. Current has its own product name, mark, palette, interface copy, and generated imagery; the source site's brand and assets are not reused.

## Design direction

The visual reference was generated with Higgsfield and translated into working HTML controls. A subdued water surface gives the player a recognizable identity, while dark panels keep the interface legible and the controls easy to locate. The image is decorative: frequency, phase, and transport state remain real text and semantic controls.

The overall layout is compact enough to behave like a tool. There is no separate marketing landing page before the player, no forced sign-up, and no onboarding screen blocking the first listen.

### Color system

| Token | Value | Use |
| --- | --- | --- |
| Background | `#0E1216` | Page canvas |
| Surface | `#161C22` | Primary cards and dialogs |
| Raised surface | `#1C242C` | Secondary controls and hover areas |
| Border | `#2A343E` | Subtle panel divisions |
| Primary text | `#E8EEF2` | Main labels and values |
| Muted text | `#A0ACB8` | Supporting explanations |
| Teal foundation | `#4AA3A2` | Brief's restrained aquatic accent |
| Interactive teal | `#73BEB9` | Start button, selected controls, and readable teal details |
| Golden Lift gold | `#C4A35A` | Warm identity for the second preset |
| Keyboard focus | `#E8C56A` | Clear focus ring, distinct from ordinary teal selection |
| Error emphasis | `#F39C8D` | Inline errors and failure feedback |

The lighter interactive teal is a deliberate implementation adjustment to the darker teal foundation so it reads clearly against the dark surfaces. Gold marks a different preset character, not a premium tier. The high-contrast media preference increases border and secondary-text contrast.

### Type and shape

The UI uses a native system sans-serif stack so no font download is needed. Frequency values and clocks use a system monospace stack with tabular figures to keep changing numbers stable. Headings use moderate weight and restrained tracking; the timer carries the strongest typographic emphasis inside the player.

Cards have modest rounded corners and fine borders. Buttons, sliders, and toggles have distinct active and focus states. Primary actions use filled teal, secondary actions use quiet borders or text. The small wave mark is an authored inline SVG; functional icons are inline SVG, not rasterized text inside generated artwork.

## Information architecture and behavior

### Primary surface

- **Player:** selected session, ready/playing status, remaining time, phase, band label, true left/right or mixed-frequency readout, Start/Stop, and volume.
- **Shape your sound:** three explicit audio modes, linked carrier and beat controls, reference bands, and concise mode-specific help.
- **Your session:** Calm Current and Golden Lift, duration choices, phase proportions, and locally saved presets.
- **A softer background:** brown noise, pink noise, and procedural rain, each with an independent toggle and gain.

The desktop layout uses two columns. On narrow screens it becomes a single column with a persistent bottom transport bar. Start/Stop remains reachable while the user scrolls to other settings; content receives enough bottom padding to avoid hiding behind that bar.

### Progressive detail

**Fine-tune your listening** holds pulse tempo and depth, the fourth-beat accent, chord layer, session edges, centered alignment, channel checks, wake lock, motion preferences, and offline download. The default view stays approachable while the full sound model remains editable.

Dialogs handle saving a preset, WAV export, keyboard help, and the evidence explanation. They use real form controls and labels. The export dialog shows format, duration, estimated size, progress, and cancellation; exporting is disabled during playback. A long export is presented as a memory tradeoff, not an instant-download promise.

## Accessibility and interaction decisions

- The page has a skip link, labeled sections and controls, pressed states for selections, visible keyboard focus, and screen-reader announcements for meaningful playback changes.
- Numeric fields and sliders represent the same underlying value. Typing is committed on blur or Enter, and invalid or out-of-range values are normalized.
- Keyboard shortcuts avoid text-entry fields and preserve native activation of focused buttons. Escape can close a dialog or stop playback.
- The operating system's reduced-motion preference is honored, with an additional in-app preference. The image does not flash at the beat frequency.
- Frequency-band names are accompanied by an explicit explanation that they do not predict the listener's EEG or guarantee an effect.
- The binaural headphone reminder changes with the selected mode. The channel test offers a practical check without starting a full session.
- Listening cautions remain available in the footer even after the introductory note is dismissed. Dismissing that note does not unlock a hidden capability or grant permission.
- On mobile, editable text values are sized to avoid the small-input zoom problem. Responsive CSS includes a compact landscape transport treatment.

These are implemented design choices. Automated checks, device accessibility checks, and physical listening tests have separate verification statuses in the README; this document is not a claim of full WCAG conformance or universal browser support.

## Sound and visual state

The page starts silently with Calm Current at 25% gain. The timer, tone values, and phase display describe the actual configured session. A modified preset stops appearing selected when its settings no longer match. Golden Lift has a warmer accent while preserving the same control layout.

Audio transitions use the audio clock and smoothed envelopes. Visual updates communicate status without attempting to visualize every oscillation. The UI avoids strobing, rapidly pulsing backgrounds, or a claim that an animated element measures a listener's mental state.

## Evidence and copy boundary

The **About the sound** dialog explains binaural, isochronic, and monaural delivery in plain language. Its evidence section links to the [2023 PLOS ONE systematic review](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0286023). The product must not add claims of treatment, guaranteed focus, healing, or guaranteed brainwave entrainment.

The Schumann chip is a familiar numerical reference, with an explicit qualification rather than a claim about Earth-resonance therapy. “Calm” and “Lift” are session names and creative descriptions, not validated clinical outcomes.

## Higgsfield artwork provenance

All three visual generations used **Higgsfield GPT Image 2.6**, tool model **`gpt_image_2_6`**, **medium** quality, **1k** size, on **14 November 2026**.

| Role | Higgsfield generation job ID | Project asset | Use |
| --- | --- | --- | --- |
| Design reference board | `5b6783a5-467a-4187-8257-3f52c11f84e3` | `assets/design-direction.webp` | Visual direction for layout, hierarchy, and atmosphere; not shipped as an interactive screen |
| Quiet water artwork | `e2be022c-23e6-4175-b1a9-05979bf9f83e` | `assets/current-water.webp` | Decorative background in the player; embedded as a data URI in `index.html` |
| Launch/social cover | `64da7e19-ffb5-409b-bd57-fc1923b5f1eb` | `assets/current-cover.webp` and `assets/current-cover.jpg` | Static cover and social-preview imagery |

The listed JPG/WebP files are delivery versions of the generated imagery. They are not third-party stock photography or copied artwork from the reference site. The generated board guided the design; all active controls, readouts, accessibility semantics, and behavior are implemented in source code.

No generative AI runs inside Current. Higgsfield was used to create the design reference and artwork during authoring. Visitors do not need a Higgsfield account, credits, or network access to generate audio.

## Maintenance

Keep the authored source in `src/` readable. After source or embedded-water changes, run `python3 tools/build.py` and commit the updated `index.html`. The site must remain usable without an npm install or a deployment-time build.

Preserve the portable single-file path, visible playback controls, honest evidence language, and absence of third-party runtime scripts. If a future feature needs an external service, account, or upload, document that change explicitly rather than retaining the current privacy and offline claims unchanged.
