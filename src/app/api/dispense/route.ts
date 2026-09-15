import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { counselTextFor, getMedicines } from "@/lib/catalogue";
import { scan } from "@/lib/safety";

/**
 * Closing a basket, with the safety engine on the server side of the door.
 *
 * The counter already refuses to dispense a blocked basket, but that refusal
 * lived only in the browser: dispense_basket could be called directly and would
 * take the stock down and write the register without ever consulting a rule.
 * A clinical gate that can be walked around by anyone who opens the network tab
 * is not a gate.
 *
 * So the basket is re-scanned here, from the catalogue, against the patient the
 * caller claims — and a block that has not been overridden by somebody entitled
 * to override it is refused outright.
 */

type Body = {
  lines?: { id: string; qty: number }[];
  patientId?: string | null;
  cleared?: string[];
  overrideReason?: string | null;
};

export async function POST(request: Request) {
  // Checked here as well as in the middleware. Without it an anonymous caller
  // fell through to row-level security and was told to "join an organisation",
  // which is a confusing way to say "sign in" — and it left the refusal
  // resting on one layer rather than two.
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to dispense." }, { status: 401 });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const lines = body?.lines?.filter((line) => line?.id && line.qty > 0) ?? [];
  if (!lines.length) {
    return NextResponse.json({ error: "Nothing to dispense." }, { status: 400 });
  }

  const { data: org } = await supabase.rpc("current_organization_id");
  if (!org) {
    return NextResponse.json({ error: "Join an organisation before dispensing." }, { status: 403 });
  }

  // The products are read from the catalogue by id, never taken from the
  // request: a caller cannot describe a paracetamol and be handed a warfarin.
  const medicines = getMedicines(lines.map((line) => line.id));
  const byId = new Map(medicines.map((medicine) => [medicine.id, medicine]));

  const resolved = lines
    .map((line) => ({ medicine: byId.get(line.id), qty: line.qty }))
    .filter((line): line is { medicine: NonNullable<typeof line.medicine>; qty: number } =>
      Boolean(line.medicine),
    );

  if (resolved.length !== lines.length) {
    return NextResponse.json(
      { error: "One of those products is not in the catalogue." },
      { status: 400 },
    );
  }

  // The patient is read from the database, not trusted from the client, because
  // age and sex decide whether half the rule book fires at all.
  let patient: { age?: number; sex?: "f" | "m" } = {};
  let patientRow: { id: string; name: string; mrn: string | null } | null = null;

  if (body?.patientId) {
    const { data } = await supabase
      .from("patients")
      .select("id, full_name, medical_record_number, age, sex")
      .eq("id", body.patientId)
      .maybeSingle();

    if (data) {
      patientRow = {
        id: data.id as string,
        name: (data.full_name as string) ?? "Walk-in",
        mrn: (data.medical_record_number as string | null) ?? null,
      };
      // Missing stays missing. Guessing an age makes every paediatric rule
      // fire; guessing a sex silently disarms the pregnancy gate.
      patient = {
        age: data.age === null || data.age === undefined ? undefined : Number(data.age),
        sex: (data.sex as "f" | "m" | null) ?? undefined,
      };
    }
  }

  const cleared = body?.cleared ?? [];

  // Overriding is a clinical act. Only somebody entitled to make it may, and
  // the entitlement is checked here rather than behind a shared PIN in the
  // browser bundle.
  if (cleared.length) {
    const { data: mayOverride } = await supabase.rpc("can_override_findings");
    if (!mayOverride) {
      return NextResponse.json(
        { error: "Your role does not permit clearing a clinical finding." },
        { status: 403 },
      );
    }
    if (!body?.overrideReason?.trim()) {
      return NextResponse.json(
        { error: "An override needs a written clinical reason." },
        { status: 400 },
      );
    }
  }

  const result = scan({
    lines: resolved,
    patient,
    cleared,
    counselText: counselTextFor,
  });

  if (result.verdict === "blocked") {
    return NextResponse.json(
      {
        error: "This basket is blocked. Resolve the finding, or record a pharmacist override.",
        verdict: result.verdict,
        findings: result.findings.filter((finding) => finding.severity === "block"),
      },
      { status: 409 },
    );
  }

  const { data, error } = await supabase.rpc("dispense_basket", {
    p_lines: resolved.map((line) => ({
      catalogue_id: line.medicine.id,
      qty: line.qty,
      brand: line.medicine.short,
      strength: line.medicine.strength ?? null,
      molecule: line.medicine.molecule,
      controlled: line.medicine.flags.includes("controlled"),
    })),
    p_patient: patientRow?.id ?? null,
    p_patient_name: patientRow?.name ?? "Walk-in",
    p_mrn: patientRow?.mrn ?? null,
    p_overrides: cleared.length
      ? `${cleared.join(", ")} — ${body?.overrideReason?.trim() ?? ""}`
      : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ verdict: result.verdict, ...(data as object) });
}
