/**
 * Ingests the real Dispensia drug database into the app's catalogue format.
 *
 *   node scripts/build-catalogue.mjs [path-to-medicine.json]
 *
 * Source: ../Safe-dispensing/medicine.json — 10,434 real Pakistani pharmaceutical
 * products with brand, generic, manufacturer, prices, WHO AWaRe class, QT risk,
 * counselling prompt and up to 99 clinical flags each.
 *
 * Two things are authored rather than ingested, because the source has no such data:
 * pack size is parsed out of the brand string, and per-branch stock (batch, expiry,
 * on-hand, shelf) is generated from a deterministic hash of the product key so the
 * demo is stable across runs. Stock is SYNTHETIC and labelled as such in the UI.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SOURCE = process.argv[2] ?? resolve(ROOT, "../Safe-dispensing/medicine.json");
const OUT_DIR = resolve(ROOT, "data");

/** The source file is missing its final brace; repair on read rather than mutating it. */
function readSource(path) {
  const text = readFileSync(path, "utf8").trim();
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(`${text}}`);
  }
}

/** Deterministic 32-bit hash so generated stock is identical on every build. */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seeded PRNG (mulberry32) — one stream per product, so products never interfere. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (random, list) => list[Math.floor(random() * list.length)];
const between = (random, min, max) => min + Math.floor(random() * (max - min + 1));

/**
 * Pack size out of the brand string: "3x10s" -> 30, "20's" -> 20, "Tab 14s" -> 14.
 * Real packaging data hiding in plain sight in the brand name.
 */
function parsePack(brand) {
  const multi = brand.match(/(\d+)\s*[x×]\s*(\d+)\s*'?s\b/i);
  if (multi) return Number(multi[1]) * Number(multi[2]);
  const single = brand.match(/\b(\d{1,4})\s*'?s\b/i);
  if (single) {
    const n = Number(single[1]);
    if (n >= 2 && n <= 1000) return n;
  }
  return null;
}

/** "Xatral Lp Tab 10mg 3x10s" -> "Xatral Lp" — the name without the spec noise. */
function shortBrand(brand) {
  let s = brand
    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|%)\b.*$/i, "")
    .replace(/\b\d+\s*[x×]\s*\d+\s*'?s\b.*$/i, "")
    .replace(/\b\d{1,4}\s*'?s\b.*$/i, "")
    .replace(/\b(tab|tabs|cap|caps|inj|syp|susp|drops|sachet|inf|soln|solution|oint|gel|cream|lotion|spray|inhaler|softgels|serum)\b\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/[-–,/]+$/, "")
    .trim();
  if (s.length < 2) s = brand.split(/\s+/).slice(0, 2).join(" ");
  return s;
}

/** "Alfuzosin 10mg" -> "10mg". Strength is the fact that distinguishes near-identical rows. */
function parseStrength(generic) {
  const m = generic.match(/(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|%)(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml))?)/i);
  return m ? m[1].replace(/\s+/g, "") : null;
}

/** isCyp3a4Inhibitor -> "CYP3A4 inhibitor"; isPpi -> "PPI"; isNsaid -> "NSAID". */
const FLAG_LABELS = {
  acei: "ACE inhibitor", arb: "ARB", ccb: "Calcium channel blocker", ccbDhp: "CCB (dihydropyridine)",
  ccbNonDhp: "CCB (non-dihydropyridine)", nsaid: "NSAID", ppi: "PPI", h2Blocker: "H2 blocker",
  ssri: "SSRI", ssriLike: "SSRI-like", snri: "SNRI", tca: "Tricyclic antidepressant", maoi: "MAOI",
  doac: "DOAC", lmwh: "LMWH", dpp4Inhibitor: "DPP-4 inhibitor", sglt2Inhibitor: "SGLT2 inhibitor",
  cyp3a4Inhibitor: "CYP3A4 inhibitor", cyp3a4Substrate: "CYP3A4 substrate",
  cyp2c19Inhibitor: "CYP2C19 inhibitor", cyp2c9Inhibitor: "CYP2C9 inhibitor",
  cyp2d6Inhibitor: "CYP2D6 inhibitor", nti: "Narrow therapeutic index", dxm: "Dextromethorphan",
  hcvDaa: "HCV direct-acting antiviral", antiTb: "Anti-tuberculosis", kSparingDiuretic: "K-sparing diuretic",
  combinedOcp: "Combined oral contraceptive", antiAlzheimer: "Anti-Alzheimer",
  cholinesteraseInhibitor: "Cholinesterase inhibitor", sulfonylureaHighRisk: "High-risk sulfonylurea",
  highRiskStatin: "High-risk statin", nonSedatingAh: "Non-sedating antihistamine",
  sedatingAh: "Sedating antihistamine", betaLactam: "Beta-lactam", cox2: "COX-2 inhibitor",
  benzo: "Benzodiazepine", weakEnzymeInducer: "Weak enzyme inducer", coughPrep: "Cough preparation",
  isulin: "Insulin",
};

