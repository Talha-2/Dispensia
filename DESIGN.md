---
name: Dispensia
description: A dense, light-ground clinical workspace where one cyan carries every interaction and colour with meaning is reserved for the clinical record.
colors:
  canvas: "#f7f9fc"
  canvas-deep: "#eef3f9"
  surface: "#ffffff"
  surface-sunk: "#f5f8fb"
  surface-hover: "#f6fafd"
  surface-active: "#e6f4fd"
  line: "#e4eaf1"
  line-soft: "#eef2f7"
  line-strong: "#cdd8e5"
  ink: "#0f172a"
  ink-2: "#475569"
  ink-3: "#64748b"
  ink-4: "#94a3b8"
  primary: "#0284c7"
  primary-strong: "#0369a1"
  primary-deep: "#075985"
  primary-soft: "#e8f5fe"
  primary-soft-2: "#c9e8fb"
  primary-line: "#8fd2f4"
  on-primary: "#ffffff"
  ok: "#047857"
  ok-solid: "#059669"
  ok-soft: "#e7f8f0"
  ok-line: "#a7e6cb"
  warn: "#b45309"
  warn-solid: "#c2410c"
  warn-soft: "#fff5e9"
  warn-line: "#f7d3a8"
  danger: "#dc2626"
  danger-strong: "#b91c1c"
  danger-soft: "#fef2f2"
  danger-line: "#f8c4c4"
  info: "#6d28d9"
  info-solid: "#7c3aed"
  info-soft: "#f3efff"
  info-line: "#d6c6fb"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "27px"
    fontWeight: 650
    lineHeight: "34px"
    letterSpacing: "-0.028em"
  headline:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "25px"
    letterSpacing: "-0.018em"
  stat:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "23px"
    fontWeight: 620
    lineHeight: "30px"
    letterSpacing: "-0.026em"
    fontFeature: "tnum 1"
  title:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "21px"
    letterSpacing: "-0.012em"
  body:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "-0.004em"
    fontFeature: "tabular-nums"
  prose:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: "21px"
  small:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: "17px"
  micro:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: "16px"
  label:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.055em"
  code:
    fontFamily: "Geist Mono, ui-monospace, SF Mono, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    letterSpacing: "-0.01em"
rounded:
  xs: "5px"
  sm: "7px"
  md: "10px"
  lg: "12px"
  check: "4px"
  pill: "999px"
spacing:
  row: "34px"
  header: "60px"
  rail: "240px"
  rail-collapsed: "60px"
  panel-pad: "16px"
  row-pad-x: "12px"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 13px"
    height: "34px"
  button-hover:
    backgroundColor: "{colors.surface-hover}"
  button-active:
    backgroundColor: "{colors.surface-sunk}"
  button-disabled:
    backgroundColor: "{colors.surface-sunk}"
    textColor: "{colors.ink-4}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: "0 13px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "{colors.primary-strong}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    height: "34px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.sm}"
    height: "34px"
  button-lg:
    height: "40px"
    padding: "0 18px"
    rounded: "{rounded.md}"
  button-sm:
    height: "28px"
    padding: "0 10px"
    rounded: "{rounded.xs}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  panel-head:
    backgroundColor: "{colors.surface-sunk}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "34px"
  field-shell:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "0 11px"
    height: "36px"
  badge:
    backgroundColor: "{colors.surface-sunk}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    padding: "0 6px"
    height: "19px"
  badge-access:
    backgroundColor: "{colors.ok-solid}"
    textColor: "#ffffff"
  badge-watch:
    backgroundColor: "{colors.warn-solid}"
    textColor: "#ffffff"
  badge-reserve:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
  badge-info:
    backgroundColor: "{colors.info-solid}"
    textColor: "#ffffff"
  badge-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink-3}"
  band:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  band-block:
    backgroundColor: "{colors.danger-soft}"
  band-conflict:
    backgroundColor: "{colors.warn-soft}"
  band-counsel:
    backgroundColor: "{colors.primary-soft}"
  band-ok:
    backgroundColor: "{colors.ok-soft}"
  nav-item:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "36px"
  nav-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-deep}"
  segmented-option:
    textColor: "{colors.ink-3}"
    rounded: "{rounded.xs}"
    padding: "0 11px"
    height: "26px"
  segmented-option-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  kbd:
    backgroundColor: "{colors.surface-sunk}"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.xs}"
    padding: "0 5px"
    height: "20px"
  dialog:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
