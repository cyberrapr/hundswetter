import assert from 'node:assert/strict';
import { dryMinutes, dayWindows, formatDay } from './rain.js';
import { isSendHour } from './morning.mjs';

const now = Date.parse('2026-11-11T10:02:00Z');
// radar records every 5 min starting 10:00, values = max in box
const radar = vals => vals.map((v, i) => ({
  timestamp: new Date(Date.parse('2026-11-11T10:00:00Z') + i * 300000).toISOString(),
  precipitation_5: [[0, v], [0, 0]],
}));

assert.deepEqual(dryMinutes(radar([0, 0, 0, 0]), now), { wet: false, minutes: 18, capped: true });
assert.deepEqual(dryMinutes(radar([0, 0, 12, 0]), now), { wet: false, minutes: 8, capped: false });
assert.deepEqual(dryMinutes(radar([5, 9, 0, 0]), now), { wet: true, minutes: 8, capped: false });
assert.deepEqual(dryMinutes(radar([5, 9]), now), { wet: true, minutes: 8, capped: true });
assert.equal(dryMinutes(radar([3]), now + 3600000), null); // only stale data

const hour = (h, mm, prob = null) => ({
  timestamp: `2026-11-11T${String(h).padStart(2, '0')}:00:00+01:00`,
  precipitation: mm, precipitation_probability: prob,
});
// record at hour H describes H-1..H; 06:00 record (05–06) is outside walking hours
const day = [hour(6, 5), hour(7, 0, 10), hour(8, 0, 20), hour(9, 0, 60), hour(10, 0.5), hour(11, 0, 5)];
assert.deepEqual(dayWindows(day), [
  { wet: false, from: 6, to: 8, prob: 20 },
  { wet: true, from: 8, to: 10, prob: 60 },
  { wet: false, from: 10, to: 11, prob: 5 },
]);
assert.equal(formatDay(dayWindows(day)), 'Trocken: 06–08, 10–11\nRegen: 08–10 (60%)');
assert.equal(formatDay(dayWindows([hour(7, 0), hour(8, 0)])), 'Ganzer Tag trocken (06–08)');
assert.equal(formatDay([]), 'Keine Vorhersage verfügbar');

// radar sees rain at 09:25 local (08:25Z) although the forecast says dry → 09–10 becomes wet
const seen = [{ t: Date.parse('2026-11-12T08:25:00Z'), mm: 9 }, { t: Date.parse('2026-11-12T09:15:00Z'), mm: 0 }];
assert.deepEqual(dayWindows([hour(9, 0, 3), hour(10, 0, 4), hour(11, 0, 4)], seen), [
  { wet: false, from: 8, to: 9, prob: 3 },
  { wet: true, from: 9, to: 10, prob: null },
  { wet: false, from: 10, to: 11, prob: 4 },
]);

// 05:45 local is 04:45 UTC in winter and 03:45 UTC in summer; the other cron slot must not send
assert.equal(isSendHour(Date.parse('2026-11-14T04:45:00Z')), true);
assert.equal(isSendHour(Date.parse('2026-11-14T03:45:00Z')), false);
assert.equal(isSendHour(Date.parse('2026-07-14T03:45:00Z')), true);
assert.equal(isSendHour(Date.parse('2026-07-14T04:45:00Z')), false);

console.log('ok');