/** Which facet a flag belongs to — drives the filter rail's grouping. */
const FLAG_GROUPS = {
  therapeutic: new Set([
    "antibiotic", "supplement", "antidiabetic", "antihypertensive", "ppi", "cephalosporin", "nsaid",
    "biguanide", "arb", "fluoroquinolone", "antiepileptic", "corticosteroid", "calcium", "macrolide",
    "antidepressant", "antihistamine", "gastro", "statin", "nonSedatingAh", "antifungal", "antipsychotic",
    "ssri", "betaBlocker", "analgesic", "systemicSteroid", "sglt2Inhibitor", "zinc", "antileukotriene",
    "muscleRelaxant", "sulfonylurea", "ccb", "anticoagulant", "anticholinergic", "antiplatelet", "ccbDhp",
    "topical", "dpp4Inhibitor", "acei", "snri", "inhaledSteroid", "urology", "benzo", "h2Blocker", "maoi",
    "doac", "betaLactam", "cox2", "antiviral", "opioid", "insulin", "dermatology", "respiratory", "antigout",
    "oncology", "sedatingAh", "antispasmodic", "ssriLike", "haemostat", "antiAlzheimer", "bronchodilator",
    "hcvDaa", "clopidogrel", "tetracycline", "highRiskStatin", "ccbNonDhp", "lmwh", "antiTb", "rifamycin",
    "iron", "cholinesteraseInhibitor", "coughPrep", "tca", "antiparasitic", "diuretic", "dxm", "xanthine",
    "contraceptive", "thyroid", "warfarin", "thiazide", "kSparingDiuretic", "longActingInsulin",
    "meglitinide", "sulfonylureaHighRisk", "rapidActingInsulin", "clozapine", "combinedOcp", "loopDiuretic",
    "moodStabilizer", "biguanide", "antileukotriene",
  ]),
  interaction: new Set([
    "cyp2c19Inhibitor", "cyp3a4Inhibitor", "cyp3a4Substrate", "cyp2d6Inhibitor", "cyp2c9Inhibitor",
    "enzymeInducer", "weakEnzymeInducer", "nti",
  ]),
  risk: new Set(["controlled", "teratogen"]),
};

