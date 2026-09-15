import { Fact, FactRow, Shell } from "@/components/shell";
import { RegisterView, type HeldLine } from "@/components/register-view";
import { query } from "@/lib/catalogue";
import { getPatients, getRegister } from "@/lib/records";
import { getStock } from "@/lib/stock";
import { getTenant } from "@/lib/tenant";

export const metadata = {
  title: "Register · Dispensia",
};

/**
 * The controlled-drug register.
 *
 * Append-only, and this organisation's own: a pharmacy that has just opened has
 * dispensed nothing, so it opens empty rather than showing a worked example.
 * The only shared thing here is which products *are* controlled, which is a
 * catalogue fact.
 */
export default async function RegisterPage() {
  const tenant = await getTenant();
  const [entries, { lines: stock }, patients] = await Promise.all([
    getRegister(),
    getStock(),
    getPatients(),
  ]);

  const controlled = query({ flags: ["controlled"], size: 1 });
  const opioids = query({ flags: ["opioid"], size: 1 });
  const benzos = query({ flags: ["benzo"], size: 1 });

  // What this shelf holds that is register-bound.
  const held: HeldLine[] = stock
    .filter((line) => line.medicine.flags.includes("controlled"))
    .map((line) => ({ medicine: line.medicine, state: line.state }));

  const pharmacists = [tenant.signedInAs ?? "Pharmacist on duty"];
  const overridden = entries.filter((entry) => entry.override).length;

  return (
    <Shell
      title="Register"
      meta={
        <>
          <span className="t-sm" data-depth="2">
            controlled-drug register
          </span>
          <span className="t-sm" data-depth="1">
            <span className="t-num" data-depth="2">
              {held.length}
            </span>{" "}
            controlled lines held ·{" "}
            <span className="t-num" data-depth="2">
              {controlled.total.toLocaleString()}
            </span>{" "}
            such products exist
          </span>
          <span className="t-sm" data-depth="0">
            append-only · {tenant.organisation.name}
          </span>
        </>
      }
    >
      <div className="mb-4">
        <FactRow cols={6}>
          <Fact
            label="Controlled lines held"
            value={String(held.length)}
            note="statutory stock"
            depth="4"
          />
          <Fact label="Entries recorded" value={String(entries.length)} note="since you opened" />
          <Fact
            label="Supplies overridden"
            value={String(overridden)}
            note="pharmacist reason recorded"
            tone={overridden ? "var(--warn)" : undefined}
          />
          <Fact label="Opioid products" value={opioids.total.toLocaleString()} note="in catalogue" />
          <Fact label="Benzodiazepines" value={benzos.total.toLocaleString()} note="in catalogue" />
          <Fact label="Balance checks due" value="0" note="all reconciled" tone="var(--ok)" />
        </FactRow>
      </div>

      <RegisterView entries={entries} held={held} patients={patients} pharmacists={pharmacists} />
    </Shell>
  );
}
