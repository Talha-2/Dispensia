"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Search as SearchIcon, Upload, X } from "lucide-react";
import { Empty, Identity, Markers, Meter, pkr } from "@/components/primitives";
import { Dialog, Toast } from "@/components/overlays";
import { COMMANDS, useCommand } from "@/lib/commands";
import { exportCsv, parseCsv, stamp } from "@/lib/csv";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Branch } from "@/data/organisation";
import type { FlagMeta, Medicine, StockState } from "@/lib/types";

export type StockRow = {
  id: string;
  branchId: string;
  medicine: Medicine;
  onHand: number;
  reorder: number;
  batch: string;
  expiry: string;
  shelf: string;
  cost: number;
  price: number;
  counted: string;
  state: StockState;
  daysToExpiry: number | null;
};

const PAGE = 14;

const GRID =
  "minmax(200px,2fr) minmax(140px,1.3fr) 108px 74px 92px minmax(96px,0.9fr) 80px 76px";

const HEADERS = ["Product", "Molecule", "On hand", "Reorder", "Batch", "Expiry", "Shelf", "Value"];

type Lens = "all" | "reorder" | "expiring" | "expired";

const LENSES: { id: Lens; label: string }[] = [
  { id: "all", label: "All lines" },
  { id: "reorder", label: "Need reorder" },
  { id: "expiring", label: "Expiring" },
  { id: "expired", label: "Expired" },
];

/**
 * The shelf, as this organisation's own record.
 *
 * Nothing here comes from the shared catalogue except what a product *is* —
 * quantities, batches, expiry dates, shelf locations and the prices this
 * pharmacy paid are all its own rows, which is why a new organisation opens
 * this screen empty rather than inheriting somebody's demo inventory.
 */
