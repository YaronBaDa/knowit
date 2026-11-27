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

### Buttons

One system, defined at `:root`: `--btn-h-lg: 48px`, `--btn-h-md: 44px`, `--btn-h-sm: 40px`,
`--btn-r: 12px`, `--btn-pad-lg/md/sm: 0 20/16/12px`.

- **Primary** (`.btn-primary`, `#er-again`, `.bp-share`) — 48, `0 20px`, 16/700, brand pink on `--on-brand`.
- **Secondary** (`.btn-secondary`, `.er-btn`, `.rv-btn`) — 44, `0 16px`, 16/700 or 14/700 for the
  compact endless pair, one surface: `rgba(255,255,255,.04)` + `1px rgba(255,255,255,.14)`.
- **Brand outline** (`.btn-outline-brand`) — 44, secondary geometry, brand border + brand text.
- **Icon** (`.icon-btn`, `.audio-btn`, `.rv-close`, `.bp-close`) — 40, no padding, 20px glyph;
  `.copy-btn` inherits the height of the row it sits in (44, or 48 beside a primary).
- **Compact rows** (`.bp-bridge`, `.er-bridge .er-btn`, `.bet-toggle`) — 40, in-card only.
- **Text links** (`.tc-inline-link`, `.backup-link`, `.link-home`) — 14/700 in body colour, no chrome,
  with a `::after` hit expander that gives a 44px target without moving layout.
- Tiles (`.er-tile`, `.rv-tile`) are 24px display elements, not buttons; chips (`.et-lives`,
  `.category-pill`) are 24px pills. `.option-btn` is an answer card sized by its content.

Never introduce a new height, radius or padding for a button: pick one of the three tiers.

### Screens
- `#screen-landing` — pre-completion hero **and** the post-completion hub (toggled by
  `.is-completed` on the screen). Same DOM node serves both states.
- `#screen-playing` — question, options, bet toggle (= the swipe prompt), feedback box, HUD.

**Bet discoverability.** The prompt above Option A is `#bet-toggle` itself — a real 36px button, one
line, 14px/400 secondary copy with a 14px amber bolt (`var(--accent-bet)`, gap 6px). `updateBetUI()`
derives its copy from `lifetimeBetsPlaced()`: no lifetime bets → `Swipe an answer right to bet
(+2 / −2)`; otherwise → `Swipe right to bet · +2 / −2 (n left)`; at zero bets → `0 bets remaining`
with the bolt at `opacity: .4`; armed → `Bet armed · pick your answer`. `lifetimeBetsPlaced()` reads
`stats.betsUsed`, falling back to the `betsWon + betsLost` sum across `stats.categories`. The one-shot
`#swipe-tip` and `#bet-intro` panels are no longer displayed (markup and their localStorage keys
stay) and `showSwipeTip()` is gone.

**Q1 peek.** `maybePeekBet()` runs from `renderQuestion()` only when the mode is daily, the question
is Q1 and unanswered, `lifetimeBetsPlaced()` is 0 and `prefers-reduced-motion` is not set. 250ms
after render, Option A's `.option-body` slides 12px right over 200ms `ease-out` while `.bet-reveal`
shows `rgba(230,180,80,.16)`, then springs back over 250ms `cubic-bezier(.34,1.56,.64,1)` and clears
every inline style. `cancelPeek()` fires on pointerdown / touchstart / keydown / wheel (capture,
passive), at the top of `handleAnswer()` and at the start of each render, so taps and drags are never
delayed — a real right-swipe afterwards still arms the bet.
- `#screen-results` — two mutually exclusive layouts. **Daily**: hero score/title, duel card,
  scorecard (grid + stat bar + agg lines), blindspot highlights, Brainprint trigger, share text,
  bottom dock. **Endless** (`.is-endless`, which hides every block above): `#endless-result` in
  three zones — the run card (ENDLESS MODE + `Best run: n`, a 40px correct-count numeral,
  `n/m correct · verdict`, an optional amber near-miss line, a flat 24px tile strip that wraps
  past ten tiles, the `time · Tap a heart to review` line, then Review answers / Share), a single
  Brainprint bridge row (`Top: <subject> (<pct>%)` + `Brainprint ↗`), and a dock with a 48px pink
  Play Again over a 40px Home. Tiles carry no border, shadow or well: mint for hits, coral with the
  broken-heart glyph for misses, and a missed tile jumps Review to that question.

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

