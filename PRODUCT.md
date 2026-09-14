# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the counter pharmacist, with a live customer waiting.** They are standing at a dispensing counter in a Pakistani retail pharmacy, working through a prescription while the patient watches. The job is: find the right product among thousands of near-identical brand names, confirm it is safe to hand over with everything else in the basket, price it, and log it — without asking the customer to wait.

This situation sets the design constraints: high information density, fast visual scanning, keyboard-first input, and safety alerts that cannot be missed or reflexively dismissed.

Secondary audiences confirmed by the codebase but not the design target this round: pharmacy managers (stock, purchase orders, margins, reporting) and administrators (staff roles, audit review).

## Product Purpose

Dispensia is a pharmacy operations workspace that makes the dispense itself safe. It combines the product catalogue, live stock, patient records and a clinical safety engine into one counter workflow, so an interaction, a QT risk, a controlled-drug obligation or a counselling duty surfaces *at the moment of dispensing* rather than in a report afterwards.

Success is a dispense that is both fast and defensible: the pharmacist moves at counter speed, and every safety decision — including every override — is recorded.

## Positioning

The differentiator is the clinical safety engine bound to a Pakistan-specific brand catalogue. Generic pharmacy POS software knows price and stock; this knows that the specific local brand in the basket is a fluoroquinolone with high QT risk, a WHO AWaRe *Watch* antibiotic, a CYP3A4 inhibitor, or a controlled drug that owes a register entry. Those judgements are already encoded per-product in the catalogue, not inferred at runtime.

## Operating Context

- **The counter session.** Search product → add to cart → the engine scans the whole basket for conflicts → moderate alerts and counselling prompts are shown → pharmacist either resolves or overrides with a PIN → checkout validation → record written.
- **Pharmacist PIN override.** A documented bypass exists for pharmacist judgement; overrides are an auditable event, never a silent dismissal.
- **Narcotics register.** Controlled-drug dispenses go to a separate statutory register with CSV export.
- **Stock receiving.** Purchase invoices received in either loose units or packs, with conversion between the two.
- **Stock audit.** PIN-gated physical count reconciliation.
- **Missed sales.** Demand for products not in stock is captured for replenishment.
- **Currency is PKR.** Prices are local retail prices, and both unit price and cost price are known, so margin is a real, displayable quantity.

## Capabilities and Constraints

Confirmed functionality: product catalogue search, inventory and batch tracking, dispensing queue and cart, clinical safety review, patient records, narcotics register, stock receiving, purchase orders, stock audit, reporting, staff auth, workspace settings.

- **Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, lucide-react icons. Supabase is wired for auth and persistence but optional — the app runs in demo mode without credentials.
- **Catalogue scale is a hard design constraint.** 10,434 products, 2,017 distinct generics, 841 manufacturers, 75 dosage forms. Search, filtering, sorting and pagination run server-side through API routes; the client never loads the whole catalogue.
- **Terminology:** *brand* (the sellable product, e.g. "Blokium Tab 50mg 30s"), *generic* (the molecule + strength), *genericClean* (the molecule alone, used for interaction matching), *dosage form*, *AWaRe class*, *QT risk*, *counselling prompt*, *clinical flag*.
- Undecided: multi-branch operation, e-prescription intake, insurance claims. Do not imply these exist.

## Brand Commitments

Product name is **Dispensia** (the Next.js workspace is "Dispensia"). Lineage: "Safe Dispensing — Healthy Pakistan", a 3-layer data/logic/presentation architecture credited to lead architect Muhammad Talha.

**Binding visual commitment (set by the user, 14 Sep 2026):** the interface is a professional clinical system, not a stylised one. Light ground, soft and highly readable colour and type, and the craft level of Epic/Cerner-class hospital software. An earlier exploratory direction — a high-contrast bitmap/terminal world — was built and explicitly rejected; do not reintroduce bitmap or pixel typography, black grounds, or expressive visual devices.

Density is not traded away for softness: the user asked for denser, more detailed list and table views and less wasted space, and that requirement stands alongside the readability one.

## Evidence on Hand

Real, verified, and to be used rather than fabricated around:

- `../Safe-dispensing/medicine.json` — **10,434 real products**. Per record: brand name, generic + strength, genericClean, dosage form, manufacturer, unitPrice, costPrice, a written counselling `prompt`, WHO `awareClass`, and clinical flags. (File is missing its final `}`; repair on ingest.)
- **WHO AWaRe distribution:** 9,028 NA · 953 WATCH · 323 ACCESS · 130 RESERVE.
- **99 distinct clinical flags**, e.g. isAntibiotic (1,284), isSupplement (1,098), isAntidiabetic (653), isAntihypertensive (627), isPpi (518), isNsaid (425), isControlled (93), isOpioid (42), isTeratogen (34), isWarfarin (4).
- **qtRisk** graded on 897 products (high / moderate).
- **256 distinct counselling prompts**, written in real clinical voice.
- **Price range:** PKR 0.12 → 174,503.20 (median 52.50); costPrice present on every record, so margin is derivable.
- **Top manufacturers:** Getz Pharma (324), Sami (303), Hilton Pharma (224), Barrett Hodgson (217), CCL (201).
- `../Safe-dispensing/logic.js` — the incumbent clinical engine: conflict detection, counselling evaluation, PIN bypass, checkout validation, narcotics register, stock receiving.

Absences that must not be invented: no real patient records, no real sales history, no customers, testimonials, certifications, or regulatory approvals.

## Product Principles

1. **The safety verdict outranks everything else on screen.** If a basket is unsafe, that is the primary information, above price, stock or convenience.
2. **Density is a service to the user, not clutter.** A pharmacist scanning 10,000 near-identical brand names needs more visible rows and more distinguishing detail per row, not more whitespace.
3. **Never let an override be accidental.** Bypassing a clinical alert must cost a deliberate action and must leave a record.
4. **Identity before name.** Brand names collide constantly; every product reference must carry the distinguishing facts — generic, strength, form, manufacturer — not the brand name alone.
5. **Real data or nothing.** Screens are designed against the actual catalogue scale and the actual clinical vocabulary, never against a tidy handful of placeholder rows.

## Accessibility & Inclusion

Counter environment: variable lighting, glare, and speed. Safety state must never be carried by colour alone — pair every clinical severity with an icon and a text label. Targets must survive fast, imprecise clicking. Keyboard operation is a primary path, not a fallback, because the incumbent app is already keyboard-driven.
