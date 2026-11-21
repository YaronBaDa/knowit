# KNOWIT — Project Handoff

**A daily 10-question trivia game** (Wordle-style virality). Single-file, zero build, vanilla JS/CSS, deployed on GitHub Pages.

> Last updated: 2026-11-21 · latest code commit `c2b585e` · this doc supersedes `GAME_STATE.md` (stale).

---

## Quick facts

| | |
|---|---|
| **Live URL** | `https://yaronbada.github.io/synapse-trivia/` |
| **Repo** | `github.com/YaronBaDa/synapse-trivia` (branch `main`) |
| **Main file** | `index.html` — 2,778 lines / ~248 KB, the entire app |
| **Stack** | Vanilla HTML/CSS/JS. No framework, no build, no bundler |
| **External deps** | Google Fonts only — **Lexend Zetta 700** + **Lexend 400/500/600/700**. Nothing else loads |
| **Deploy** | GitHub Pages serves `main` root. Push = ship. CDN takes 60–90 s |
| **Question bank** | 505 items in the `QUESTIONS` array (do not dump it) |

---

## Product loop

1. Play today's 10 → score, a verdict line ("Smug."), a 2×5 grid.
2. Challenge a friend (`?d=<puzzle>&vs=<score>_<time>`) or copy the emoji grid.
3. Come back tomorrow (streak) and play Endless (3 lives) after the daily is done.

Modes: **Daily** (hero, deterministic, 20 s/question, 3 bets), **Endless** (random, 3 lives, `RUN` counter), **Duel** (same daily set as a shared link).

---

## Files

```
/root/synapse-trivia/
├── index.html            # entire app: markup + inline <style> + inline <script>
├── knowit-brain.svg      # source of the brand mark (inlined as <symbol id="knowit-symbol">)
├── favicon.png           # 64×64, brain on #140F12 tile in #F454B0
├── apple-touch-icon.png  # 180×180, same treatment
├── og-image.png          # 1200×630 social card (predates the current palette — regenerate if it matters)
├── KNOWIT_HANDOFF.md     # this file
└── GAME_STATE.md         # stale v1 notes — ignore
```

Scratch tooling (not in repo): `/tmp/knowit.js` (extracted inline JS for `node --check`), `/tmp/pw/` (Playwright 1.65 + Chromium), `/tmp/shots/`.

---

## Design system

### Colour tokens (single source: `:root`)

| token | value | meaning |
|---|---|---|
| `--bg-canvas` | `#140F12` | page |
| `--bg-surface` | `#1F181C` | cards |
| `--bg-surface-subtle` | `#2B2227` | option cards, chips |
| `--text-primary` / `--text-secondary` | `#F3F4F6` / `#B2A4AC` | copy |
| `--on-brand` | `#140F12` | text on pink |
| `--accent-brand` | `#F454B0` | brand, primary CTA, **live clock** |
| `--accent-correct` / `--accent-incorrect` | `#21C868` / `#F22933` | answer states |
| `--accent-incorrect-text` | `#FF5C63` | small red text only (AA on surface) |
| `--accent-bet` | `#F59E0B` | **bets only** — bolts, toggle armed, option ring |

**Colour budget rule:** max 1–2 pink elements per screen. Pink = brand + clock + the Brainprint accuracy polygon. Amber = money/bets only. Never mix.

Bet accent switch: `--accent-bet`, `--accent-bet-tint`, `--accent-bet-glow`, `--accent-bet-glow-strong` sit together in `:root` with a comment listing the amber values — swapping those 4 reverts the colour.

### Type scale (8 classes, defined at the END of `<style>`)

`.type-brand` (Zetta 700/0.04em) · `.type-hero` (clamp 36–44, weight 700) · `.type-title` (18/700) · `.type-question` (clamp 18–24/600, `text-wrap: balance`) · `.type-subtitle` (15/600) · `.type-body` (13.5/400 secondary) · `.type-eyebrow` (11/600/0.07em caps) · `.type-hud` (12/500/0.03em tabular).

