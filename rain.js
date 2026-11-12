// Shared logic for quick-check page and morning push. Pure functions, no I/O.

// Tuning knobs — real weather needs calibration, change here.
// radar: max value (0.01 mm / 5 min) in box that still counts as dry.
// 1 = the smallest amount radar can report (≈0.1 mm/h, a trace you hardly feel); set 0 to be strict.
export const DRY_5MIN = 1;
export const WET_PROB = 40;   // hourly: rain probability (%) from which an hour counts as wet
export const WET_MM_H = 0.2;  // hourly: amount (mm/h) from which an hour counts as wet
export const DAY_FROM = 6, DAY_TO = 22; // walking hours

const STEP = 5 * 60000;
const maxOf = r => Math.max(...r.precipitation_5.flat());

// Radar steps that are not over yet, sorted: [{ t: ms, mm: max value in box }]
export function steps(records, now = Date.now()) {
  return records
    .map(r => ({ t: Date.parse(r.timestamp), mm: maxOf(r) }))
    .filter(s => s.t + STEP > now)
    .sort((a, b) => a.t - b.t);
}

// → { wet, minutes, capped } : current state, minutes until it changes,
// capped = no change inside radar horizon (minutes = horizon). null if no data.
export function dryMinutes(records, now = Date.now()) {
  const s = steps(records, now);
  if (!s.length) return null;
  const wet = s[0].mm > DRY_5MIN;
  const change = s.find(x => (x.mm > DRY_5MIN) !== wet);
  const end = change ? change.t : s[s.length - 1].t + STEP;
  return { wet, minutes: Math.max(0, Math.round((end - now) / 60000)), capped: !change };
}

// Hourly records (timestamps in local time, value = previous 60 min) →
// merged blocks [{ wet, from, to, prob }] between DAY_FROM and DAY_TO.
// radarSteps (from steps()) override the forecast: the hourly forecast can miss a shower
// that the radar already sees, and radar is what is really falling.
export function dayWindows(hours, radarSteps = []) {
  const hourOf = new Intl.DateTimeFormat('de-DE', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Berlin' });
  const radarWet = new Set(radarSteps.filter(s => s.mm > DRY_5MIN).map(s => parseInt(hourOf.format(s.t))));
  const blocks = [];
  for (const h of hours) {
    const from = (+h.timestamp.slice(11, 13) || 24) - 1; // record at 10:00 describes 09–10
    if (from < DAY_FROM || from >= DAY_TO) continue;
    const seen = radarWet.has(from);
    const prob = seen ? null : h.precipitation_probability; // forecast % means nothing once radar sees rain
    const wet = seen || (prob ?? 0) >= WET_PROB || (h.precipitation ?? 0) >= WET_MM_H;
    const last = blocks[blocks.length - 1];
    if (last && last.wet === wet && last.to === from) {
      last.to = from + 1;
      last.prob = Math.max(last.prob ?? 0, prob ?? 0) || null;
    } else blocks.push({ wet, from, to: from + 1, prob: prob || null });
  }
  return blocks;
}

const hh = n => String(n).padStart(2, '0');
const span = b => `${hh(b.from)}–${hh(b.to)}`;

export function formatDay(blocks) {
  const dry = blocks.filter(b => !b.wet), wet = blocks.filter(b => b.wet);
  if (!blocks.length) return 'Keine Vorhersage verfügbar';
  if (!wet.length) return `Ganzer Tag trocken (${span({ from: blocks[0].from, to: blocks.at(-1).to })})`;
  const rain = wet.map(b => span(b) + (b.prob ? ` (${b.prob}%)` : '')).join(', ');
  if (!dry.length) return `Regen den ganzen Tag: ${rain}`;
  return `Trocken: ${dry.map(span).join(', ')}\nRegen: ${rain}`;
}