export function StockView({
  lines,
  branches,
  organisation,
}: {
  lines: StockRow[];
  branches: Branch[];
  organisation: string;
  flagMeta: FlagMeta[];
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [lens, setLens] = useState<Lens>("all");
  const [page, setPage] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const branchName = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch.name])),
    [branches],
  );

  const filtered = useMemo(() => {
    const lower = term.trim().toLowerCase();
    return lines.filter((line) => {
      if (lens === "reorder" && line.state !== "low" && line.state !== "critical") return false;
      if (lens === "expiring" && !(line.daysToExpiry !== null && line.daysToExpiry >= 0 && line.daysToExpiry <= 90))
        return false;
      if (lens === "expired" && !(line.daysToExpiry !== null && line.daysToExpiry < 0)) return false;
      if (!lower) return true;
      return [line.medicine.short, line.medicine.brand, line.medicine.molecule, line.batch, line.shelf]
        .join(" ")
        .toLowerCase()
        .includes(lower);
    });
  }, [lines, term, lens]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * PAGE, current * PAGE + PAGE);

  const doExport = useCallback(() => {
    const count = exportCsv(`dispensia-stock-${stamp()}`, filtered, [
      { header: "Catalogue ID", value: (l) => l.medicine.id },
      { header: "Product", value: (l) => l.medicine.short },
      { header: "Strength", value: (l) => l.medicine.strength ?? "" },
      { header: "Molecule", value: (l) => l.medicine.molecule },
      { header: "Quantity", value: (l) => l.onHand },
      { header: "Reorder", value: (l) => l.reorder },
      { header: "Batch", value: (l) => l.batch },
      { header: "Expiry", value: (l) => l.expiry },
      { header: "Shelf", value: (l) => l.shelf },
      { header: "Cost", value: (l) => l.cost.toFixed(2) },
      { header: "Price", value: (l) => l.price.toFixed(2) },
      { header: "Branch", value: (l) => branchName.get(l.branchId) ?? "" },
    ]);
    setToast(`Exported ${count} stock ${count === 1 ? "line" : "lines"}.`);
  }, [filtered, branchName]);

  useCommand(COMMANDS.export, doExport);
  useCommand(
    COMMANDS.import,
    useCallback(() => setImportOpen(true), []),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="field-shell min-w-[220px] flex-1">
          <SearchIcon size={15} strokeWidth={1.8} className="shrink-0" style={{ color: "var(--ink-3)" }} />
          <input
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setPage(0);
            }}
            placeholder="Filter this shelf by product, molecule, batch or location"
            className="t-data"
            aria-label="Search stock"
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

        <div className="seg shrink-0" role="group" aria-label="Stock lens">
          {LENSES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setLens(entry.id);
                setPage(0);
              }}
              aria-pressed={lens === entry.id}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <button type="button" className="act shrink-0" onClick={doExport} disabled={!lines.length}>
          <Download size={15} strokeWidth={1.8} />
          Export
        </button>

        <button type="button" className="act act-primary shrink-0" onClick={() => setImportOpen(true)}>
          <Upload size={15} strokeWidth={1.8} />
          Import stock
        </button>
      </div>

      {lines.length === 0 ? (
        <Empty
          title={`${organisation} holds no stock yet`}
          hint="Stock is your organisation's own record — quantities, batches, expiry dates and what you paid. Import a CSV to receive your first delivery; the catalogue stays available for looking products up in the meantime."
          action={
            <button type="button" className="act act-primary act-lg" onClick={() => setImportOpen(true)}>
              <Upload size={16} strokeWidth={1.8} />
              Import stock from CSV
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <Empty
          title="No line matches that"
          hint="This shelf is searched across product, molecule, batch code and shelf location."
          action={
            <button
              type="button"
              className="act act-primary"
              onClick={() => {
                setTerm("");
                setLens("all");
              }}
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="panel min-h-0 flex-1 overflow-auto">
          <div style={{ minWidth: 980 }}>
            <div
              className="baseline-strong sticky top-0 z-10 grid items-center gap-x-3 px-3 py-2"
              style={{ gridTemplateColumns: GRID, background: "var(--surface-sunk)" }}
            >
              {HEADERS.map((label) => (
                <span key={label} className="t-label">
                  {label}
                </span>
              ))}
            </div>

            {shown.map((line) => {
              const expiring =
                line.daysToExpiry !== null && line.daysToExpiry >= 0 && line.daysToExpiry <= 90;
              const expired = line.daysToExpiry !== null && line.daysToExpiry < 0;
              return (
                <div
                  key={line.id}
                  className="baseline row grid items-center gap-x-3 px-3 py-1.5"
                  style={{ gridTemplateColumns: GRID, minHeight: 36 }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1">
                      <Identity medicine={line.medicine} depth={3} showMaker={false} />
                    </span>
                    <Markers medicine={line.medicine} />
                  </span>

                  <span className="t-data truncate" data-depth="1">
                    {line.medicine.molecule}
                  </span>

                  <span className="flex items-center gap-2">
                    <Meter value={line.onHand} of={line.reorder || line.onHand} tone={line.state} />
                    <span
                      className="t-data t-num"
                      data-depth="3"
                      style={
                        line.state === "out" || line.state === "critical"
                          ? { color: "var(--danger)" }
                          : undefined
                      }
                    >
                      {line.onHand}
                    </span>
                  </span>

                  <span className="t-data t-num" data-depth="1">
                    {line.reorder || "—"}
                  </span>

                  <span className="t-data t-code truncate" data-depth="1">
                    {line.batch}
                  </span>

                  <span
                    className="t-data t-num truncate"
                    data-depth={expired || expiring ? "3" : "1"}
                    style={expired ? { color: "var(--danger)" } : expiring ? { color: "var(--warn)" } : undefined}
                  >
                    {line.expiry}
                    {line.daysToExpiry !== null ? (
                      <span className="ml-1" data-depth="1">
                        {expired ? `${Math.abs(line.daysToExpiry)}d past` : `${line.daysToExpiry}d`}
                      </span>
                    ) : null}
                  </span>

                  <span className="t-data truncate" data-depth="1">
                    {line.shelf}
                  </span>

                  <span className="t-data t-num text-right" data-depth="2">
                    {pkr(line.onHand * line.cost)}
                  </span>
                </div>
              );
            })}

            <div className="flex items-center gap-3 px-3 py-2">
              <span className="t-data flex-1" data-depth="1">
                <span className="t-num" data-depth="2">
                  {current * PAGE + 1}–{Math.min(filtered.length, (current + 1) * PAGE)}
                </span>{" "}
                of{" "}
                <span className="t-num" data-depth="2">
                  {filtered.length}
                </span>{" "}
                lines
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

      <ImportStockDialog
        open={importOpen}
        branches={branches}
        onClose={() => setImportOpen(false)}
        onDone={(message) => {
          setImportOpen(false);
          setToast(message);
          router.refresh();
        }}
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

/* ═══ Receiving a delivery ═════════════════════════════════════════════════ */

type Parsed = {
  catalogueId: string;
  label: string;
  quantity: number;
  reorder: number;
  batch: string;
  expiry: string;
  shelf: string;
  cost: number | null;
  price: number | null;
  problem?: string;
};

const HEAD_ALIASES: Record<string, string> = {
  "catalogue id": "id",
  "catalogue_id": "id",
  id: "id",
  product: "name",
  brand: "name",
  name: "name",
  quantity: "qty",
  qty: "qty",
  "on hand": "qty",
  received: "qty",
  reorder: "reorder",
  "reorder level": "reorder",
  batch: "batch",
  "batch number": "batch",
  lot: "batch",
  expiry: "expiry",
  "expiry date": "expiry",
  expires: "expiry",
  shelf: "shelf",
  location: "shelf",
  cost: "cost",
  price: "price",
  retail: "price",
};

function ImportStockDialog({
  open,
  branches,
  onClose,
  onDone,
}: {
  open: boolean;
  branches: Branch[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Parsed[] | null>(null);
  const [filename, setFilename] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const valid = rows?.filter((row) => !row.problem) ?? [];
  const rejected = rows?.filter((row) => row.problem) ?? [];

  async function read(file: File) {
    setError("");
    setFilename(file.name);

    const text = await file.text();
    const table = parseCsv(text).filter((row) => row.some((cell) => cell.trim()));
    if (table.length < 2) {
      setError("That file has a header but no rows.");
      setRows(null);
      return;
    }

    const head = table[0].map((cell) => HEAD_ALIASES[cell.trim().toLowerCase()] ?? "");
    if (!head.includes("id")) {
      setError("No catalogue ID column. Export this shelf first to see the shape the importer expects.");
      setRows(null);
      return;
    }

    const at = (row: string[], key: string) => {
      const index = head.indexOf(key);
      return index === -1 ? "" : (row[index] ?? "").trim();
    };

    const parsed: Parsed[] = table.slice(1).map((row) => {
      const id = at(row, "id");
      const quantity = Number(at(row, "qty"));
      const expiry = at(row, "expiry");

      // Validated here so a bad row is named before anything is written, rather
      // than a delivery half-landing and needing to be unpicked.
      let problem: string | undefined;
      if (!id) problem = "no catalogue ID";
      else if (!Number.isFinite(quantity) || quantity < 0) problem = "quantity is not a number";
      else if (expiry && Number.isNaN(Date.parse(expiry))) problem = "expiry is not a date";

      const cost = Number(at(row, "cost"));
      const price = Number(at(row, "price"));

      return {
        catalogueId: id,
        label: at(row, "name") || id,
        quantity: Number.isFinite(quantity) ? quantity : 0,
        reorder: Number(at(row, "reorder")) || 0,
        batch: at(row, "batch"),
        expiry,
        shelf: at(row, "shelf"),
        cost: Number.isFinite(cost) && at(row, "cost") ? cost : null,
        price: Number.isFinite(price) && at(row, "price") ? price : null,
        problem,
      };
    });

    setRows(parsed);
  }

  async function commit() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !valid.length) return;

    setBusy(true);
    setError("");

    let received = 0;
    let failed = 0;
    let lastMessage = "";

    for (const row of valid) {
      const { error: rpcError } = await supabase.rpc("receive_stock", {
        p_catalogue_id: row.catalogueId,
        p_quantity: row.quantity,
        p_batch: row.batch || null,
        p_expiry: row.expiry || null,
        p_shelf: row.shelf || null,
        p_reorder: row.reorder || null,
        p_cost: row.cost,
        p_price: row.price,
        p_branch: branchId || null,
      });

      if (rpcError) {
        failed += 1;
        lastMessage = rpcError.message;
      } else {
        received += 1;
      }
    }

    setBusy(false);

    if (!received) {
      setError(lastMessage || "Nothing was received.");
      return;
    }

    setRows(null);
    setFilename("");
    onDone(
      failed
        ? `Received ${received} lines; ${failed} failed. ${lastMessage}`
        : `Received ${received} stock ${received === 1 ? "line" : "lines"}.`,
    );
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        setRows(null);
        setError("");
        onClose();
      }}
      title="Import stock from CSV"
      description="Receiving is additive: the same batch arriving twice adds to the line you already hold."
      width={680}
      footer={
        <>
          <button type="button" className="act" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="act act-primary"
            onClick={commit}
            disabled={busy || !valid.length}
          >
            <Upload size={15} strokeWidth={1.8} />
            {busy ? "Receiving…" : `Receive ${valid.length} line${valid.length === 1 ? "" : "s"}`}
          </button>
        </>
      }
    >
      {!rows ? (
        <div>
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-(--radius) border border-dashed px-6 py-10 text-center transition-colors hover:bg-(--surface-hover)"
            style={{ borderColor: "var(--line-strong)" }}
          >
            <Upload size={22} strokeWidth={1.6} style={{ color: "var(--ink-3)" }} />
            <span className="t-data mt-3 font-semibold" style={{ color: "var(--ink)" }}>
              Choose a CSV file
            </span>
            <span className="t-sm mt-1" data-depth="1">
              {filename || "Or drop one here"}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) read(file);
              }}
            />
          </label>

          <div className="mt-4">
            <p className="t-label">Columns it reads</p>
            <p className="t-prose mt-1" data-depth="2">
              <strong>Catalogue ID</strong> and <strong>Quantity</strong> are required. Reorder, Batch,
              Expiry, Shelf, Cost and Price are optional. Export this shelf to get a file in exactly the
              right shape — the catalogue ID is what ties a line to the shared product record, so a row
              without one cannot be checked for interactions.
            </p>
          </div>

          {error ? (
            <p className="band t-sm mt-4" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2 pb-3">
            <span className="t-data" data-depth="2">
              {filename}
            </span>
            <span className="t-data" data-depth="1">
              <span className="t-num" data-depth="3">
                {valid.length}
              </span>{" "}
              ready
              {rejected.length ? (
                <>
                  {" · "}
                  <span className="t-num" style={{ color: "var(--danger)" }}>
                    {rejected.length}
                  </span>{" "}
                  rejected
                </>
              ) : null}
            </span>

            {branches.length > 1 ? (
              <label className="ml-auto flex items-center gap-2">
                <span className="t-label">Into</span>
                <select
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  className="field h-8 w-[150px]"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="panel-flat max-h-[40vh] overflow-auto">
            {rows.map((row, index) => (
              <div
                key={`${row.catalogueId}-${index}`}
                className="baseline flex items-baseline gap-3 px-3 py-1.5 last:border-b-0"
              >
                <span className="t-data min-w-0 flex-1 truncate" data-depth={row.problem ? "1" : "3"}>
                  {row.label}
                </span>
                <span className="t-data t-num w-14 text-right" data-depth="2">
                  {row.quantity}
                </span>
                <span className="t-data t-code w-24 truncate" data-depth="1">
                  {row.batch || "—"}
                </span>
                <span className="t-data t-num w-24 text-right" data-depth="1">
                  {row.expiry || "—"}
                </span>
                <span className="w-32 shrink-0 text-right">
                  {row.problem ? (
                    <span className="t-sm" style={{ color: "var(--danger)" }}>
                      {row.problem}
                    </span>
                  ) : (
                    <span className="cell cell-access-soft">ready</span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {error ? (
            <p className="band t-sm mt-3" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}
