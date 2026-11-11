// Morning push: today's dry windows → ntfy. Env: LAT, LON, NTFY_TOPIC, optional PAGE_URL.
import { dayWindows, formatDay, DAY_FROM, DAY_TO } from './rain.js';

const { LAT, LON, NTFY_TOPIC, PAGE_URL } = process.env;
if (!LAT || !LON || !NTFY_TOPIC) throw new Error('LAT, LON and NTFY_TOPIC must be set');

const tz = 'Europe/Berlin';
const today = new Date().toLocaleDateString('sv-SE', { timeZone: tz }); // YYYY-MM-DD
const hh = n => String(n).padStart(2, '0');
const url = `https://api.brightsky.dev/weather?lat=${LAT}&lon=${LON}&tz=${tz}` +
  `&date=${today}T${hh(DAY_FROM)}:00&last_date=${today}T${hh(DAY_TO)}:00`;

const res = await fetch(url);
if (!res.ok) throw new Error(`Bright Sky ${res.status}`);
const text = formatDay(dayWindows((await res.json()).weather));

const push = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
  method: 'POST',
  body: text,
  headers: { Title: 'Hundswetter heute', Tags: 'dog', ...(PAGE_URL && { Click: PAGE_URL }) },
});
if (!push.ok) throw new Error(`ntfy ${push.status}`);
console.log(text);
