# KNOWIT — Project Handoff

**A daily 10-question trivia game** (Wordle-style virality). Single-file, zero build, vanilla JS/CSS, deployed on GitHub Pages.

> Last updated: 2026-11-18 · Latest commit `2899332` · This doc supersedes the older lean `GAME_STATE.md`.

---

## Quick facts

| | |
|---|---|
| **Live URL** | `https://yaronbada.github.io/synapse-trivia/` |
| **Repo** | `github.com/YaronBaDa/synapse-trivia` (branch `main`) |
| **Main file** | `index.html` (~2,107 lines, ~210 KB) — the entire app |
| **Stack** | Vanilla HTML/CSS/JS, no runtime framework, no build step |
| **External deps** | Google Fonts only (Lexend 400–900 + JetBrains Mono) |
| **Repo name** | `synapse-trivia` (internal name kept for backward compat; product name is **KNOWIT**) |
| **Deploy** | GitHub Pages, serves `main` root. Push = ship. |

---

## Product overview

KNOWIT is a high-speed, minimalist daily trivia game. The **Daily 10** is the hero mode (same 10 questions for everyone each day), with **Endless Mode** as a gated secondary loop, **ghost duels** via URL challenge links, and **streaks/bets** for retention.

The core retention/virality loop mirrors Wordle:
1. Play today's 10 → get a score + a persona archetype + a 2×5 emoji grid.
2. Challenge a friend (duel URL) or post the grid.
3. Come back tomorrow (streak) and play Endless after finishing the Daily.

---

## Architecture & files

```
/root/synapse-trivia/
├── index.html            # THE ENTIRE APP (HTML + inline <style> + inline <script>)
├── og-image.png          # 1200×630 social share card (Lexend, brand accent, grid motif)
├── favicon.png           # 64×64 accent "K" mark
├── apple-touch-icon.png  # 180×180 accent "K" mark
├── GAME_STATE.md         # older, leaner handoff (superseded by this doc)
└── index.html.bak        # STALE v1 backup (28 KB / 15 questions) — do NOT edit
```