A **wiring block** immediately after them assigns each component to one tier (selector groups at the end of the sheet, so they win by order). Only type metrics are wired; colours stay with their components. Real computed sizes:

- wordmark 25.2–27.3px Zetta (clamp 24–30, 7vw) · hub wordmark 16px Zetta
- question **17.5px @320×568** (short-viewport rule), **20.16 @360**, **21.84 @390**
- results verdict **24–25.74px/700**, header title 18/700
- HUD rows 12/500, eyebrows 11/600, body 13.5/400, buttons 15/600, options 15/500

**Question size is load-bearing:** a 20px floor clips 20 of 505 questions on a 568px-tall screen. Keep `@media (max-height: 600px) { .question-text { font-size: 17.5px } }`.

### Surface rules

- One card primitive: `--bg-surface`, 1px `--border-subtle`, `border-radius: var(--radius)` (14), **16px padding**.
- Prefer **plain elements over pills**: bet bolts, the bet line and the streak line all sit bare on the canvas (no bg/border/padding). Don't reintroduce chip-style containers without a reason. The **category name is the one exception** — always a `.category-pill`.
- Radii: cards 14, buttons 14, key badges 8, pip strip 999.

### Category pill (`.category-pill`)

Every category name renders inside a pill — gameplay, review modal, and the Brainprint modal. Layout: `inline-flex`, **20px tall**, `padding: 1px 9px 0`, `999px`, 10/600, `line-height: 1`, `0.06em`, uppercase.

- `.cat-row` (wrapper `#q-cat` / `#rm-cat`) sits directly above the text with **`margin-bottom: 10px`**, `#q-text` keeps `margin-top: 0`, so the pill reads as part of the question.
- `.progress-strip` is `margin-bottom: 22px` so the 10 segments stay grouped with the HUD above.
- Short-viewport override (`max-height: 600px`): strip 12px, pill 8px, stage `padding-bottom: 4px` — keeps the 505-question sweep at **0 clipped** on 320×568.
- Colours come from `applyCategoryPillStyle(el, name)` (JS, not CSS): 6 muted palettes — green `#6EE7B7` (Nature/Biology/Earth/Animals), stone `#D6D3D1` (History/Geography/Travel), blue `#7DD3FC` (Science/Space/Tech/Math), orange `#FDBA74` (Sports/Games), purple `#D8B4FE` (Literature/Arts/Music/Books), red `#FDA4AF` (Pop Culture/Film/TV). **No palette is amber**, so a pill can never read as a bet. Unknown names hash (FNV-1a) across the 6 in declaration order.
- Keyword map covers all bank categories; `Food & Drink` and `Business` are unmapped and therefore take the hash.

---

## Screens

**Landing — pre-completion** (`#screen-landing:not(.is-completed)`): brain mark (clamp 96–116px) → `KNOWIT` → 2-line tagline (14/400 secondary). Pinned footer holds `#streak-bar` (plain 12/400 line, hidden at streak 0), `Daily #N` (12/400) and the pink CTA (15/600). Footer rhythm: 4px between meta lines, 8px above the CTA. `#landing-stats` is force-hidden.

**Landing — post-completion hub** (`.is-completed`): header row (28px mark + Zetta wordmark + pink streak pill), `Today's Run` card (eyebrow → `18px/700` score line with muted `18/500` tail → 10-cell mini grid → `Next set in … · N played · Best Nd` → Review/Share), then the Endless card (pink `KEEP GOING` eyebrow → 18/700 title → 13.5/400 line → pink CTA).

**Playing**: header (meta `Daily #N` / `ENDLESS · Q01`, three amber bet bolts, timer text) → timer bar → 10-segment progress strip → category pill (10px above the question) → question → answer dock (bordered top edge, 4 option cards) → bet line above the dock → feedback strip (absolute, floats over the bet line).

**Results**: header (`Today's Set` + `Daily #N`) → verdict `clamp(24–28)/700` + streak badge → scorecard (5×2 grid · divider · 4-col stat bar · tap hint) → Blindspot line (outside the card) → Brainprint bar → Challenge CTA + 44px copy icon → Play Endless → footer `Next set in … · Home`.