function labelFlag(key) {
  if (FLAG_LABELS[key]) return FLAG_LABELS[key];
  const spaced = key.replace(/([A-Z])/g, " $1").toLowerCase().trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function groupOf(key) {
  if (FLAG_GROUPS.risk.has(key)) return "risk";
  if (FLAG_GROUPS.interaction.has(key)) return "interaction";
  return "therapeutic";
}

// ── Ingest ────────────────────────────────────────────────────────────────────

const raw = readSource(SOURCE);
const keys = Object.keys(raw);

const counselDict = [];
const counselIndex = new Map();
const flagMeta = new Map();
const items = [];
const seenIds = new Set();

const SHELVES = ["A", "B", "C", "D", "E"];
const COLD = new Set(["Inj", "Inf", "Milk"]);

for (const key of keys) {
  const src = raw[key];

  // The `id` field collides across records (several brands share one). The object
  // key is the only unique handle, so that is what becomes the product id.
  let id = key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!id) id = `rx-${hash(key).toString(36)}`;
  while (seenIds.has(id)) id = `${id}-${hash(id).toString(36).slice(0, 3)}`;
  seenIds.add(id);

  const flags = [];
  let qt = null;
  for (const [field, value] of Object.entries(src)) {
    if (field === "qtRisk") {
      qt = value;
      continue;
    }
    if (!field.startsWith("is") || value !== true) continue;
    const flagKey = field.slice(2, 3).toLowerCase() + field.slice(3);
    flags.push(flagKey);
    if (!flagMeta.has(flagKey)) {
      flagMeta.set(flagKey, { key: flagKey, label: labelFlag(flagKey), group: groupOf(flagKey), count: 0 });
    }
    flagMeta.get(flagKey).count += 1;
  }

  let counsel = -1;
  if (src.prompt) {
    if (!counselIndex.has(src.prompt)) {
      counselIndex.set(src.prompt, counselDict.length);
      counselDict.push(src.prompt);
    }
    counsel = counselIndex.get(src.prompt);
  }

  const price = Math.round((src.unitPrice ?? 0) * 100) / 100;
  const cost = Math.round((src.costPrice ?? 0) * 100) / 100;

  const item = {
    id,
    brand: src.brand,
    short: shortBrand(src.brand),
    generic: src.generic,
    molecule: src.genericClean,
    strength: parseStrength(src.generic),
    form: src.dosageForm,
    maker: src.manufacturer,
    pack: parsePack(src.brand),
    price,
    cost,
    aware: src.awareClass ?? "NA",
    qt,
    flags,
    counsel,
  };

  // ── Synthetic branch stock ─────────────────────────────────────────────────
  // A real pharmacy stocks a fraction of the national catalogue. ~18% here,
  // chosen by hash so the same products are stocked on every build.
  const seed = hash(id);
  const random = rng(seed);
  if (seed % 100 < 18) {
    const cheap = price < 60;
    const reorder = cheap ? between(random, 20, 60) : between(random, 4, 18);
    const ratio = random();
    const onHand =
      ratio < 0.08 ? 0
      : ratio < 0.2 ? between(random, 1, Math.max(1, Math.floor(reorder * 0.5)))
      : ratio < 0.36 ? between(random, Math.floor(reorder * 0.5), reorder)
      : between(random, reorder + 1, reorder * (cheap ? 6 : 4));

    // Expiry spread from 5 months past to 34 months out, so expired and
    // expiring-soon batches both exist without being the common case.
    const monthsOut = between(random, -5, 34);
    const expiry = new Date(Date.UTC(2026, 8 + monthsOut, between(random, 1, 28)));

    item.stock = {
      onHand,
      reorder,
      batch: `${item.molecule.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X")}-${(seed % 9000) + 1000}`,
      expiry: expiry.toISOString().slice(0, 10),
      shelf: COLD.has(item.form) ? "Cold room" : `${pick(random, SHELVES)}${between(random, 1, 9)}`,
      counted: `2026-0${between(random, 6, 9)}-${String(between(random, 10, 28)).padStart(2, "0")}`,
    };
  }

  items.push(item);
}

// ── Facets ────────────────────────────────────────────────────────────────────

const tally = (getter) => {
  const t = new Map();
  for (const item of items) {
    const v = getter(item);
    if (v === undefined || v === null || v === "") continue;
    t.set(v, (t.get(v) ?? 0) + 1);
  }
  return [...t.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).map(([value, count]) => ({ value, count }));
};

const catalogue = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: "Safe-dispensing/medicine.json",
  note: "Product facts are real. stock{} is synthetic branch data generated deterministically from the product id.",
  counsel: counselDict,
  flags: [...flagMeta.values()].sort((a, b) => b.count - a.count),
  facets: {
    makers: tally((i) => i.maker),
    forms: tally((i) => i.form),
    molecules: tally((i) => i.molecule),
    aware: tally((i) => i.aware),
  },
  items,
};

mkdirSync(OUT_DIR, { recursive: true });
const outPath = resolve(OUT_DIR, "catalogue.json");
writeFileSync(outPath, JSON.stringify(catalogue));

const stocked = items.filter((i) => i.stock);
console.log(`catalogue.json written to ${outPath}`);
console.log(`  products      ${items.length}`);
console.log(`  stocked       ${stocked.length}`);
console.log(`  molecules     ${catalogue.facets.molecules.length}`);
console.log(`  manufacturers ${catalogue.facets.makers.length}`);
console.log(`  dosage forms  ${catalogue.facets.forms.length}`);
console.log(`  clinical flags${String(catalogue.flags.length).padStart(6)}`);
console.log(`  counsel texts ${counselDict.length}`);
console.log(`  aware         ${catalogue.facets.aware.map((a) => `${a.value}:${a.count}`).join("  ")}`);
console.log(`  packs parsed  ${items.filter((i) => i.pack).length}`);
console.log(`  size          ${(JSON.stringify(catalogue).length / 1048576).toFixed(2)} MB`);
