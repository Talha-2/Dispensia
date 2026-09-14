"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, PenLine, Search as SearchIcon, X } from "lucide-react";
import { Empty, Markers, STOCK_LABEL, pkr } from "@/components/primitives";
import { Dialog, Toast } from "@/components/overlays";
import { COMMANDS, useCommand } from "@/lib/commands";
import { exportCsv, stamp } from "@/lib/csv";
import type { Medicine, Patient, StockState } from "@/lib/types";

export type RegisterEntry = {
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
  /** Written for a supply the engine gated and a pharmacist cleared. */
  override?: string;
};

export type HeldLine = {
  medicine: Medicine;
  state: StockState;
};

/**
 * A register is read a page at a time; nobody scrolls a statutory ledger. Ten
 * two-line rows is what clears the fold on a 940px screen once the summary row
 * and the toolbar have taken their share.
 */
const PAGE = 10;

const CLASSES = [
  { id: "all", label: "All entries" },
  { id: "opioid", label: "Opioid" },
  { id: "benzo", label: "Benzodiazepine" },
] as const;

type ClassId = (typeof CLASSES)[number]["id"];

const GRID =
  "96px 56px minmax(170px,1.5fr) minmax(140px,1.1fr) 52px 76px minmax(96px,0.9fr)";

const HEADERS = ["Date", "Time", "Product", "Patient", "Qty", "Balance", "Pharmacist"];