**Brainprint** (`.bp-*`, `#brainprint-modal`): one compact bar on Results (below the scorecard) and inside the Today's Run card on the hub. Unlocked at ≥5 answers across ≥3 categories — otherwise a muted "Play 3+ categories to unlock" pill that still opens the modal in calibration mode. The modal is a 380px card: KNOWIT/Zetta + BRAINPRINT eyebrow, a plain 300×300 SVG spider web (3 rings + spokes at `rgba(255,255,255,.1)`, **no watermark**), a Hot Pink accuracy polygon (`#F454B0` / `rgba(244,84,176,.22)`), pink default dots with amber bet nodes, legend, 3-column summary at 20/700, every played category as a pill. Type is three tiers only: 20/700 figures, 12.5px rows + legend, 10/600/0.06em micro labels. "Share Brainprint" renders the same card at 720×900 on canvas (`knowit-brainprint.png`): `navigator.canShare({files})` → native share, else download + clipboard summary and the button reads "Saved & Copied ✓" for 2 s.

**Review modal**: 18/700 question, 11/600 labels, 13.5/400 did-you-know, sticky primary action.

### Bottom thumb zone (all screens)

`#app` and `.screen` are `100dvh` flex columns; each screen owns one bottom dock that carries `padding-bottom: max(18px, env(safe-area-inset-bottom))`:

- **Landing (pre-completion)**: `.landing-body` flexes and centres; `.landing-footer` (`Daily #N`, streak line, pink `Play Today's Set`) is `margin-top: auto`.
- **Hub (post-completion)**: `.hub-cards` is `flex: 1` and `.endless-teaser` takes `margin-top: auto`, so `Play Endless` sits at the bottom inside its own card.
- **Playing**: `.question-stage` flexes; `.mid-slot` (feedback + bet) and `.options-grid` form the bottom block (`margin-top: auto` on the slot, `18px` safe padding on the grid). No extra button under the answers.
- **Results**: `.results-body` scrolls above a `.results-footer` dock that holds Challenge + Copy, Play Endless, then countdown · Home (`margin-top: auto`, gap 10).
- **Modals**: `.modal-cta` / `.bp-cta` wrap the primary button and are `position: sticky; bottom: 0` on `#1F181C` with `padding-top: 12px`, so long review lists scroll behind them.

---

## Logic that must not drift

| area | rule |
|---|---|
| **Day boundary** | UTC everywhere. `LAUNCH_UTC = Date.UTC(2026,10,18)` → puzzle #1 = 2026-11-18. `getToday()`, `getDailyNum()` |
| **Daily set** | `getDailyQuestions(dayNum)`: tier ramp E,E,E,M,M,M,M,H,H,H; `CAT_CAP = 2`; `NO_SAME_DAY` pairs; `HOLD_IDS` (p11, p23, p32, sp13, g36) never scheduled; queues refill with their own seed so no repeats |
| **Answer side** | slot placement uses a second seed (`dayIndex*7919 + pos*104729`) — deterministic per day, never a rotation |
| **Timer** | 20 s per question; `FAST_TIME_SEC = 55` aggregate; pct-based warn/danger classes |
| **Bets** | 3/day; +2 correct, −1 wrong, refunded on timeout; swipe 96px reveals / 56px commits; bolts go hollow as they're spent |
| **Streak** | participation, not score: `streakAfterCompletion` + `dayDiff`; `effectiveStreak` returns 0 after a missed day |
| **Endless** | 3 lives, random without repeats (`state.endlessUsed`), `RUN` counter, best stored as `bestEndless` |
| **Feedback pacing** | `FEEDBACK_MS_CORRECT = 1800`, `FEEDBACK_MS_WRONG = 3200` |
| **Duels** | `?d=<puzzle>&vs=<score>_<time>`; wrong-day or already-played links are cleared with a toast |

### localStorage (do not rename or extend)

`knowit_stats_v3` — `played, streak, maxStreak, lastDate, completedDaily, totalCorrect, totalAnswered, bestEndless, betsUsed, betsHit, categories`
`knowit_progress_v1` — mid-daily resume (validated against the current id list)
`knowit_result_v1` — today's finished run (drives the hub card + "Review")

