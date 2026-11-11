# Hundswetter

Rain check for dog walks. No dependencies, no build.

- `rain.js` — shared pure logic + tuning knobs (thresholds, walking hours) at the top.
- `index.html` — quick-check page (GitHub Pages). Location lives in the phone's `localStorage`, never in the repo.
- `morning.mjs` — daily push via ntfy.sh, run by `.github/workflows/morning.yml` (05:45 Europe/Berlin).
- Data: Bright Sky (`api.brightsky.dev`, DWD open data): `/radar` = 5-min nowcast +2 h, `/weather` = hourly.

## Commands

- Test: `node test.mjs`
- Local page: `npx serve .` (ES module import does not work from `file://`)
- Manual push: `gh workflow run morning.yml`

## Config (GitHub)

- Secrets: `LAT`, `LON`, `NTFY_TOPIC` (topic name works like a password — keep it out of the repo).
- Variable: `PAGE_URL` (Pages URL, opened when the push is tapped).
- GitHub disables scheduled workflows after 60 days without repo activity — re-enable under Actions if pushes stop.