**Post-completion home** (`.is-completed.active` — the `.active` is load-bearing: without it the
finished home kept `display: flex` while inactive, stayed in the flow under every other screen and
pushed the question screen below the fold, which read as "Play Endless does nothing").
It is a full-height flex column: `#screen-landing.is-completed`
takes `height/min-height: 100dvh`, `justify-content: space-between`, a 12 px gap and
`padding-bottom: max(16px, env(safe-area-inset-bottom))`, so the last card always finishes at the safe
area with no dead space. The brand header, the Brainprint bridge and the Endless card keep their
intrinsic height (`flex: 0 0 auto`); the Today's Set receipt is `flex: 1 0 auto` with
`justify-content: space-between` — it grows to take every spare pixel but never squashes its content,
and the Challenge row is its last child (17 px of card padding below it). Below 700 px height the
body padding and stack gap drop to 8 px so the Endless card still clears the safe area at 360x640.

Four zones on a 12 px rhythm. The streak and countdown
live inside the receipt (no floating pill): a 14 px row with the pink flame + `N-day streak`
(number at 600) on the left and muted `Next set in Xh Ym` on the right, then a 1 px `--border`
divider.

1. **Today's Set receipt** (`#1F181C`, radius 16, padding 16, flex column), strictly in this order:
   streak row + divider → `TODAY'S SET · #N` → archetype as the card headline (28/700) → score line
   (28/700, `nowrap`; only the minus of a negative is crimson) → **meta row** (`c/10 correct · Xm Ys`
   at 14/400 muted + `Review answers` at 14/700, `align-items: baseline`, `space-between`, both
   `nowrap`) → percentile → `Bets n/m` (only when a bet was placed) → 24 px ten-tile strip →
   optional bets nudge → **Challenge a Friend + copy button** (`margin-top: auto`, `padding-top: 12`,
   so the CTA owns the bottom of the card). Every secondary inline action in the hub — `Review
   answers`, `Brainprint ↗` — wears the same `.tc-inline-link` class: transparent, borderless,
   `padding: 0`, 14/700 `#F3F4F6`, underline on hover/focus, `opacity: .7` on tap.
   The nudge reads `No bets placed. A bet on a sure answer scores double.` and shows only when no
   bet was placed **and** `correct >= 6` **and** `stats.played <= 10`. `currentSharePayload()` feeds
   both the results and hub challenge/copy handlers.
2. **Brainprint bridge** — `Best subject: {category} {pct}%` (category kept on one line via
   `.bp-subject`) with `Brainprint ↗`; locked shows `Brainprint` + `{answered}/30 answers`.
3. **Endless stage** — compact: `ENDLESS MODE` + `3 LIVES`, 32 px mark inline with
   `Redeem yourself` (points ≤ 0) or `Want to keep going?`, `Best run: N`, outlined brand
   `Play Endless`.
4. **Install hint** (`#a2hs`) — streak ≥ 3, not standalone, `knowit_a2hs_dismissed` unset.

**Time is capped per question.** `DAILY_QUESTION_LIMIT_MS = 20000` and `endlessTimeLimit(i)` feed
`answerLimitMs(i, mode)` → `questionTimeLimit()` / `capQuestionTime(ms)`, which the timer, the
`handleAnswer`/`handleTimeout` capture and the resume offset all use. A backgrounded tab or a resumed
save therefore records at most the limit for that question (and resumes into a timeout rather than an
hour-long question). Stored results are never rewritten: every display (hub receipt, results stat
bar, share text, duel card/modal, aggregate POST) reads through `cappedTotalMs()` / `cappedSeconds()`,
so a run never shows more than `questions x limit`.