`categories` is a silent lifetime map: `{ "<Category>": { answered, correct, betsWon, betsLost } }`. `recordCategoryStat(q, isCorrect, isBet, answerIndex)` writes one row per answer (Daily and Endless, timeouts included as a plain miss — no bet), guarded against double-submits and resumed dailies by an answer-index Set that resets per run. `getCategoryStats()` returns the read-only aggregate sorted by `answered` desc (`category, answered, correct, accuracy %, betsWon, betsLost`); it feeds the Brainprint modal via `brainprintData()` (top 6 axes, padded at 0% from the bank).

---

## How to verify a change

```bash
cd /root/synapse-trivia
python3 -c "import re;s=open('index.html').read();open('/tmp/knowit.js','w').write(re.search(r'<script>(.*?)</script>',s,re.S).group(1))"
node --check /tmp/knowit.js
python3 -m http.server 8799 --bind 127.0.0.1 &   # background:true in the tool
```

Then drive it with Playwright (`/tmp/pw/node_modules/playwright`). Minimum bar for any UI change:

1. **Viewport matrix** 320×568, 360×640, 390×844 — assert `scrollHeight - innerHeight === 0` and `scrollWidth - innerWidth === 0`.
2. **Question sweep** — loop all 505 questions through `state.questions=[q]; renderQuestion()` and assert no `#q-text` bottom crosses the stage bottom (must stay **0/505**).
3. **Sample the real functions**, never a reimplementation: seed `localStorage`, reload, and read computed styles.
4. **Colour budget** — count visible elements whose text/bg/border/shadow contains `rgb(244, 84, 176)`; daily and endless gameplay must be 1–2.
5. **Syntax** — `node --check` on the extracted script every time.

Live check after push: wait ~75 s, then `curl "https://yaronbada.github.io/synapse-trivia/?nocache=$(date +%s%N)"` and grep for the new token. `raw.githubusercontent.com` and the Pages CDN cache independently; the GitHub Contents API is the only truthful source immediately after a push.

**Gotcha:** `getComputedStyle` returns mid-transition values. Anything with `transition: … .2s` needs ~350 ms before you read colours, or you'll "find" bugs that aren't there (this cost an hour on the bet ring).

**Gotcha:** `p.evaluate()` with a template-literal string ignores its second argument. Define the probe as a real function.

---

## Working agreements

- Batches are surgical: change what's asked, leave the rest. Report before/after numbers, verification output, and anything noticed but not changed.
- Do not touch game mechanics, copy, or the localStorage schema unless asked.
- No new fonts, no JetBrains Mono, no new font families. Lexend everywhere; Zetta only for the wordmark.
- Verify against real code paths; commit messages state the change, not the process.

---

## Known leftovers (safe, cosmetic)

- `#hero-score` is `display:none` since the scorecard refactor, so `.type-hero` currently has no visible consumer. The stat bar's `24/700` PTS number is the de-facto hero.
- Timer shows **both** a bar and `00:00.5` — redundant but useful mid-question.
- The bet reveal's `+2 / −1` sits at 10px (must fit a 96px swipe panel under an 11px `BET`).
- `.bet-token-bolt`, `.stat-chip`, `#btn-practice`, `.cell-glyph` are unused selectors/ids left in place.
- `og-image.png` predates the current palette (pink/green swap) — regenerate before sharing.
- `GAME_STATE.md` is stale; `KNOWIT_HANDOFF.md` replaced it.

## Commit trail (style pass)

```
c2b585e  full-screen type and density audit, verdict promoted, category chip removed
4ba34b7  quiet pre-completion landing, streak grouped with the CTA
f035086  bet bolts and toggle sit plain on the canvas
3787c27  3-bolt bet meter, larger question type
a57c1fd  Lexend-only 8-tier type scale, JetBrains Mono removed
827ff49  lifetime daily stats live in Today's Run card
11e23dc  endless uses RUN, quieter RUN counter
3ded6c3  amber reserved for bets, pink capped per screen
```
