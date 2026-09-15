import { Suspense } from "react";
import { PatientsView } from "@/components/patients-view";
import { Fact, FactRow, Shell } from "@/components/shell";
import { getPatients } from "@/lib/records";

export const metadata = {
  title: "Patients · Dispensia",
};

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const { open } = await searchParams;
  const patients = await getPatients();
  const prescribers = [...new Set(patients.map((p) => p.prescriber).filter(Boolean))];
  const withAllergies = patients.filter((p) => p.allergies.length).length;
  // A patient with no age counts towards none of these bands. Counting them as
  // 0 made every incomplete record paediatric.
  const paediatric = patients.filter((p) => p.age !== undefined && p.age < 18).length;
  const reproductive = patients.filter(
    (p) => p.sex === "f" && p.age !== undefined && p.age >= 15 && p.age <= 50,
  ).length;
  const over65 = patients.filter((p) => p.age !== undefined && p.age >= 65).length;
  const conditions = new Set(patients.flatMap((p) => p.conditions)).size;

  return (
    <Shell
      title="Patients"
      meta={
        <>
          <span className="t-data" data-depth="2">
            <span className="t-num" data-depth="3">
              {patients.length}
            </span>{" "}
            records
          </span>
          <span className="t-data" data-depth="1">
            <span className="t-num" data-depth="2">
              {withAllergies}
            </span>{" "}
            with allergies
          </span>
          <span className="t-data" data-depth="1">
            <span className="t-num" data-depth="2">
              {paediatric}
            </span>{" "}
            paediatric
          </span>
          <span className="t-data" data-depth="1">
            <span className="t-num" data-depth="2">
              {prescribers.length}
            </span>{" "}
            prescribers
          </span>
          <span className="t-data" data-depth="0">
            synthetic records
          </span>
        </>
      }
    >
      <div className="mb-4">
        <FactRow>
          <Fact label="Records" value={String(patients.length)} note="on this branch" />
          {/* A patient count is not an AWaRe class, a severity or a shelf state,
              so it does not take a clinical hue. */}
          <Fact label="With allergies" value={String(withAllergies)} note="checked on every basket" />
          <Fact label="Paediatric" value={String(paediatric)} note="under 18 — age gates armed" />
          <Fact
            label="Reproductive age"
            value={String(reproductive)}
            note="teratogen and ACEi gates"
          />
          <Fact label="Over 65" value={String(over65)} note="renal and polypharmacy risk" />
          <Fact label="Conditions tracked" value={String(conditions)} note="distinct across all records" />
        </FactRow>
      </div>

      <Suspense fallback={null}>
        <PatientsView patients={patients} initialOpen={open} />
      </Suspense>
    </Shell>
  );
}
