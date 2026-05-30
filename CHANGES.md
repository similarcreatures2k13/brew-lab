# Brew Lab V3.5 — Phantom Trial Build

Ship date: 2026-05-30.
**One file: replace `index.html` and commit.** Old localStorage data sits dormant under V3 keys (`bl_beans3`, `bl_history3`, `bl_overrides3`) — recoverable if you ever need it, ignored by this build.

---

## What's new

### Engine (the brain fix)

The smart-defaults logic is completely rebuilt around the V4 data model. Same JavaScript file, all inline. Five core changes:

1. **`roast.intent` field** drives the espresso-roast detection. Three values: `Filter`, `Espresso`, `Omni`. The Culture-blend bug is fixed — it now correctly defaults to 25 clicks / 90°C / even pour instead of 23 clicks / 94°C / layered.
2. **Blend composition support.** Beans store `origins[]` with shares. A 40% Brazil / 25% Colombia / 20% Guatemala / 15% Rwanda blend is one bean with four origin entries. Engine weights density and solubility by share.
3. **Pour schedule scales by dose.** 10g uses 3 pours, 14–18g uses 4, 19g+ uses 5. No more wash-out on small doses.
4. **Liberica and wet-hulled handled as their own cases.** Liberica counter-balances the porous default. Wet-hulled gets +1 click.
5. **Confidence score** returned with every default. Low-confidence triggers automatic AI advisor on bean fill.

### AI advisor

- **Model: Claude Haiku 4.5** (`claude-haiku-4-5-20251001`). 67% cheaper than Sonnet for this task.
- **Prompt tightened for Haiku's literalness.** Equipment block with Commandante click range (12–26). Current recipe as anchor with explicit cage like *"your output must be in [24, 26] clicks and [90, 94]°C."* Espresso-roast rule stated as an explicit hard rule. Response prefilled with `{` to force JSON start.
- **Auto-fires only on low-confidence defaults.** New beans with complex blends or unknown variety pull AI suggestions. Preset and high-confidence default beans skip AI entirely.
- **Three modes**: `fill` (new bean), `adjust` (3+ feedback cycles unresolved), `review` (manual sanity check).
- **Validated JSON output.** Out-of-range values rejected. Markdown fences stripped. Chatty preambles tolerated.

### Dev log (new for phantom trial)

- **Per-brew dev note**: after submitting feedback, tap `[+ dev note]` to add freeform notes about what surprised you, where the engine was off, etc.
- **Engine metadata auto-captured** with every brew: reasoning chain, confidence, whether AI was invoked, AI rationale if used.
- **Export button** in Settings: `◆ Copy dev log to clipboard`. Produces formatted markdown ready to paste into next chat session.
- **Quick shortcut**: tap the version number (`V3.5 / PHANTOM`) 5 times rapidly → also copies dev log.

### Design language

- New color tokens: `--bg-void`, `--bg-shell`, `--gold`, `--green-lock`, `--red-miss`.
- Monospace JetBrains Mono for all numbers and labels. Inter Tight for body.
- Hairline-border card pattern with floating top-edge labels.
- Status bar at the top showing current bean + method + locked state.
- Pour schedule rendered as left-aligned vertical timeline with diamond markers.
- Bracketed monospace numbers throughout.

---

## What's NOT in this build

Deferred to V3.6 or beyond — kept this commit focused:

- Bean edit / delete after creation
- Multi-origin blend input on add-bean form (custom beans are single-origin only for now)
- Brikka americano custom dilution settings per bean
- DOOM sound effects
- Tasting note marking on recipe screen (only on feedback screen)
- Brew history filtering by bean / method

---

## How to deploy from phone

1. Open `github.dev/similarcreatures2k13/brew-lab` in mobile Safari (or `github.com` and "Edit this file" on `index.html`)
2. Open `index.html`
3. Select all (long-press → Select All, or ⌘A with keyboard)
4. Paste this file's contents
5. Commit with message like `V3.5: engine rebuild, Haiku, dev log`
6. Wait ~60 seconds for GitHub Pages to redeploy
7. On your home-screen PWA: **remove the icon** (long-press → Remove Bookmark), then open the URL fresh in Safari and re-add to home screen. This clears the PWA cache. *Crucial — otherwise iOS will serve you a stale version.*

---

## Phantom trial protocol — what to do

This is what you should actually do over the next session or two:

### Step 1 — Walk the existing beans

Open the app. Tap V60 → Hot → pick each preset bean → review the generated recipe. Don't brew. Just look at the numbers and ask yourself: *"Does that feel right?"*

If a number feels off, hit `[+ dev note]` on the feedback screen even without brewing — write something like `"Aalamin BM presets coming as 25 clicks, real world I dial at 26. Engine is 1 click finer than my actual."` This is calibration data.

### Step 2 — Add a new bean from scratch

Tap `+ Bean` in the tab bar. Add something exotic — Ethiopia Yirgacheffe, or that next bean you have queued up. Set roast intent. Save. Then go through the brew flow and see what the engine generates. Dev note any surprises.

### Step 3 — Add an espresso-roast bean

This is the key test. Add a known espresso-roast blend (The Culture, or a Brazilian Santos-style blend). Mark `Espresso` intent. Generate V60 recipe. Confirm: clicks should land at 25–26, temp ≤91°C, pour style `even`. If it doesn't, dev note the divergence.

### Step 4 — Test the AI advisor

If you have your Anthropic API key set, add a very complex blend (4+ origins) — engine confidence will be `low` and Haiku will auto-fire. Read the rationale. Dev note: does it sound right? Does it agree with the engine or push different numbers?

### Step 5 — Export and ship to me

Settings → `◆ Copy dev log to clipboard` → paste into next chat. I'll read the divergence patterns and we'll tune.

---

## Known shortcomings of this build

- **Recipe overrides for preset beans**: When you "lock" a preset's recipe, the build clones the preset into `customBeans` to record it. This means the bean shows up as `CUSTOM` styling in the bean picker afterward. Cosmetic but worth knowing.
- **No undo on dev note submit**. Type carefully or edit on next brew.
- **Form scroll on mobile**: the add-bean form may push inputs under the soft keyboard. Scroll the page if you can't see what you're typing.
- **PWA cache aggression**: iOS Safari aggressively caches PWAs. Always remove + re-add to home screen after deploys until you confirm the version number on screen has updated.

---

## What I want from you next session

Three things, ranked:

1. **Paste the dev log.** Even if it's only 3 entries.
2. **Tell me where the engine is off.** "Aalamin should be 26 not 25" / "Lemongrass cap is too aggressive for Col 722" / etc. These are 1-click tunings that should be data-driven.
3. **Tell me what's friction.** "Bean picker is overwhelming" / "Forgot what 'descending' means without explanation" / "Dose input loses focus when I type" — anything that slowed you down. Those become V3.6 fixes.

Don't worry about visual polish in this session — that's V4 territory. We're calibrating the brain right now.
