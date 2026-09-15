import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Patient } from "@/lib/types";

export type RegisterEntryRow = {
  key: string;
  medicineId: string;
  brand: string;
  strength: string;
  molecule: string;
  patientName: string;
  mrn: string;
  qty: number;
  when: string;
  time: string;
  pharmacist: string;
  balance: number;
  override?: string;
};

/**
 * This organisation's patient records.
 *
 * Empty for a pharmacy that has just opened, which is the point: a patient list
 * is a record of who walked in, and nobody has. The catalogue is the only
 * dataset anybody inherits.
 */
export async function getPatients(): Promise<Patient[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("patients")
    .select(
      "id, medical_record_number, full_name, age, sex, phone, prescriber, allergies, conditions, notes, last_visit, created_at",
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    mrn: (row.medical_record_number as string) ?? "—",
    name: (row.full_name as string) ?? "Unnamed",
    // Age and sex arm the paediatric, teratogen and reproductive-age gates, so
    // a missing one stays missing. The defaults here used to be 0 and "m",
    // which are not neutral in either direction: an age of 0 makes a newborn of
    // every unrecorded adult and fires the paediatric rules on all of them,
    // and a sex of "m" disarms the pregnancy gate silently — the basket comes
    // back clear because the question was never asked.
    age: row.age === null || row.age === undefined ? undefined : Number(row.age),
    sex: (row.sex as "f" | "m" | null) ?? undefined,
    phone: (row.phone as string) ?? "—",
    prescriber: (row.prescriber as string) ?? "Unassigned",
    lastVisit: (row.last_visit as string) ?? "—",
    allergies: (row.allergies as string[] | null) ?? [],
    conditions: (row.conditions as string[] | null) ?? [],
    notes: (row.notes as string | null) ?? undefined,
  }));
}

/**
 * The controlled-drug register, newest first.
 *
 * Append-only in the database: there is an insert policy and a select policy
 * and deliberately no update or delete, so a correction has to be a new line.
 */
export async function getRegister(): Promise<RegisterEntryRow[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  // A controlled-drug register is kept per registered site: each branch has its
  // own DRAP licence, and an inspector asks that site for that site's book.
  const { data: branch } = await supabase.rpc("current_branch_id");

  const { data, error } = await supabase
    .from("register_entries")
    .select(
      "id, catalogue_id, brand, strength, molecule, patient_name, mrn, quantity, balance_after, pharmacist, override_reason, entered_at",
    )
    .eq("branch_id", branch ?? "00000000-0000-0000-0000-000000000000")
    .order("entered_at", { ascending: false })
    .limit(500);

  if (error || !data) return [];

  return data.map((row) => {
    const at = new Date(row.entered_at as string);
    return {
      key: row.id as string,
      medicineId: (row.catalogue_id as string) ?? "",
      brand: (row.brand as string) ?? "—",
      strength: (row.strength as string | null) ?? "",
      molecule: (row.molecule as string) ?? "—",
      patientName: (row.patient_name as string) ?? "Walk-in",
      mrn: (row.mrn as string | null) ?? "—",
      qty: Number(row.quantity) || 0,
      balance: Number(row.balance_after) || 0,
      pharmacist: (row.pharmacist as string) ?? "—",
      override: (row.override_reason as string | null) ?? undefined,
      when: Number.isNaN(at.getTime()) ? "—" : at.toISOString().slice(0, 10),
      time: Number.isNaN(at.getTime()) ? "—" : at.toTimeString().slice(0, 5),
    };
  });
}