---

# Design System: Dispensia

The whole system lives in one file: `src/app/globals.css`. Tokens are declared on `:root`, the reset sits in `@layer base`, and every component class sits in `@layer components`. If you are adding a surface, add it there — do not start a second stylesheet, and do not reach for a Tailwind config (Tailwind v4 is loaded via `@import "tailwindcss"` with no config file; the tokens are CSS custom properties, not theme entries).

## Overview

**Creative North Star: "The Quiet Instrument"**

Everything that is *chrome* — navigation, headers, buttons, panels, dividers, table rules — is deliberately silent: four levels of slate ink on a cool near-white ground, with one cyan doing all the talking about what is clickable or selected. That silence exists so the only loud things on screen can be clinical facts. A red on this interface is never decoration and never "important-ish"; it means a WHO AWaRe class, a safety severity, or a shelf/expiry state, and nothing else.

Density is the second commitment and it is not traded away for softness. The base row is 34px, the catalogue table runs twelve columns at a 1110px minimum, and body text ships at 13.5px. That works only because every ink level was chosen against a measured contrast ratio on white, not by eye: the palette is small, the ramp is short, and no text colour in the system falls below 4.5:1 at the size it actually ships at.

The build refuses two things by name. It refuses the KPI-cards-over-a-chart dashboard as the landing surface — the counter is the landing surface, and `FactRow` puts six figures on *one* panel instead of six identical cards. And it refuses the coloured side-tab alert: a severity band states its rank with a tint, a border, an icon chip and a written rank word together, because a 4px red edge is decoration standing in for meaning the notice already carries.

**Key Characteristics:**
- Light blue-grey ground (`--canvas`); white is reserved for surfaces that hold data
- Four measured ink levels, each with a recorded contrast ratio
- One cyan for all interaction; semantic hue reserved for the clinical record
- 34px rows, 13.5px body, many columns — density as a service, not clutter
- Layered shadows (contact + ambient), never a flat drop shadow or a hard offset
- Plus Jakarta Sans throughout, Geist Mono for machine values only
- Severity never carried by colour alone

## Colors

A cool slate neutral ramp, one deep cyan, and four saturated clinical hues that are allowed on screen only when they are reporting a fact from the catalogue or the safety engine.

### Primary

- **Clinical Cyan** (`--primary`): every interactive and selected state in the product — button fills, focus rings, caret, active nav item, checked checkbox, selected filter facet, `data-depth="4"` text, the "show more" affordance, the logo gradient. Chosen deep rather than bright specifically so white text on it measures **4.6:1**; the brighter sky tones give 2.6:1 and were rejected.
- **Cyan Strong / Cyan Deep** (`--primary-strong`, `--primary-deep`): hover fill and border for primary buttons; `--primary-deep` is also the text colour on every tinted cyan surface (active nav, hovered menu item, selected text).
- **Cyan Wash / Cyan Tint / Cyan Line** (`--primary-soft`, `--primary-soft-2`, `--primary-line`): the tinted family. `--primary-soft` fills a selected row background, an active nav item, a hovered `.pop-item`, a selected `.facet`; `--primary-soft-2` is the 3px focus halo on fields and the text selection background; `--primary-line` is its hairline.

### Secondary — the clinical semantics

These four are **reserved**. Each ships as a solid (for badge fills), a dark text-safe tone, a soft tint (for surfaces), and a line colour.

- **Stewardship Green** (`--ok`, `--ok-solid`): WHO AWaRe **ACCESS**, healthy stock, a clear safety verdict.
- **Caution Amber** (`--warn`, `--warn-solid`): WHO AWaRe **WATCH**, low stock, expiring shelf state, a "pharmacist review" finding, a recorded override.
- **Block Red** (`--danger`, `--danger-strong`): WHO AWaRe **RESERVE**, out/critical stock, expired shelf state, high QT risk, and the `block` severity — "do not dispense".
- **Statutory Violet** (`--info`, `--info-solid`): deliberately *non-clinical*. It carries the controlled-drug `CD` marker and informational counts. It exists precisely so a statutory obligation cannot be mistaken for a clinical severity — violet is not on the green→amber→red severity ladder, so the eye does not rank it.

`--aware-access`, `--aware-watch` and `--aware-reserve` are aliases onto ok/warn/danger, so the AWaRe lane can be re-hued later without touching severity.

### Neutral

