# Dispensia

A pharmacy counter-dispensing workspace for a Pakistani retail pharmacy. It puts the clinical
safety engine **inside** the dispensing workflow: interactions, WHO AWaRe stewardship,
controlled-drug obligations and counselling duties surface at the counter, before the medicine
changes hands — not in a report afterwards.

## What is real here

The product catalogue is real, ingested from the incumbent system's drug database:

| | |
|---|---|
| Products | **10,434** |
| Distinct molecules | 2,017 |
| Manufacturers | 841 |
| Dosage forms | 74 |
| Clinical flags | 99 |
| Counselling texts | 255 |
| WHO AWaRe | 953 Watch · 323 Access · 130 Reserve |
| QT-graded products | 897 |
| Interaction rules | **34**, ported from the incumbent engine |

Brand names, generics, manufacturers, dosage forms, retail and cost prices, AWaRe classes, QT
risk grades, clinical flags and counselling text are all real.

**Stock levels, batch codes, expiry dates, shelf locations, patients and register entries are
synthetic.** They are generated deterministically from a hash of each product id, so they are
stable across builds, and they are labelled as demo data everywhere they appear in the UI.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

The catalogue is committed at `data/catalogue.json`. To rebuild it from the source database:

```bash
node scripts/build-catalogue.mjs [path-to-medicine.json]
# defaults to ../Safe-dispensing/medicine.json
```

## The screens

| Route | What it is |
|---|---|
| `/dispensing` | **The counter.** Basket, live safety verdict, counselling, overrides, checkout, receipt. |
| `/catalogue` | All 10,434 products. Table / list / board, with a faceted filter rail. |
| `/inventory` | The 1,885 lines this branch stocks, with shelf state and expiry exposure. |
| `/patients` | Patient records and the safety gates each one arms. |
| `/safety` | The 34-rule book, with real catalogue exposure counts per rule. |
| `/register` | The controlled-drug register. |
| `/dashboard` | Operational overview — what needs the pharmacist now. |
| `/reports` | Holding value, AWaRe mix, expiry exposure, margin distribution. |
| `/settings` | Organisation, branches, members, roles, clinical defaults, keyboard reference. |
| `/login` | Sign in or create an account. |
| `/onboarding` | Create an organisation and its first branch. |

Try a blocked basket:
`/dispensing?lines=warfarin,alkeris&patient=p-1042`

## Keyboard

| Keys | Action |
|---|---|
| `Ctrl/⌘ K` | Command palette — products, patients, batches and commands |
| `Ctrl/⌘ Enter` | Dispense and record the basket |
| `Ctrl/⌘ P` | Print the receipt |
| `Ctrl/⌘ E` | Export the current view to CSV |
| `Ctrl/⌘ I` | Import stock from CSV |
| `Ctrl/⌘ J` | Add a patient record |
| `/` | Jump to the filter field |
| `A` | Focus the add-product field |
| `Alt 1–9` | Go to a section |
| `Esc` | Close the open panel or dialog |

## Architecture

```
src/lib/catalogue.ts   Catalogue load, query, drill-down faceting, aggregates. Server only.
src/lib/safety.ts      The 34 interaction rules + stewardship and statutory gates.
src/lib/csv.ts         CSV export and a forgiving CSV reader.
src/lib/commands.ts    The command bus behind the palette and the shortcuts.
src/app/api/           catalogue · suggest · scan · product/[id] · inventory · health
src/components/        Shell, rail, command palette, views, counter, dialogs, receipt.
data/catalogue.json    The ingested catalogue (3.5 MB, read at runtime, not bundled).
supabase/migrations/   Schema and row-level security policies.
```

The catalogue never reaches the browser. Search, filtering, sorting, faceting and pagination all
resolve in `/api/catalogue`, which returns a page of rows plus facet counts for the current
result set.

### Faceting

Facet counts use **drill-down semantics**: each group's counts are computed with that group's own
selection excluded. Selecting `RESERVE` therefore leaves `WATCH` and `ACCESS` visible with the
counts they would have under the *other* filters. Counting every group against the fully filtered
set is what makes a multi-select rail collapse to a single choice the moment you use it.

### The safety engine

`scan()` evaluates the **whole basket** on every change, not each line as it is added — the danger
is usually in the combination that was safe a moment ago. On top of the 34 interaction rules it
raises gates for controlled drugs, AWaRe Reserve and Watch antibiotics, known teratogens in
patients of reproductive age, and stacked high-QT-risk products.

Clearing a finding costs a pharmacist PIN and a written clinical reason, both recorded against the
basket and printed on the receipt. Demographic rules cannot fire without a patient record, and the
counter says so rather than implying the basket was checked against them.

## API

```
GET  /api/health
GET  /api/catalogue?q=&aware=&form=&maker=&molecule=&flags=&stock=&expiry=&sort=&dir=&page=&size=
GET  /api/inventory?q=&stock=&expiry=
GET  /api/suggest?q=&limit=
GET  /api/product/:id
POST /api/scan     { lines: [{id, qty}], patient: {age, sex}, cleared: [ruleKey] }
```

## Production backend

Supabase is optional — without credentials the app runs on the Demo tenant with open sign-in.

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and add the URL and keys.
3. Run the migrations **in order** (Supabase SQL editor, or `supabase db push`):

   | | |
   |---|---|
   | `202609130001_initial_schema.sql` | Tables, indexes, row-level security |
   | `202609140001_staff_role_values.sql` | Adds the `owner` and `cashier` roles |
   | `202609140002_tenancy_and_demo_org.sql` | Tenant profile columns, tenant policies, `create_organization()`, and the Demo Pharmacy seed |

4. Set `NEXT_PUBLIC_BACKEND_ENABLED=true`.

The second file must run on its own: PostgreSQL will not let a migration use an enum value in
the same transaction that adds it.

## Organisations

Dispensia is multi-tenant. Anyone can sign up, and the first thing they do is create an
organisation — a trading name, a first branch, a tax number and a retail licence. From then on
every read and write is scoped to that organisation by row-level security, and the receipt,
the register and the audit log all carry its name.

Creating one goes through `create_organization()`, a `security definer` function: it is the only
write that cannot be gated on membership, because the caller is not a member of anything yet. It
makes the organisation, its first branch and the caller's owner profile in one transaction, and
refuses an account that already belongs somewhere.

### The Demo tenant

A single shared **Demo Pharmacy** is seeded by the migration and is readable by every signed-in
account, writable by none. An account with no organisation of its own lands there, so the counter,
catalogue, patients, safety, register and reports are all exercisable immediately. The header says
`DEMO` and links to `/onboarding` whenever that is what you are looking at, so nobody has to guess
whether the data in front of them is real.

Sign in and **Create account** on `/login` both go through Supabase Auth. Without credentials
configured, either button opens the Demo tenant directly.

## Deploying to Vercel

Import the repository in Vercel — the framework, build command and output are all detected. Then
set these environment variables for Production and Preview:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | the project URL from Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | the service role key — server only, never expose it |
| `NEXT_PUBLIC_BACKEND_ENABLED` | `true` |

`data/catalogue.json` is committed and traced into the serverless output by
`outputFileTracingIncludes` in `next.config.ts`, so no build-time ingest step runs on Vercel.

## Design

The visual system is documented in `DESIGN.md`; durable product truth is in `PRODUCT.md`.