**Voice system (`VOICE`).** The finished-day receipt's verdict is now a band headline plus one
caption. `VOICE.headline` holds seven pools keyed by correct answers (`c0`, `c1_2`, `c3_4`, `c5_6`,
`c7_8`, `c9`, `c10`); `VOICE.line` holds eight pools keyed by the bet/clock outcome. Both picks are
pure functions of stored data — `voiceHeadline(correct, puzzle)` indexes with
`(puzzle * 7 + correct * 3) % pool.length`, `voiceLine(answers, puzzle)` with
`(puzzle * 5 + betsUsed + timeouts) % pool.length` — so a stored result always renders the same copy
and consecutive puzzles in one band cannot collide (pool of ten, step of seven). Line priority:
`timeoutMany` → `betsAllHit`/`betsAllMissed` → `oneHit`/`oneMiss`/`betsMixed` → `timeout1` →
`noBets`; `{k}` is replaced with the timeout count. Flags come from the stored answers only
(`bet` boolean, timeout = `picked === null`); if either flag is absent the caption is skipped and the
headline shows alone. `fitVoiceHeadline()` keeps the 28px headline on one line — it tightens tracking
to -0.02em, then applies a small `scaleX` (0.93 at worst, four strings at 360px) — and never changes
font-size, so the card height is stable. Nothing is written back to storage and the share text,
Brainprint and Endless copy are untouched.

**Boot + splash.** `#boot` is a fixed, full-screen lockup (72 px symbol, `KNOWIT` at 20 px
`var(--font-display)`, 8 px gap, both centred) in the initial HTML, so it paints before the 3.5 MB
script parses; it fades out 420 ms after `load` (2.5 s hard fallback) and is removed from the DOM.
Lexend Zetta 700 (latin, ~15 KB woff2) is **embedded as a base64 `@font-face` with `font-display:
block`**, and the Google Fonts link now serves Lexend only — the wordmark can never fall back to a
system face, on first paint or offline. `manifest.webmanifest` ships 192/512 `any` icons plus a
512 `maskable` one (generated from `#knowit-symbol` on `#140F12`), which is what Android uses to draw
the PWA splash; the splash's own app-name line is rendered by the OS in the system font and cannot be
styled from the page.

**Review Answers carousel (`#screen-review`).** The home receipt's `Review answers`, and a tap on any
miss tile, open a full-screen review: a 48 px flex header (`[symbol] KNOWIT · #n REVIEW` on the left,
40 px ✕ on the right), a 10-tile scrubber on the rubric geometry (24 px tall, 4 px radius, 4 px gaps,
emerald/crimson, 12 px bolt when the question was bet, 2 px white border on the active tile) two-way
synced with a horizontally snapped 10-slide track (each slide exactly one track width; a slide scrolls
vertically only when its card is taller than the viewport), and a dock holding just `← Previous` /
`Next Miss →` / `Next →` / `Done` (48 px). It opens on the first miss (Q1 on a 10/10). Each card is
three zones: the 20 px stem, the four options in the in-game reveal language (dark surface + 2 px
emerald border + ✓, dark surface + 2 px crimson border + `✕ Your pick`, everything else at 42 %
opacity), then a hairline divider, the `EXPLANATION` label and the note. The per-slide delta is derived
from the answer itself (`correct` + `bet`), never from stored points, so a missed bet reads
`−2 pts (Bet Missed ⚡)` in crimson and a timeout reads `−1 pt (Too slow)`.

**Playing screen answered state.** On answer or timeout `#screen-playing` gains `.is-answered`: the
countdown row is hidden with `visibility: hidden; opacity: 0` (it keeps its box, so nothing jumps), the
bet toggle is removed from the flow, and the explanation strip takes that space. `renderQuestion()`
clears the class. The question stem is 20px/1.2 (one step above the 16px answer cards); below 700px
height the options' bottom padding, the category row's margin and a 2-line explanation clamp keep a
four-line stem readable above the strip. The old 2px auto-advance rail inside the feedback box is gone.

Percentile copy (`percentileCopy()`, server value = share of players beaten): `p >= 50` →
`Top {100-p}% today` (min 1); `10 <= p < 50` → `Beat {p}% of players`; `p < 10` → nothing. The share
header only gains `· Top X%` when `p >= 50`. `loadHubAggregate()` reuses the cached `LAST_AGG` and
otherwise does one 2 s `GET /agg` per session.

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
  mint `#5CCB9D`, coral `#E8675E`, soft coral text `#F0918B`; amber `#E0A855` is bets-only.
  Category pills are neutral (`#B2A4AC` on a 6% white wash) — no per-category hues. `--accent-brand` is the only pink token (`--brand-pink` merged into
  it); ice, indigo, glow, orchid and the unused correct-tint tokens were removed.
- Brand gradient: `--brand-grad`, `--brand-cta-grad`; the SVG `#knowit-grad` lives in a **zero-size
  SVG** (paint servers inside a `display:none` subtree silently fail in Chrome).
