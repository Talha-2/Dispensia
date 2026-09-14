import { NextResponse } from "next/server";
import { query, type Query, type SortKey } from "@/lib/catalogue";
import type { ExpiryState, StockState } from "@/lib/types";

/**
 * The catalogue is 10,434 products, so every search, filter, sort and page is
 * resolved here rather than in the browser. The response carries facet counts
 * for the current result set, which is what lets the filter rail tell the truth
 * about what is left to narrow.
 *
 *   /api/catalogue?q=insulin&aware=WATCH&sort=price&dir=desc&page=2
 */
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const list = (key: string) => {
    const values = searchParams.getAll(key).flatMap((v) => v.split(",")).filter(Boolean);
    return values.length ? values : undefined;
  };
  const num = (key: string) => {
    const raw = searchParams.get(key);
    if (raw === null || raw === "") return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const input: Query = {
    q: searchParams.get("q") ?? undefined,
    aware: list("aware"),
    form: list("form"),
    maker: list("maker"),
    molecule: list("molecule"),
    flags: list("flags"),
    qt: list("qt"),
    stock: list("stock") as StockState[] | undefined,
    expiry: list("expiry") as ExpiryState[] | undefined,
    scope: searchParams.get("scope") === "stocked" ? "stocked" : "all",
    priceMin: num("priceMin"),
    priceMax: num("priceMax"),
    sort: (searchParams.get("sort") as SortKey) ?? undefined,
    dir: searchParams.get("dir") === "desc" ? "desc" : "asc",
    page: num("page"),
    size: num("size"),
  };

  return NextResponse.json(query(input));
}
