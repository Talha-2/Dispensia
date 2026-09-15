"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, Search as SearchIcon, UserPlus, X } from "lucide-react";
import { Empty } from "@/components/primitives";
import { Dialog, Toast } from "@/components/overlays";
import { COMMANDS, useCommand } from "@/lib/commands";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { exportCsv, stamp } from "@/lib/csv";
import type { Patient } from "@/lib/types";

type View = "table" | "list" | "board";

/**
 * The gates in the safety engine that a patient's own age and sex will arm.
 *
 * An unrecorded age arms nothing, and says so. Treating it as 0 used to arm
 * every paediatric block on an adult whose record was merely incomplete; the
 * honest answer is that the engine cannot speak for this patient yet.
 */
function gatesFor(patient: Patient): { label: string; tone: string }[] {
  const gates: { label: string; tone: string }[] = [];
  const { age, sex } = patient;

  if (age === undefined) {
    return [{ label: "Age not recorded — age gates dark", tone: "var(--warn)" }];
  }

  if (age < 2) gates.push({ label: "Promethazine block", tone: "var(--danger)" });
  if (age < 8) gates.push({ label: "Tetracycline block", tone: "var(--danger)" });
  if (age < 16) gates.push({ label: "Aspirin / Reye's block", tone: "var(--danger)" });
  if (age < 18) {
    gates.push({ label: "Benzodiazepine block", tone: "var(--danger)" });
    gates.push({ label: "Fluoroquinolone review", tone: "var(--warn)" });
  }
  if (!sex) {
    gates.push({ label: "Sex not recorded — pregnancy gates dark", tone: "var(--warn)" });
  } else if (sex === "f" && age >= 15 && age <= 50) {
    gates.push({ label: "ACEi / ARB pregnancy gate", tone: "var(--warn)" });
    gates.push({ label: "Teratogen pregnancy check", tone: "var(--warn)" });
  }
  if (age > 35) gates.push({ label: "Combined OCP cardiovascular", tone: "var(--warn)" });
  return gates;
}

/**
 * In the table a patient may arm five gates at once, and painting all five
 * amber turns the column into a wall of caution that means nothing. Only hard
 * blocks keep their hue there; reviews read as ordinary text.
 */
const gateInk = (tone: string) => (tone === "var(--danger)" ? tone : "var(--ink-2)");

/** One track per column, declared once so the header and the rows cannot drift. */
const PATIENT_GRID =
  "minmax(140px,1fr) 64px 96px minmax(120px,1fr) minmax(140px,1.2fr) minmax(160px,1.4fr)";

const ageBand = (age: number | undefined) =>
  age === undefined
    ? "Age not recorded"
    : age < 2 ? "Under 2" : age < 8 ? "2–7" : age < 18 ? "8–17" : age < 40 ? "18–39" : age < 65 ? "40–64" : "65+";

