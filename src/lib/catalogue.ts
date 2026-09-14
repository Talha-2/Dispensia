import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Catalogue, ExpiryState, Facet, Medicine, StockState } from "@/lib/types";

/** Today, fixed for the demo so expiry states are stable across a session. */
export const TODAY = new Date("2026-09-14T00:00:00Z");

type Indexed = Medicine & { _hay: string; _flags: Set<string> };

type Loaded = {
  catalogue: Catalogue;
  items: Indexed[];
  byId: Map<string, Indexed>;
  byMolecule: Map<string, Indexed[]>;
};

let cache: Loaded | null = null;

/**
 * Loads and indexes the catalogue once per server process. 10,434 records parse
 * in well under a tenth of a second, and every request afterwards is a scan over
 * an array already in memory.
 */
export function load(): Loaded {
  if (cache) return cache;

  const raw = readFileSync(join(process.cwd(), "data", "catalogue.json"), "utf8");
  const catalogue = JSON.parse(raw) as Catalogue;

  const items: Indexed[] = catalogue.items.map((item) => ({
    ...item,
    _hay: `${item.brand} ${item.generic} ${item.molecule} ${item.maker} ${item.form} ${item.id}`.toLowerCase(),
    _flags: new Set(item.flags),
  }));

  const byId = new Map(items.map((item) => [item.id, item]));
  const byMolecule = new Map<string, Indexed[]>();
  for (const item of items) {
    const list = byMolecule.get(item.molecule);
    if (list) list.push(item);
    else byMolecule.set(item.molecule, [item]);
  }

  cache = { catalogue, items, byId, byMolecule };
  return cache;
}

export function getCatalogueMeta() {
  const { catalogue, items } = load();
  return {
    generatedAt: catalogue.generatedAt,
    source: catalogue.source,
    total: items.length,
    stocked: items.filter((item) => item.stock).length,
    flags: catalogue.flags,
    facets: catalogue.facets,
    counsel: catalogue.counsel,
  };
}

export function getMedicine(id: string): Medicine | undefined {
  return load().byId.get(id);
}

export function getMedicines(ids: string[]): Medicine[] {
  const { byId } = load();
  return ids.map((id) => byId.get(id)).filter((m): m is Indexed => Boolean(m));
}

export function counselTextFor(medicine: Medicine): string | null {
  if (medicine.counsel < 0) return null;
  return load().catalogue.counsel[medicine.counsel] ?? null;
}

/** Every product sharing this molecule — the substitution list a pharmacist wants. */
export function alternativesFor(medicine: Medicine, limit = 8): Medicine[] {
  const { byMolecule } = load();
  return (byMolecule.get(medicine.molecule) ?? [])
    .filter((other) => other.id !== medicine.id)
    .sort((a, b) => {
      const aStock = a.stock ? 0 : 1;
      const bStock = b.stock ? 0 : 1;
      return aStock - bStock || a.price - b.price;
    })
    .slice(0, limit);
}

// ── Derived state ─────────────────────────────────────────────────────────────

export function stockState(medicine: Medicine): StockState | null {
  if (!medicine.stock) return null;
  const { onHand, reorder } = medicine.stock;
  if (onHand === 0) return "out";
  if (onHand <= reorder * 0.5) return "critical";
  if (onHand <= reorder) return "low";
  return "healthy";
}

export function daysToExpiry(medicine: Medicine): number | null {
  if (!medicine.stock) return null;
  const expiry = new Date(`${medicine.stock.expiry}T00:00:00Z`);
  return Math.round((expiry.getTime() - TODAY.getTime()) / 86400000);
}

export function expiryState(medicine: Medicine): ExpiryState | null {
  const days = daysToExpiry(medicine);
  if (days === null) return null;
  if (days < 0) return "expired";
  if (days <= 90) return "expiring";
  return "ok";
}

/** Retail margin as a percentage of the selling price. */
export function margin(medicine: Medicine): number | null {
  if (!medicine.price || !medicine.cost) return null;
  return ((medicine.price - medicine.cost) / medicine.price) * 100;
}

/** Value of the shelf holding, at cost. */
export function stockValue(medicine: Medicine): number {
  if (!medicine.stock) return 0;
  return medicine.stock.onHand * medicine.cost;
}

