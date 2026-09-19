# Agent Power Up: outcome-first redesign

Research snapshot: 19 September 2026. Benchmark: Netherlands free iPhone apps, excluding games. Source: [Apple's live chart](https://apps.apple.com/nl/iphone/charts). Rankings vary by country and time and do not measure usability.

## Method and limits

Inspected the first two published App Store screenshots for each of the ten apps, plus listing information. This is a heuristic review of developer-supplied marketing screens, not an installed-app usability study, accessibility audit, or measured conversion comparison. Recommendations below are design judgments about fit for Agent Power Up.

| Rank | App / official listing | Visible pattern | Transfer to this product |
| --- | --- | --- | --- |
| 1 | [ChatGPT](https://apps.apple.com/nl/app/chatgpt/id6448311069) | Minimal chrome, persistent input, response directly in the conversation | Best focus reference: one primary action, then the returned business result |
| 2 | [Shop](https://apps.apple.com/nl/app/shop-al-je-favoriete-merken/id1223471316) | Delivery status with a clear next milestone; content-led shopping surface | Best progress reference: show what completed and what comes next; avoid adopting the dense shopping feed |
| 3 | [Claude](https://apps.apple.com/nl/app/claude-by-anthropic/id6473753684) | Quiet conversation surface with concrete local results; dedicated voice action | Give useful business details, not just a technical receipt |
| 4 | [Le Champion](https://apps.apple.com/nl/app/le-champion/id1573773139) | Event-specific home, activity categories, timeline | Organize around the current job; event/category browsing is less relevant here |
| 5 | [nlCabs](https://apps.apple.com/nl/app/nlcabs/id6766819636) | Map context and a short safety action sheet | Use short contextual actions; no reason to add a map |
| 6 | [Vinted](https://apps.apple.com/nl/app/vinted-tweedehandsplatform/id632064380) | Selling framed as an outcome, concrete item fields | Best onboarding reference: brief input -> review -> activation |
| 7 | [Google Gemini](https://apps.apple.com/nl/app/google-gemini/id6477489729) | Focused input over a response; voice/camera as direct tools | Show the action where it is needed; avoid modes the MVP cannot support |
| 8 | [Meta AI](https://apps.apple.com/nl/app/meta-ai/id1558240027) | Useful place/product results in a conversation | Present the returned service information; avoid a fake chat interface |
| 9 | [Microsoft Copilot](https://apps.apple.com/nl/app/microsoft-copilot/id541164041) | Connected content picker, structured outputs, bottom navigation | Put connection detail one level deeper; use labeled mobile navigation |
| 10 | [Vodafone & Ziggo](https://apps.apple.com/nl/app/vodafone-ziggo/id496189385) | Product overview, balances and clear service actions | Surface business status and requests; omit promotions and unrelated content |

## Decisions implemented

- Three destinations: Home, Requests, Business. Desktop segmented navigation; labeled mobile bottom navigation.
- One visible next setup action: website import -> review/edit -> activate -> test FIND.
- Main text at 16px, prominent 36–52px task headings, 56px primary actions, generous spacing. Mobile inputs retain 16px type.
- Neutral canvas, white working surfaces, a single cobalt action colour. Functional feedback uses restrained green and error red.
- After a FIND call, show the business and services from the actual API response. Keep confirmation details available in a disclosure.
- Count successful FIND calls and received requests from stored records. Explicitly label that calls include owner checks; never present them as customers acquired.
- Make the existing quote capability usable through a test-request form and an actionable inbox. A mailto link opens the owner's email client; it does not send automatically.
- Keep queued integrations compact. Square, ChatGPT and Google details are disclosed rather than dominating the page.
- Move API keys, schemas, event traces and recovery/refresh details into Business. Preserve every existing backend capability.
- Show failed requests clearly and offer retry. Do not show an earlier receipt as the result of a failed new search.

## Value boundary

This MVP can host an authenticated business API, return business information, save quote requests, and optionally exercise Square sandbox booking. It does not establish ChatGPT/Google discovery or prove customer acquisition. Sandbox proof and internal checks must remain distinguishable from real customer activity.

## Evaluation after deployment

Compare the activation-to-callable rate and time-to-first-success with the old flow. Watch import failures and abandonment at review/activation. In a short observed test, ask a local owner to connect their business, verify a service, and find a received request without guidance. No improvement claim is warranted until those outcomes are measured.