- **Cool Ground** (`--canvas`, `--canvas-deep`): the page itself. The page is never white.
- **Data White** (`--surface`): reserved for surfaces that hold data, so a card reads as a card from its own lift rather than from a heavy border.
- **Sunk / Hover / Active** (`--surface-sunk`, `--surface-hover`, `--surface-active`): panel headers and sticky table heads, row hover, and the selected-row fill.
- **Ink** (`--ink`, **17.4:1** on `--surface`): primary reading — product identity, headings, figures, field text.
- **Ink 2** (`--ink-2`, **7.4:1**): the document default. `body` is set to this, not to `--ink`.
- **Ink 3** (`--ink-3`, **4.8:1**): secondary and metadata. Also the `::placeholder` colour.
- **Ink 4** (`--ink-4`, **2.9:1**): faint — hairline separators, disabled text, filled meter cells, hover border on controls. **Never body text.**
- **Lines** (`--line`, `--line-soft`, `--line-strong`): panel borders and table rules; `--line-soft` for in-table baselines; `--line-strong` for control borders and scrollbar thumbs.

### Named Rules

**The Reservation Rule.** One cyan carries all interaction. Green, amber and red are reserved for three data domains — WHO AWaRe class, safety severity, and shelf/expiry state — plus violet for the non-clinical statutory marker. No chrome, navigation, hover state or control state may use a semantic hue. If you need a colour for a new control, the answer is `--primary` or an ink level.

**The Ink-4 Floor Rule.** `--ink-4` measures 2.9:1. It may hold a rule, a disabled label, or a meter cell. It may never hold text the pharmacist has to read. `::placeholder` is explicitly `--ink-3` and not `--ink-4`, because the catalogue's main search field is a placeholder most of the time — that is real reading text.

**The Absent-Signal Rule.** 87% of the catalogue is outside the AWaRe classification. `NA` renders **nothing** — no grey chip, no dash. A marker on every row is ink spent saying nothing; absence is the signal.

### Where the code does not hold the line

Record these as known deviations, not as licence to add more:

1. **Commercial margin is painted with clinical hues.** A retail margin under 5% is coloured `--danger` (`catalogue-view.tsx:977`, `product-panel.tsx:143`, `reports/page.tsx:129`). Money is a fourth domain that the reservation rule does not name. If you extend reporting, prefer `data-depth` and a written label over borrowing red.
2. **Hue used as rank ordinal in charts.** `dashboard/page.tsx:305` and `reports/page.tsx:185,210` paint the first-ranked bar `--danger` and the second `--warn` purely because of sort position — not because those rows are dangerous. Do not copy this into new charts; use one hue at varying depth.
3. **Form-validation chrome uses red.** Inline field errors (`login/page.tsx:70`, `counter.tsx:834`) and the required-field asterisk (`patients-view.tsx:669`) use `--danger`. Defensible, but it is control state rather than a clinical fact.
4. **Rail counts use `--warn`.** The "Needs attention" block in the nav rail (`rail.tsx:179-180`) tints reorder/expiring counts amber. The *value* is shelf state, so it is in-domain; the *placement* is navigation chrome. It is the one place the two categories touch.
5. **The primary button's glow is the wrong blue.** `.act-primary`'s shadow is tinted `rgb(29 78 216 / …)` — an indigo, not `--primary` (`#0284c7`). Same for `.act-primary:disabled`'s `#7d9ad4` text, which is a one-off with poor contrast on `--primary-soft-2`. Both are hard-coded literals that escaped the token system.

## Typography

**One family: Plus Jakarta Sans** (`--font-ui`, loaded via `next/font/google` as `--font-sans`, `display: swap`), a geometric humanist with a wide variable weight range — which is what lets an 11px uppercase label and a 27px heading come from the same family and still read as different voices.

**Machine values: Geist Mono** (`--font-code`, weights 400/500 only). Used for batch numbers, lot codes and references — anywhere character-by-character comparison is the actual task. Never for body text, never for headings.

**Character:** neutral and clinical, tightened at size. Everything above 15px carries negative tracking (−0.012em to −0.028em); body carries −0.004em; only `.t-label` opens up (+0.055em uppercase). Tabular figures are on globally via `body { font-variant-numeric: tabular-nums }`, so numeric columns line up without per-cell opt-in — `.t-num` exists to re-assert it inside components that reset it.

The weight scale exploits the variable font: 450 (inactive nav), 550 (buttons, semi-emphasis, `data-depth` 3 and 4), 600 (labels, titles, active states), 620 (stats), 650 (page title), 700 (wordmark only).