// ── Query ─────────────────────────────────────────────────────────────────────

export type SortKey = "relevance" | "brand" | "price" | "stock" | "expiry" | "maker" | "margin";

export type Query = {
  q?: string;
  aware?: string[];
  form?: string[];
  maker?: string[];
  molecule?: string[];
  flags?: string[];
  stock?: StockState[];
  expiry?: ExpiryState[];
  /** "stocked" limits to lines this branch carries; "all" searches the national catalogue. */
  scope?: "all" | "stocked";
  qt?: string[];
  priceMin?: number;
  priceMax?: number;
  sort?: SortKey;
  dir?: "asc" | "desc";
  page?: number;
  size?: number;
};

export type QueryResult = {
  items: Medicine[];
  total: number;
  page: number;
  size: number;
  pages: number;
  facets: {
    aware: Facet[];
    form: Facet[];
    maker: Facet[];
    molecule: Facet[];
    flags: Facet[];
    stock: Facet[];
    expiry: Facet[];
    qt: Facet[];
  };
  /** Totals over the whole filtered set, not just the visible page. */
  summary: {
    stockedLines: number;
    unitsOnHand: number;
    stockValue: number;
    needsReorder: number;
    expiringSoon: number;
    expired: number;
    controlled: number;
    watchReserve: number;
    medianPrice: number;
  };
};

const inList = (list: string[] | undefined, value: string | null) =>
  !list || list.length === 0 || (value !== null && list.includes(value));

/** Scores a match so the most likely product is first: brand prefix beats a maker mention. */
function score(item: Indexed, terms: string[]): number {
  let total = 0;
  const brand = item.brand.toLowerCase();
  const short = item.short.toLowerCase();
  const generic = item.generic.toLowerCase();
  const molecule = item.molecule.toLowerCase();

  for (const term of terms) {
    if (short === term || brand === term) total += 100;
    else if (short.startsWith(term) || brand.startsWith(term)) total += 60;
    else if (molecule.startsWith(term)) total += 45;
    else if (generic.includes(term)) total += 25;
    else if (molecule.includes(term)) total += 20;
    else if (brand.includes(term)) total += 15;
    else if (item._hay.includes(term)) total += 5;
  }
  if (item.stock) total += 8;
  return total;
}

/** The filter groups the rail exposes. Each one can be skipped independently. */
type FacetKey = "aware" | "form" | "maker" | "molecule" | "flags" | "stock" | "expiry" | "qt";