/** First and last initial — the anchor the eye finds before it reads a name. */
const initials = (name: string) => {
  const parts = name.replace(/[^\p{L}\s.'-]/gu, "").split(/\s+/).filter(Boolean);
  if (!parts.length) return "??";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : (parts[0][1] ?? "");
  return `${first}${last}`;
};

/**
 * The worst thing this patient's own demographics will do to a basket. A hard
 * block outranks a review; nothing else changes the tone, because an allergy is
 * already stated in words on every surface that shows one.
 */
function riskOf(patient: Patient): "block" | "conflict" | null {
  const gates = gatesFor(patient);
  if (gates.some((gate) => gate.tone === "var(--danger)")) return "block";
  return gates.length ? "conflict" : null;
}

// "—" rather than a guess: the column is read as fact, and an invented 0M is
// worse than a blank that sends somebody to the record.
const sexLabel = (patient: Patient) =>
  `${patient.age ?? "—"}${patient.sex ? patient.sex.toUpperCase() : "—"}`;

type GroupBy = "prescriber" | "age" | "risk";

const RISK_LANE = ["Hard blocks armed", "Review gates armed", "No demographic gate"] as const;

const laneOf = (patient: Patient, by: GroupBy) => {
  if (by === "prescriber") return patient.prescriber;
  if (by === "age") return ageBand(patient.age);
  const risk = riskOf(patient);
  return risk === "block" ? RISK_LANE[0] : risk === "conflict" ? RISK_LANE[1] : RISK_LANE[2];
};

/** Age and risk lanes have an inherent order; prescribers only have a caseload. */
const AGE_LANE = ["Under 2", "2–7", "8–17", "18–39", "40–64", "65+", "Age not recorded"];

export function PatientsView({
  patients: seed,
  initialOpen,
}: {
  patients: Patient[];
  initialOpen?: string;
}) {
  const [term, setTerm] = useState("");
  const [view, setView] = useState<View>("table");
  const [open, setOpen] = useState<string | null>(initialOpen ?? null);
  const [groupBy, setGroupBy] = useState<GroupBy>("prescriber");
  const [added, setAdded] = useState<Patient[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const patients = useMemo(() => [...added, ...seed], [added, seed]);

  const filtered = useMemo(() => {
    const lower = term.toLowerCase().trim();
    if (!lower) return patients;
    return patients.filter((patient) =>
      [patient.name, patient.mrn, patient.prescriber, patient.phone, ...patient.conditions, ...patient.allergies]
        .join(" ")
        .toLowerCase()
        .includes(lower),
    );
  }, [patients, term]);

  useCommand(
    COMMANDS.newPatient,
    useCallback(() => setAddOpen(true), []),
  );

  const doExport = useCallback(() => {
    const count = exportCsv(`dispensia-patients-${stamp()}`, filtered, [
      { header: "MRN", value: (p) => p.mrn },
      { header: "Name", value: (p) => p.name },
      { header: "Age", value: (p) => p.age },
      { header: "Sex", value: (p) => (p.sex === "f" ? "Female" : "Male") },
      { header: "Phone", value: (p) => p.phone },
      { header: "Prescriber", value: (p) => p.prescriber },
      { header: "Last visit", value: (p) => p.lastVisit },
      { header: "Allergies", value: (p) => p.allergies.join(" | ") },
      { header: "Conditions", value: (p) => p.conditions.join(" | ") },
      { header: "Armed safety gates", value: (p) => gatesFor(p).map((g) => g.label).join(" | ") },
    ]);
    setToast(`Exported ${count} patient ${count === 1 ? "record" : "records"}.`);
  }, [filtered]);

  useCommand(COMMANDS.export, doExport);

  const groups = useMemo(() => {
    const map = new Map<string, Patient[]>();
    for (const patient of filtered) {
      const key = laneOf(patient, groupBy);
      const list = map.get(key);
      if (list) list.push(patient);
      else map.set(key, [patient]);
    }
    const entries = [...map.entries()];
    // Age and risk lanes read in their own order; prescribers rank by caseload.
    const order = groupBy === "age" ? AGE_LANE : groupBy === "risk" ? [...RISK_LANE] : null;
    if (order) return entries.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    return entries.sort((a, b) => b[1].length - a[1].length);
  }, [filtered, groupBy]);

  const selected = filtered.find((p) => p.id === open) ?? null;

  return (
    <div
      className="grid gap-x-6"
      style={{ gridTemplateColumns: selected ? "minmax(0,1fr) 340px" : "minmax(0,1fr)" }}
    >
      <div className="min-w-0">
        <div className="baseline-strong flex flex-wrap items-center gap-x-4 gap-y-2 pb-2">
          <div className="field-shell min-w-[220px] flex-1">
            <SearchIcon size={15} strokeWidth={1.8} className="shrink-0" style={{ color: "var(--ink-3)" }} />
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Filter by name, MRN, prescriber, condition or allergy"
              className="t-data"
              aria-label="Search patients"
              data-filter-field=""
              spellCheck={false}
            />
            {term ? (
              <button
                type="button"
                onClick={() => setTerm("")}
                className="shrink-0"
                style={{ color: "var(--ink-3)" }}
                aria-label="Clear search"
              >
                <X size={14} strokeWidth={1.9} />
              </button>
            ) : (
              <span className="kbd shrink-0">/</span>
            )}
          </div>

          <div className="seg shrink-0" role="group" aria-label="View mode">
            {(["table", "list", "board"] as View[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                aria-pressed={view === mode}
                className="capitalize"
              >
                {mode}
              </button>
            ))}
          </div>

          <button type="button" className="act shrink-0" onClick={doExport}>
            <Download size={15} strokeWidth={1.8} />
            Export
          </button>

          <button type="button" className="act act-primary shrink-0" onClick={() => setAddOpen(true)}>
            <UserPlus size={15} strokeWidth={1.8} />
            Add patient
          </button>

          {view === "board" ? (
            <label className="flex shrink-0 items-center gap-2">
              <span className="t-label">Group</span>
              <select
                value={groupBy}
                onChange={(event) => setGroupBy(event.target.value as GroupBy)}
                className="field h-8 w-[130px]"
              >
                <option value="prescriber">Prescriber</option>
                <option value="age">Age band</option>
                <option value="risk">Armed gates</option>
              </select>
            </label>
          ) : null}

          <span className="t-data t-num" data-depth="2">
            {filtered.length} of {patients.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <Empty
            title="No patient matches that"
            hint="Search runs across name, medical record number, prescriber, recorded conditions and allergies."
            action={
              <button type="button" className="act act-primary" onClick={() => setTerm("")}>
                Clear search
              </button>
            }
          />
        ) : view === "table" ? (
          <div className="panel overflow-x-auto">
            <div style={{ minWidth: 900 }}>
              <div
                className="baseline-strong grid items-center gap-x-3 px-3 py-2"
                style={{ gridTemplateColumns: PATIENT_GRID, background: "var(--surface-sunk)" }}
              >
                {["Patient", "Age", "MRN", "Prescriber", "Allergies", "Armed gates"].map((label) => (
                  <span key={label} className="t-label">
                    {label}
                  </span>
                ))}
              </div>
              {filtered.map((patient) => {
                const live = open === patient.id;
                const gates = gatesFor(patient);
                return (
                  <div
                    key={patient.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpen(patient.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setOpen(patient.id);
                      }
                    }}
                    className="baseline row grid cursor-pointer items-center gap-x-3 px-3 py-1.5"
                    style={{ gridTemplateColumns: PATIENT_GRID, minHeight: 34 }}
                    data-live={live}
                  >
                    <span className="t-data truncate" data-depth={live ? "4" : "3"}>
                      {patient.name}
                    </span>
                    <span className="t-data t-num" data-depth="2">
                      {patient.age}
                      {patient.sex === "f" ? "F" : "M"}
                    </span>
                    <span className="t-data t-num truncate" data-depth="1">
                      {patient.mrn}
                    </span>
                    <span className="t-data truncate" data-depth="1">
                      {patient.prescriber}
                    </span>
                    <span className="t-data truncate" style={{ color: patient.allergies.length ? "var(--danger)" : undefined }} data-depth={patient.allergies.length ? "3" : "0"}>
                      {patient.allergies.length ? patient.allergies.join(", ") : "none recorded"}
                    </span>
                    <span className="flex flex-wrap items-center gap-1">
                      {gates.length ? (
                        gates.slice(0, 2).map((gate) => (
                          <span key={gate.label} className="t-sm" style={{ color: gateInk(gate.tone) }}>
                            {gate.label}
                          </span>
                        ))
                      ) : (
                        <span className="t-data" data-depth="0">
                          none
                        </span>
                      )}
                      {gates.length > 2 ? (
                        <span className="t-data" data-depth="1">
                          +{gates.length - 2}
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : view === "list" ? (
          /* A list, not a grid of cards: one ruled row per patient, reading
             left to right as identity → care → risk. Denser than the board and
             wordier than the table, which is the job a list view is for. */
          <div className="panel overflow-hidden">
            {filtered.map((patient) => {
              const live = open === patient.id;
              const gates = gatesFor(patient);
              const risk = riskOf(patient);
              const blocks = gates.filter((gate) => gate.tone === "var(--danger)");
              return (
                <div
                  key={patient.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpen(patient.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setOpen(patient.id);
                    }
                  }}
                  className="baseline row flex cursor-pointer items-start gap-3 px-3 py-2.5 last:border-b-0"
                  data-live={live}
                >
                  <span className="avatar mt-0.5" data-tone={risk ?? undefined} aria-hidden>
                    {initials(patient.name)}
                  </span>

                  {/* Who they are, and who looks after them. */}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="t-data" data-depth={live ? "4" : "3"}>
                        {patient.name}
                      </span>
                      <span className="t-data t-num" data-depth="2">
                        {sexLabel(patient)}
                      </span>
                      <span className="t-data t-num" data-depth="1">
                        {patient.mrn}
                      </span>
                    </span>
                    <span className="t-data mt-0.5 block truncate" data-depth="1">
                      {patient.prescriber} · last seen{" "}
                      <span className="t-num">{patient.lastVisit}</span> · {patient.phone}
                    </span>
                    {patient.conditions.length ? (
                      <span className="t-data mt-0.5 block truncate" data-depth="2">
                        {patient.conditions.join(" · ")}
                      </span>
                    ) : null}
                    {patient.notes ? (
                      <span className="t-prose mt-1 block max-w-[72ch]" data-depth="2">
                        {patient.notes}
                      </span>
                    ) : null}
                  </span>

                  {/* Allergies keep a column of their own — it is the one fact
                      on this row that can hurt somebody, and it must not be
                      buried in a sentence. */}
                  <span className="hidden w-[168px] shrink-0 md:block">
                    {patient.allergies.length ? (
                      <>
                        <span className="t-label" style={{ color: "var(--danger)" }}>
                          Allergic
                        </span>
                        {patient.allergies.map((allergy) => (
                          <span key={allergy} className="t-sm block" style={{ color: "var(--danger)" }}>
                            {allergy}
                          </span>
                        ))}
                      </>
                    ) : (
                      <span className="t-data" data-depth="0">
                        no allergy recorded
                      </span>
                    )}
                  </span>

                  <span className="hidden w-[200px] shrink-0 lg:block">
                    {gates.length ? (
                      <>
                        <span className="flex items-center gap-1.5">
                          <span className="t-label">Gates armed</span>
                          {blocks.length ? (
                            <span className="cell cell-reserve-soft">{blocks.length}</span>
                          ) : null}
                        </span>
                        {gates.slice(0, 3).map((gate) => (
                          <span key={gate.label} className="t-sm block" style={{ color: gateInk(gate.tone) }}>
                            {gate.label}
                          </span>
                        ))}
                        {gates.length > 3 ? (
                          <span className="t-sm block" data-depth="1">
                            +{gates.length - 3} more
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="t-data" data-depth="0">
                        no demographic gate
                      </span>
                    )}
                  </span>

                  <a
                    href={`/dispensing?patient=${encodeURIComponent(patient.id)}`}
                    className="act act-sm mt-0.5 shrink-0"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Dispense
                  </a>
                </div>
              );
            })}
          </div>
        ) : (
          /* A board of lanes, each scrolling inside itself. The page keeps its
             height whatever the biggest prescriber's caseload is. */
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3" style={{ minWidth: Math.min(groups.length, 6) * 264 }}>
              {groups.map(([key, list]) => {
                const atRisk = list.filter((patient) => riskOf(patient) === "block").length;
                return (
                  <section
                    key={key}
                    className="lane w-[256px] shrink-0"
                    style={{ height: "min(620px, calc(100vh - var(--header) - 280px))", minHeight: 320 }}
                  >
                    <div className="panel-head shrink-0" style={{ padding: "8px 10px" }}>
                      <h3 className="t-label flex-1 truncate" style={{ color: "var(--ink)" }}>
                        {key}
                      </h3>
                      {atRisk ? <span className="cell cell-reserve-soft">{atRisk}</span> : null}
                      <span className="cell cell-quiet">{list.length}</span>
                    </div>

                    <div className="lane-body">
                      {list.map((patient) => {
                        const live = open === patient.id;
                        const gates = gatesFor(patient);
                        const risk = riskOf(patient);
                        return (
                          <button
                            key={patient.id}
                            type="button"
                            onClick={() => setOpen(patient.id)}
                            className="tile flex items-start gap-2 p-2.5"
                            data-live={live}
                          >
                            <span className="avatar avatar-sm" data-tone={risk ?? undefined} aria-hidden>
                              {initials(patient.name)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="t-data block truncate" data-depth={live ? "4" : "3"}>
                                {patient.name}
                              </span>
                              <span className="t-data block truncate" data-depth="1">
                                <span className="t-num">{sexLabel(patient)}</span> ·{" "}
                                <span className="t-num">{patient.mrn}</span>
                              </span>
                              <span className="mt-1.5 flex flex-wrap items-center gap-1">
                                {patient.allergies.length ? (
                                  <span className="cell cell-block">
                                    {patient.allergies.length} allergy
                                  </span>
                                ) : null}
                                {gates.length ? (
                                  <span
                                    className={`cell ${risk === "block" ? "cell-reserve-soft" : "cell-watch-soft"}`}
                                  >
                                    {gates.length} gate{gates.length === 1 ? "" : "s"}
                                  </span>
                                ) : null}
                                {!patient.allergies.length && !gates.length ? (
                                  <span className="cell cell-quiet">clear</span>
                                ) : null}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selected ? (
        <aside
          aria-label="Patient detail"
          className="sticky top-[72px] hidden max-h-[calc(100vh-88px)] overflow-y-auto border-l border-(--line) pl-4 lg:block"
        >
          <div className="baseline-strong flex h-7 items-center gap-2 pb-1">
            <span className="t-label flex-1" style={{ color: "var(--ink)" }}>
              Patient
            </span>
            <button type="button" onClick={() => setOpen(null)} className="t-data" data-depth="1">
              close ✕
            </button>
          </div>

          <p className="t-display mt-3" style={{ fontSize: 20 }}>
            {selected.name}
          </p>
          <p className="t-data mt-1" data-depth="2">
            {selected.age} years · {selected.sex === "f" ? "Female" : "Male"} · {selected.mrn}
          </p>

          <div className="mt-4">
            <p className="t-label baseline pb-1">Contact</p>
            <p className="t-data py-1" data-depth="2">
              {selected.phone}
            </p>
            <p className="t-data" data-depth="1">
              {selected.prescriber} · last seen {selected.lastVisit}
            </p>
          </div>

          <div className="mt-4">
            <p className="t-label baseline pb-1">Allergies</p>
            {selected.allergies.length ? (
              selected.allergies.map((allergy) => (
                <p key={allergy} className="t-data flex items-center gap-2 py-1" style={{ color: "var(--danger)" }}>
                  <span className="cell cell-block">!</span>
                  {allergy}
                </p>
              ))
            ) : (
              <p className="t-data py-1" data-depth="1">
                None recorded. That is not the same as none.
              </p>
            )}
          </div>

          {selected.conditions.length ? (
            <div className="mt-4">
              <p className="t-label baseline pb-1">Conditions</p>
              {selected.conditions.map((condition) => (
                <p key={condition} className="t-data py-1" data-depth="2">
                  {condition}
                </p>
              ))}
            </div>
          ) : null}

          <div className="mt-4">
            <p className="t-label baseline pb-1">Gates this patient arms</p>
            {gatesFor(selected).length ? (
              gatesFor(selected).map((gate) => (
                <p key={gate.label} className="t-data py-1" style={{ color: gate.tone }}>
                  {gate.label}
                </p>
              ))
            ) : (
              <p className="t-data py-1" data-depth="1">
                No age or sex gate applies. Interaction rules still run on every basket.
              </p>
            )}
          </div>

          {selected.notes ? (
            <div className="band mt-4" data-sev="counsel">
              <p className="t-label">Note</p>
              <p className="t-prose mt-1" data-depth="2">
                {selected.notes}
              </p>
            </div>
          ) : null}
        </aside>
      ) : null}

      <AddPatientDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        existing={patients}
        onCreate={(patient) => {
          setAdded((current) => [patient, ...current]);
          setAddOpen(false);
          setOpen(patient.id);
          setToast(`${patient.name} added as ${patient.mrn}.`);
        }}
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

/* ═══ Add a patient ════════════════════════════════════════════════════════
   The fields the safety engine actually uses are required, because a record
   without an age and a sex silently disarms half the rule book. */

function AddPatientDialog({
  open,
  onClose,
  existing,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  existing: Patient[];
  onCreate: (patient: Patient) => void;
}) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"f" | "m" | "">("");
  const [phone, setPhone] = useState("");
  const [prescriber, setPrescriber] = useState("");
  const [allergies, setAllergies] = useState("");
  const [conditions, setConditions] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const prescribers = useMemo(
    () => [...new Set(existing.map((p) => p.prescriber))].sort(),
    [existing],
  );

  const nextMrn = useMemo(() => {
    const numbers = existing
      .map((p) => Number(p.mrn.replace(/\D/g, "")))
      .filter((n) => Number.isFinite(n));
    return `MRN-${Math.max(1040, ...numbers) + 1}`;
  }, [existing]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const years = Number(age);

    if (name.trim().length < 2) return setError("Enter the patient's full name.");
    if (!Number.isFinite(years) || years < 0 || years > 120) return setError("Enter an age between 0 and 120.");
    if (!sex) return setError("Sex is required — several safety rules depend on it.");
    if (existing.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())) {
      return setError(`A record for ${name.trim()} already exists. Search for it rather than creating a duplicate.`);
    }

    const split = (value: string) =>
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError("Supabase is not configured, so records cannot be saved.");

    setSaving(true);
    // organization_id is filled by the insert policy's own scope check, so the
    // client never chooses which pharmacy a patient belongs to.
    supabase
      .rpc("current_organization_id")
      .then(({ data: org }) =>
        supabase
          .from("patients")
          .insert({
            organization_id: org,
            medical_record_number: nextMrn,
            full_name: name.trim(),
            age: years,
            sex,
            phone: phone.trim() || null,
            prescriber: prescriber || null,
            allergies: split(allergies),
            conditions: split(conditions),
            last_visit: new Date().toISOString().slice(0, 10),
          })
          .select("id")
          .single(),
      )
      .then(({ data, error: saveError }) => {
        setSaving(false);
        if (saveError) return setError(saveError.message);

        onCreate({
          id: (data?.id as string) ?? nextMrn,
          mrn: nextMrn,
          name: name.trim(),
          age: years,
          sex,
          phone: phone.trim() || "—",
          prescriber: prescriber || "Unassigned",
          lastVisit: new Date().toISOString().slice(0, 10),
          allergies: split(allergies),
          conditions: split(conditions),
        });

        setName("");
        setAge("");
        setSex("");
        setPhone("");
        setAllergies("");
        setConditions("");
        setError("");
      });

    return undefined;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a patient"
      description={`The record will be created as ${nextMrn}.`}
      width={560}
      footer={
        <>
          <button type="button" className="act" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="add-patient" className="act act-primary" disabled={saving}>
            <UserPlus size={15} strokeWidth={1.8} />
            {saving ? "Saving…" : "Create record"}
          </button>
        </>
      }
    >
      <form id="add-patient" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required className="sm:col-span-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="field" autoComplete="off" />
        </Field>

        <Field label="Age" required hint="Arms the paediatric and reproductive-age gates">
          <input
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="field"
            inputMode="numeric"
            autoComplete="off"
          />
        </Field>

        <Field label="Sex" required hint="Several rules cannot fire without it">
          <select value={sex} onChange={(e) => setSex(e.target.value as "f" | "m")} className="field">
            <option value="">Select…</option>
            <option value="f">Female</option>
            <option value="m">Male</option>
          </select>
        </Field>

        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="field" autoComplete="off" />
        </Field>

        <Field label="Prescriber">
          <select value={prescriber} onChange={(e) => setPrescriber(e.target.value)} className="field">
            <option value="">Unassigned</option>
            {prescribers.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Known allergies" hint="Comma separated" className="sm:col-span-2">
          <input
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="Penicillin, Ibuprofen"
            className="field"
            autoComplete="off"
          />
        </Field>

        <Field label="Conditions" hint="Comma separated" className="sm:col-span-2">
          <input
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            placeholder="Type 2 diabetes, Hypertension"
            className="field"
            autoComplete="off"
          />
        </Field>

        {error ? (
          <p className="band t-sm sm:col-span-2" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  required,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="t-label">
        {label}
        {required ? <span style={{ color: "var(--danger)" }}> *</span> : null}
      </span>
      <span className="mt-1.5 block">{children}</span>
      {hint ? (
        <span className="t-xs mt-1 block" data-depth="1">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
