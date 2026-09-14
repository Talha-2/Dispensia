import { NextResponse } from "next/server";
import { counselTextFor, getMedicines } from "@/lib/catalogue";
import { scan } from "@/lib/safety";

type Body = {
  lines?: { id: string; qty?: number }[];
  patient?: { age?: number; sex?: "f" | "m" };
  cleared?: string[];
};

/**
 * Scans a whole basket against the 34 interaction rules plus the stewardship and
 * controlled-drug obligations. The counter calls this on every basket change.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const requested = body.lines ?? [];
  const medicines = getMedicines(requested.map((line) => line.id));
  const byId = new Map(medicines.map((m) => [m.id, m]));

  const missing = requested.filter((line) => !byId.has(line.id)).map((line) => line.id);
  const lines = requested
    .filter((line) => byId.has(line.id))
    .map((line) => ({ medicine: byId.get(line.id)!, qty: Math.max(1, line.qty ?? 1) }));

  const result = scan({
    lines,
    patient: body.patient ?? {},
    cleared: body.cleared ?? [],
    counselText: counselTextFor,
  });

  return NextResponse.json({ ...result, missing });
}
