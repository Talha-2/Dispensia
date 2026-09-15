import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { query } from "@/lib/catalogue";
import { patients as demoPatients } from "@/data/patients";

/**
 * Filling the demo pharmacy.
 *
 * The demo is a real tenant, so its data has to be real rows rather than the
 * synthetic slice the catalogue file used to hand every organisation. This
 * writes that slice in: the 1,885 products the seed marks as stocked become
 * stock lines, the twelve synthetic patients become patient records, and a
 * handful of controlled supplies become register entries.
 *
 * It runs as the caller, so row-level security is what stops it being pointed
 * at anybody's real pharmacy — and it refuses outright unless the organisation
 * being acted for is the demo.
 */

/** Postgres is happier with a few large inserts than a thousand small ones. */
const CHUNK = 400;

export async function POST() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { data: org } = await supabase.rpc("current_organization_id");
  if (!org) {
    return NextResponse.json({ error: "Join an organisation first." }, { status: 403 });
  }

  const { data: isDemo } = await supabase.rpc("is_demo_organization", { target: org });
  if (!isDemo) {
    return NextResponse.json(
      { error: "Only the demo organisation can be seeded." },
      { status: 403 },
    );
  }

  const { data: branches } = await supabase
    .from("branches")
    .select("id, is_primary, name")
    .eq("organization_id", org)
    .order("is_primary", { ascending: false });

  const branch = branches?.[0]?.id;
  if (!branch) {
    return NextResponse.json({ error: "The demo has no branch to stock." }, { status: 409 });
  }

  // ── Stock ────────────────────────────────────────────────────────────────
  // Everything the catalogue seed marks as held, written as this tenant's rows.
  const stocked = query({ scope: "stocked", size: 4000 }).items.filter((item) => item.stock);

  const stockRows = stocked.map((medicine) => ({
    organization_id: org,
    branch_id: branch,
    catalogue_id: medicine.id,
    on_hand: medicine.stock!.onHand,
    reorder: medicine.stock!.reorder,
    batch: medicine.stock!.batch,
    expiry: medicine.stock!.expiry,
    shelf: medicine.stock!.shelf,
    cost: medicine.cost,
    price: medicine.price,
    counted_at: medicine.stock!.counted,
  }));

  let stockWritten = 0;
  for (let i = 0; i < stockRows.length; i += CHUNK) {
    const { error } = await supabase
      .from("stock_lines")
      .upsert(stockRows.slice(i, i + CHUNK), { onConflict: "branch_id,catalogue_id,batch" });
    if (error) {
      return NextResponse.json(
        { error: `Stock: ${error.message}`, stockWritten },
        { status: 500 },
      );
    }
    stockWritten += Math.min(CHUNK, stockRows.length - i);
  }

  // ── Patients ─────────────────────────────────────────────────────────────
  const patientRows = demoPatients.map((patient) => ({
    organization_id: org,
    medical_record_number: patient.mrn,
    full_name: patient.name,
    age: patient.age,
    sex: patient.sex,
    phone: patient.phone,
    prescriber: patient.prescriber,
    allergies: patient.allergies,
    conditions: patient.conditions,
    notes: patient.notes ?? null,
    last_visit: patient.lastVisit,
  }));

  const { error: patientError } = await supabase
    .from("patients")
    .upsert(patientRows, { onConflict: "organization_id,medical_record_number" });

  if (patientError) {
    return NextResponse.json(
      { error: `Patients: ${patientError.message}`, stockWritten },
      { status: 500 },
    );
  }

  // ── Register ─────────────────────────────────────────────────────────────
  // A short history over controlled products the demo actually holds, so the
  // register opens with something to read rather than an empty statutory book.
  const { data: saved } = await supabase
    .from("patients")
    .select("id, full_name, medical_record_number")
    .eq("organization_id", org)
    .limit(12);

  const controlled = stocked.filter((medicine) => medicine.flags.includes("controlled")).slice(0, 10);

  const registerRows = controlled.map((medicine, index) => {
    const patient = saved?.[index % Math.max(1, saved.length)];
    const qty = (index % 3) + 1;
    const when = new Date();
    when.setDate(when.getDate() - index);

    return {
      organization_id: org,
      branch_id: branch,
      catalogue_id: medicine.id,
      brand: medicine.short,
      strength: medicine.strength ?? null,
      molecule: medicine.molecule,
      patient_id: patient?.id ?? null,
      patient_name: patient?.full_name ?? "Walk-in",
      mrn: patient?.medical_record_number ?? null,
      quantity: qty,
      balance_after: Math.max(0, (medicine.stock?.onHand ?? 0) - qty),
      pharmacist: "Demo Pharmacist",
      override_reason:
        index % 4 === 0 ? "Palliative continuation, prescriber contacted" : null,
      entered_at: when.toISOString(),
    };
  });

  let registerWritten = 0;
  if (registerRows.length) {
    const { error: registerError } = await supabase.from("register_entries").insert(registerRows);
    if (registerError) {
      return NextResponse.json(
        { error: `Register: ${registerError.message}`, stockWritten },
        { status: 500 },
      );
    }
    registerWritten = registerRows.length;
  }

  return NextResponse.json({
    stock: stockWritten,
    patients: patientRows.length,
    register: registerWritten,
  });
}