### Hierarchy

- **`.t-display-lg`** (650, 27px/34px, −0.028em): the page title in the shell. One per screen.
- **`.t-stat`** (620, 23px/30px, tabular): the figure in a `Fact` tile.
- **`.t-display`** (600, 18px/25px, −0.018em): dialog titles, empty-state headings.
- **`.t-title`** (600, 15px/21px): section heading inside a panel. Rare in the build — the `Head` primitive uses `.t-label` at `--ink` instead.
- **`.t-data`** (13.5px/19px): the workhorse. Table cells, row values, product identity. 182 uses — if you are unsure, this is the class.
- **`.t-prose`** (13.5px/21px): running sentences — counselling text, finding detail, hints. Capped at 54ch next to the verdict, 62–80ch elsewhere.
- **`.t-sm`** (12.5px/17px) / **`.t-xs`** (11.5px/16px): metadata, receipt lines, secondary counts.
- **`.t-label`** (600, 11px/16px, +0.055em, uppercase, `--ink-3`): the section marker. Sits on a baseline that runs to the edge — never as a card top.
- **`.t-code`** (Geist Mono, 12px): references, batch and lot codes.

### Named Rules

**The Emphasis-Not-Size Rule.** Importance is expressed by `data-depth`, not by bumping a font size. The ramp has ten steps and they are all spoken for; if a value needs to stand out inside a row, raise its depth, do not invent a size.

**The Baseline-Head Rule.** A section heading is a `.t-label` on a `.baseline-strong` rule that runs the full width. It is never a second card inside a card, and it never gets its own border box.

## Layout

**Structural tokens:** `--rail` 240px (nav rail), `--rail-collapsed` 60px, `--header` 60px, `--row` 34px. The rail writes `--rail-width` onto `<html>` from `localStorage` so the main column's left padding follows the collapse without a layout flash.

**The frame** (`shell.tsx`): a fixed, full-height nav rail on the left at `lg` and up; a sticky translucent header (88% surface + 10px backdrop blur) holding the one command field and the pharmacist identity; then a page head with `.t-display-lg`, a meta row, and right-aligned actions; then content. Below `lg` the rail is replaced by `RailStrip` — a horizontally scrolling chip row inside the header, masked at its right edge with a gradient so the four-of-nine items that fit at 390px still advertise that more exist.

**Breakpoints** are Tailwind v4 defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280. `lg` is the one that matters — it is where the rail appears and where every two-column workspace splits.

**Two-column workspaces** are asymmetric CSS grids, not halves:
- Counter: `minmax(0,1.55fr) minmax(320px,0.85fr)` — basket left, verdict right. On narrow screens the verdict takes `order-1` so it is still first.
- Catalogue: `232px minmax(0,1fr) 340px` when the product panel is open, `232px minmax(0,1fr)` when closed.
- Patients: `minmax(0,1fr) 340px` when a patient is selected.

**The catalogue table** is a CSS grid, not a `<table>`: a 12px gutter column followed by twelve data columns (`catalogue-view.tsx:117-134`), fixed widths for form/pack/price/margin/batch/shelf and `minmax` for product/molecule/manufacturer. It has a hard `TABLE_MIN` of 1110px and scrolls horizontally inside its panel; the header row is `position: sticky` against that scroll container. Rows are `min-height: 32`.

**Sidebars** use `.sticky-rail`: sticky at `--header + 12px`, capped at `100vh − header − 24px`, scrolling inside itself with `overscroll-behavior: contain` so a filter rail never drags the page or strands its own tail.

**Spacing rhythm** is Tailwind's default 4px scale — there is no custom spacing token beyond the structural four above. The recurring values in practice: panel padding 16px (`p-4`), row padding 12px horizontal, section gaps 16px (`gap-4`), column gaps 24px (`gap-x-6`), page padding 16px rising to 24px at `lg`.

**Measure caps** are explicit and vary by context: 54ch for verdict and finding prose (it sits in a narrow column), 62ch for empty-state hints, 68–80ch for wider reading.

## Elevation & Depth

The system is **layered, not flat and not lifted**. Every shadow is two shadows: a tight 1–2px contact shadow that anchors the element to the ground, plus a wide, heavily negative-spread ambient shadow that gives it the lift. A single-value drop shadow is not part of this vocabulary, and neither is a hard offset shadow.

