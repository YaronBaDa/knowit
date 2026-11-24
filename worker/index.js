/**
 * KNOWIT — anonymous daily score aggregation.
 *
 *   POST /submit  { puzzle, points, correctByPos[10], seconds, playerId }
 *   GET  /agg?puzzle=N[&points=P]  → { n, percentileFor?, qRate[10] }
 *
 * What is stored: one aggregate counter per puzzle (n, a points histogram, and how
 * many players got each of the ten positions right), plus a short-lived de-dupe key
 * and a rate-limit counter. No answers' picked options, no names, no IPs kept.
 *
 * KV is eventually consistent and has no compare-and-swap, so a concurrent
 * read-modify-write can lose a single increment. For a "you beat X% of players"
 * banner that is completely fine, and it keeps this free to run.
 *
 * Deploy:  node kv-id.mjs  → records the existing STATS namespace id in wrangler.toml
 *          wrangler deploy → (do NOT run `kv namespace create` again; it would orphan the live data)
 */

const LAUNCH_UTC = Date.UTC(2026, 10, 18);   // puzzle #1 = 2026-11-18 UTC
const MIN_POINTS = -13;
const MAX_POINTS = 13;
const Q_COUNT = 10;
const RATE_LIMIT = 30;          // requests per IP per minute
const RATE_WINDOW_SEC = 60;
const DEDUPE_TTL_SEC = 3 * 24 * 60 * 60;

// The site origin only (plus local dev). Anything else gets no CORS grant.
const ALLOWED_ORIGINS = new Set([
  'https://yaronbada.github.io',
  'http://localhost:8799',
  'http://127.0.0.1:8799',
  'http://127.0.0.1:8801',
  'http://localhost:8801',
]);

function corsOrigin(origin) {
  return ALLOWED_ORIGINS.has(origin) ? origin : 'https://yaronbada.github.io';
}
function headers(origin, extra) {
  return Object.assign({
    'access-control-allow-origin': corsOrigin(origin),
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    'cache-control': 'no-store',
    vary: 'Origin',
  }, extra || {});
}
function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: headers(origin, { 'content-type': 'application/json' }),
  });
}
function blankAgg() {
  return { n: 0, pointsHist: {}, qCorrect: new Array(Q_COUNT).fill(0) };
}

function puzzleNumberFor(ms) {
  const d = new Date(ms);
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((day - LAUNCH_UTC) / 86400000) + 1;
}

function isInt(v, min, max) {
  return Number.isInteger(v) && v >= min && v <= max;
}

// Crude per-IP limiter. KV counters can race, which only makes the limit fuzzy.
async function rateLimited(env, request, minute) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const key = `rl:${ip}:${minute}`;
  const current = parseInt(await env.STATS.get(key), 10) || 0;
  if (current >= RATE_LIMIT) return true;
  await env.STATS.put(key, String(current + 1), { expirationTtl: RATE_WINDOW_SEC * 2 });
  return false;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: headers(origin) });
    }

    // Config drift guard: a deploy whose wrangler.toml still carries the placeholder id, or a
    // binding dropped by hand, would throw on the first KV call and answer an opaque CF 500.
    // Fail loudly-but-cleanly instead; the client already ignores any non-ok response.
    if (!env || !env.STATS || typeof env.STATS.get !== 'function') {
      return json({ error: 'not_configured' }, 503, origin);
    }

    const minute = Math.floor(Date.now() / 60000);
    if (await rateLimited(env, request, minute)) {
      return json({ error: 'rate_limited' }, 429, origin);
    }

    if (request.method === 'POST' && url.pathname === '/submit') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'bad_json' }, 400, origin); }
      if (!body || typeof body !== 'object') return json({ error: 'bad_body' }, 400, origin);

      const { puzzle, points, correctByPos, seconds, playerId } = body;
      const today = puzzleNumberFor(Date.now());
      if (!isInt(puzzle, today - 1, today)) return json({ error: 'bad_puzzle' }, 400, origin);
      if (!isInt(points, MIN_POINTS, MAX_POINTS)) return json({ error: 'bad_points' }, 400, origin);
      if (!Array.isArray(correctByPos) || correctByPos.length !== Q_COUNT) return json({ error: 'bad_positions' }, 400, origin);
      if (!correctByPos.every(v => typeof v === 'boolean')) return json({ error: 'bad_positions' }, 400, origin);
      if (typeof playerId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(playerId)) return json({ error: 'bad_player' }, 400, origin);
      if (seconds !== undefined && (typeof seconds !== 'number' || !isFinite(seconds) || seconds < 0 || seconds > 86400)) {
        return json({ error: 'bad_seconds' }, 400, origin);
      }

      const seenKey = `p:${puzzle}:${playerId}`;
      if (await env.STATS.get(seenKey)) {
        const agg = (await env.STATS.get(`agg:${puzzle}`, 'json')) || blankAgg();
        return json({ ok: true, duplicate: true, n: agg.n || 0 }, 200, origin);
      }

      const agg = (await env.STATS.get(`agg:${puzzle}`, 'json')) || blankAgg();
      agg.n = (agg.n || 0) + 1;
      agg.pointsHist = agg.pointsHist || {};
      agg.pointsHist[String(points)] = (agg.pointsHist[String(points)] || 0) + 1;
      if (!Array.isArray(agg.qCorrect) || agg.qCorrect.length !== Q_COUNT) agg.qCorrect = new Array(Q_COUNT).fill(0);
      for (let i = 0; i < Q_COUNT; i++) if (correctByPos[i]) agg.qCorrect[i]++;

      await env.STATS.put(`agg:${puzzle}`, JSON.stringify(agg));
      await env.STATS.put(seenKey, '1', { expirationTtl: DEDUPE_TTL_SEC });
      return json({ ok: true, n: agg.n }, 200, origin);
    }

    if (request.method === 'GET' && url.pathname === '/agg') {
      const puzzle = parseInt(url.searchParams.get('puzzle'), 10);
      if (!Number.isInteger(puzzle) || puzzle < 1) return json({ error: 'bad_puzzle' }, 400, origin);

      const agg = (await env.STATS.get(`agg:${puzzle}`, 'json')) || blankAgg();
      const n = agg.n || 0;
      const qRate = new Array(Q_COUNT).fill(0).map((_, i) => (n > 0 ? (agg.qCorrect[i] || 0) / n : 0));

      const out = { n, qRate };
      const pointsParam = url.searchParams.get('points');
      if (pointsParam !== null) {
        const points = parseInt(pointsParam, 10);
        if (!isInt(points, MIN_POINTS, MAX_POINTS)) return json({ error: 'bad_points' }, 400, origin);
        // Share of players with strictly fewer points, plus half of those tied with you
        let less = 0, equal = 0;
        for (const key of Object.keys(agg.pointsHist || {})) {
          const value = parseInt(key, 10);
          const count = agg.pointsHist[key] || 0;
          if (value < points) less += count;
          else if (value === points) equal += count;
        }
        out.percentileFor = n > 0 ? Math.round(((less + equal / 2) / n) * 1000) / 10 : null;
      }
      return json(out, 200, origin);
    }

    return json({ error: 'not_found' }, 404, origin);
  },
};
