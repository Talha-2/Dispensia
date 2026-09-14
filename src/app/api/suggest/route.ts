import { NextResponse } from "next/server";
import { counselTextFor, stockState, suggest } from "@/lib/catalogue";

/** Type-ahead for the command field. Ranked, stocked lines first. */
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const term = searchParams.get("q") ?? "";
  const items = suggest(term, Number(searchParams.get("limit") ?? 8));

  return NextResponse.json({
    items: items.map((medicine) => ({
      ...medicine,
      counselText: counselTextFor(medicine),
      stockState: stockState(medicine),
    })),
  });
}
