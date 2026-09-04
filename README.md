# Zigzag Runner

Static canvas game published at `/zigzag-runner/`.

## Run

Serve the repository root over HTTP; service workers do not work reliably from `file://`.

## Product contract

- Language priority: `?lang=` → saved language → browser language → English.
- Ad serving, interstitials, rewarded revives, and generic cross-promotion are suspended while the site is under an invalid-traffic restriction.
- Four visible related-game links remain as attributable navigation.
- Private GA4 stages fire at most once per page load: `zigzag_runner_view`, `zigzag_runner_start`, `zigzag_runner_progress`, `zigzag_runner_complete`, `zigzag_runner_share`, and `zigzag_runner_related_click`.
- Scores, coins, themes, skins, timing, outcomes, and URLs never enter these events. Sharing is counted only after platform success.
- The service worker caches only successful same-origin requests within `/zigzag-runner/` and deletes only caches owned by this app.

## Validation

From the portfolio repository:

```powershell
npm run verify:zigzag-runner-suspension
```