export function RegisterView({
  entries: seed,
  held,
  patients,
  pharmacists,
}: {
  entries: RegisterEntry[];
  held: HeldLine[];
  patients: Patient[];
  pharmacists: string[];
}) {
  const [written, setWritten] = useState<RegisterEntry[]>([]);
  const [term, setTerm] = useState("");
  const [klass, setKlass] = useState<ClassId>("all");
  const [page, setPage] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flagsById = useMemo(
    () => new Map(held.map((line) => [line.medicine.id, line.medicine.flags])),
    [held],
  );

  const entries = useMemo(() => [...written, ...seed], [written, seed]);

  const filtered = useMemo(() => {
    const lower = term.toLowerCase().trim();
    return entries.filter((entry) => {
      if (klass !== "all" && !(flagsById.get(entry.medicineId) ?? []).includes(klass)) return false;
      if (!lower) return true;
      return [entry.brand, entry.molecule, entry.patientName, entry.mrn, entry.pharmacist, entry.when]
        .join(" ")
        .toLowerCase()
        .includes(lower);
    });
  }, [entries, term, klass, flagsById]);

  // A filter that shortens the ledger must not leave the reader on a page that
  // no longer exists.
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * PAGE, current * PAGE + PAGE);

  const doExport = useCallback(() => {
    const count = exportCsv(`dispensia-register-${stamp()}`, filtered, [
      { header: "Date", value: (e) => e.when },
      { header: "Time", value: (e) => e.time },
      { header: "Product", value: (e) => `${e.brand}${e.strength ? ` ${e.strength}` : ""}` },
      { header: "Molecule", value: (e) => e.molecule },
      { header: "Patient", value: (e) => e.patientName },
      { header: "MRN", value: (e) => e.mrn },
      { header: "Quantity", value: (e) => e.qty },
      { header: "Balance after", value: (e) => e.balance },
      { header: "Pharmacist", value: (e) => e.pharmacist },
      { header: "Override reason", value: (e) => e.override ?? "" },
    ]);
    setToast(`Exported ${count} register ${count === 1 ? "entry" : "entries"}.`);
  }, [filtered]);

  useCommand(COMMANDS.export, doExport);

  /** The balance a product stands at right now, read off the last entry for it. */
  const balanceOf = useCallback(
    (medicineId: string) => {
      const last = entries.find((entry) => entry.medicineId === medicineId);
      if (last) return last.balance;
      return held.find((line) => line.medicine.id === medicineId)?.medicine.stock?.onHand ?? 0;
    },
    [entries, held],
  );

  const value = held.reduce(
    (sum, line) => sum + (line.medicine.stock?.onHand ?? 0) * line.medicine.cost,
    0,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(292px,0.42fr)]">
      {/* ── The ledger ─────────────────────────────────────────────────────── */}
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="field-shell min-w-[220px] flex-1">
            <SearchIcon size={15} strokeWidth={1.8} className="shrink-0" style={{ color: "var(--ink-3)" }} />
            <input
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                setPage(0);
              }}
              placeholder="Search by product, patient, MRN or pharmacist"
              className="t-data"
              aria-label="Search the register"
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

          <div className="seg shrink-0" role="group" aria-label="Entry class">
            {CLASSES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setKlass(entry.id);
                  setPage(0);
                }}
                aria-pressed={klass === entry.id}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <button type="button" className="act shrink-0" onClick={doExport}>
            <Download size={15} strokeWidth={1.8} />
            Export
          </button>

          <button
            type="button"
            className="act act-primary shrink-0"
            onClick={() => setAddOpen(true)}
            disabled={!held.length}
          >
            <PenLine size={15} strokeWidth={1.8} />
            Record entry
          </button>
        </div>

        {filtered.length === 0 ? (
          <Empty
            title="No entry matches that"
            hint="The register is searched across product, molecule, patient, medical record number and the pharmacist who signed."
            action={
              <button
                type="button"
                className="act act-primary"
                onClick={() => {
                  setTerm("");
                  setKlass("all");
                }}
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <div className="panel overflow-x-auto">
            <div style={{ minWidth: 820 }}>
              <div
                className="baseline-strong grid items-center gap-x-3 px-3 py-2"
                style={{ gridTemplateColumns: GRID, background: "var(--surface-sunk)" }}
              >
                {HEADERS.map((label) => (
                  <span key={label} className="t-label">
                    {label}
                  </span>
                ))}
              </div>

              {shown.map((entry) => (
                <div
                  key={entry.key}
                  className="baseline row grid items-center gap-x-3 px-3 py-1.5"
                  style={{ gridTemplateColumns: GRID, minHeight: 34 }}
                >
                  <span className="t-data t-num" data-depth="1">
                    {entry.when}
                  </span>
                  <span className="t-data t-num" data-depth="1">
                    {entry.time}
                  </span>
                  <span className="min-w-0 truncate">
                    <span className="t-data" data-depth="3">
                      {entry.brand}
                    </span>
                    {entry.strength ? (
                      <span className="t-data t-num ml-1" data-depth="2">
                        {entry.strength}
                      </span>
                    ) : null}
                    <span className="t-data block truncate" data-depth="1">
                      {entry.molecule}
                    </span>
                  </span>
                  <span className="min-w-0 truncate">
                    <span className="t-data block truncate" data-depth="2">
                      {entry.patientName}
                    </span>
                    <span className="t-data t-num block" data-depth="1">
                      {entry.mrn}
                    </span>
                  </span>
                  <span className="t-data t-num" data-depth="3">
                    {entry.qty}
                  </span>
                  <span
                    className="t-data t-num"
                    data-depth="2"
                    style={entry.balance === 0 ? { color: "var(--danger)" } : undefined}
                  >
                    {entry.balance}
                  </span>
                  <span className="min-w-0 truncate">
                    <span className="t-data block truncate" data-depth="1">
                      {entry.pharmacist}
                    </span>
                    {entry.override ? (
                      <span className="cell cell-watch-soft mt-0.5">overridden</span>
                    ) : null}
                  </span>
                </div>
              ))}

              {/* Pagination, so the ledger is a page rather than a scroll. */}
              <div className="flex items-center gap-3 px-3 py-2">
                <span className="t-data flex-1" data-depth="1">
                  <span className="t-num" data-depth="2">
                    {current * PAGE + 1}–{Math.min(filtered.length, (current + 1) * PAGE)}
                  </span>{" "}
                  of{" "}
                  <span className="t-num" data-depth="2">
                    {filtered.length}
                  </span>{" "}
                  entries
                </span>
                <button
                  type="button"
                  className="act act-sm act-icon"
                  onClick={() => setPage(Math.max(0, current - 1))}
                  disabled={current === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={15} strokeWidth={1.9} />
                </button>
                <span className="t-data t-num" data-depth="2">
                  {current + 1} / {pages}
                </span>
                <button
                  type="button"
                  className="act act-sm act-icon"
                  onClick={() => setPage(Math.min(pages - 1, current + 1))}
                  disabled={current >= pages - 1}
                  aria-label="Next page"
                >
                  <ChevronRight size={15} strokeWidth={1.9} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── What is on the shelf behind the ledger ─────────────────────────── */}
      <aside className="sticky-rail min-w-0 self-start">
        <div className="panel">
          <div className="panel-head">
            <span className="t-label flex-1" style={{ color: "var(--ink)" }}>
              Controlled stock held
            </span>
            <span className="cell cell-quiet">{held.length}</span>
          </div>

          <div className="px-3 py-1">
            {held.length ? (
              held.map(({ medicine, state }) => (
                <div key={medicine.id} className="baseline flex items-center gap-2 py-1.5 last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <span className="t-data block truncate" data-depth="3">
                      {medicine.short}
                      {medicine.strength ? (
                        <span className="t-num ml-1" data-depth="2">
                          {medicine.strength}
                        </span>
                      ) : null}
                    </span>
                    <span className="t-data block truncate" data-depth="1">
                      {medicine.stock?.shelf} · {STOCK_LABEL[state]}
                    </span>
                  </span>
                  <Markers medicine={medicine} aware={false} />
                  <span
                    className="t-data t-num w-8 shrink-0 text-right"
                    data-depth="3"
                    style={state === "critical" || state === "out" ? { color: "var(--danger)" } : undefined}
                  >
                    {medicine.stock?.onHand}
                  </span>
                </div>
              ))
            ) : (
              <p className="t-prose max-w-[54ch] py-3" data-depth="2">
                No controlled stock is held at this branch right now. The register stays open for the statutory
                retention period regardless.
              </p>
            )}
          </div>

          <div className="baseline-strong" />
          <div className="flex items-baseline gap-2 px-3 py-2">
            <span className="t-data flex-1" data-depth="1">
              Value held at cost
            </span>
            <span className="t-data t-num" data-depth="3">
              PKR {pkr(value)}
            </span>
          </div>
        </div>

        <div className="band mt-3" data-sev="conflict">
          <p className="t-label" style={{ color: "var(--ink)" }}>
            Statutory duty
          </p>
          <p className="t-prose mt-1 max-w-[54ch]" data-depth="3">
            Every controlled supply writes an entry here before the basket can close, with the prescriber and the
            patient identity verified. Entries are append-only; a correction is a new line, never an edit.
          </p>
        </div>
      </aside>

      <EntryDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        held={held}
        patients={patients}
        pharmacists={pharmacists}
        balanceOf={balanceOf}
        onWrite={(entry) => {
          setWritten((list) => [entry, ...list]);
          setAddOpen(false);
          setPage(0);
          setToast(
            `Entry written for ${entry.brand} — balance now ${entry.balance}. The line is append-only and cannot be edited.`,
          );
        }}
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

/* ═══ Write an entry ═══════════════════════════════════════════════════════
   A register line is a legal record, so the dialog refuses anything it cannot
   stand behind: a real patient, a quantity the shelf can actually cover, and a
   named pharmacist who verified the prescriber. */

function EntryDialog({
  open,
  onClose,
  held,
  patients,
  pharmacists,
  balanceOf,
  onWrite,
}: {
  open: boolean;
  onClose: () => void;
  held: HeldLine[];
  patients: Patient[];
  pharmacists: string[];
  balanceOf: (medicineId: string) => number;
  onWrite: (entry: RegisterEntry) => void;
}) {
  const [medicineId, setMedicineId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [qty, setQty] = useState("1");
  const [pharmacist, setPharmacist] = useState(pharmacists[0] ?? "");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");

  const chosen = held.find((line) => line.medicine.id === medicineId) ?? null;
  const balance = chosen ? balanceOf(chosen.medicine.id) : null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(qty);

    if (!chosen) return setError("Choose the controlled product being supplied.");
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return setError("A controlled supply cannot be recorded against a walk-in.");
    if (!Number.isInteger(amount) || amount < 1) return setError("Quantity must be a whole number of units.");
    if (balance !== null && amount > balance) {
      return setError(`Only ${balance} units are on the shelf. The register cannot go negative.`);
    }
    if (!verified) return setError("Confirm that the prescriber and the patient identity were verified.");

    const now = new Date();
    onWrite({
      key: `${chosen.medicine.id}-${now.getTime()}`,
      medicineId: chosen.medicine.id,
      brand: chosen.medicine.short,
      strength: chosen.medicine.strength ?? "",
      molecule: chosen.medicine.molecule,
      patientName: patient.name,
      mrn: patient.mrn,
      qty: amount,
      when: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 5),
      pharmacist: pharmacist || pharmacists[0] || "Unassigned",
      balance: (balance ?? 0) - amount,
    });

    setMedicineId("");
    setPatientId("");
    setQty("1");
    setVerified(false);
    setError("");
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record a register entry"
      description="Append-only. Once written, a line can be superseded but never changed."
      width={560}
      footer={
        <>
          <button type="button" className="act" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="register-entry" className="act act-primary">
            <PenLine size={15} strokeWidth={1.8} />
            Write entry
          </button>
        </>
      }
    >
      <form id="register-entry" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="t-label">
            Controlled product<span style={{ color: "var(--danger)" }}> *</span>
          </span>
          <select
            value={medicineId}
            onChange={(event) => setMedicineId(event.target.value)}
            className="field mt-1.5"
          >
            <option value="">Select…</option>
            {held.map(({ medicine }) => (
              <option key={medicine.id} value={medicine.id}>
                {medicine.short}
                {medicine.strength ? ` ${medicine.strength}` : ""} · {medicine.molecule}
              </option>
            ))}
          </select>
          {chosen ? (
            <span className="t-xs mt-1 block" data-depth="1">
              Shelf {chosen.medicine.stock?.shelf} · batch {chosen.medicine.stock?.batch} · balance now{" "}
              <span className="t-num" data-depth="3">
                {balance}
              </span>
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="t-label">
            Patient<span style={{ color: "var(--danger)" }}> *</span>
          </span>
          <select
            value={patientId}
            onChange={(event) => setPatientId(event.target.value)}
            className="field mt-1.5"
          >
            <option value="">Select…</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name} · {patient.mrn}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="t-label">
            Quantity<span style={{ color: "var(--danger)" }}> *</span>
          </span>
          <input
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            className="field mt-1.5"
            inputMode="numeric"
            autoComplete="off"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="t-label">Pharmacist signing</span>
          <select
            value={pharmacist}
            onChange={(event) => setPharmacist(event.target.value)}
            className="field mt-1.5"
          >
            {pharmacists.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 sm:col-span-2">
          <input
            type="checkbox"
            checked={verified}
            onChange={(event) => setVerified(event.target.checked)}
            className="sr-only peer"
          />
          <span className="check mt-0.5" aria-hidden />
          <span className="t-prose max-w-[60ch]" data-depth="2">
            I verified the prescriber and the patient&apos;s identity before supply.
          </span>
        </label>

        {error ? (
          <p className="band t-sm sm:col-span-2" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
