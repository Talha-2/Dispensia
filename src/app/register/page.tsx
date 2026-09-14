import { Fact, FactRow, Shell } from "@/components/shell";
import { RegisterView, type HeldLine, type RegisterEntry } from "@/components/register-view";
import { query, stockState } from "@/lib/catalogue";
import { patients } from "@/data/patients";
import { members } from "@/data/organisation";

export const metadata = {
  title: "Register · Dispensia",
};

/** Deterministic so the demo register is the same on every load. */
function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export default function RegisterPage() {
  const controlled = query({ flags: ["controlled"], sort: "brand", size: 400 });
  const stocked = controlled.items.filter((m) => m.stock);
  const held: HeldLine[] = stocked.map((medicine) => ({
    medicine,
    state: stockState(medicine) ?? "healthy",
  }));

  const opioids = query({ flags: ["opioid"], size: 1 });
  const benzos = query({ flags: ["benzo"], size: 1 });

  // Only a licensed pharmacist may sign a controlled entry — the register is
  // where that distinction is load-bearing rather than decorative.
  const pharmacists = members
    .filter((member) => member.pharmacistLicence && member.status === "active")
    .map((member) => member.name);

  // SYNTHETIC entries, written over the real controlled products this branch
  // holds so every name, molecule and balance on the ledger is one that exists.
  // The balance walks down per product, which is what a real register does.
  const running = new Map<string, number>();
  const entries: RegisterEntry[] = stocked.slice(0, 40).map((medicine, index) => {
    const seed = hash(medicine.id);
    const patient = patients[seed % patients.length];
    const qty = (seed % 3) + 1;
    const day = Math.max(1, 14 - Math.floor(index / 3));
    const opening = running.get(medicine.id) ?? medicine.stock?.onHand ?? 0;
    const balance = Math.max(0, opening - qty);
    running.set(medicine.id, balance);
    return {
      key: `${medicine.id}-${index}`,
      medicineId: medicine.id,
      brand: medicine.short,
      strength: medicine.strength ?? "",
      molecule: medicine.molecule,
      patientName: patient.name,
      mrn: patient.mrn,
      qty,
      when: `2026-09-${String(day).padStart(2, "0")}`,
      time: `${String(9 + (seed % 8)).padStart(2, "0")}:${String(seed % 60).padStart(2, "0")}`,
      pharmacist: pharmacists[seed % Math.max(1, pharmacists.length)] ?? "A. Yousaf",
      balance,
      override: seed % 11 === 0 ? "Palliative continuation, prescriber contacted" : undefined,
    };
  });

  const overridden = entries.filter((entry) => entry.override).length;

  return (
    <Shell
      title="Register"
      meta={
        <>
          <span className="t-data" data-depth="2">
            controlled-drug register
          </span>
          <span className="t-data" data-depth="1">
            <span className="t-num" data-depth="2">
              {controlled.total}
            </span>{" "}
            controlled products ·{" "}
            <span className="t-num" data-depth="2">
              {held.length}
            </span>{" "}
            held here
          </span>
          <span className="t-data" data-depth="0">
            append-only · synthetic entries
          </span>
        </>
      }
    >
      <div className="mb-4">
        <FactRow cols={6}>
          <Fact label="Controlled lines held" value={String(held.length)} note="statutory stock" depth="4" />
          <Fact label="Entries this month" value={String(entries.length)} note="September 2026" />
          <Fact
            label="Supplies overridden"
            value={String(overridden)}
            note="pharmacist reason recorded"
            tone={overridden ? "var(--warn)" : undefined}
          />
          <Fact label="Opioid products" value={String(opioids.total)} note="in catalogue" />
          <Fact label="Benzodiazepines" value={String(benzos.total)} note="in catalogue" />
          <Fact label="Balance checks due" value="0" note="all reconciled" tone="var(--ok)" />
        </FactRow>
      </div>

      <RegisterView entries={entries} held={held} patients={patients} pharmacists={pharmacists} />
    </Shell>
  );
}