- Fonts: **Lexend Zetta** for the KNOWIT wordmark only (`.hub-wordmark`, `#screen-results
  .hub-wordmark`, `.bp-wordmark`); **Lexend** for everything else. `--font-mono` and
  `--font-telemetry` both alias `--font-sans`, so old selectors keep working. The one exception is
  `.backup-code` (export + restore fields), which uses `ui-monospace, Menlo, monospace` so `1/l/I`
  and `0/O` stay distinguishable with no network font.
- **Type scale is 7 steps, 14 px floor:** 14 (labels, eyebrows, meta, chips, pills, secondary
  buttons, timers, run badges, category tags) · 16 (question stem, answer buttons, primary CTAs,
  verdict subtitles, Brainprint rows) · 20 (card titles, modal titles, duel scores, KPI numerals) ·
  24 (callouts, results stat bar) · 28 (home score, archetype, verdict headline, landing tagline) ·
  32 (`.type-hero` display utility) · 40 (reserved for the two hero numerals: Daily points and the
  Endless run on `#hero-score`). `.lives` and `.bp-close` keep `font-size: 20px` because there it
  sizes the glyph, not copy.
- **Two weights only: 400 and 700.** 700 = wordmarks, hero scores, card/modal titles, verdict
  headlines, CTAs, answer options, active bet/status toggles, toasts. 400 = body, subtitles, notes,
  14 px metadata, timestamps, countdowns, captions. Google Fonts loads `Lexend:wght@400;700` and
  `Lexend Zetta:wght@700`; canvas `ctx.font` and the share-card SVG use the same pair.
- **Three line-heights, three trackings.** `line-height` is only `1` (icons, pills, chips, buttons),
  `1.2` (20 px+ headings, titles, verdicts, hero numerals) or `1.4` (14–16 px body, stems, options,
  notes). `letter-spacing` is only `-0.01em` (20 px+ display), `0` (body, stems, options, counters)
  or `0.04em` (uppercase eyebrows, category pills, badges, wordmark). Uppercase labels came down
  from 0.06–0.08em to 0.04em so 14 px tracked text stays on one line at 360 px.
- Lexend ships **no `tnum` feature** — `font-variant-numeric: tabular-nums` is a no-op there, so live
  numbers are held still with an explicit `min-width`: `.q-timer-text` 7ch (its `00:00.0` format),
  `.endless-hud .streak` 11ch (its `RUN: NN` pill). Verified: the timer renders 56 px for every
  sample and the run pill 88 px for RUN: 00 → 99.
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

`BTNSYS1` button consolidation: 9 heights -> 3, one secondary surface, tokens for radius/padding
`ENDRES1` endless results rebuilt as card -> bridge -> dock; hero shows correct answers
`BET1` always-on swipe prompt with state copy, Q1 peek-and-spring for first-time bettors
`ENDLESS1` fix: inactive completed home pushed the game screen below the fold; Endless entry delegated
`VOICE1` headline + bet/clock caption on the receipt
`HOME1` full-height receipt card, icon-free left-aligned Endless card
`BOOT1` brand boot lockup, embedded Zetta wordmark face, 192/512/maskable icons
`REVIEW2` reveal-style options, clean header lockup, true point deltas, 24px scrubber, no back link
`REVIEW1` swipeable Review Answers carousel replacing the home→results review hop
`HUB1` Review answers joins the counter line, shared inline-link style, CTA pinned to the card bottom
`TIME1` per-question time cap at capture + clamped display, dock hairline hidden under the explanation
`Q20` 20px question stem, countdown hidden while the explanation shows, dwell rail removed
`COLOR1` softened semantics (mint/coral/amber), neutral category styling, no hardcoded old hues
`TYPO4` 3 line-heights (1/1.2/1.4) + 3 trackings (-0.01/0/0.04em), tighter uppercase labels
`TYPO3` two-weight system: everything is 400 or 700 (51 CSS + 11 canvas/SVG weights)
`TYPO2` 7-step type scale with a 14px floor (84 declarations remapped)
`TYPO1` drop JetBrains Mono, OS mono for backup codes, tabular guards, token cleanup
`0199837` score line replaces stat labels, nudge under grid, accent flame, tighter Review spacing
`28667a2` in-card streak row, archetype-first order, percentile wording, Review link, bets nudge
`6b138d0` home: challenge-first receipt, labelled stats, tappable misses, compact Endless, install hint
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
