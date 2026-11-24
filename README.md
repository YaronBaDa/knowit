# KNOWIT

A daily 10-question trivia game. One self-contained `index.html` (inline CSS + JS, no build step,
no dependencies), hosted on GitHub Pages: <https://yaronbada.github.io/knowit/>.

```
index.html              the whole game
schedule.json           frozen question ids per puzzle number (append-only)
tools/freeze-schedule.js  regenerates / extends schedule.json from index.html
manifest.webmanifest    PWA manifest
sw.js                   service worker (app-shell cache)
```

## Puzzle numbering

Puzzle **#1 = 2026-11-18 (UTC)**; each puzzle runs from 00:00 UTC and everyone gets the same ten
questions in the same order. Daily score range is −13 … +13 (standard ±1, bet ±2, timeout −1 / −2).

## Why schedule.json exists

The daily set is computed from the whole `QUESTIONS` bank. That means any edit to `QUESTIONS`,
`HOLD_IDS`, `NO_SAME_DAY` or the tier queues silently changes which questions past and future
puzzles use — and breaks every old challenge link, replay and saved result that references them.

`schedule.json` freezes the answer:

```json
{ "version": 1, "launch": "2026-11-18", "days": { "1": ["p37", "b9", …], "2": [ … ] } }
```

- The game fetches it at startup and plays the stored ids when the day is present and every id
  still exists in `QUESTIONS` (otherwise it falls back to the computed set).
- The file is **append-only**. `tools/freeze-schedule.js` keeps existing entries byte-for-byte and
  only appends days beyond the highest one already stored.
- If a recomputed day disagrees with the stored one the script prints a warning and keeps the
  stored ids — that is your signal that a bank edit has drifted a published puzzle.

## Adding questions safely

1. Add the question object to the `QUESTIONS` array in `index.html` (unique `id`, `difficulty`,
   `category` from `UMBRELLA_CATEGORIES`, `options`, `correctIndex`, `didYouKnow`).
2. Run the freeze script:
   ```bash
   node tools/freeze-schedule.js            # append missing days up to #120
   node tools/freeze-schedule.js --days 365 # extend further out
   node tools/freeze-schedule.js --check    # report missing days / drift, write nothing
   ```
3. Commit both files together — `index.html` **and** `schedule.json`:
   ```bash
   git add index.html schedule.json && git commit -m "content: add questions, extend schedule"
   ```
4. If the script warns that published days no longer recompute identically, do **not** delete them
   unless you intend to invalidate old links. New questions only enter play once the schedule
   reaches days that had not been frozen yet.

## Editing a question

Text, options and `didYouKnow` edits are safe: schedule.json stores ids, not content, so every
already-frozen day keeps the same picks. Only removing or renaming an `id` breaks frozen days —
in that case the game falls back to the computed set for those days (the id check fails).

## Anonymous score aggregation (optional)

`API_BASE` in `index.html` points at the live worker
(`https://knowit-stats.ybachmandagan.workers.dev`), so aggregation is **on**. Set it to `''` to turn
it off completely — nothing is sent and the results screen is exactly as it always was.

### What is collected

After a **completed, ranked daily** (never a replay, never Endless), the client makes one
`POST /submit` and one `GET /agg`. The POST body is:

| field | meaning |
|---|---|
| `puzzle` | the puzzle number, e.g. `12` |
| `points` | your total for the set, −13 … 13 |
| `correctByPos` | ten booleans — whether position 1…10 was answered correctly |
| `seconds` | rounded total time on the ten questions |
| `playerId` | a random UUID generated on this device, stored in `knowit_pid` |

Nothing else is sent. **No picked options, no answer text, no names, no email, no
`knowit_name`, no challenge links, no IP address is stored** (the IP is only used in memory for
the per-minute rate limit). The Worker keeps one aggregate per puzzle — a count, a points
histogram, and how many players got each position right — plus a 3-day de-dupe key that stops the
same device counting twice for one puzzle.

What you see back: “Top X% today” under the stat bar from **2** submitted players (a percentile
needs a second player to mean anything) and “Hardest today: Q9 (48% got it)” under the grid from
**20**. If the API is slow, missing or erroring, both lines are simply absent — the game is unchanged.

### Deploying the Worker

The worker is already deployed and its KV namespace already holds data, so a redeploy must reuse
that namespace. Running `wrangler kv namespace create STATS` a second time creates a new, empty
namespace and the percentile lines silently reset to nothing.

```bash
node worker/kv-id.mjs          # records the existing STATS namespace id in worker/wrangler.toml
node worker/kv-id.mjs --check  # exit 1 while the id is still a placeholder
cd worker && wrangler deploy   # note the printed https origin
```

On a brand-new account with no namespace yet, create it once (`wrangler kv namespace create STATS`)
and then run `node worker/kv-id.mjs`. Both commands need `npx wrangler login` once, on the machine
that will deploy.

Then set `API_BASE` in `index.html` to that origin and commit. The Worker only answers CORS for
`https://yaronbada.github.io` (plus local dev origins), and accepts puzzle numbers for today or
yesterday UTC only. KV is eventually consistent — a lost increment just nudges a percentage.

## Local development

```bash
python3 -m http.server 8799 --bind 127.0.0.1   # from the repo root, then open /index.html
```

The service worker only registers on `https:` or `localhost`/`127.0.0.1`. Bump `CACHE` in `sw.js`
whenever the app shell changes.