Depth is carried by shadow *and* a hairline border together — a panel is `1px solid --line` plus `--shadow-sm`. Neither alone.

### Shadow Vocabulary

- **`--shadow-xs`** (`0 1px 1px rgb(15 23 42 / .04), 0 1px 2px rgb(15 23 42 / .05)`): resting controls — buttons, fields, the selected segment, the switch knob, the avatar.
- **`--shadow-sm`** (`0 1px 2px / .05, 0 2px 6px -1px / .07`): `.panel` — the default data surface. Also the button's hover state (one step up, never two).
- **`--shadow`** (`0 1px 2px / .05, 0 8px 18px -6px / .12`): `.panel-lg`, for a surface that should read as clearly above the page.
- **`--shadow-pop`** (`0 2px 4px / .06, 0 16px 32px -8px / .22`): menus and popovers — transient, above everything on the page.
- **`--shadow-lg`** (`0 2px 4px / .05, 0 24px 44px -12px / .20`): the dialog, and the toast.

The ladder is strictly `xs → sm → (base) → pop → lg`, all cast from the same `rgb(15 23 42)` ink so the shadow reads as the page's own shadow rather than a grey overlay. The one exception is `.act-primary`, which adds `inset 0 1px 0 rgb(255 255 255 / 0.18)` — a hairline top highlight that makes a filled button read as a physical key — over a tinted shadow (see the deviation noted in Colors).

Recessed depth is done with colour, not inset shadow: `--surface-sunk` for panel headers, sticky table heads and the segmented-control track.

### Named Rules

**The Two-Shadow Rule.** Every elevation token is a contact shadow plus an ambient shadow. Never ship a single-layer `box-shadow` and never ship a hard offset.

**The One-Step-Up Rule.** Hover raises an element exactly one rung (`xs → sm`), press removes the shadow entirely and translates 1px down. A press is a loss of elevation, not a colour change alone.

**The Selected-Row Rule.** A live row is `--surface-active` plus `inset 2px 0 0 --primary` — an inset spine, not a border, so the row's height and the grid's alignment never shift when it is selected.

## Shapes

Soft, small, consistent radii on a four-step ramp: **5px** (`--radius-xs`, badges, menu items, small buttons, facets), **7px** (`--radius-sm`, the default control radius — buttons, fields, nav items, segmented track), **10px** (`--radius`, panels, bands, popovers), **12px** (`--radius-lg`, dialogs and large panels). Two exceptions exist by function: the checkbox is 4px (a 16px box needs a tighter corner to still read as square), and the switch track and radio are fully round — the round control is how "one of many" is announced before it is clicked.

The border language is a **hairline everywhere**: 1px is the only border width in the system except the checkbox's 1.5px and the `.kbd`'s 2px bottom edge, which fakes a keycap's depth. Borders are `--line` on surfaces and `--line-strong` on controls, so a control always reads as slightly more defined than the panel it sits on.

Nothing in the system is clipped to a non-rectangular silhouette, and there are no decorative shapes — no blobs, no gradients on surfaces. The only gradients in the build are the logo mark's vertical cyan fade, the avatar chip, and the fade-out mask above a "show more" button.

## Components

### Emphasis scale — `data-depth` (the spine)

One attribute carries emphasis across every component, so a value's importance is decided once rather than re-argued per component:

| depth | colour | weight | meaning |
|---|---|---|---|
| `0` | `--ink-4` | — | faint — rank words, tertiary counts |
| `1` | `--ink-3` | — | secondary — metadata, sub-lines, labels |
| `2` | `--ink-2` | — | body — the default reading level |
| `3` | `--ink` | 550 | primary reading — product identity, key values |
| `4` | `--primary` | 550 | interactive or actively-signalling |

Usage in the build: 126 × depth-1, 75 × depth-2, 30 × depth-3, 18 × depth-0, 2 × depth-4. Depth 4 is genuinely rare — it is held for the `blocked`/`conflict` verdict and the two safety counters, which is the point. `VERDICT_DEPTH` in `primitives.tsx` maps the five verdict states onto this scale, so the verdict's weight is a token lookup, not a per-screen judgement.

### Buttons — `.act`

One button class, four intents, three sizes. Default is a white key with a `--line-strong` hairline, `--ink` text at 550, and `--shadow-xs`.

