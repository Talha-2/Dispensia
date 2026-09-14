import type { ReactNode } from "react";
import type { AwareClass, Medicine, Severity, StockState, Verdict } from "@/lib/types";

/* ═══ Numbers ══════════════════════════════════════════════════════════════ */

export const pkr = (value: number, precise = false) =>
  new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: precise ? 2 : 0,
    maximumFractionDigits: precise ? 2 : 0,
  }).format(value);

export const compact = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1)}M`
    : value >= 1000
      ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`
      : String(value);

/* ═══ Section head ═════════════════════════════════════════════════════════
   A heading is a label on a baseline that runs to the edge. Never a card top. */

export function Head({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="baseline-strong flex min-h-7 flex-wrap items-center gap-x-4 gap-y-1 pb-1">
      <span className="t-label" style={{ color: "var(--ink)" }}>
        {title}
      </span>
      {meta ? <span className="t-data flex flex-wrap items-center gap-x-3 gap-y-1" data-depth="1">{meta}</span> : null}
      {actions ? <span className="ml-auto flex items-center gap-1">{actions}</span> : null}
    </div>
  );
}

/* ═══ Reversed cells ═══════════════════════════════════════════════════════ */

const AWARE_TITLE: Record<AwareClass, string> = {
  ACCESS: "WHO AWaRe ACCESS — first-line, low resistance potential",
  WATCH: "WHO AWaRe WATCH — higher resistance potential, confirm the indication",
  RESERVE: "WHO AWaRe RESERVE — last resort, specialist indication only",
  NA: "Not an antibiotic — outside the AWaRe classification",
};

export function Aware({ value, full = false }: { value: AwareClass; full?: boolean }) {
  // 87% of the catalogue is outside the AWaRe classification. A marker on every
  // one of those rows would be ink spent saying nothing; absence is the signal.
  if (value === "NA") return null;
  const tone = value === "ACCESS" ? "cell-access" : value === "WATCH" ? "cell-watch" : "cell-reserve";
  return (
    <span className={`cell ${tone}`} title={AWARE_TITLE[value]}>
      {full ? value : value[0]}
      <span className="sr-only"> AWaRe {value}</span>
    </span>
  );
}

/**
 * Controlled drug. A statutory obligation, so it ships solid and labelled: the
 * letters carry the meaning when colour is unavailable, and the hue is the
 * non-clinical violet so it cannot be confused with a severity signal.
 */
export function Controlled() {
  return (
    <span className="cell cell-info" title="Controlled drug — narcotics register entry required">
      CD
    </span>
  );
}

export function QtCell({ risk }: { risk: "high" | "moderate" }) {
  return (
    <span
      className={`cell ${risk === "high" ? "cell-block" : "cell-quiet"}`}
      title={`QT prolongation risk: ${risk}`}
    >
      QT
      <span className="sr-only"> risk {risk}</span>
    </span>
  );
}

/** Every marker a product carries, in one fixed order so the eye learns it. */
export function Markers({ medicine, aware = true }: { medicine: Medicine; aware?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      {aware ? <Aware value={medicine.aware} /> : null}
      {medicine.flags.includes("controlled") ? <Controlled /> : null}
      {medicine.qt ? <QtCell risk={medicine.qt} /> : null}
      {medicine.flags.includes("teratogen") ? (
        <span className="cell cell-quiet" title="Known teratogen — pregnancy check required">
          TER
        </span>
      ) : null}
    </span>
  );
}

/* ═══ Identity ═════════════════════════════════════════════════════════════
   Brand names collide constantly across 10,434 products, so a product is never
   named by its brand alone. One invariant block renders it everywhere. */

export function Identity({
  medicine,
  depth = 3,
  showMaker = true,
}: {
  medicine: Medicine;
  depth?: 1 | 2 | 3 | 4;
  showMaker?: boolean;
}) {
  return (
    <span className="block">
      <span className="t-data block truncate" data-depth={depth}>
        {medicine.short}
        {medicine.strength ? (
          <span className="t-num" data-depth={Math.max(1, depth - 1)}>
            {" "}
            {medicine.strength}
          </span>
        ) : null}
      </span>
      <span className="t-data block truncate" data-depth="1">
        {medicine.molecule}
        {showMaker ? (
          <>
            {" · "}
            {medicine.form}
            {" · "}
            {medicine.maker}
          </>
        ) : (
          <> · {medicine.form}</>
        )}
      </span>
    </span>
  );
}

/* ═══ Meter ════════════════════════════════════════════════════════════════
   Quantity read as a run of cells, the way a blister is counted by eye. */

export function Meter({ value, of, tone }: { value: number; of: number; tone: StockState }) {
  const cells = 7;
  const filled = of <= 0 ? 0 : Math.max(value > 0 ? 1 : 0, Math.min(cells, Math.round((value / of) * cells)));
  return (
    <span className="meter" data-tone={tone} role="img" aria-label={`${value} of ${of} reorder level`}>
      {Array.from({ length: cells }, (_, i) => (
        <i key={i} data-on={i < filled} />
      ))}
    </span>
  );
}

export const STOCK_LABEL: Record<StockState, string> = {
  out: "Out of stock",
  critical: "Critical",
  low: "Low",
  healthy: "Healthy",
};

/* ═══ Verdict ══════════════════════════════════════════════════════════════
   Five named, addressable states. The verdict is never a mood — it is a word,
   a depth and a pattern, and it is the loudest thing on the surface. */

export const VERDICT_DEPTH: Record<Verdict, "0" | "1" | "2" | "3" | "4"> = {
  unscanned: "1",
  clear: "2",
  counsel: "3",
  conflict: "4",
  blocked: "4",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  block: "Do not dispense",
  conflict: "Pharmacist review",
  counsel: "Counsel",
  note: "Note",
};

export function SeverityMark({ severity }: { severity: Severity }) {
  if (severity === "block") {
    return <span className="cell cell-block">!</span>;
  }
  if (severity === "conflict") {
    return <span className="cell cell-signal">!</span>;
  }
  return <span className="cell cell-quiet">i</span>;
}

/* ═══ Empty ════════════════════════════════════════════════════════════════ */

export function Empty({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="py-12">
      <p className="t-display" style={{ fontSize: 20 }}>
        {title}
      </p>
      <p className="t-prose mt-2 max-w-[62ch]" data-depth="1">
        {hint}
      </p>
      {action ? <div className="mt-4 flex gap-2">{action}</div> : null}
    </div>
  );
}
