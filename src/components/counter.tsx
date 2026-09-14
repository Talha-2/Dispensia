"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Printer, Search, Trash2, X } from "lucide-react";
import { Identity, Markers, SEVERITY_LABEL, SeverityMark, pkr } from "@/components/primitives";
import { Receipt, makeReference, type Sale } from "@/components/receipt";
import { Dialog, Toast } from "@/components/overlays";
import { COMMANDS, MOD_LABEL, useCommand } from "@/lib/commands";
import type { Finding, Medicine, Patient, ScanResult, Verdict } from "@/lib/types";

const PHARMACIST_PIN = "5566";

const VERDICT_COPY: Record<Verdict, { title: string; line: string }> = {
  unscanned: { title: "Nothing in the basket", line: "Add a product to start a dispense." },
  clear: { title: "Clear to dispense", line: "No interaction, stewardship or statutory obligation fired." },
  counsel: { title: "Counsel before handover", line: "Nothing blocks the sale, but the patient must be told the following." },
  conflict: { title: "Pharmacist review", line: "One or more obligations must be resolved or overridden before checkout." },
  blocked: { title: "Do not dispense", line: "A contraindication in this basket can kill. Resolve it, or record a pharmacist override." },
};

const VERDICT_TONE: Record<Verdict, string | undefined> = {
  unscanned: undefined,
  clear: "var(--ok)",
  counsel: undefined,
  conflict: "var(--warn)",
  blocked: "var(--danger)",
};

type Line = { medicine: Medicine; qty: number };

/** Shelf state for a product, mirrored from the catalogue's own derivation. */
function shelfState(medicine: Medicine) {
  if (!medicine.stock) return null;
  const { onHand, reorder } = medicine.stock;
  if (onHand === 0) return "out" as const;
  if (onHand <= reorder * 0.5) return "critical" as const;
  if (onHand <= reorder) return "low" as const;
  return "healthy" as const;
}

/**
 * The counter.
 *
 * Everything here is a plane on the void. The verdict is the front plane —
 * brightest, widest, heaviest — because the one thing that must never be missed
 * is whether this basket is safe to hand over. The basket rides baselines below
 * it, and an override costs a PIN and a written reason, every time.
 */
export type FeedEntry = {
  time: string;
  kind: "dispense" | "override" | "register" | "block" | "counsel";
  what: string;
  who: string;
  detail: string;
};

const FEED_TONE: Record<FeedEntry["kind"], string | undefined> = {
  dispense: undefined,
  counsel: undefined,
  register: "var(--warn)",
  override: "var(--warn)",
  block: "var(--danger)",
};

const FEED_MARK: Record<FeedEntry["kind"], string> = {
  dispense: "OK",
  counsel: "CO",
  register: "CD",
  override: "OV",
  block: "!!",
};

