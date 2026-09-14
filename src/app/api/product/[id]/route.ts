import { NextResponse } from "next/server";
import {
  alternativesFor,
  counselTextFor,
  daysToExpiry,
  expiryState,
  getMedicine,
  margin,
  stockState,
} from "@/lib/catalogue";

/** Everything the counter needs about one product, including its substitutions. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const medicine = getMedicine(id);

  if (!medicine) {
    return NextResponse.json({ error: "No product with that id." }, { status: 404 });
  }

  return NextResponse.json({
    medicine,
    counsel: counselTextFor(medicine),
    margin: margin(medicine),
    stockState: stockState(medicine),
    expiryState: expiryState(medicine),
    daysToExpiry: daysToExpiry(medicine),
    alternatives: alternativesFor(medicine, 10).map((alt) => ({
      ...alt,
      stockState: stockState(alt),
    })),
  });
}
