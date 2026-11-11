// Morning push: today's dry windows → ntfy. Env: LAT, LON, NTFY_TOPIC, optional PAGE_URL.
import { dayWindows, formatDay, DAY_FROM, DAY_TO } from './rain.js';

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

const text = formatDay(dayWindows((await (await get(url)).json()).weather));

await get(`https://ntfy.sh/${NTFY_TOPIC}`, {
  method: 'POST',
  body: text,
  headers: { Title: 'Hundswetter heute', Tags: 'dog', ...(PAGE_URL && { Click: PAGE_URL }) },
});
console.log(text);
