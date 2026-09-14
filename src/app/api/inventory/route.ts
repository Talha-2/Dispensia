import { NextResponse } from "next/server";
import { daysToExpiry, expiryState, query, stockState, stockValue } from "@/lib/catalogue";

/**
 * Stocked lines only — the 1,885 products this branch actually carries, with
 * shelf state, expiry countdown and holding value resolved server-side.
 *
 *   /api/inventory?q=insulin&stock=critical,low
 */
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const list = (key: string) => {
    const values = searchParams.getAll(key).flatMap((v) => v.split(",")).filter(Boolean);
    return values.length ? values : undefined;
  };

  const result = query({
    q: searchParams.get("q") ?? undefined,
    scope: "stocked",
    stock: list("stock") as never,
    expiry: list("expiry") as never,
    maker: list("maker"),
    form: list("form"),
    aware: list("aware"),
    sort: (searchParams.get("sort") as never) ?? "expiry",
    dir: searchParams.get("dir") === "desc" ? "desc" : "asc",
    page: Number(searchParams.get("page") ?? 1),
    size: Number(searchParams.get("size") ?? 50),
  });

  return NextResponse.json({
    ...result,
    items: result.items.map((medicine) => ({
      ...medicine,
      stockState: stockState(medicine),
      expiryState: expiryState(medicine),
      daysToExpiry: daysToExpiry(medicine),
      holdingValue: stockValue(medicine),
    })),
  });
}
