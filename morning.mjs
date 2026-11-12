// Morning push: today's dry windows → ntfy. Env: LAT, LON, NTFY_TOPIC, optional PAGE_URL.
import { steps, dayWindows, formatDay, DAY_FROM, DAY_TO } from './rain.js';

const { LAT, LON, NTFY_TOPIC, PAGE_URL } = process.env;
if (!LAT || !LON || !NTFY_TOPIC) throw new Error('LAT, LON and NTFY_TOPIC must be set');

const tz = 'Europe/Berlin';
const today = new Date().toLocaleDateString('sv-SE', { timeZone: tz }); // YYYY-MM-DD
const hh = n => String(n).padStart(2, '0');
const url = `https://api.brightsky.dev/weather?lat=${LAT}&lon=${LON}&tz=${tz}` +
  `&date=${today}T${hh(DAY_FROM)}:00&last_date=${today}T${hh(DAY_TO)}:00`;

// Servers sometimes refuse a connection from GitHub's runners; one blip must not cost the day's push.
// Errors name only the host — the full URL holds the location / topic and logs are public.
async function get(url, opt) {
  const host = new URL(url).host;
  for (let left = 3; ; left--) {
    let why;
    try {
      const r = await fetch(url, opt);
      if (r.ok) return r;
      why = `answered ${r.status}`;
    } catch (e) {
      why = `unreachable (${e.cause?.code ?? e.name})`; // never rethrow the raw error object
    }
    if (!left) throw new Error(`${host} ${why}`);
    await new Promise(done => setTimeout(done, 20000));
  }
}

// The schedule fires several times because GitHub sometimes drops or delays a run.
// ntfy keeps recent messages, so ask it whether today's push already went out.
const TITLE = 'Hundswetter heute';
const recent = await (await get(`https://ntfy.sh/${NTFY_TOPIC}/json?poll=1&since=8h`)).text();
if (recent.split('\n').some(line => line && JSON.parse(line).title === TITLE)) {
  console.log('already sent today');
  process.exit(0);
}

// Radar covers the next 2 h and corrects the forecast there (same as the page does).
const from = encodeURIComponent(new Date(Date.now() - 5 * 60000).toISOString());
const radar = await (await get(`https://api.brightsky.dev/radar?lat=${LAT}&lon=${LON}&distance=2000&format=plain&date=${from}`)).json();
const text = formatDay(dayWindows((await (await get(url)).json()).weather, steps(radar.radar)));

await get(`https://ntfy.sh/${NTFY_TOPIC}`, {
  method: 'POST',
  body: text,
  headers: { Title: TITLE, Tags: 'dog', ...(PAGE_URL && { Click: PAGE_URL }) },
});
console.log(text);