- **Shape:** 7px (`--radius-sm`); `.act-lg` goes to 10px, `.act-sm` to 5px.
- **Sizes:** default 34px tall / 13px text; `.act-lg` 40px / 14px; `.act-sm` 28px / 12.5px; `.act-icon` makes it square (34px, or 28px with `.act-sm`).
- **Intents:** `.act-primary` (cyan fill, inner highlight, weight 600), `.act-danger` (red fill — used only for *recording an override* and destructive confirmation, twice in the whole app), `.act-quiet` (borderless, transparent, `--ink-3`, fills to `--surface-sunk` on hover).
- **Hover:** background to `--surface-hover`, border to `--ink-4`, shadow up one rung.
- **Active:** `translateY(1px)`, shadow removed, background to `--surface-sunk`.
- **Disabled:** `--surface-sunk` fill, `--ink-4` text, no shadow, `cursor: not-allowed`.

### Badges — `.cell`

A badge states a clinical fact in 19px of height. Meaning survives greyscale through the **letter inside**, not the hue: `A`/`W`/`R` for AWaRe, `CD` for controlled, `QT`, `TER`, `!` for a block, `i` for a note, `OV` for an override.

- **Solid forms** (`.cell-access`, `-watch`, `-reserve`, `-block`, `-signal`, `-primary`, `-info`) are what the shipped screens actually use — at a counter a filled chip is found by the eye considerably faster than a tinted one.
- **Soft forms** (`.cell-access-soft`, `-watch-soft`, `-reserve-soft`, `-primary-soft`) are defined in the stylesheet for places where a wall of solid chips would shout, **but no component currently uses one.** They are reserved, not established. If you introduce one, do it for a whole surface at once, not for a single row.
- **`.cell-quiet`** (transparent, `--line-strong` border, `--ink-3`) is the real second form in use: it carries moderate QT risk, teratogen, and note-level severity — facts worth marking but not worth shouting.
- Every badge carries a `title` and, where the glyph is abbreviated, an `.sr-only` expansion.

### Surfaces — `.panel`

- **`.panel`**: white, 1px `--line`, 10px radius, `--shadow-sm`. This is the container for everything — 19 uses.
- **`.panel-flat`**: same without the shadow, for a panel nested inside another surface.
- **`.panel-lg`** (12px, `--shadow`) and **`.panel-head`** (a sunk, ruled header strip) are defined but **currently unused** — screens hand-roll their header strips with `baseline-strong` + `background: var(--surface-sunk)`. Prefer `.panel-head` for new work; it is the intended form.

### Rows and dividers

`.baseline` (a `--line-soft` bottom rule) is the in-table divider; `.baseline-strong` (`--line`) closes a section head. `.row` adds a 120ms background transition and a `--surface-hover` hover.

Two row states are kept visually distinct **on purpose**, because confusing them at a counter would be a clinical error:
- `data-live="true"` — *selected*: `--surface-active` + a cyan inset spine.
- `data-flag="block" | "conflict"` — *implicated by the safety engine*: a red or amber tint, no spine.

### Fields — `.field` / `.field-shell`

- **`.field`**: 34px, white, `--line-strong` hairline, 7px radius, `--shadow-xs`. Hover lifts the border to `--ink-4`; focus takes the border to `--primary` and adds a 3px `--primary-soft-2` halo (`box-shadow`, so it does not shift layout). `textarea.field` switches to auto height with 8px vertical padding. `select.field` draws its own chevron from two CSS gradients — no background image, no icon font.
- **`.field-shell`**: 36px, carries the border itself so the inner `<input>` can stay completely bare; `:focus-within` drives the same focus treatment. Use this whenever a field holds more than text — the command field, search boxes with a clear button, anything with a `.kbd` hint inside.
- **Placeholders** are `--ink-3` with `opacity: 1`. Do not lower this.

### Navigation

Fixed 240px rail, collapsing to 60px, state persisted in `localStorage` via `useSyncExternalStore`. Items are 36px tall at 13.5px with a 16px lucide icon at `strokeWidth 1.7` and opacity 0.62. Groups (`Dispensing` / `Inventory` / `Management`) are separated by a `.pop-label`.

**Active state uses cyan only**: `--primary-soft` fill, `--primary-deep` text, weight 600, and `inset 0 0 0 1px --primary-line` as the outline. Every item carries a `.kbd` showing its `Alt+1…9` shortcut. The mobile `RailStrip` uses the same fill/text pair at 32px tall.

### Segmented control — `.seg`