- **CSS**: inline `<style>` in `<head>` (lines ~29–430).
- **JS**: inline `<script>` at end of `<body>` (lines ~570–2107).
- **Question bank**: `QUESTIONS` array inline in JS (505 items — do NOT re-read/dump; it's large).

Scratch files (NOT in repo): `/tmp/test_v7.js` (DOM-shim test harness), `/tmp/knowit.js` (extracted inline JS for `node --check`).

---

## Game modes & rules

### Daily 10 (hero mode)
- 10 questions, **deterministic per date** (seeded PRNG → same set + same option order for everyone, globally).
- Per-question timer: **20 s**.
- **3 bets** per game (see Bet mechanic).
- Headline score = `x/10` (count of correct answers).
- Streak: `>= 7` correct increments the daily streak; `< 7` resets it.
- Completing the Daily unlocks Endless on the home screen.

### Endless Mode (gated secondary)
- 3 lives (heart icons). Wrong answer = −1 life; timeout = −1 life.
- Per-question timer: **15 s**. No bets.
- Streak counter (mono `STRK: 05`, "blazing" glow ≥ 5).
- Hidden on landing until today's Daily is completed.

### Ghost duels (zero-backend)
- Challenge URL format: `?vs=SCORE_SECONDS[_NAME]` (seconds rounded to 0.1).
- Opening a `?vs=` link shows a duel banner during play and a **VICTORY / DEFEATED / TIED** result card at the end.
- Tie-break: lower time wins.

---

## Bet mechanic — current: SWIPE-RIGHT-TO-BET

> History: bet bar → swipe-right (v1) → hold-to-lock (brief) → **swipe-right (email-style)**. Current implementation is the email-style swipe.

- **Tap** an option = standard answer (+1 correct / 0 wrong).
- **Swipe right** on an option card → the card slides right, revealing a solid **amber** `⚡ BET / +2 −1` panel at the left edge (email-app "reveal action" pattern).
  - Reveal width: **96 px**; commit threshold: **56 px**; angle lock (`|Δx| > |Δy| × 1.5`, `Δx > 0`, vertical > 25 px cancels).
  - Release past threshold → haptic double-buzz, snap back, bet resolves (+2 correct / −1 wrong).
  - Release short → card glides back, no penalty, no answer (below-threshold swipe = nothing).
- **Keyboard** (desktop): `1–4` / `A–D` = answer; `Shift + key` = bet.
- 3 bets per Daily; unspent bets are lost at game end.
- **Bet tokens** in the header: a pill badge `[⚡ ● ● ○]` — unspent pips are **indigo** (`--accent-indigo`), spent pips animate into hollow rings.
- Stats: `betsUsed` / `betsHit` (lifetime, daily only).

---

## Scoring & persona archetypes

- Points are secondary: correct +1, correct+bet +2, wrong+bet −1, wrong 0, timeout 0 (bet refunded).
- **Archetypes** (replace the old "pace" label on results), priority order:
  1. `< 5/10` → **THE EGO CHECK** (skull)
  2. 3 bets, 0 hit → **THE ADRENALINE JUNKIE** (dice)
  3. 3 bets, 3 hit → **THE SNIPER** (target)
  4. `≥ 9/10` + fast (<55 s) → **THE SYNTHESIZER** (lightning)
  5. `≥ 7/10` + slow → **THE GRANDMASTER** (chess)
  6. `≥ 7/10` + fast → **THE SNIPER** (target)
  7. fallback → **THE GRANDMASTER** (chess)

---

## Results screen (summary)

Top → bottom:
1. **Hero score** (`8/10`) + **archetype** (monochrome SVG + name) + sub (`Total 1m 9s • <archetype sub>`).
2. **Streak badge** — flame + `N-day streak`, or dimmed `Streak broken` (hidden on first-ever play).
3. **Duel result card** (duel runs only).
4. **Highlights** — bet line first, then mastery + blindspot:
   - `⚡ 0/3 bets placed · Tip: Swipe right on an answer you know to bet +2 / -1!` (when 0 bets used)
   - `🔥 Top Categories: … (100%)` (capped at 3)
   - `❄️ Blindspot: <cat> (n/m)`
5. **2×5 heatmap grid** — ✓/✕ glyph on every cell; bet cells get a 2 px indigo ring; wrong cells tappable.
6. **Review modal** (tap a red cell) — question, your answer, correct answer, bet, "Did you know?" factoid.
7. **Actions** — `⚔️ Challenge a Friend` (emerald, primary), `📋 Copy Grid Only` (dark), `⚡ Play Endless Mode` (dark, daily only), `Home Menu`.

---

## Share / viral engine

Two differentiated CTAs (buttons carry inline SVG icons via JS injection):

- **Challenge a Friend** (emerald) → `navigator.share` native sheet on mobile, clipboard fallback on desktop. Copies:
  ```
  KNOWIT Daily #1028 ⚡ 8/10
  THE GRANDMASTER (1m 9s)

  🟩✅🟩🟥🟩
  🟩🟩🟩🟩🟥

  Blindspot: History ❄️
  Can you beat my score?
  https://…?vs=8_69
  ```
- **Copy Grid Only** (dark) → clean emoji blocks, no link, no blindspot (for Reddit/Discord/group chats):
  ```
  KNOWIT Daily #1028 ⚡ 8/10
  🟩✅🟩🟥🟩
  🟩🟩🟩🟩🟥
  ```

Emoji mapping in the grid: 🟩 correct, 🟥 wrong, ✅ correct-bet, ❌ wrong-bet. (These 4 emojis are clipboard-only; the brand ⚡ appears in the header line.)

---

## Color system (current token set)

Defined in `:root`. **Fonts/typography are intentionally NOT part of the color system — do not touch them.**

| Token | Value | Use |
|---|---|---|
| `--bg-canvas` | `#0F1117` | global backdrop |
| `--bg-surface` | `#1A1D26` | question card, modals, panels |
| `--bg-surface-subtle` | `#242836` | option buttons, key hints, category chips |
| `--border-subtle` | `rgba(255,255,255,.08)` | borders/dividers |
| `--text-primary` | `#F3F4F6` | main text |
| `--text-secondary` | `#94A3B8` | metadata, timers, counters |
| `--accent-correct` | `#10B981` | correct answers / checks / emerald CTA |
| `--accent-incorrect` | `#F43F5E` | wrong answers / ✕ |
| `--accent-bet` | `#F59E0B` | **swipe-reveal track** + wager feedback (amber) |
| `--accent-brand` | `#6366F1` | streak, duel header, tags, logo, timer bar |
| `--accent-indigo` | `#7e8ce8` | **bet pips + bet rings** (distinct from brand) |
| `--accent-*-tint` | `rgba(…, .14)` | soft background washes (correct uses `.18`) |
| `--shadow` / `--shadow-sm` | soft | elevation (no harsh dropshadows) |

**Legacy aliases** map old names (`--bg`, `--surface`, `--ink`, `--accent`, `--correct`, `--wrong`, `--warning`, etc.) to the new tokens, so JS inline colors (`var(--correct)`, `var(--wrong)`, `var(--accent-bet)`) keep resolving.

---

## Typography (LOCKED — do not change)

- **Lexend** (400–900): questions, option choices, headings, logo (`K` glyph + "KNOWIT" wordmark at weight 900).
- **JetBrains Mono**: question index (`Q01/10`), elapsed timer (`00:05.8`), streak counter (`STRK: 05`), key badges, bet pips, metadata.

---

## Icons

Inline monochrome SVGs (Lucide-style, 1.5 px stroke, `currentColor`) in a JS `ICONS` object: `lightning, flame, swords, bulb, skull, trophy, target, chess, dice, heart, snowflake, copy`.

**Emoji policy**: raw platform emojis (🔥⚔️💡🧠💀 and others) are purged from core UI and replaced with SVG. Only 🟩🟥✅❌ (clipboard grid) and the brand ⚡ remain.

---

## Question bank

- **505 questions**, 16 categories, each: `id, category, difficulty, question, options[4], correctIndex, didYouKnow`.
- Category counts: Science 50, History 50, Geography 45, Pop Culture 45, Literature 45, Math 25, Technology 25, Arts 20, Film 25, Food & Drink 25, Sports 25, Nature 30, Business 20, Travel 25, Music 25, Space 25.

### Deterministic daily shuffle (P0 — answer distribution)
- `shuffleIntoSlot(q, rng, slot)`: places the correct answer at `slot`, Fisher-Yates the 3 distractors.
- Daily slot = `(dayIndex % 4 + questionPos) % 4` → guarantees the correct answer is **uniformly spread across A/B/C/D** (e.g. 3/3/2/2), identical for all players.
- Seed = `mulberry32(dayIndex * 1000 + questionPos)`.
- Endless = plain `Math.random` Fisher-Yates.

---

## localStorage & constants

- **Key**: `knowit_stats_v3` → `{ played, streak, maxStreak, totalCorrect, totalAnswered, bestEndless, lastDate, completedDaily, betsUsed, betsHit }`. Migration shim: `bestGauntlet → bestEndless`.
- **Tip flag**: `knowit_seen_swipe_tip` (day-1 swipe tip).
- Constants: `Q_PER_DAY = 10`, `GAUNTLET_LIVES = 3` (endless), daily timer 20 s, endless timer 15 s, bet swipe threshold 56 px / reveal 96 px, answer-feedback hold 2600 ms.

---

## SEO / social / assets

- Static OG + Twitter card meta tags, `description`, `canonical`, theme-color, favicon + apple-touch-icon.
- `og-image.png` is **brand-generic** (crawlers don't run JS, so per-score dynamic previews aren't possible on a static host). It renders the KNOWIT identity on every shared link.

---

## Deployment & verification workflow

```bash
cd /root/synapse-trivia
# validate JS syntax
python3 -c "import re;open('/tmp/knowit.js','w').write(re.search(r'<script>(.*?)</script>',open('index.html').read(),re.S).group(1))"
node --check /tmp/knowit.js
# run DOM-shim regression suite (27 tests)
node /tmp/test_v7.js
# deploy
git add index.html && git commit -m "…" && git push origin main
# verify live (CDN caches ~10 min — bust it)
curl -s "https://yaronbada.github.io/synapse-trivia/?nocache=$(date +%s)" | grep -c "<marker>"
```

CDN notes: GitHub Pages caches `index.html` ~10 min; raw GitHub and the Contents API have separate caches. Use `?nocache=` for verification.

---

## Testing status

- `node --check` clean.
- **27/27** DOM-shim tests pass (`/tmp/test_v7.js`): archetypes, `fmtClock`, daily shuffle spread + determinism, bet +2/−1/fallback, share formats (clean vs challenge), SVG injection, emoji purge.
- **NOT verified on a physical device** (headless shim can't simulate touch): swipe gesture timing, haptics, angle-lock, safe-area/footer anchoring. **These need a real phone pass.**

---

## Known issues / caveats / pending

1. **OG image is static/brand-generic** — no per-score preview. Needs a serverless function (or static prerender) for dynamic "beat my 8/10" cards.
2. **`index.html.bak`** is a stale 28 KB v1 backup still tracked in the repo — safe to delete.
3. **Question-bank comment** still says "200 questions" (actually 505) — cosmetic.
4. **Duplicate `.btn-copied` CSS rule** — harmless, could dedupe.
5. **Logo `K` is white on accent** — mild AA-contrast concern, pre-existing.
6. **`--accent-indigo #7e8ce8` vs brand `#6366F1`** — the bet pips/rings use `#7e8ce8` (as literally requested); if the user wants them to match the brand violet, it's a one-line swap.
7. **Bet tip wording** — says "Swipe right" (correct for the current gesture); an earlier spec draft said "Press & hold."

---

## Handoff directives (for the next session)

1. **Read this doc first**, then `GAME_STATE.md` if you need the even-leaner version.
2. **Inspect only the exact files/lines needed** — do NOT re-read the 505-question `QUESTIONS` array.
3. **Edit only `index.html`** (single file). Fonts/typography rules are locked — do not touch.
4. **Validate before deploy**: `node --check` + `node /tmp/test_v7.js` (recreate the harness if `/tmp` was wiped).
5. **Push to survive wipes**: the environment is ephemeral; `/root/synapse-trivia` + GitHub are the durable home. Classic PAT required for push.
6. **Verify with cache-bust** (`?nocache=`) after every deploy.
7. Reusable procedures (DOM-shim testing, deterministic shuffle, color-token mapping, OG-image generation via PIL) are worth re-deriving from this doc if the session context is lost.

---

## Recent commit history (reverse chronological)

```
2899332 De-jitter feedback, decouple bet pips → indigo badge, 2px answer states, visual highlights + bet tip, glyph heatmap, split share CTAs + viral challenge payload
6c41067 Refine dark theme color system (new token palette, soft elevation, amber bet affordance)
769b4f6 Add OG/social share preview + streak badge on results
c038b7c Consolidate to single native-share button; email-style swipe-to-bet
e53381d Modernize UI (glass, SVG icons, mono metrics), hold-to-bet, persona archetypes + viral share
809e1a2 Fix cropped swipe-track; full bet explanation in hint/tip
2bb3709 Fix double-text on answers; remove bet ring from progress tiles; extend feedback to 2.6 s
d59efae Fix option shuffle distribution (deterministic Fisher-Yates), dedupe bet instructions, angle-lock swipe, time-based pace tiers, review modal factoid
5405e56 Replace bet bar with swipe-right-to-bet; pips in header; Shift+key to bet; day-1 nudge tip
5935d90 Add bet mechanic (I KNOW IT: 2x/−1, 3 bets daily), progress strip, KNOW IT ALL title
… (earlier: v2–v6 → 505 questions, duels, results overhaul, rebrand to KNOWIT)
```
