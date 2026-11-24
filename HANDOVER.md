# KNOWIT — Handover Brief

_Last updated: 2026-11-23 · commit `371ca6c` · live at <https://yaronbada.github.io/knowit/>_

## 0. Start here (next agent)

```bash
git clone https://github.com/YaronBaDa/knowit.git && cd knowit
```
Then read, in this order: **this file** → `README.md` (deploy + schedule tooling) →
`worker/index.js` (analytics API) → `sw.js` (caching contract). Only `index.html` matters for
day-to-day work; it is the whole game. Brand assets (`*.png`, `*.ico`, `knowit-brain.svg`) are in the
repo and already wired up — no need to recreate them.

Nothing else needs to be transferred: the repo is the single source of truth and is public.

This is the entry point for anyone (human or agent) taking over KNOWIT. It supersedes nothing —
`KNOWIT_HANDOFF.md` is the long-form design spec/history written earlier in the project; this file
is the current-state map: what exists, how it fits together, what is fragile, and what is left.

---

## 1. What KNOWIT is

A daily trivia game for mobile. Ten questions per day, the same set for everyone, one attempt,
UTC midnight rollover (puzzle **#1 = 2026-11-18**). Players can bet on answers for double stakes,
and there is an Endless mode with three lives. Everything ships as **one self-contained
`index.html`** (inline CSS + JS, no framework, no build step, no npm) on GitHub Pages, plus a few
small support files (service worker, manifest, frozen schedule, analytics worker, tooling).

Current numbers: **1,105 questions** (430 easy / 414 medium / 261 hard) across 16 raw category tags
that normalize into 6 umbrella categories; `schedule.json` frozen through **day #150** (2027-04-16).
Two evergreen batches are appended after the original 505: `sn/gg/hs/sl/pc/al` (batch 1) and
`zs/zg/zh/zl/zp/za` (batch 2), each 50 per umbrella at 15 easy / 20 medium / 15 hard, so frozen days
and the Endless pool kept their existing behaviour. Batch 2 also balances the correct answer index
at exactly 75 per position 0-3. Bank additions do not enter Daily play until the schedule is
extended past day 150 with the freeze tool.

- Repo: `github.com/YaronBaDa/knowit` (branch `main`, owner is the sole visible contributor)
- Live: `https://yaronbada.github.io/knowit/`
- Domain: none yet — `SITE_URL` in `index.html` is the Pages URL and will need changing when a
  custom domain lands (also update the canonical/OG tags, `manifest.webmanifest`, `sitemap`-less).
- Owner is **non-technical** and edits through github.com (pencil → paste → commit). Prefer
  copy-pasteable, step-by-step instructions over CLI commands. The owner also values sole
  authorship — do not add collaborators, forks, or third-party contributors.

---

## 2. Repository layout

```
index.html                 3.5 MB / ~4,770 lines — the entire game (HTML + <style> + <script>)
sw.js                      98 lines — service worker, ONE cache constant at the top
manifest.webmanifest       PWA manifest (standalone, #140F12, icons 64 + 180)
schedule.json              1,105-id bank frozen per day, days 1–150 (append-only)
tools/freeze-schedule.js   Node, zero deps — regenerates/extends schedule.json from index.html
worker/index.js            Cloudflare Worker: anonymous score aggregation (KV)
worker/wrangler.toml       Worker config (KV binding named STATS — id still a placeholder)
README.md                  deploy + “adding questions safely”
KNOWIT_HANDOFF.md          older long-form design spec (still useful for design rationale)
GAME_STATE.md              very early notes, mostly superseded
favicon.ico / favicon.png / apple-touch-icon.png / og-image.png / knowit-brain.svg   brand assets
index.html.bak             stale Oct backup, UNTRACKED — safe to delete, do not ship it
```

Nothing is generated at build time. `index.html` is served exactly as committed.

### Deploy

Pages serves `main` directly. Push, wait ~70–85 s, then verify the live URL with a cache-buster
(`?t=<random>`) — the CDN holds `index.html` for a few minutes and `raw.githubusercontent.com`
has its own separate cache (verify content through the GitHub Contents API if you must be sure).

**Every release must also bump `CACHE` in `sw.js` (`knowit-vNN`).** The worker is network-first for
the shell so a normal reload shows new HTML, but the cache name is the only thing that purges old
entries and keeps offline users from sitting on a stale shell.

---

## 3. Local development & testing

```bash
cd <repo root>
python3 -m http.server 8799 --bind 127.0.0.1     # must be rooted at the repo, not a parent
# open http://127.0.0.1:8799/index.html
```

Gotchas learned the hard way:

- A `http.server` started from the wrong directory silently serves a directory listing; if the page
  looks empty check `curl -s …/index.html | grep -c startDaily` (should be 4).
- Port 8801/8802 may be occupied by leftovers — check `ss -lptn | grep :PORT` before starting.
- The service worker registers on `https:` and `localhost`/`127.0.0.1` only, and caches aggressively;
  for a clean slate use a fresh browser profile or DevTools → Application → Clear site data.
- Playwright + Chromium live in `/tmp/pw` during a session (ephemeral). Typical script shape:
  seed `knowit_stats_v3` / `knowit_result_v1` in `localStorage`, `page.evaluate(() => { … })` into the
  real functions (`startDaily()`, `finishGame()`, `renderHub()`, `openBrainprint()`), then assert on
  DOM/computed styles. Always check `viewport 360×640`, `390×844`, sometimes `430×932`.
- After a deploy, re-verify **live** (not local) with `?t=Date.now()` and read computed styles, not
  screenshots alone.

---

## 4. index.html architecture

Single classic `<script>` (not a module), plain ES2018+, helper `$(id)`, functions declared at top
level. Structure top→bottom: `<head>` (meta, manifest, Plausible, Google Fonts, one `<style>`), SVG
sprite/defs, three screens, modals, then the script.

### Screens
- `#screen-landing` — pre-completion hero **and** the post-completion hub (toggled by
  `.is-completed` on the screen). Same DOM node serves both states.
- `#screen-playing` — question, options, bet toggle, feedback box, HUD.
- `#screen-results` — hero score/title, duel card, scorecard (grid + stat bar + agg lines),
  blindspot highlights, Brainprint trigger, share text, bottom dock.

Overlays: `#brainprint-modal` (a **full-bleed page**, not a card), `#review-modal`, `#duel-modal`,
`#backup-modal`, `#toast-host`, `#hurt-vignette`, `#confetti-canvas`.

### State
`let state = { mode, screen, questions, currentQ, answers, startTime, qStartTime, waiting,
advanceTimer, feedbackAt, muted, timerId, endlessLives, endlessStreak, lastLostHeart,
lastHeartFrom, betsLeft, armed, duel, pendingDuel, replayDay, … }`.

`state` is in-memory only. Persistence is `stats` (lifetime) + `knowit_progress_v1` (in-flight daily)
+ `knowit_result_v1` (finished daily).

### Main flow
`renderLanding()` → `startDaily()` → `renderQuestion()` → `handleAnswer()` / `handleTimeout()` →
`advanceAfterFeedback()` → `finishGame()` → post-completion home (ranked Daily) or
`showScreen('results')` (Endless, duels, replays) → `viewTodaysResults()` / `openReview()`. Endless: `startEndless()` reuses the same question renderer with its own HUD.

---

## 5. Persistence & data model

Keys (never rename or reshape the first four; new keys are additive only):

| key | shape |
|---|---|
| `knowit_stats_v3` | `{ played, streak, maxStreak, totalCorrect, totalAnswered, bestEndless, lastDate, completedDaily, betsUsed, betsHit, freezes, freezeUsedOn[], categories{} }` |
| `knowit_progress_v1` | in-flight daily: `{ date, puzzle, answers[], index, at, betsLeft }` — deleted on finish |
| `knowit_result_v1` | finished daily: `{ date, puzzle, answers[] }` — drives Results + hub card |
| `knowit_seen_swipe_tip` | `'1'` once the old swipe hint is dismissed |
| `knowit_muted` | `'1'` when audio is muted |
| `knowit_name` | optional 16-char player name used in challenge links |
| `knowit_seen_bet_intro` | `'1'` once the first-run bet explainer has been seen |
| `knowit_pid` | random UUID for anonymous aggregation |
| `knowit_schedule_v1` | `{ v: 1, days }` — last good `schedule.json`, used only when the fetch is slow or fails |
| `knowit_a2hs_dismissed` | `'1'` once the add-to-home-screen hint is dismissed |

`categories` is keyed by the **six umbrella names** and each bucket is
`{ answered, correct, betsWon, betsLost }`. `loadStats()` migrates older saves in place (bets
defaults, freeze fields, umbrella folding) and must stay idempotent.

---

## 6. Daily schedule (the part that must not drift)

Two layers:

1. **Computed** — `buildNextDay()` walks `SET_TIERS` (`E,E,E,M,M,M,M,H,H,H`) through per-tier queues
   seeded by `mulberry32`, respecting `CAT_CAP = 2`, `NO_SAME_DAY` pairs and `HOLD_IDS`
   (`p11, p23, p32, sp13, g36`). `computeDailySetIds(n)` builds day by day; `orderedDailyIds(n)`
   reorders the **already picked** ten with `seededShuffle(ids, n*9973+17+attempt)` from day
   `TIER_SHUFFLE_FROM = 8`, constrained so Q1 is easy/medium and no three hards are adjacent
   (50 attempts, then raw order).
2. **Frozen** — `schedule.json` stores the **final** play order per day (150 days). At startup the
   client fetches it (max 1.5 s, `scheduleReady`), caches the last good copy in
   `knowit_schedule_v1`, validates that every id still exists in `QUESTIONS`, and
   `getDailySetIds`/`orderedDailyIds` prefer the stored day verbatim. Missing/broken → computed.

`tools/freeze-schedule.js` re-derives days from the scheduling code inside `index.html` (it slices
the real source, runs it in a `vm` with inert stubs) and **only appends** days beyond the highest
stored one. It warns (never rewrites) when a published day no longer recomputes identically.
`--days N` extends, `--check` reports only.

**Known consequence of growing the bank:** the per-tier queues are seeded by pool position, so any
added question changes what the generator would pick for *every* day — the tool now warns on all
120 originally frozen days even though the stored days are untouched. `schedule.json` is the
authority; the computed path is only a fallback, and `knowit_schedule_v1` keeps that fallback on the
published set instead of quietly serving a different ten from every other player.

**Never edit past or current days by hand.** Adding questions is: add to `QUESTIONS` → run the tool →
commit `index.html` + `schedule.json` together. Editing text/options is safe (ids are what is frozen);
renaming/removing an id makes those days fall back to computed and the tool will warn.

---

## 7. Game rules (locked)

- **Daily scoring**: standard +1 / −1; bet +2 / −2; timeout −1 (−2 if a bet was armed). Range
  −13 … +13. Three bets per day. Endless is +1 / −1 per question with 3 hearts.
- **Tiers** (daily verdict): ≥11 Omniscient-ish, ≥8, ≥5, ≥1, ≥−2, below.
- **Duel links**: `?d=<puzzle>&vs=<score>_<seconds>[_<name>]`; pre-game modal (name input, Accept /
  Just play); already-played today → head-to-head from saved answers; older link → unranked replay
  (`REPLAY #n`, writes no stats/result/progress); future link → toast. Score floor −13.
- **Streak freeze**: `freezes` (0–2, earned only — one per 7 consecutive days), `freezeUsedOn[]`.
  A gap of exactly 2 days consumes one and keeps the streak; 3+ resets. `effectiveStreak()` keeps a
  1-day-gap streak alive while a freeze is banked and the streak line shows ❄ “Freeze ready”.
- **Endless**: `GAUNTLET_LIVES = 3`; `endlessTimeLimit()` 12 s → 10 s → 8 s; RUN = questions lasted
  (0-correct guard); pace pill at Q6/Q11; last heart pulses crimson. The draw is weighted by run
  length (`endlessWeights`): 0–4 easy/medium, 5–9 medium/hard, 10+ hard, and `endlessPoolBase()`
  removes today's Daily ten so Endless can never spoil the set.
- **Feedback dwell**: `FEEDBACK_MS_CORRECT = 1500`, `FEEDBACK_MS_WRONG = 3500` (misses and timeouts,
  Endless included). The strip carries a 2 px countdown rail in the dwell's colour and is itself a
  skip target; every pending advance is `state.advanceTimer`, cleared by `cancelFeedback()`.

---

## 8. Brainprint

Full-bleed page (`#brainprint-modal`, fixed inset 0, locked column): 44 px top bar (KNOWIT in
**Lexend Zetta** + BRAINPRINT + 44×44 ✕), scrolling middle, docked `Share Brainprint` CTA.
Unlocks at **30 total answers and 3 categories with ≥5 answers** (`BP_MIN_ANSWERED`,
`BP_MIN_CATEGORIES`, `BP_MIN_PER_CAT`). Categories under 5 answers keep an axis but plot at radius 0
with a 40 %-opacity label and no node, and are excluded from strongest/blindspot.

`brainprintType()` derives one of seven shareable identities from the ranked categories only:
The Gambler → The Polymath → The Specialist → Pop-Culture Goblin → Armchair Scholar → The Lab Rat →
The Wanderer, using `UMBRELLA_CATEGORIES` values (never retyped strings). The name is the page
headline (Lexend 20/700), the PNG title and the first line of the share text.
`window.__debugBrainprint(rows)` prints any type from fake rows.

The 720×900 share PNG (`drawBrainprintCard`) is drawn on canvas with hardcoded dark colours on
purpose — it stays dark in every theme. `?s=b` is appended to the URL line.

---

## 9. Current home + results UI

**Routing**: a ranked Daily run now lands on the post-completion home directly (Q10 → `landing`).
`#screen-results` stays for Endless run-overs, `?vs=` ghost duels (head-to-head card) and unranked
replays; `finishGame()` decides with `toHub` and `viewTodaysResults()`/Review forces results.

**Post-completion home** (`.is-completed`), four zones on a 12 px rhythm:

1. **Header + habit bar** — brand mark + Zetta wordmark only, then a centred pill
   (`6px 14px`, radius 999) reading `🔥 {streak}-day Streak · Next set in {countdown}`; `tick()`
   refreshes it.
2. **Today's Set receipt** (`#1F181C`, radius 16, padding 16): `TODAY'S SET · #N` → labelled stat row
   (score / `c/10` correct / `Xm Ys`, values 20/800, crimson under zero) → optional `Bets n/m` →
   optional `Top X% today` → rank title → optional insight (`N of M misses were hard questions.`,
   only on a losing run where hard questions were at least half the misses) → 24 px ten-tile strip
   (check on correct, X on miss, bolt kept on bets; misses carry `data-idx`) → `Tap a miss to see
   what got you.` when there is a miss → filled **Challenge a Friend** + square copy button →
   outline `Review`. `currentSharePayload()` feeds both the results and hub challenge/copy handlers.
3. **Brainprint bridge** — `Best subject: {category} {pct}%` (category kept on one line via
   `.bp-subject`) with `Brainprint ↗`; when locked it shows `Brainprint` + `{answered}/30 answers`.
4. **Endless stage** — compact and secondary: `ENDLESS MODE` + `3 LIVES`, 32 px mark inline with
   `Redeem yourself` (when today's points ≤ 0) or `Want to keep going?`, `Best run: N`, and an
   outlined brand `Play Endless` (44 px). It no longer fills the leftover height.
5. **Install hint** (`#a2hs`) — only when streak ≥ 3, not standalone and
   `knowit_a2hs_dismissed` is unset; uses the captured `beforeinstallprompt` when available, else
   iOS/Android copy. Dismiss sets the key.

Percentile: `loadHubAggregate()` reuses the payload `loadAggregates()` cached (`LAST_AGG`) and
otherwise does one 2 s `GET /agg` per session, rendered through the same `renderAggregates()` gate.

**Results**: brand header → eyebrow (`TODAY'S SET` / `ENDLESS MODE` / `REPLAY #n`) → hero score and
verdict → optional duel card → scorecard (tile grid, `SCORE / CORRECT / TIME`, `#agg-line`
“Top X% today”, `#agg-hardest` “Hardest today: Qk (…% got it)”) → blindspot line → Brainprint
trigger → bottom dock (Challenge / Copy / Play Endless / Home). `#near-miss` shows
“1/2 away from tying your best run.” on Endless results.

---

## 10. PWA / service worker rules

`sw.js` has exactly one `CACHE` constant — **bump it on every release**. It only handles
**same-origin GETs**; cross-origin requests (Plausible, Google Fonts, the stats API) are ignored.
Navigations and `index.html` are **network-first** with the cached copy as offline fallback
(`ignoreSearch`, so `?d=…&vs=…` links open offline); icons/manifest/og-image are cache-first; other
same-origin GETs are network-first with cache fallback. Every fetch is wrapped in try/catch.
`install` caches the shell best-effort + `skipWaiting()`; `activate` deletes other caches +
`clients.claim()`. Consequence: Google Fonts are **not** cached by the SW, so offline typography
falls back to system fonts.

Install criteria still missing: **192×192 and 512×512 icons** (add to the manifest and to `SHELL`).

---

## 11. Analytics

Two independent, optional systems; both are silent when unavailable.

1. **Plausible** (privacy-light, no cookies) — script tag with `data-domain="YOUR_DOMAIN_HERE"`
   (still a placeholder). Every call goes through `track(name, props)` →
   `window.plausible?.(name, { props })` inside try/catch. Events: `landing_view`, `daily_start`,
   `daily_complete` (once per puzzle, never on replays), `share_tap`, `duel_accept`, `duel_result`,
   `endless_start`, `endless_complete`, `brainprint_open`, `question_abandon`.
2. **Anonymous aggregation** — Cloudflare Worker in `worker/` with a KV binding named `STATS`.
   `POST /submit { puzzle, points, correctByPos[10], seconds, playerId }` (validated: puzzle within
   today/yesterday UTC, points −13…13, ten booleans, `playerId` 8–64 chars), de-duped per
   puzzle+player for 3 days, folded into `agg:<puzzle>` `{ n, pointsHist, qCorrect[10] }`;
   `GET /agg?puzzle=N&points=P` returns `{ n, qRate[10], percentileFor }`. 30 req/min per IP, CORS
   for the site origin only. `API_BASE` in `index.html` points at
   `https://knowit-stats.ybachmandagan.workers.dev`, which is **live and answering** (`/agg` returns
   real aggregates). `wrangler.toml` carries a placeholder `id` — `node worker/kv-id.mjs` records the
   real namespace id from the account, and `--check` reports whether it is set.

Client behaviour: one POST + one GET per completed ranked daily, 2 s abort, no retry; “Top X% today”
appears at `n ≥ 2`, “Hardest today” at `n ≥ 20`; the share head gains `· Top X%` once known.
Never sends picks, names or links.

---

## 12. Backup / restore

Home footer → `Backup` opens `#backup-modal`: export builds base64url JSON
`{ v: 1, stats, result: today-only-or-null }` (~6 KB); restore validates version, numeric fields and
`categories`, caps the code at 20 KB, confirms, then **merges** — higher counters win, the newer
`lastDate` brings its streak, category buckets keep the larger `answered`, freezes take the max,
nothing is summed, and `knowit_progress_v1` is never imported.

---

## 13. Design system (do not drift)

- Palette: canvas `#140F12`, card `#1F181C`, recessed `#1A1418`, primary `#F3F4F6`, secondary
  `#B2A4AC`; pink `#F454B0`, glow `#FF6EB4`, orchid `#A855F7`; amber `#F59E0B` (bets only), emerald
  `#21C868`, crimson `#F22933`, ice `#7DD3FC`.
- Brand gradient: `--brand-grad`, `--brand-cta-grad`; the SVG `#knowit-grad` lives in a **zero-size
  SVG** (paint servers inside a `display:none` subtree silently fail in Chrome).
- Fonts: **Lexend Zetta** for the KNOWIT wordmark only; **Lexend** for everything else;
  **JetBrains Mono** (`--font-telemetry`) only for the Endless run badge. `--font-mono` is still an
  alias of Lexend for legacy bits.
- Strict 4 px grid (1/2 px borders exempt). Interactive secondary buttons are 12 px radius / 40 px
  everywhere, including the receipt; `9999px` pills are reserved for non-interactive status/category badges.
- Rubric tiles: 24 px tall, radius 4, 4 px gaps; one renderer (`applyRubricTile`) for all four
  surfaces; bolt/heart icons reuse the HUD geometry byte-for-byte.
- Category pills (gameplay, review) are text pills with a 12 px icon; the Brainprint page uses
  28 px circular icon tokens instead (`makeCategoryBadge`).

---

## 14. Hard rules for the next agent

1. `index.html` stays a single file unless a task explicitly adds files. New files so far:
   `sw.js`, `manifest.webmanifest`, `schedule.json`, `tools/freeze-schedule.js`, `worker/*`,
   `README.md`, `KNOWIT_HANDOFF.md`, this file.
2. Never rename/remove `knowit_stats_v3`, `knowit_progress_v1`, `knowit_result_v1`,
   `knowit_seen_swipe_tip`; only add keys; never change existing field shapes.
3. Never change `QUESTIONS` content or the schedule for past/current days; `schedule.json` is
   append-only and generated by the tool.
4. Never change scoring (see §7) without an explicit instruction, and keep copy in sync with it.
5. Reuse tokens/classes (`--accent-brand`, `--bg-surface`, `.btn-primary`, `.btn-secondary`,
   `.toast`, `.modal-backdrop`) — no new colours outside the palette.
6. Smallest possible diff; match existing style (`$(id)`, semicolons, no refactors of untouched code).
7. Bump `CACHE` in `sw.js` in every release commit, then push and verify live.
8. After shipping, report: functions changed, what was verified (with real numbers), and a manual
   test checklist. The owner tests on a phone and reports from screenshots.

---

## 15. Known issues / open items

- **Mascot asset missing** — `/brain-mascot.webp` 404s, so the Endless hero shows the 🧠 fallback
  tile. Drop the real 96×96 (or larger, transparent) PNG/WebP at the repo root to activate it.
- **192/512 PWA icons missing** — needed for full Android install criteria.
- **Plausible domain placeholder** — `data-domain="YOUR_DOMAIN_HERE"`, so analytics no-ops.
- **`wrangler.toml` KV id is a placeholder** — the worker is deployed and live, but the repo cannot
  redeploy until the real STATS namespace id is recorded: `node worker/kv-id.mjs` (needs
  `wrangler login` once), `node worker/kv-id.mjs --check` to see the current state. A missing
  binding now answers `503 {"error":"not_configured"}` instead of an opaque CF 500.
- **Service worker offline typography** — Google Fonts are cross-origin and deliberately not cached;
  self-hosting the two woff2 files would fix offline rendering if that matters.
- **360×640 is tight** — the Brainprint page scrolls its middle (by design). The hub now fits all
  four zones at 360×640 (endless stage measures 240 px there and 444 px at 390×844); keep new hub
  copy to one line or re-measure.
- `index.html.bak` is a stale, untracked Oct backup — delete it or ignore it; never ship it.
- `GAME_STATE.md` is early, largely superseded notes.

---

## 16. Recent history (newest first)

`HOMEv2` home: challenge-first receipt, labelled stats, tappable misses, compact Endless, install hint
`5127669` daily completion routes to a 4-zone post-completion home (habit bar, receipt, bridge, Endless)
`8de74a5` +300 evergreen questions (1,105 bank), correct answers balanced 75/75/75/75
`0eeff68` +300 evergreen questions (805 bank), Endless difficulty weighting, schedule to day 150
`be68019` feedback dwell 1500/3500ms + 2px countdown rail, tap-to-skip
`76f47f9` worker config: `kv-id.mjs`, 503 on a missing KV binding, docs corrected
`4c8ea68` restore the receipt layout (big points, boxed Brainprint row, 2-up actions)
`721039b` quiz copy + mascot Endless hero + `Keep Playing` CTA
`b33df51` equal 50/50 receipt and hero
`66e3e71` Endless hero card, run heat tiers, last-heart pulse, near-miss callout
`93d72b3` remove home dead gap, full-height Today’s Run, standalone Brainprint button
`2aa6eb3` Brainprint: docked share CTA, scrolling middle, Lexend archetype title
`5605741` Brainprint as a full-bleed page with circular category icon tokens
`de913d5` percentile at 2+ players, hardest line at 20
`6c97071` point `API_BASE` at the deployed worker
`bab53f0` service worker: network-first shell, ignore cross-origin
`d01bdd0` anonymous aggregation worker + client
`c903aea` streak freezes + backup/restore codes
`95fad76` frozen append-only `schedule.json` + tooling
`9485e0e` Brainprint gate + identity types, `2eae585` analytics, `3d872f3` PWA,
`030594f` tier shuffle from #8, `6b91a22` share channel tags, `4e412dd` duel flow overhaul

---

## 17. Quick verification checklist after any change

1. `node --check` the extracted inline script (regex the `<script>` block) and `sw.js`/worker files.
2. Local: pre-completion home, one full daily (bets, timeout, skip feedback), Results, replay link,
   duel link, Endless until death, Brainprint page, Backup export→restore.
3. Sizes 360×640 and 390×844: no horizontal overflow, no clipped cards, CTAs reachable.
4. Push, wait ~80 s, verify live with `?t=` and confirm `CACHE` bumped.
5. Console clean (page errors + `sw.js` errors), especially with plausible.io blocked.