A `--surface-sunk` track with a 1px border and 3px inner padding; options are 26px, `--ink-3`, and the selected option becomes a white 5px chip with `--shadow-xs` and weight 600. Selection is expressed with `aria-pressed`, and the CSS reads that attribute directly — do not add a separate `.is-selected` class.

### Menus — `.pop` / `.pop-item`

10px radius, `--shadow-pop`, 5px padding. Items are 32px, `--ink-2`, and both `:hover` and keyboard `data-active="true"` resolve to the **same** treatment (`--primary-soft` / `--primary-deep`), so mouse and keyboard highlight look identical. `.pop-sep` is a 1px rule; `.pop-label` is a 10.5px uppercase heading at `--ink-4` (also reused as the rail's group heading).

### Alerts — `.band`

The signature component. A band is a full-width notice with a 10px radius, 12/14px padding, and a background + border pair driven entirely by `data-sev`:

| `data-sev` | background | border |
|---|---|---|
| `block` | `--danger-soft` | `--danger-line` |
| `conflict` | `--warn-soft` | `--warn-line` |
| `counsel` | `--primary-soft` | `--primary-line` |
| `ok` | `--ok-soft` | `--ok-line` |

There is **no coloured side tab**. Stacked bands self-space with `.band + .band { margin-top: 8px }`.

**The severity contract** is implemented in `FindingBand` (`counter.tsx:772`): the band's tint, a `SeverityMark` icon chip (`!` solid red for block, `!` solid amber for conflict, `i` quiet for note), the finding title at depth 4/3/2 by rank, and the written rank word from `SEVERITY_LABEL` ("Do not dispense" / "Pharmacist review" / "Counsel" / "Note"). Four independent channels; three of them survive greyscale.

*Honest exception:* the contract is fully honoured for safety findings and the verdict. Bands used as page-level status notices (`dashboard:89`, `settings:141`, `register:193`, `login:67`) carry the tint and border but no icon chip and no rank word — they rely on their own sentence. If you add a band that reports a *clinical* severity, it must carry all four channels.

### The verdict panel (signature)

The right column of the counter, sticky at `top: 72px`, holding a `.band` whose `data-sev` is derived from the basket's verdict, a 22px semibold headline coloured by verdict tone, a line of prose capped at 54ch, and then the findings list — ranked worst-first, scrolling inside `max-h-[52vh]`. Nothing on that screen outranks it at any width; at narrow widths it takes `order-1` and moves above the basket rather than below it.

Overriding a finding is deliberately expensive: it opens an inline form requiring a PIN *and* a written clinical reason of at least eight characters, and the submit button is `.act-danger`. Cleared findings do not vanish — they move to an "Overridden this basket" panel with an `OV` badge, the reason, and an Undo.

### Stock meter — `.meter`

Seven 5×11px cells with 2px gaps — quantity read as a run, the way a blister is counted by eye. Off cells are `--line`; on cells take their colour from `data-tone` (`healthy` → green, `low` → amber, `critical`/`out` → red, untoned → `--ink-4`). An out-of-stock meter tints *all* cells `--danger-line` rather than filling none, so "empty" and "not loaded" cannot be confused. Always paired with the numeric count and an `aria-label`.

### Keyboard hints — `.kbd`

20px, `--surface-sunk`, `--ink-3`, with a 2px bottom border faking a keycap. Set in the **UI font, not the mono font** — these are labels, not code. Fourteen uses; the app is keyboard-first and every shortcut is shown where it applies.

### Filters — `.facet` / `.check` / `.check-radio`

A filter is visibly a checkbox: a 16px, 4px-radius box with a 1.5px border that fills `--primary` when its parent `.facet[data-on="true"]`. Multi-select uses the square; one-of-many scope uses `.check-radio` (round, with a 6px white dot that fades in). The facet row itself is 28px minimum with a `--primary-soft` fill when on. This replaced a caret that only appeared once something was selected — which gave no affordance that several values could be picked at once.

### Dialog — `.scrim` / `.dialog`

Scrim is `rgb(15 23 42 / 0.32)` with a 2px backdrop blur, top-aligned at 8vh so a tall dialog grows downward rather than off both edges. The panel is 12px radius, `--shadow-lg`, animating in over 180ms from `translateY(-8px) scale(0.985)`. It has a `--line`-ruled header with `.t-display` and a quiet icon close button, a body, and a `--surface-sunk` footer strip. `ui.tsx` handles the behaviour: Escape closes, scrim-click closes, focus moves in on open and returns to the trigger on close, Tab is trapped, and body scroll is locked.

### Disclosure — `.chev` / `.reveal` / `.more`

The chevron **rotates** 180° over 200ms rather than swapping glyphs, driven purely by `[aria-expanded="true"] > .chev`. Revealed content animates in over 180ms (`.reveal`). `.more` is the "show more" affordance: a 28px cyan text button with a 22px gradient fade rising from it over the content above, and an arrow icon on a 1.9s `nudge` loop.

### Motion

All motion uses `--ease` (`cubic-bezier(0.2, 0.8, 0.25, 1)`) — a fast-out, settled-in curve. Durations are short and tiered: 110–130ms for control state, 150ms for the switch, 180ms for reveals and the dialog, 200ms for the chevron, 220ms for `.rise`. `.blink` (1.2s pulse) marks a scan in progress; `.rise` exists for list entry but is **currently unused**. `prefers-reduced-motion: reduce` collapses every animation and transition to 0.001ms and stops `.blink` at full opacity.

### Print — the dispensing receipt

Printing is a real deliverable, not an afterthought. `@page` margin is 8mm. Under `@media print`: `aside`, `header`, `nav` and anything `.no-print` are removed; `.print-only` flips to visible. A dialog marked `printable` gets `.print-root` (which neutralises the fixed scrim, its padding, its blur and its overflow) and `.print-sheet` (which strips border, radius, shadow and animation, caps width at **78mm** for an 80mm thermal roll, and forces every descendant to `#000`).

The receipt itself (`receipt.tsx`) is built for that width: a 360px column, dashed rules between blocks, a three-column line table, tabular figures throughout, and — deliberately — the controlled-drug register note and every pharmacist override printed on the customer's copy, not just in the audit log.

## Do's and Don'ts

### Do:
- **Do** express importance with `data-depth` (0–4) rather than a new font size or a new colour. It is the spine of the system and it works in every component.
- **Do** put new component classes inside `@layer components` in `globals.css`, and keep resets inside `@layer base`.
- **Do** use `--primary` for anything interactive or selected — buttons, focus, active nav, checked controls, selected rows.
- **Do** pair every clinical severity with all four channels: tint, border, icon chip, and a written rank word.
- **Do** give every abbreviated badge a `title` and an `.sr-only` expansion (`A` → "AWaRe ACCESS").
- **Do** use both a hairline border and a shadow token on a surface. `--shadow-sm` + `1px --line` is the panel; neither alone reads correctly on `--canvas`.
- **Do** keep hover to exactly one shadow rung, and make press a *loss* of elevation plus a 1px translate.
- **Do** cap running prose with an explicit `ch` measure — 54ch in a narrow column, 62–80ch elsewhere.
- **Do** mark anything that must not print with `.no-print`, and mark the printable dialog with `printable`.
- **Do** keep semantic markers off rows where the fact is absent (`NA` renders nothing).

### Don't:
- **Don't** use green, amber or red for chrome, navigation, hover, focus or any control state. Those hues belong to AWaRe class, safety severity and shelf/expiry state. Violet belongs to the controlled-drug marker.
- **Don't** use `--ink-4` for text a person has to read, and don't lower `::placeholder` from `--ink-3` — the catalogue's main search field is a placeholder most of the time.
- **Don't** write an unlayered CSS rule in `globals.css`. Layered utilities lose to unlayered rules regardless of specificity, so a stray unlayered `h1 { font-size: inherit }` would silently outrank every `.t-*` class. The only rules intentionally outside a layer are the `@media print` block and `.print-only` — they need that precedence.
- **Don't** ship a single-layer or hard-offset `box-shadow`. Every elevation token is contact + ambient.
- **Don't** confuse `data-live` (selected) with `data-flag` (implicated by the safety engine). They are separate attributes with separate treatments for a reason.
- **Don't** put a coloured side tab on a band, and don't let a severity be carried by tint alone.
- **Don't** make an override cheap. A PIN and a written reason are the interaction, and the cleared finding stays visible with an Undo.
- **Don't** reintroduce bitmap or pixel typography, black grounds, terminal framing, or expressive display faces — that direction was built and explicitly rejected.
- **Don't** hard-code a colour literal. Every deviation currently in the build (`rgb(29 78 216 …)`, `#7d9ad4`) is a defect, not a precedent.
- **Don't** trade density for whitespace. 34px rows, 13.5px body, twelve columns — the density is the product working.