export function Counter({
  patients,
  starters = [],
  feed = [],
  initialLines = [],
  initialPatient = "",
}: {
  patients: Patient[];
  starters?: Medicine[];
  feed?: FeedEntry[];
  /** Seeded from the URL, so a basket under review can be linked and reopened. */
  initialLines?: Medicine[];
  initialPatient?: string;
}) {
  const [lines, setLines] = useState<Line[]>(() =>
    initialLines.map((medicine) => ({ medicine, qty: 1 })),
  );
  const [patientId, setPatientId] = useState<string>(initialPatient);
  const [cleared, setCleared] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [term, setTerm] = useState("");
  const [suggestions, setSuggestions] = useState<{ term: string; items: Medicine[] }>({
    term: "",
    items: [],
  });
  const [cursor, setCursor] = useState(0);
  const [sale, setSale] = useState<Sale | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [discountPct, setDiscountPct] = useState("");
  const [tendered, setTendered] = useState("");
  const addRef = useRef<HTMLInputElement>(null);

  const patient = patients.find((p) => p.id === patientId);

  const query = term.trim();
  const hits = query.length >= 2 ? suggestions.items : [];
  const active = Math.min(cursor, Math.max(0, hits.length - 1));

  // ── Type-ahead ────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(q)}&limit=6`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data: { items: Medicine[] }) => setSuggestions({ term: q, items: data.items }))
        .catch(() => undefined);
    }, 110);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term]);

  // ── Scan the whole basket on every change ────────────────────────────────
  // The result is keyed by the exact basket that produced it, so "scanning" is
  // derived from a stale key rather than written into state by the effect.
  const basketKey = useMemo(
    () =>
      JSON.stringify({
        lines: lines.map((line) => [line.medicine.id, line.qty]),
        patient: patient ? [patient.age, patient.sex] : null,
        cleared,
      }),
    [lines, patient, cleared],
  );

  const [scan, setScan] = useState<{ key: string; result: ScanResult } | null>(null);
  const result = lines.length && scan?.key === basketKey ? scan.result : null;
  const scanning = lines.length > 0 && scan?.key !== basketKey;

  useEffect(() => {
    if (!lines.length) return;
    const controller = new AbortController();
    fetch("/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lines: lines.map((line) => ({ id: line.medicine.id, qty: line.qty })),
        patient: patient ? { age: patient.age, sex: patient.sex } : {},
        cleared,
      }),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((data: ScanResult) => setScan({ key: basketKey, result: data }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [basketKey, lines, patient, cleared]);

  const add = useCallback((medicine: Medicine) => {
    setLines((current) => {
      const existing = current.find((line) => line.medicine.id === medicine.id);
      if (existing) {
        return current.map((line) =>
          line.medicine.id === medicine.id ? { ...line, qty: line.qty + 1 } : line,
        );
      }
      return [...current, { medicine, qty: 1 }];
    });
    setTerm("");
    setCursor(0);
    addRef.current?.focus();
  }, []);

  const remove = (id: string) => {
    setLines((current) => current.filter((line) => line.medicine.id !== id));
  };

  const setQty = (id: string, qty: number) => {
    setLines((current) =>
      current.map((line) => (line.medicine.id === id ? { ...line, qty: Math.max(1, qty) } : line)),
    );
  };

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.medicine.price * line.qty, 0),
    [lines],
  );
  const cost = useMemo(
    () => lines.reduce((sum, line) => sum + line.medicine.cost * line.qty, 0),
    [lines],
  );

  // A discount is capped at the margin: a counter should not be able to sell
  // below cost by fat-fingering a percentage.
  const maxDiscountPct = subtotal > 0 ? Math.max(0, ((subtotal - cost) / subtotal) * 100) : 0;
  const requestedPct = Math.min(Math.max(Number(discountPct) || 0, 0), 100);
  const appliedPct = Math.min(requestedPct, maxDiscountPct);
  const discount = (subtotal * appliedPct) / 100;
  const total = subtotal - discount;

  const paid = Number(tendered) || 0;
  const change = paid - total;
  const units = lines.reduce((sum, line) => sum + line.qty, 0);

  const verdict: Verdict = lines.length === 0 ? "unscanned" : (result?.verdict ?? "clear");
  const blocked = verdict === "blocked";
  const copy = VERDICT_COPY[verdict];
  const tone = VERDICT_TONE[verdict];

  /* ── Checkout ────────────────────────────────────────────────────────────
     Closing a basket writes the sale, produces the bill, and clears the bench
     so the next customer starts clean. A blocked basket cannot get here. */
  const checkout = useCallback(() => {
    if (!lines.length) return;
    if (blocked) {
      setToast("This basket is blocked. Resolve or override the finding before dispensing.");
      return;
    }
    // An entered cash float that does not cover the bill is a typo, not a sale.
    // An empty float means "exact" and is allowed through.
    if (paid > 0 && paid < total) {
      setToast(`Cash tendered is short by PKR ${(total - paid).toFixed(2)}.`);
      return;
    }
    const now = new Date();
    setSale({
      reference: makeReference(),
      at: now.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }),
      lines,
      patient,
      pharmacist: "A. Yousaf",
      subtotal,
      discount,
      total,
      cost,
      // A card or wallet sale tenders exactly the total; only cash has a float.
      tendered: paid,
      overrides: cleared.map((key) => ({ key, reason: overrides[key] ?? "" })),
      controlled: result?.controlled ?? [],
      counselling: (result?.counselling ?? []).map((entry) => ({
        brand: entry.brand,
        text: entry.text,
      })),
    });
    setLines([]);
    setCleared([]);
    setOverrides({});
    setDiscountPct("");
    setTendered("");
  }, [lines, patient, subtotal, discount, total, cost, paid, cleared, overrides, blocked, result]);

  useCommand(COMMANDS.checkout, checkout);
  useCommand(
    COMMANDS.print,
    useCallback(() => {
      if (sale) window.print();
      else setToast("Nothing to print yet — close a basket first.");
    }, [sale]),
  );
  useCommand(
    COMMANDS.clearBasket,
    useCallback(() => setLines([]), []),
  );

  function onAddKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!hits.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((active + 1) % hits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((active - 1 + hits.length) % hits.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      add(hits[active]);
    }
  }

  return (
    <div className="grid gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
      {/* ═══ The bench ═══════════════════════════════════════════════════
          Below lg the verdict leads: on a phone the basket and the counselling
          text are long enough to push "Do not dispense" off the first screen,
          which inverts the one thing this surface exists to say. */}
      <div className="order-2 min-w-0 lg:order-1">
        {/* Patient */}
        <div className="panel flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
          <label className="flex items-center gap-2">
            <span className="t-label">Patient</span>
            <select
              value={patientId}
              onChange={(event) => setPatientId(event.target.value)}
              className="field h-8 w-[240px]"
              style={{ color: patient ? "var(--ink)" : "var(--ink-3)" }}
            >
              <option value="">Walk-in (no record)</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.age}
                  {p.sex === "f" ? "F" : "M"} · {p.mrn}
                </option>
              ))}
            </select>
          </label>

          {patient ? (
            <>
              <span className="t-data" data-depth="1">
                {patient.prescriber}
              </span>
              {patient.allergies.length ? (
                <span className="t-data flex items-center gap-1" style={{ color: "var(--danger)" }}>
                  <span className="cell cell-block">A</span>
                  allergic to {patient.allergies.join(", ")}
                </span>
              ) : (
                <span className="t-data" data-depth="1">
                  no recorded allergies
                </span>
              )}
              {patient.conditions.length ? (
                <span className="t-data" data-depth="1">
                  {patient.conditions.join(" · ")}
                </span>
              ) : null}
            </>
          ) : (
            <span className="t-data" data-depth="1">
              Age and sex gates stay dark without a patient record — pick one to arm them.
            </span>
          )}
        </div>

        {/* ── Add a product ───────────────────────────────────────────────
            The busiest control on the counter, so it is the largest: a tall
            field, and results that carry everything needed to pick the right
            one of four near-identical brands — shelf, batch, price and class. */}
        <div className="relative mt-4">
          <div
            className="field-shell"
            style={{ height: 46, borderColor: term ? "var(--primary)" : undefined }}
          >
            <Search size={18} strokeWidth={1.9} className="shrink-0" style={{ color: "var(--primary)" }} />
            <input
              ref={addRef}
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={onAddKeyDown}
              placeholder="Add a product — type a brand, molecule or manufacturer"
              className="text-[15px]"
              spellCheck={false}
              data-add-field=""
              aria-label="Add a product to the basket"
              autoComplete="off"
            />
            {term ? (
              <button
                type="button"
                onClick={() => setTerm("")}
                className="shrink-0"
                style={{ color: "var(--ink-3)" }}
                aria-label="Clear"
              >
                <X size={15} strokeWidth={1.9} />
              </button>
            ) : (
              <span className="kbd shrink-0">A</span>
            )}
          </div>

          {term.trim().length >= 2 ? (
            <ul
              role="listbox"
              aria-label="Matching products"
              className="panel absolute left-0 right-0 top-[52px] z-30 max-h-[320px] overflow-y-auto py-1"
              style={{ boxShadow: "var(--shadow-lg)" }}
            >
              {hits.length === 0 ? (
                <li className="px-4 py-5 text-center">
                  <p className="t-sm" data-depth="2">
                    No product matches “{term.trim()}”.
                  </p>
                  <p className="t-xs mt-1" data-depth="1">
                    Search runs across all 10,434 brands, 2,017 molecules and 841 manufacturers.
                  </p>
                </li>
              ) : (
                hits.map((medicine, index) => {
                  const state = shelfState(medicine);
                  return (
                    <li
                      key={medicine.id}
                      role="option"
                      aria-selected={index === active}
                      onMouseEnter={() => setCursor(index)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        add(medicine);
                      }}
                      className="row flex cursor-pointer items-center gap-3 px-3 py-2"
                      data-live={index === active}
                    >
                      <span className="min-w-0 flex-1">
                        <Identity medicine={medicine} depth={index === active ? 3 : 2} />
                      </span>
                      <Markers medicine={medicine} />
                      <span className="w-[104px] shrink-0 text-right">
                        {medicine.stock && state ? (
                          <>
                            <span className="t-sm t-num block" data-depth={state === "out" ? "1" : "3"}>
                              {medicine.stock.onHand} on hand
                            </span>
                            <span className="t-xs block truncate" data-depth="1">
                              {medicine.stock.shelf} · {medicine.stock.batch}
                            </span>
                          </>
                        ) : (
                          <span className="t-xs" data-depth="1">
                            not stocked
                          </span>
                        )}
                      </span>
                      <span className="t-data t-num w-16 shrink-0 text-right font-semibold" style={{ color: "var(--ink)" }}>
                        {pkr(medicine.price, true)}
                      </span>
                      {index === active ? <span className="kbd shrink-0">⏎</span> : null}
                    </li>
                  );
                })
              )}
            </ul>
          ) : null}
        </div>

        {/* Basket */}
        <div className="panel mt-4 overflow-hidden">
          <div
            className="baseline-strong flex items-center gap-3 px-4 py-2.5"
            style={{ background: "var(--surface-sunk)" }}
          >
            <span className="t-label flex-1">Basket</span>
            <span className="t-sm t-num" data-depth={lines.length ? "3" : "1"}>
              {lines.length} {lines.length === 1 ? "line" : "lines"}
            </span>
            {lines.length ? (
              <button type="button" className="act act-sm" onClick={() => setLines([])}>
                <Trash2 size={14} strokeWidth={1.8} />
                Clear
              </button>
            ) : null}
          </div>

          {lines.length === 0 ? (
            <div className="px-4 pb-4">
              <p className="t-prose max-w-[68ch] py-3" data-depth="2">
                An empty basket scans clean. Add the first product above — the engine runs the whole basket
                against {"34"} interaction rules, the WHO AWaRe classes and the controlled-drug register on
                every change.
              </p>

              {starters.length ? (
                <div className="mt-2">
                  <div className="baseline flex items-center gap-2 pb-1">
                    <span className="t-label flex-1">Deepest stock on the shelf</span>
                    <span className="t-data" data-depth="0">
                      one click adds a line
                    </span>
                  </div>
                  <div className="grid gap-x-6 sm:grid-cols-2">
                    {starters.map((medicine) => (
                      <button
                        key={medicine.id}
                        type="button"
                        onClick={() => add(medicine)}
                        className="baseline row -mx-2 flex items-center gap-2 rounded-sm px-2 py-1.5 text-left"
                      >
                        <span aria-hidden="true" className="w-2 shrink-0 text-(--primary)">
                          +
                        </span>
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
                            {medicine.molecule} · {medicine.form}
                          </span>
                        </span>
                        <Markers medicine={medicine} />
                        <span className="t-data t-num w-10 shrink-0 text-right" data-depth="1">
                          {medicine.stock?.onHand}
                        </span>
                        <span className="t-data t-num w-16 shrink-0 text-right" data-depth="2">
                          {pkr(medicine.price, true)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            lines.map((line) => {
              const implicated = result?.findings.some((f) => f.implicates.includes(line.medicine.id));
              const worst = result?.findings.find((f) => f.implicates.includes(line.medicine.id));
              const flag =
                worst?.severity === "block" ? "block" : worst?.severity === "conflict" ? "conflict" : undefined;
              return (
                <div
                  key={line.medicine.id}
                  className="baseline row flex items-start gap-3 px-4 py-2.5"
                  data-flag={flag}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="t-data" data-depth={implicated ? "4" : "3"}>
                        {line.medicine.short}
                      </span>
                      {line.medicine.strength ? (
                        <span className="t-data t-num" data-depth="2">
                          {line.medicine.strength}
                        </span>
                      ) : null}
                      <Markers medicine={line.medicine} />
                    </span>
                    <span className="t-data mt-0.5 block truncate" data-depth="1">
                      {line.medicine.molecule} · {line.medicine.form} · {line.medicine.maker}
                    </span>
                  </span>

                  <span
                    className="flex shrink-0 items-center overflow-hidden rounded-sm border"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <button
                      type="button"
                      className="h-7 w-7 text-[15px] leading-none transition-colors hover:bg-(--surface-sunk)"
                      onClick={() => setQty(line.medicine.id, line.qty - 1)}
                      aria-label={`Reduce quantity of ${line.medicine.short}`}
                    >
                      −
                    </button>
                    <span
                      className="t-data t-num w-8 border-x py-1 text-center font-semibold"
                      style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                    >
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      className="h-7 w-7 text-[15px] leading-none transition-colors hover:bg-(--surface-sunk)"
                      onClick={() => setQty(line.medicine.id, line.qty + 1)}
                      aria-label={`Increase quantity of ${line.medicine.short}`}
                    >
                      +
                    </button>
                  </span>

                  <span className="t-data t-num w-20 shrink-0 text-right" data-depth="3">
                    {pkr(line.medicine.price * line.qty, true)}
                  </span>

                  <button
                    type="button"
                    className="act act-quiet act-sm act-icon shrink-0"
                    onClick={() => remove(line.medicine.id)}
                    aria-label={`Remove ${line.medicine.short} from the basket`}
                  >
                    <X size={14} strokeWidth={1.9} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Counselling */}
        {result?.counselling.length ? (
          <div className="panel mt-4 overflow-hidden">
            <div
              className="baseline-strong flex items-center gap-3 px-4 py-2.5"
              style={{ background: "var(--surface-sunk)" }}
            >
              <span className="t-label flex-1">Counsel the patient</span>
              <span className="t-sm t-num" data-depth="2">
                {result.counselling.length}
              </span>
            </div>
            {result.counselling.map((entry) => (
              <div key={entry.id} className="baseline px-4 py-3">
                <p className="t-sm" data-depth="1">
                  {entry.brand}
                </p>
                <p className="t-prose mt-1 max-w-[70ch]" data-depth="2">
                  {entry.text}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* ═══ The verdict ═════════════════════════════════════════════════
          Nothing on this screen outranks it, at any width. */}
      <div className="order-1 min-w-0 lg:order-2">
        <div className="sticky top-[72px]">
          <div
            className="band"
            data-sev={
              verdict === "blocked"
                ? "block"
                : verdict === "conflict"
                  ? "conflict"
                  : verdict === "clear"
                    ? "ok"
                    : "counsel"
            }
            style={{ padding: "14px 16px" }}
          >
            <div className="flex items-baseline gap-2">
              <span className="t-label">Verdict</span>
              {scanning ? (
                <span className="t-sm blink" data-depth="1">
                  Scanning…
                </span>
              ) : null}
              <span className="t-sm t-num ml-auto" data-depth="1">
                {lines.length} {lines.length === 1 ? "line" : "lines"} ·{" "}
                {result?.findings.length ?? 0} findings
              </span>
            </div>

            <p className="t-display-lg mt-1" style={{ color: tone ?? "var(--ink)" }}>
              {copy.title}
            </p>
            <p className="t-prose mt-1.5 max-w-[54ch]" data-depth="2">
              {copy.line}
            </p>
          </div>

          {/* Findings, ranked worst first. */}
          <div className="mt-2 max-h-[52vh] space-y-2 overflow-y-auto">
            {result?.findings.map((finding) => (
              <FindingBand
                key={finding.key}
                finding={finding}
                lines={lines}
                overrideReason={overrides[finding.key]}
                onOverride={(reason) => {
                  setCleared((current) => [...current, finding.key]);
                  setOverrides((current) => ({ ...current, [finding.key]: reason }));
                }}
              />
            ))}

            {cleared.length ? (
              <div className="panel mt-3 overflow-hidden">
                <p
                  className="t-label baseline px-3 py-2"
                  style={{ background: "var(--surface-sunk)" }}
                >
                  Overridden this basket
                </p>
                {cleared.map((key) => (
                  <div key={key} className="baseline flex items-start gap-2 px-3 py-2">
                    <span className="cell cell-signal shrink-0">OV</span>
                    <span className="min-w-0 flex-1">
                      <span className="t-sm block" data-depth="2">
                        {key}
                      </span>
                      <span className="t-sm mt-0.5 block" data-depth="1">
                        {overrides[key]}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="act act-quiet act-sm shrink-0"
                      onClick={() => setCleared((current) => current.filter((k) => k !== key))}
                    >
                      Undo
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* ── The till ──────────────────────────────────────────────────
              Taking the money is the last thing that happens at a counter, so
              it sits at the bottom of the verdict column: discount, cash
              tendered and change, then the one button that closes it. */}
          <div className="panel mt-3 overflow-hidden">
            <div className="px-4 pt-3">
              <div className="flex items-baseline justify-between">
                <span className="t-sm" data-depth="1">
                  Subtotal
                </span>
                <span className="t-sm t-num" data-depth="2">
                  PKR {pkr(subtotal, true)}
                </span>
              </div>

              {discount > 0 ? (
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="t-sm" data-depth="1">
                    Discount {appliedPct.toFixed(1)}%
                  </span>
                  <span className="t-sm t-num" style={{ color: "var(--ok)" }}>
                    − PKR {pkr(discount, true)}
                  </span>
                </div>
              ) : null}

              <div className="mt-2 flex items-baseline justify-between border-t border-(--line) pt-2">
                <span className="t-data font-semibold" style={{ color: "var(--ink)" }}>
                  Total payable
                </span>
                <span className="t-stat">PKR {pkr(total, true)}</span>
              </div>

              <p className="t-xs mt-0.5" data-depth="1">
                {lines.length} {lines.length === 1 ? "line" : "lines"} · {units}{" "}
                {units === 1 ? "unit" : "units"} · margin PKR {pkr(total - cost, true)}
                {total > 0 ? ` · ${(((total - cost) / total) * 100).toFixed(1)}%` : ""}
              </p>
            </div>

            {lines.length ? (
              <div className="mt-3 border-t border-(--line) px-4 py-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="t-xs" data-depth="1">
                      Discount %
                    </span>
                    <input
                      value={discountPct}
                      onChange={(event) => setDiscountPct(event.target.value)}
                      className="field t-num mt-1 h-9"
                      inputMode="decimal"
                      placeholder="0"
                      aria-label="Discount percent"
                    />
                  </label>

                  <label className="block">
                    <span className="t-xs" data-depth="1">
                      Cash tendered
                    </span>
                    <input
                      value={tendered}
                      onChange={(event) => setTendered(event.target.value)}
                      className="field t-num mt-1 h-9"
                      inputMode="decimal"
                      placeholder={total.toFixed(2)}
                      aria-label="Cash tendered"
                    />
                  </label>
                </div>

                {requestedPct > maxDiscountPct && subtotal > 0 ? (
                  <p className="t-xs mt-1.5" style={{ color: "var(--warn)" }}>
                    Capped at {maxDiscountPct.toFixed(1)}% — a deeper discount would sell below cost.
                  </p>
                ) : null}

                {paid > 0 ? (
                  <div
                    className="mt-2.5 flex items-baseline justify-between rounded-lg px-3 py-2"
                    style={{
                      background: change >= 0 ? "var(--ok-soft)" : "var(--danger-soft)",
                      border: `1px solid ${change >= 0 ? "var(--ok-line)" : "var(--danger-line)"}`,
                    }}
                  >
                    <span className="t-sm font-medium" style={{ color: change >= 0 ? "var(--ok)" : "var(--danger)" }}>
                      {change >= 0 ? "Change due" : "Still owing"}
                    </span>
                    <span
                      className="t-num text-[17px] font-bold"
                      style={{ color: change >= 0 ? "var(--ok)" : "var(--danger)" }}
                    >
                      PKR {pkr(Math.abs(change), true)}
                    </span>
                  </div>
                ) : null}

                {/* Quick tender: the notes a Pakistani counter actually holds. */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="act act-sm"
                    onClick={() => setTendered(total.toFixed(2))}
                  >
                    Exact
                  </button>
                  {[500, 1000, 5000].map((note) => (
                    <button
                      key={note}
                      type="button"
                      className="act act-sm t-num"
                      onClick={() => setTendered(String(note))}
                    >
                      {note.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="border-t border-(--line) p-4">
              <button
                type="button"
                className={`act act-lg w-full ${blocked ? "act-danger" : "act-primary"}`}
                disabled={!lines.length || blocked}
                onClick={checkout}
              >
                {blocked ? "Blocked — override to continue" : "Dispense and record"}
                {!blocked && lines.length ? <span className="kbd ml-1">{MOD_LABEL} ⏎</span> : null}
              </button>

              {!lines.length ? (
                <p className="t-sm mt-2 text-center" data-depth="1">
                  Nothing to dispense yet.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ The worked queue ════════════════════════════════════════════
          What this counter has already done today, newest at the front. */}
      {feed.length ? (
        <section className="panel order-3 min-w-0 overflow-hidden lg:col-span-2">
          <div
            className="baseline-strong flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
            style={{ background: "var(--surface-sunk)" }}
          >
            <h2 className="t-label flex-1">Today at this counter</h2>
            <span className="t-sm t-num" data-depth="2">
              {feed.length} events
            </span>
            <span className="t-sm" data-depth="0">
              synthetic activity over real products
            </span>
          </div>

          <div className="grid xl:grid-cols-2">
            {feed.map((entry, index) => (
              <div key={`${entry.time}-${index}`} className="baseline row flex items-start gap-3 px-4 py-2.5">
                <span className="t-data t-num w-11 shrink-0" data-depth="1">
                  {entry.time}
                </span>
                <span
                  className={`cell shrink-0 ${entry.kind === "block" ? "cell-block" : entry.kind === "override" ? "cell-signal" : "cell-quiet"}`}
                >
                  {FEED_MARK[entry.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="t-data block truncate"
                    data-depth={entry.kind === "block" || entry.kind === "override" ? "3" : "2"}
                    style={{ color: FEED_TONE[entry.kind] }}
                  >
                    {entry.what}
                  </span>
                  <span className="t-data block truncate" data-depth="1">
                    {entry.detail}
                  </span>
                </span>
                <span className="t-data w-20 shrink-0 truncate text-right" data-depth="1">
                  {entry.who}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ═══ The bill ════════════════════════════════════════════════════ */}
      <Dialog
        open={Boolean(sale)}
        onClose={() => setSale(null)}
        title="Dispense recorded"
        description={sale ? `${sale.reference} · the basket is closed and the bench is clear.` : undefined}
        width={460}
        printable
        footer={
          <>
            <button type="button" className="act" onClick={() => setSale(null)}>
              Done
            </button>
            <button type="button" className="act act-primary" onClick={() => window.print()}>
              <Printer size={15} strokeWidth={1.8} />
              Print receipt
              <span className="kbd ml-1">{MOD_LABEL} P</span>
            </button>
          </>
        }
      >
        {sale ? <Receipt sale={sale} /> : null}
      </Dialog>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

/**
 * A finding is a band, not a card. Its rank sets its weight, and clearing it
 * costs a PIN and a written reason — never a single dismissive click.
 */
function FindingBand({
  finding,
  lines,
  overrideReason,
  onOverride,
}: {
  finding: Finding;
  lines: Line[];
  overrideReason?: string;
  onOverride: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const implicated = lines
    .filter((line) => finding.implicates.includes(line.medicine.id))
    .map((line) => line.medicine);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pin !== PHARMACIST_PIN) {
      setError("That PIN does not match a registered pharmacist. The override was not recorded.");
      return;
    }
    if (reason.trim().length < 8) {
      setError("Write the clinical reason — at least a few words. It is written to the audit log.");
      return;
    }
    onOverride(reason.trim());
    setOpen(false);
  }

  return (
    <div className="band" data-sev={finding.severity}>
      <div className="flex items-start gap-2">
        <SeverityMark severity={finding.severity} />
        <div className="min-w-0 flex-1">
          <p
            className="t-data"
            data-depth={finding.severity === "block" ? "4" : finding.severity === "conflict" ? "3" : "2"}
            style={{ color: finding.severity === "block" ? "var(--danger)" : undefined }}
          >
            {finding.title}
          </p>
          <p className="t-prose mt-1 max-w-[54ch]" data-depth="2">
            {finding.detail}
          </p>

          {implicated.length ? (
            <p className="t-data mt-1" data-depth="1">
              {implicated.map((m) => m.short).join(" + ")}
            </p>
          ) : null}

          <div className="mt-1 flex items-center gap-2">
            <span className="t-data" data-depth="0">
              {SEVERITY_LABEL[finding.severity]}
              {finding.demographic ? " · depends on patient age or sex" : ""}
            </span>
            {!overrideReason ? (
              <button type="button" className="act ml-auto" onClick={() => setOpen((v) => !v)}>
                {open ? "cancel" : "override"}
              </button>
            ) : null}
          </div>

          {open ? (
            <form onSubmit={submit} className="mt-2">
              <label className="block">
                <span className="t-label">Pharmacist PIN</span>
                <input
                  type="password"
                  value={pin}
                  onChange={(event) => {
                    setPin(event.target.value);
                    setError("");
                  }}
                  className="field t-data t-num"
                  autoComplete="off"
                  inputMode="numeric"
                />
              </label>
              <label className="mt-2 block">
                <span className="t-label">Clinical reason</span>
                <input
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setError("");
                  }}
                  placeholder="Prescriber contacted, dose adjusted, INR monitored…"
                  className="field t-data"
                />
              </label>
              {error ? (
                <p className="t-data mt-1" style={{ color: "var(--danger)" }} role="alert">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="act act-danger mt-2">
                Record override
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