export function query(input: Query): QueryResult {
  const { items } = load();
  const terms = (input.q ?? "").toLowerCase().trim().split(/\s+/).filter(Boolean);

  /**
   * Drill-down faceting.
   *
   * A facet group's own selection is excluded when counting that group, so
   * choosing "RESERVE" still leaves WATCH and ACCESS visible with the counts
   * they would have under the *other* filters. Counting every group against the
   * fully-filtered set is the bug that makes a multi-select rail collapse to a
   * single choice the moment you use it.
   */
  const passes = (item: Indexed, skip?: FacetKey) => {
    if (terms.length && !terms.every((term) => item._hay.includes(term))) return false;
    if (input.scope === "stocked" && !item.stock) return false;
    if (skip !== "aware" && !inList(input.aware, item.aware)) return false;
    if (skip !== "form" && !inList(input.form, item.form)) return false;
    if (skip !== "maker" && !inList(input.maker, item.maker)) return false;
    if (skip !== "molecule" && !inList(input.molecule, item.molecule)) return false;
    if (skip !== "qt" && !inList(input.qt, item.qt)) return false;
    if (skip !== "flags" && input.flags?.length && !input.flags.every((flag) => item._flags.has(flag))) {
      return false;
    }
    if (skip !== "stock" && input.stock?.length) {
      const state = stockState(item);
      if (!state || !input.stock.includes(state)) return false;
    }
    if (skip !== "expiry" && input.expiry?.length) {
      const state = expiryState(item);
      if (!state || !input.expiry.includes(state)) return false;
    }
    if (input.priceMin !== undefined && item.price < input.priceMin) return false;
    if (input.priceMax !== undefined && item.price > input.priceMax) return false;
    return true;
  };

  const matched = items.filter((item) => passes(item));

  // ── Facets ────────────────────────────────────────────────────────────────
  const counter = <T extends string>(key: FacetKey, getter: (item: Indexed) => T | null | undefined) => {
    const map = new Map<string, number>();
    for (const item of items) {
      if (!passes(item, key)) continue;
      const value = getter(item);
      if (value === null || value === undefined || value === "") continue;
      map.set(value, (map.get(value) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  };

  // Flags are ANDed, so a flag's count is how many rows would remain if it were
  // added to the current selection — which is what the number beside it means.
  const flagCounts = new Map<string, number>();
  for (const item of items) {
    if (!passes(item, "flags")) continue;
    for (const flag of item.flags) {
      if (input.flags?.length) {
        const others = input.flags.filter((selected) => selected !== flag);
        if (!others.every((selected) => item._flags.has(selected))) continue;
      }
      flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1);
    }
  }

  const facets = {
    aware: counter("aware", (item) => item.aware),
    form: counter("form", (item) => item.form),
    maker: counter("maker", (item) => item.maker),
    molecule: counter("molecule", (item) => item.molecule),
    stock: counter("stock", (item) => stockState(item)),
    expiry: counter("expiry", (item) => expiryState(item)),
    qt: counter("qt", (item) => item.qt),
    flags: [...flagCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
  };

  // ── Summary over the whole filtered set ───────────────────────────────────
  const stocked = matched.filter((item) => item.stock);
  const prices = matched.map((item) => item.price).sort((a, b) => a - b);
  const summary = {
    stockedLines: stocked.length,
    unitsOnHand: stocked.reduce((sum, item) => sum + (item.stock?.onHand ?? 0), 0),
    stockValue: stocked.reduce((sum, item) => sum + stockValue(item), 0),
    needsReorder: stocked.filter((item) => {
      const state = stockState(item);
      return state === "low" || state === "critical" || state === "out";
    }).length,
    expiringSoon: stocked.filter((item) => expiryState(item) === "expiring").length,
    expired: stocked.filter((item) => expiryState(item) === "expired").length,
    controlled: matched.filter((item) => item._flags.has("controlled")).length,
    watchReserve: matched.filter((item) => item.aware === "WATCH" || item.aware === "RESERVE").length,
    medianPrice: prices.length ? prices[Math.floor(prices.length / 2)] : 0,
  };

  // ── Sort ──────────────────────────────────────────────────────────────────
  const dir = input.dir === "desc" ? -1 : 1;
  const sort = input.sort ?? (terms.length ? "relevance" : "brand");

  if (sort === "relevance" && terms.length) {
    const scored = new Map(matched.map((item) => [item.id, score(item, terms)]));
    matched.sort((a, b) => (scored.get(b.id) ?? 0) - (scored.get(a.id) ?? 0) || a.brand.localeCompare(b.brand));
  } else {
    matched.sort((a, b) => {
      switch (sort) {
        case "price":
          return (a.price - b.price) * dir;
        case "maker":
          return a.maker.localeCompare(b.maker) * dir || a.brand.localeCompare(b.brand);
        case "stock":
          return ((a.stock?.onHand ?? -1) - (b.stock?.onHand ?? -1)) * dir;
        case "expiry":
          return ((daysToExpiry(a) ?? 99999) - (daysToExpiry(b) ?? 99999)) * dir;
        case "margin":
          return ((margin(a) ?? -999) - (margin(b) ?? -999)) * dir;
        default:
          return a.brand.localeCompare(b.brand) * dir;
      }
    });
  }

  // ── Paginate ──────────────────────────────────────────────────────────────
  const size = Math.min(Math.max(input.size ?? 25, 5), 200);
  const pages = Math.max(1, Math.ceil(matched.length / size));
  const page = Math.min(Math.max(input.page ?? 1, 1), pages);
  const start = (page - 1) * size;

  return {
    items: matched.slice(start, start + size).map(({ _hay, _flags, ...item }) => {
      void _hay;
      void _flags;
      return item;
    }),
    total: matched.length,
    page,
    size,
    pages,
    facets,
    summary,
  };
}

/**
 * Whole-shelf aggregates for reporting. Computed over every stocked line rather
 * than a page of results, so the totals are the branch's actual position.
 */
export function stockAggregates() {
  const { items } = load();
  const stocked = items.filter((item) => item.stock);

  const byMaker = new Map<string, { lines: number; units: number; value: number; retail: number }>();
  const byForm = new Map<string, { lines: number; value: number }>();
  const byAware = new Map<string, { lines: number; units: number; value: number }>();
  const marginBands = [
    { label: "Loss or flat", min: -Infinity, max: 0, lines: 0 },
    { label: "Under 10%", min: 0, max: 10, lines: 0 },
    { label: "10–15%", min: 10, max: 15, lines: 0 },
    { label: "15–20%", min: 15, max: 20, lines: 0 },
    { label: "Over 20%", min: 20, max: Infinity, lines: 0 },
  ];
  const expiryBands = [
    { label: "Already expired", lines: 0, value: 0 },
    { label: "Within 30 days", lines: 0, value: 0 },
    { label: "31–90 days", lines: 0, value: 0 },
    { label: "91–180 days", lines: 0, value: 0 },
    { label: "Beyond 180 days", lines: 0, value: 0 },
  ];

  let units = 0;
  let cost = 0;
  let retail = 0;

  for (const item of stocked) {
    const onHand = item.stock!.onHand;
    const value = onHand * item.cost;
    const sell = onHand * item.price;
    units += onHand;
    cost += value;
    retail += sell;

    const maker = byMaker.get(item.maker) ?? { lines: 0, units: 0, value: 0, retail: 0 };
    maker.lines += 1;
    maker.units += onHand;
    maker.value += value;
    maker.retail += sell;
    byMaker.set(item.maker, maker);

    const form = byForm.get(item.form) ?? { lines: 0, value: 0 };
    form.lines += 1;
    form.value += value;
    byForm.set(item.form, form);

    const aware = byAware.get(item.aware) ?? { lines: 0, units: 0, value: 0 };
    aware.lines += 1;
    aware.units += onHand;
    aware.value += value;
    byAware.set(item.aware, aware);

    const mg = margin(item);
    if (mg !== null) {
      const band = marginBands.find((b) => mg >= b.min && mg < b.max);
      if (band) band.lines += 1;
    }

    const days = daysToExpiry(item) ?? 9999;
    const index = days < 0 ? 0 : days <= 30 ? 1 : days <= 90 ? 2 : days <= 180 ? 3 : 4;
    expiryBands[index].lines += 1;
    expiryBands[index].value += value;
  }

  const sorted = <T extends { value: number }>(map: Map<string, T>) =>
    [...map.entries()].sort((a, b) => b[1].value - a[1].value);

  return {
    lines: stocked.length,
    units,
    cost,
    retail,
    margin: retail > 0 ? ((retail - cost) / retail) * 100 : 0,
    makers: sorted(byMaker),
    forms: sorted(byForm),
    aware: [...byAware.entries()],
    marginBands,
    expiryBands,
  };
}

/**
 * How many catalogue products sit on one side of an interaction rule, and how
 * many of those this branch actually holds. This is what turns the rule book
 * from a list of warnings into a statement about real exposure.
 */
export function countWatch(
  tokens: string[],
  matches: (medicine: Medicine, token: string) => boolean,
): { total: number; stocked: number } {
  const { items } = load();
  let total = 0;
  let stocked = 0;
  for (const item of items) {
    if (!tokens.some((token) => matches(item, token))) continue;
    total += 1;
    if (item.stock) stocked += 1;
  }
  return { total, stocked };
}

/** Fast type-ahead for the command field. Ranked, stocked lines first. */
export function suggest(term: string, limit = 8): Medicine[] {
  const { items } = load();
  const q = term.toLowerCase().trim();
  if (q.length < 2) return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const hits: { item: Indexed; score: number }[] = [];
  for (const item of items) {
    if (!terms.every((t) => item._hay.includes(t))) continue;
    hits.push({ item, score: score(item, terms) });
    if (hits.length > 600) break;
  }

  return hits
    .sort((a, b) => b.score - a.score || a.item.brand.localeCompare(b.item.brand))
    .slice(0, limit)
    .map(({ item }) => {
      const { _hay, _flags, ...rest } = item;
      void _hay;
      void _flags;
      return rest;
    });
}
