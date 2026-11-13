// Morning push: today's dry windows → ntfy. Needs LAT, LON, NTFY_TOPIC, optional PAGE_URL.
// Runs as a Cloudflare Worker on a cron trigger (see wrangler.toml), or by hand: `node morning.mjs`.
import { steps, dayWindows, formatDay, DAY_FROM, DAY_TO } from './rain.js';

const TZ = 'Europe/Berlin';
const TITLE = 'Hundswetter heute';
const SEND_HOUR = 5; // local hour in which the scheduled push goes out (cron minute is in wrangler.toml)

// One blip of a server must not cost the day's push.
// Errors name only the host — the full URL holds the location / topic.
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

export async function morning({ LAT, LON, NTFY_TOPIC, PAGE_URL }) {
  if (!LAT || !LON || !NTFY_TOPIC) throw new Error('LAT, LON and NTFY_TOPIC must be set');

  // ntfy keeps recent messages, so ask it whether today's push already went out.
  const recent = await (await get(`https://ntfy.sh/${NTFY_TOPIC}/json?poll=1&since=8h`)).text();
  if (recent.split('\n').some(line => line && JSON.parse(line).title === TITLE)) return 'already sent today';

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: TZ }); // YYYY-MM-DD
  const hh = n => String(n).padStart(2, '0');
  const place = `lat=${LAT}&lon=${LON}`;
  const weather = await (await get(`https://api.brightsky.dev/weather?${place}&tz=${TZ}` +
    `&date=${today}T${hh(DAY_FROM)}:00&last_date=${today}T${hh(DAY_TO)}:00`)).json();
  // Radar covers the next 2 h and corrects the forecast there (same as the page does).
  const from = encodeURIComponent(new Date(Date.now() - 5 * 60000).toISOString());
  const radar = await (await get(`https://api.brightsky.dev/radar?${place}&distance=2000&format=plain&date=${from}`)).json();
  const text = formatDay(dayWindows(weather.weather, steps(radar.radar)));

  await get(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: 'POST',
    body: text,
    headers: { Title: TITLE, Tags: 'dog', ...(PAGE_URL && { Click: PAGE_URL }) },
  });
  return text;
}

// Cron triggers are UTC only, so wrangler.toml fires at two UTC hours (winter / summer time)
// and only the one that is SEND_HOUR o'clock in local time sends.
export const isSendHour = (now = Date.now()) =>
  parseInt(new Intl.DateTimeFormat('de-DE', { hour: 'numeric', hourCycle: 'h23', timeZone: TZ }).format(now)) === SEND_HOUR;

export default {
  scheduled(_event, env, ctx) {
    if (isSendHour()) ctx.waitUntil(morning(env).then(console.log));
  },
};

if (globalThis.process?.argv?.[1]?.endsWith('morning.mjs')) console.log(await morning(process.env));
