import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getMedicines } from "@/lib/catalogue";
import type { Medicine, StockState } from "@/lib/types";

export type StockLine = {
  id: string;
  branchId: string;
  medicine: Medicine;
  onHand: number;
  reorder: number;
  batch: string;
  expiry: string;
  shelf: string;
  cost: number;
  price: number;
  counted: string;
  state: StockState;
  /** Days until expiry; negative once it has passed. Null when undated. */
  daysToExpiry: number | null;
};

export type StockSummary = {
  lines: number;
  units: number;
  valueAtCost: number;
  needsReorder: number;
  expiringSoon: number;
  expired: number;
  outOfStock: number;
};

const shelfState = (onHand: number, reorder: number): StockState => {
  if (onHand === 0) return "out";
  if (reorder > 0 && onHand <= reorder * 0.5) return "critical";
  if (reorder > 0 && onHand <= reorder) return "low";
  return "healthy";
};

const daysUntil = (date: string | null) => {
  if (!date) return null;
  const then = Date.parse(date);
  if (Number.isNaN(then)) return null;
  return Math.round((then - Date.now()) / 86_400_000);
};

/**
 * What this organisation actually holds.
 *
 * Stock lives in the database, scoped to the tenant by row-level security; the
 * product behind each line is looked up in the shared catalogue that ships with
 * the app. Keeping the two apart is the whole point — a pharmacy owns its
 * shelf, nobody owns the fact that warfarin interacts with an NSAID — so a line
 * carries a catalogue id rather than a copy of the product.
 *
 * A line whose catalogue id no longer resolves is dropped rather than rendered
 * half-empty: it means the catalogue moved under it, and a stock row with no
 * molecule cannot be dispensed safely.
 */
export async function getStock(): Promise<{ lines: StockLine[]; summary: StockSummary }> {
  const empty = {
    lines: [],
    summary: {
      lines: 0,
      units: 0,
      valueAtCost: 0,
      needsReorder: 0,
      expiringSoon: 0,
      expired: 0,
      outOfStock: 0,
    },
  };

  const supabase = await getSupabaseServerClient();
  if (!supabase) return empty;

  // The branch you are standing in, not the whole company. A three-branch
  // pharmacy has three shelves, and a balance that mixes them is not a balance.
  const { data: branch } = await supabase.rpc("current_branch_id");

  const { data, error } = await supabase
    .from("stock_lines")
    .select("id, branch_id, catalogue_id, on_hand, reorder, batch, expiry, shelf, cost, price, counted_at")
    .eq("branch_id", branch ?? "00000000-0000-0000-0000-000000000000")
    .order("on_hand", { ascending: false });

  if (error || !data?.length) return empty;

  const medicines = getMedicines(data.map((row) => row.catalogue_id as string));
  const byId = new Map(medicines.map((medicine) => [medicine.id, medicine]));

  const lines: StockLine[] = [];
  for (const row of data) {
    const medicine = byId.get(row.catalogue_id as string);
    if (!medicine) continue;

    const onHand = Number(row.on_hand) || 0;
    const reorder = Number(row.reorder) || 0;
    const expiry = (row.expiry as string | null) ?? "";

    lines.push({
      id: row.id as string,
      branchId: row.branch_id as string,
      // The stock line's own price wins where it has one: what this pharmacy
      // paid and charges is a fact about this pharmacy, not about the product.
      medicine: {
        ...medicine,
        cost: row.cost === null ? medicine.cost : Number(row.cost),
        price: row.price === null ? medicine.price : Number(row.price),
        stock: {
          onHand,
          reorder,
          batch: (row.batch as string | null) ?? "—",
          expiry: expiry || "—",
          shelf: (row.shelf as string | null) ?? "—",
          counted: (row.counted_at as string | null) ?? "—",
        },
      },
      onHand,
      reorder,
      batch: (row.batch as string | null) ?? "—",
      expiry: expiry || "—",
      shelf: (row.shelf as string | null) ?? "—",
      cost: row.cost === null ? medicine.cost : Number(row.cost),
      price: row.price === null ? medicine.price : Number(row.price),
      counted: (row.counted_at as string | null) ?? "—",
      state: shelfState(onHand, reorder),
      daysToExpiry: daysUntil(expiry || null),
    });
  }

  const summary: StockSummary = {
    lines: lines.length,
    units: lines.reduce((sum, line) => sum + line.onHand, 0),
    valueAtCost: lines.reduce((sum, line) => sum + line.onHand * line.cost, 0),
    needsReorder: lines.filter((line) => line.state === "low" || line.state === "critical").length,
    expiringSoon: lines.filter(
      (line) => line.daysToExpiry !== null && line.daysToExpiry >= 0 && line.daysToExpiry <= 90,
    ).length,
    expired: lines.filter((line) => line.daysToExpiry !== null && line.daysToExpiry < 0).length,
    outOfStock: lines.filter((line) => line.state === "out").length,
  };

  return { lines, summary };
}

/**
 * The shelf in the shape the catalogue's own `query()` returns.
 *
 * The dashboard and the reports were written against that shape when stock was
 * a slice of the catalogue. Giving them the same shape over the tenant's real
 * rows means those screens read this pharmacy's shelf without being rebuilt —
 * and read zero, correctly, for one that has received nothing.
 */
export async function getStockAsQuery() {
  const { lines, summary } = await getStock();

  const byState = (states: StockState[]) =>
    lines.filter((line) => states.includes(line.state)).map((line) => line.medicine);

  return {
    lines,
    items: lines.map((line) => line.medicine),
    total: summary.lines,
    summary: {
      stockedLines: summary.lines,
      unitsOnHand: summary.units,
      stockValue: summary.valueAtCost,
      needsReorder: summary.needsReorder,
      expiringSoon: summary.expiringSoon,
      expired: summary.expired,
    },
    /** Products this shelf is short of, shallowest first. */
    short: lines
      .filter((line) => line.state === "out" || line.state === "critical")
      .sort((a, b) => a.onHand - b.onHand)
      .map((line) => line.medicine),
    expiringSoon: lines
      .filter((line) => line.daysToExpiry !== null && line.daysToExpiry >= 0 && line.daysToExpiry <= 90)
      .sort((a, b) => (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0))
      .map((line) => line.medicine),
    expired: lines
      .filter((line) => line.daysToExpiry !== null && line.daysToExpiry < 0)
      .map((line) => line.medicine),
    watched: lines
      .filter((line) => line.medicine.aware === "RESERVE" || line.medicine.aware === "WATCH")
      .sort((a, b) => b.onHand - a.onHand)
      .map((line) => line.medicine),
    healthy: byState(["healthy"]),
  };
}
