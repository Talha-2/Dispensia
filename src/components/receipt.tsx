"use client";

import { Mark } from "@/components/mark";
import { pkr } from "@/components/primitives";
import { currentBranch, organisation } from "@/data/organisation";
import type { Medicine, Patient } from "@/lib/types";

export type Sale = {
  reference: string;
  at: string;
  lines: { medicine: Medicine; qty: number }[];
  patient?: Patient;
  pharmacist: string;
  subtotal: number;
  discount: number;
  total: number;
  cost: number;
  tendered: number;
  overrides: { key: string; reason: string }[];
  controlled: Medicine[];
  counselling: { brand: string; text: string }[];
};

export function makeReference() {
  const now = new Date();
  const day = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const seq = String(Math.floor(now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds())).padStart(5, "0");
  return `RX-${day}-${seq}`;
}

/**
 * The bill. Set for an 80mm roll under print, and readable on screen before it
 * goes anywhere. Everything on it is a fact from the basket that produced it —
 * including the overrides, which belong on the customer's copy as much as in
 * the audit log.
 */
export function Receipt({ sale }: { sale: Sale }) {
  const vatable = sale.total;

  return (
    <div className="mx-auto max-w-[360px]" style={{ fontVariantNumeric: "tabular-nums" }}>
      {/* The bill is issued by the organisation, not by the software — the
          trading name, the licence and the tax number all belong on it. */}
      <div className="pb-3 text-center">
        <div className="flex items-center justify-center gap-2.5">
          <Mark size={26} />
          <p className="t-title leading-tight">{organisation.name}</p>
        </div>
        <p className="t-xs mt-1.5" data-depth="2">
          {currentBranch.name} · {currentBranch.address}
        </p>
        <p className="t-xs" data-depth="1">
          {currentBranch.phone} · {organisation.email}
        </p>
        <p className="t-xs t-code mt-1" data-depth="1">
          {organisation.ntn} · {currentBranch.licence}
        </p>
      </div>

      <div className="border-y border-dashed border-(--line-strong) py-2">
        <Row label="Reference" value={sale.reference} mono />
        <Row label="Date" value={sale.at} />
        <Row label="Pharmacist" value={sale.pharmacist} />
        <Row label="Patient" value={sale.patient ? `${sale.patient.name} · ${sale.patient.mrn}` : "Walk-in"} />
        {sale.patient ? <Row label="Prescriber" value={sale.patient.prescriber} /> : null}
      </div>

      <table className="mt-3 w-full text-[12.5px]">
        <thead>
          <tr className="border-b border-(--line)">
            <th className="pb-1 text-left font-semibold" style={{ color: "var(--ink-3)" }}>
              Item
            </th>
            <th className="pb-1 text-right font-semibold" style={{ color: "var(--ink-3)" }}>
              Qty
            </th>
            <th className="pb-1 text-right font-semibold" style={{ color: "var(--ink-3)" }}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {sale.lines.map((line) => (
            <tr key={line.medicine.id} className="border-b border-dashed border-(--line-soft)">
              <td className="py-1.5 pr-2 align-top">
                <span className="block font-medium" style={{ color: "var(--ink)" }}>
                  {line.medicine.short}
                  {line.medicine.strength ? ` ${line.medicine.strength}` : ""}
                </span>
                <span className="block text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                  {line.medicine.molecule} · {line.medicine.form}
                  {line.medicine.stock ? ` · batch ${line.medicine.stock.batch}` : ""}
                </span>
              </td>
              <td className="py-1.5 text-right align-top">{line.qty}</td>
              <td className="py-1.5 text-right align-top" style={{ color: "var(--ink)" }}>
                {pkr(line.medicine.price * line.qty, true)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 border-t border-(--line-strong) pt-2">
        {sale.discount > 0 ? (
          <>
            <Row label="Subtotal" value={`PKR ${pkr(sale.subtotal, true)}`} />
            <Row label="Discount" value={`− PKR ${pkr(sale.discount, true)}`} />
          </>
        ) : null}

        <div className="flex items-baseline justify-between pt-1">
          <span className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
            Total payable
          </span>
          <span className="t-display" style={{ fontWeight: 700 }}>
            PKR {pkr(vatable, true)}
          </span>
        </div>

        <div className="mt-1.5 border-t border-dashed border-(--line-strong) pt-1.5">
          <Row label="Paid by" value="Cash" />
          {sale.tendered > 0 ? (
            <>
              <Row label="Tendered" value={`PKR ${pkr(sale.tendered, true)}`} />
              <Row label="Change" value={`PKR ${pkr(Math.max(0, sale.tendered - sale.total), true)}`} />
            </>
          ) : null}
        </div>

        <p className="t-xs mt-1.5" data-depth="1">
          {sale.lines.length} {sale.lines.length === 1 ? "line" : "lines"} ·{" "}
          {sale.lines.reduce((sum, line) => sum + line.qty, 0)} units · {organisation.taxNote}
        </p>
      </div>

      {sale.controlled.length ? (
        <div className="mt-3 border-t border-dashed border-(--line-strong) pt-2">
          <p className="t-xs font-semibold" style={{ color: "var(--ink)" }}>
            Controlled drug — register entry written
          </p>
          {sale.controlled.map((medicine) => (
            <p key={medicine.id} className="t-xs" data-depth="1">
              {medicine.short} · {medicine.molecule}
            </p>
          ))}
        </div>
      ) : null}

      {sale.overrides.length ? (
        <div className="mt-3 border-t border-dashed border-(--line-strong) pt-2">
          <p className="t-xs font-semibold" style={{ color: "var(--ink)" }}>
            Pharmacist overrides recorded
          </p>
          {sale.overrides.map((override) => (
            <p key={override.key} className="t-xs" data-depth="1">
              {override.key} — {override.reason}
            </p>
          ))}
        </div>
      ) : null}

      {sale.counselling.length ? (
        <div className="mt-3 border-t border-dashed border-(--line-strong) pt-2">
          <p className="t-xs font-semibold" style={{ color: "var(--ink)" }}>
            How to take these
          </p>
          {sale.counselling.map((entry) => (
            <p key={entry.brand} className="t-xs mt-1" data-depth="2">
              <span style={{ color: "var(--ink)" }}>{entry.brand}</span> — {entry.text}
            </p>
          ))}
        </div>
      ) : null}

      <p className="t-xs mt-4 border-t border-dashed border-(--line-strong) pt-2 text-center" data-depth="1">
        Keep this receipt. Medicines are not returnable once they leave the counter.
        <br />
        Questions about your medicine? Ask the pharmacist before you take the first dose.
      </p>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="t-xs" data-depth="1">
        {label}
      </span>
      <span
        className={`t-xs text-right ${mono ? "t-code" : ""}`}
        style={{ color: "var(--ink)", fontWeight: 550 }}
      >
        {value}
      </span>
    </div>
  );
}
