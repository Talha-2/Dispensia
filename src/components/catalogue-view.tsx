"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  MoreHorizontal,
  PackagePlus,
  Search as SearchIcon,
  Upload,
  X,
} from "lucide-react";
import { EMPTY_FILTERS, type FacetSet, type Filters } from "@/components/filter-rail";
import { FilterChips, FilterPopover } from "@/components/filter-popover";
import { ProductPanel } from "@/components/product-panel";
import { Empty, Identity, Markers, pkr } from "@/components/primitives";
import { Dialog, Menu, Toast } from "@/components/overlays";
import { COMMANDS, useCommand } from "@/lib/commands";
import { exportCsv, parseCsv, stamp } from "@/lib/csv";
import type { FlagMeta, Medicine } from "@/lib/types";

type Result = {
  items: Medicine[];
  total: number;
  page: number;
  size: number;
  pages: number;
  facets: FacetSet;
  summary: {
    stockedLines: number;
    unitsOnHand: number;
    stockValue: number;
    needsReorder: number;
    expiringSoon: number;
    expired: number;
    controlled: number;
    watchReserve: number;
    medianPrice: number;
  };
};

type View = "table" | "list" | "board";
type Sort = "relevance" | "brand" | "price" | "stock" | "expiry" | "maker" | "margin";

function marginOf(medicine: Medicine) {
  if (!medicine.price || !medicine.cost) return null;
  return ((medicine.price - medicine.cost) / medicine.price) * 100;
}

const COLUMNS: { key: string; label: string; sort?: Sort; width: string; align?: "right" }[] = [
  { key: "brand", label: "Product", sort: "brand", width: "minmax(160px,1.5fr)" },
  { key: "molecule", label: "Molecule", width: "minmax(100px,1fr)" },
  { key: "form", label: "Form", width: "58px" },
  { key: "maker", label: "Manufacturer", sort: "maker", width: "minmax(100px,1fr)" },
  { key: "markers", label: "Class", width: "78px" },
  { key: "pack", label: "Pack", width: "38px", align: "right" },
  { key: "price", label: "Retail", sort: "price", width: "64px", align: "right" },
  { key: "margin", label: "Margin", sort: "margin", width: "46px", align: "right" },
  // No stock columns. What a pharmacy holds is its own record, on its own
  // screen; the number that used to sit here came from the catalogue file and
  // was the same for everybody, which made it worse than absent.
  { key: "counsel", label: "Counselling", width: "minmax(120px,1.1fr)" },
];

// One track per column and nothing else. There used to be a leading 12px track
// for a row caret; the caret is gone, and a leftover track silently shifts every
// cell one column to the left.
const GRID = COLUMNS.map((c) => c.width).join(" ");
/** Fixed columns + gaps + the flexible columns' minimums + the panel's padding. */
const TABLE_MIN = 1110;

export function CatalogueView({
  flagMeta,
  title = "Catalogue",
  lockScope,
  onAdd,
}: {
  flagMeta: FlagMeta[];
  title?: string;
  lockScope?: "stocked";
  onAdd?: (medicine: Medicine) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [term, setTerm] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(term);

  // Filters come out of the URL on first render, so a drill-down link from the
  // dashboard ("/inventory?stock=out,critical") actually arrives filtered, and
  // a narrowed view can be shared or reloaded without losing its state.
  const [filters, setFilters] = useState<Filters>(() => {
    const list = (key: string) =>
      (params.get(key) ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

    return {
      scope: lockScope ?? (params.get("scope") === "stocked" ? "stocked" : "all"),
      aware: list("aware"),
      stock: list("stock"),
      expiry: list("expiry"),
      flags: list("flags"),
      form: list("form"),
      maker: list("maker"),
      molecule: list("molecule"),
      qt: list("qt"),
    };
  });
  const [view, setView] = useState<View>((params.get("view") as View) ?? "table");
  const [sort, setSort] = useState<Sort>("brand");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(50);
  const [groupBy, setGroupBy] = useState<"aware" | "form">("aware");
  const [open, setOpen] = useState<string | null>(params.get("open"));

  // Results are keyed by the query that produced them, so "loading" and "failed"
  // are derived from a stale key rather than written into state by the effect.
  const [loaded, setLoaded] = useState<{ key: string; data?: Result; failed?: boolean } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 160);
    return () => window.clearTimeout(timer);
  }, [term]);

  const search = useMemo(() => {
    const next = new URLSearchParams();
    if (debounced.trim()) next.set("q", debounced.trim());
    if (filters.scope === "stocked") next.set("scope", "stocked");
    for (const key of ["aware", "stock", "expiry", "flags", "form", "maker", "molecule", "qt"] as const) {
      if (filters[key].length) next.set(key, filters[key].join(","));
    }
    next.set("sort", debounced.trim() && sort === "brand" ? "relevance" : sort);
    next.set("dir", dir);
    next.set("page", String(page));
    next.set("size", String(view === "board" ? 120 : size));
    return next;
  }, [debounced, filters, sort, dir, page, size, view]);

  const key = search.toString();
  const result = loaded?.data ?? null;
  const loading = loaded?.key !== key;
  const failed = loaded?.key === key && Boolean(loaded.failed);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/catalogue?${key}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
      .then((data: Result) => setLoaded({ key, data }))
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setLoaded({ key, failed: true });
      });
    return () => controller.abort();
  }, [key]);

  // Keep the address bar in step so a filtered view can be shared or reloaded.
  useEffect(() => {
    const next = new URLSearchParams(search);
    next.delete("size");
    next.delete("dir");
    if (view !== "table") next.set("view", view);
    if (open) next.set("open", open);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [search, view, open, pathname, router]);

  const applySort = useCallback(
    (key: Sort) => {
      if (sort === key) {
        setDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSort(key);
        setDir(key === "price" || key === "stock" || key === "margin" ? "desc" : "asc");
      }
      setPage(1);
    },
    [sort],
  );

  const items = useMemo(() => result?.items ?? [], [result]);

  /* ── Export ──────────────────────────────────────────────────────────────
     Exports the whole filtered set, not the visible page, by walking the same
     query the table is showing. Capped so a stray "no filters" export cannot
     pull all 10,434 rows into the browser by accident. */
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);

  const doExport = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const CAP = 4000;
      const params = new URLSearchParams(search);
      params.set("size", "200");
      const rows: Medicine[] = [];
      let page = 1;
      let pages = 1;
      do {
        params.set("page", String(page));
        const response = await fetch(`/api/catalogue?${params.toString()}`);
        const data = (await response.json()) as Result;
        rows.push(...data.items);
        pages = data.pages;
        page += 1;
      } while (page <= pages && rows.length < CAP);

      const count = exportCsv(`dispensia-${title.toLowerCase()}-${stamp()}`, rows, [
        { header: "Product ID", value: (m) => m.id },
        { header: "Brand", value: (m) => m.brand },
        { header: "Generic", value: (m) => m.generic },
        { header: "Molecule", value: (m) => m.molecule },
        { header: "Strength", value: (m) => m.strength },
        { header: "Form", value: (m) => m.form },
        { header: "Manufacturer", value: (m) => m.maker },
        { header: "Pack size", value: (m) => m.pack },
        { header: "Retail PKR", value: (m) => m.price.toFixed(2) },
        { header: "Cost PKR", value: (m) => m.cost.toFixed(2) },
        { header: "Margin %", value: (m) => (marginOf(m) ?? 0).toFixed(1) },
        { header: "AWaRe", value: (m) => m.aware },
        { header: "QT risk", value: (m) => m.qt ?? "" },
        { header: "Clinical flags", value: (m) => m.flags.join(" | ") },
        { header: "On hand", value: (m) => m.stock?.onHand ?? "" },
        { header: "Reorder level", value: (m) => m.stock?.reorder ?? "" },
        { header: "Batch", value: (m) => m.stock?.batch ?? "" },
        { header: "Expiry", value: (m) => m.stock?.expiry ?? "" },
        { header: "Shelf", value: (m) => m.stock?.shelf ?? "" },
      ]);

      setToast(
        `Exported ${count.toLocaleString()} rows${
          rows.length >= CAP ? ` (capped at ${CAP.toLocaleString()} — narrow the filters for the rest)` : ""
        }.`,
      );
    } catch {
      setToast("The export could not be built. Nothing was downloaded.");
    } finally {
      setBusy(false);
    }
  }, [busy, search, title]);

  useCommand(COMMANDS.export, doExport);
  useCommand(
    COMMANDS.import,
    useCallback(() => setImportOpen(true), []),
  );

  const groups = useMemo(() => {
    if (view !== "board") return [];
    const keyOf = (m: Medicine) =>
      groupBy === "aware" ? m.aware : m.form;
    const order = groupBy === "aware" ? ["RESERVE", "WATCH", "ACCESS", "NA"] : [];
    const map = new Map<string, Medicine[]>();
    for (const item of items) {
      const key = keyOf(item);
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    const entries = [...map.entries()];
    if (order.length) entries.sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    else entries.sort((a, b) => b[1].length - a[1].length);
    return entries.slice(0, 8);
  }, [items, view, groupBy]);

  const applyFilters = useCallback(
    (next: Filters) => {
      // A locked scope survives, because the screen is defined by it.
      setFilters(lockScope ? { ...next, scope: lockScope } : next);
      setPage(1);
    },
    [lockScope],
  );

  return (
    // The whole view is one flex column that fills the viewport: only the table
    // body scrolls, and the way through the rest of the data is the pager.
    <div
      className="grid min-h-0 flex-1 gap-x-4"
      style={{ gridTemplateColumns: open ? "minmax(0,1fr) 340px" : "minmax(0,1fr)" }}
    >
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="field-shell min-w-[220px] flex-1">
            <SearchIcon size={15} strokeWidth={1.8} className="shrink-0" style={{ color: "var(--ink-3)" }} />
            <input
              value={term}
              onChange={(event) => {
                setTerm(event.target.value);
                setPage(1);
              }}
              placeholder={`Filter ${title.toLowerCase()} by brand, molecule or manufacturer`}
              className="t-data"
              spellCheck={false}
              data-filter-field=""
              aria-label={`Search ${title}`}
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

          {result ? (
            <FilterPopover
              facets={result.facets}
              filters={filters}
              flagMeta={flagMeta}
              onChange={applyFilters}
            />
          ) : null}

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

          {view === "board" ? (
            <select
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as typeof groupBy)}
              className="field h-8 w-[136px] shrink-0"
              aria-label="Group board by"
            >
              <option value="aware">AWaRe class</option>
              <option value="form">Dosage form</option>
            </select>
          ) : null}

          <Menu
            label="More"
            align="end"
            buttonClass="act act-icon shrink-0"
            trigger={<MoreHorizontal size={16} strokeWidth={1.9} />}
            items={[
              { label: "Export to CSV", hint: "Ctrl E", icon: <Download size={15} strokeWidth={1.8} />, onSelect: doExport, disabled: busy },
              { label: "Import stock", hint: "Ctrl I", icon: <Upload size={15} strokeWidth={1.8} />, onSelect: () => setImportOpen(true) },
              { separator: true },
              { label: "Add a stock line", icon: <PackagePlus size={15} strokeWidth={1.8} />, onSelect: () => setStockOpen(true) },
            ]}
          />
        </div>

        {/* Applied filters live outside the popover so they are always in sight. */}
        <FilterChips filters={filters} flagMeta={flagMeta} onChange={applyFilters} />

        {/* ── Summary: one line of totals over the whole filtered set ────── */}
        {result ? (
          <div
            className="mb-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-sm px-3 py-2"
            style={{ background: "var(--surface-sunk)", border: "1px solid var(--line-soft)" }}
          >
            <span className="t-data" data-depth="3">
              <span className="t-num">{result.total.toLocaleString()}</span>{" "}
              <span data-depth="1">products</span>
            </span>
            <span className="t-data" data-depth="1">
              <span className="t-num" data-depth="2">
                {result.facets.molecule.length.toLocaleString()}
              </span>{" "}
              molecules
            </span>
            <span className="t-data" data-depth="1">
              <span className="t-num" data-depth="2">
                {result.facets.maker.length.toLocaleString()}
              </span>{" "}
              manufacturers
            </span>
            {result.summary.watchReserve > 0 ? (
              <span className="t-data" data-depth="1">
                <span className="t-num" data-depth="2">
                  {result.summary.watchReserve}
                </span>{" "}
                AWaRe watch or reserve
              </span>
            ) : null}
            {loading ? (
              <span className="t-sm blink ml-auto" data-depth="1">
                Searching…
              </span>
            ) : null}
          </div>
        ) : null}

        {failed ? (
          <Empty
            title="The catalogue did not answer"
            hint="The search request failed before it reached the catalogue. Nothing was lost — try the same search again."
            action={
              <button type="button" className="act act-primary" onClick={() => setTerm((t) => `${t} `.trim())}>
                Retry
              </button>
            }
          />
        ) : !loading && items.length === 0 ? (
          <Empty
            title="Nothing matches this narrowing"
            hint="Every filter is an AND. Drop one in the Filter panel, or switch the scope back to the whole catalogue."
            action={
              <button
                type="button"
                className="act act-primary"
                onClick={() => {
                  setFilters({ ...EMPTY_FILTERS, scope: lockScope ?? "all" });
                  setTerm("");
                  setPage(1);
                }}
              >
                Clear all filters
              </button>
            }
          />
        ) : view === "table" ? (
          <TableView items={items} sort={sort} dir={dir} onSort={applySort} open={open} onOpen={setOpen} />
        ) : view === "list" ? (
          <ListView items={items} open={open} onOpen={setOpen} />
        ) : (
          <BoardView groups={groups} open={open} onOpen={setOpen} groupBy={groupBy} />
        )}

        {/* ── Pagination ────────────────────────────────────────────────────
            The way through the data. The table never grows the page; you page. */}
        {result && result.pages > 1 && view !== "board" ? (
          <div className="mt-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
            <span className="t-data" data-depth="1">
              Page <span className="t-num" data-depth="3">{result.page}</span> of{" "}
              <span className="t-num">{result.pages.toLocaleString()}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="act act-sm act-icon"
                onClick={() => setPage(1)}
                disabled={result.page === 1}
                aria-label="First page"
              >
                <ChevronsLeft size={15} strokeWidth={1.9} />
              </button>
              <button
                type="button"
                className="act act-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={result.page === 1}
              >
                <ChevronLeft size={15} strokeWidth={1.9} />
                Previous
              </button>
              <button
                type="button"
                className="act act-sm"
                onClick={() => setPage((p) => Math.min(result.pages, p + 1))}
                disabled={result.page === result.pages}
              >
                Next
                <ChevronRight size={15} strokeWidth={1.9} />
              </button>
              <button
                type="button"
                className="act act-sm act-icon"
                onClick={() => setPage(result.pages)}
                disabled={result.page === result.pages}
                aria-label="Last page"
              >
                <ChevronsRight size={15} strokeWidth={1.9} />
              </button>
            </div>
            <label className="ml-auto flex items-center gap-2">
              <span className="t-label">Rows</span>
              <select
                value={size}
                onChange={(event) => {
                  setSize(Number(event.target.value));
                  setPage(1);
                }}
                className="field h-8 w-[84px]"
              >
                {[25, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>

      {/* ── Product plane ───────────────────────────────────────────────── */}
      {/* The detail panel is the grid's SECOND column. It used to declare
          col-start-3, left over from when a filter rail held column one — which
          implicitly created a third track and stranded a column of dead space
          between the table and the panel. */}
      {open ? (
        <div className="hidden min-h-0 lg:block">
          <ProductPanel id={open} flagMeta={flagMeta} onClose={() => setOpen(null)} onAdd={onAdd} />
        </div>
      ) : null}

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={setToast} />
      <AddStockDialog open={stockOpen} onClose={() => setStockOpen(false)} onDone={setToast} />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

/* ═══ Add a stock line ═════════════════════════════════════════════════════
   Receiving stock against a real catalogue product: the product is chosen from
   the catalogue rather than typed, so a batch can never be booked against a
   name that does not exist. */

function AddStockDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<Medicine[]>([]);
  const [chosen, setChosen] = useState<Medicine | null>(null);
  const [qty, setQty] = useState("");
  const [reorder, setReorder] = useState("");
  const [batch, setBatch] = useState("");
  const [expiry, setExpiry] = useState("");
  const [shelf, setShelf] = useState("");
  const [cost, setCost] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2 || chosen) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(q)}&limit=6`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data: { items: Medicine[] }) => setHits(data.items))
        .catch(() => undefined);
    }, 120);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term, chosen]);

  function reset() {
    setTerm("");
    setHits([]);
    setChosen(null);
    setQty("");
    setReorder("");
    setBatch("");
    setExpiry("");
    setShelf("");
    setCost("");
    setError("");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!chosen) return setError("Choose the product this batch is for.");
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) return setError("Enter the quantity received.");
    if (!batch.trim()) return setError("A batch number is required to book stock in.");
    if (!expiry) return setError("An expiry date is required.");
    if (new Date(expiry) <= new Date("2026-09-14")) {
      return setError("That expiry date has already passed — expired stock cannot be received.");
    }

    onDone(
      `${quantity} units of ${chosen.short} booked in on batch ${batch.trim().toUpperCase()}. Connect Supabase to persist it.`,
    );
    reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add a stock line"
      description="Receive a batch against a product that already exists in the catalogue."
      width={560}
      footer={
        <>
          <button
            type="button"
            className="act"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </button>
          <button type="submit" form="add-stock" className="act act-primary">
            <PackagePlus size={15} strokeWidth={1.8} />
            Book in
          </button>
        </>
      }
    >
      <form id="add-stock" onSubmit={submit}>
        <label className="block">
          <span className="t-label">
            Product <span style={{ color: "var(--danger)" }}>*</span>
          </span>
          {chosen ? (
            <span className="panel-flat mt-1.5 flex items-center gap-3 p-2.5">
              <span className="min-w-0 flex-1">
                <Identity medicine={chosen} depth={3} />
              </span>
              <Markers medicine={chosen} />
              <button
                type="button"
                className="act act-quiet act-sm act-icon shrink-0"
                aria-label="Choose a different product"
                onClick={() => {
                  setChosen(null);
                  setTerm("");
                }}
              >
                <X size={14} strokeWidth={1.9} />
              </button>
            </span>
          ) : (
            <span className="relative mt-1.5 block">
              <span className="field-shell">
                <SearchIcon size={15} strokeWidth={1.8} className="shrink-0" style={{ color: "var(--ink-3)" }} />
                <input
                  value={term}
                  onChange={(event) => {
                    setTerm(event.target.value);
                    setError("");
                  }}
                  placeholder="Search the catalogue by brand or molecule"
                  className="t-data"
                  autoComplete="off"
                  spellCheck={false}
                />
              </span>
              {hits.length && term.trim().length >= 2 ? (
                <span className="panel absolute left-0 right-0 top-10 z-10 block max-h-[220px] overflow-y-auto py-1">
                  {hits.map((medicine) => (
                    <button
                      key={medicine.id}
                      type="button"
                      className="pop-item"
                      style={{ height: 46 }}
                      onClick={() => {
                        setChosen(medicine);
                        setCost(medicine.cost.toFixed(2));
                        setHits([]);
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <Identity medicine={medicine} depth={3} />
                      </span>
                      <Markers medicine={medicine} />
                    </button>
                  ))}
                </span>
              ) : null}
            </span>
          )}
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="t-label">
              Quantity received <span style={{ color: "var(--danger)" }}>*</span>
            </span>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="field mt-1.5"
              inputMode="numeric"
              autoComplete="off"
            />
          </label>

          <label className="block">
            <span className="t-label">Reorder level</span>
            <input
              value={reorder}
              onChange={(e) => setReorder(e.target.value)}
              className="field mt-1.5"
              inputMode="numeric"
              autoComplete="off"
              placeholder="When to reorder"
            />
          </label>

          <label className="block">
            <span className="t-label">
              Batch number <span style={{ color: "var(--danger)" }}>*</span>
            </span>
            <input
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              className="field t-code mt-1.5"
              autoComplete="off"
              placeholder="AZI-2212"
            />
          </label>

          <label className="block">
            <span className="t-label">
              Expiry <span style={{ color: "var(--danger)" }}>*</span>
            </span>
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="field mt-1.5"
            />
          </label>

          <label className="block">
            <span className="t-label">Shelf location</span>
            <input
              value={shelf}
              onChange={(e) => setShelf(e.target.value)}
              className="field mt-1.5"
              autoComplete="off"
              placeholder="A4 or Cold room"
            />
          </label>

          <label className="block">
            <span className="t-label">Unit cost (PKR)</span>
            <input
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="field mt-1.5"
              inputMode="decimal"
              autoComplete="off"
            />
          </label>
        </div>

        {error ? (
          <p className="band t-sm mt-4" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

/* ═══ Import ═══════════════════════════════════════════════════════════════
   A validating importer. Every row is matched against the real catalogue before
   anything is claimed, and the result tells the truth about what would land and
   what would not — including that committing needs the backend connected. */

type ImportRow = {
  line: number;
  ref: string;
  qty: number | null;
  batch: string;
  expiry: string;
  matched?: Medicine;
  problem?: string;
};

function ImportDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [filename, setFilename] = useState("");
  const [reading, setReading] = useState(false);

  const reset = useCallback(() => {
    setRows(null);
    setFilename("");
  }, []);

  async function read(file: File) {
    setReading(true);
    setFilename(file.name);
    try {
      const text = await file.text();
      const table = parseCsv(text);
      if (!table.length) {
        setRows([]);
        return;
      }

      const header = table[0].map((cell) => cell.trim().toLowerCase());
      const col = (...names: string[]) => header.findIndex((cell) => names.includes(cell));
      const refCol = col("product id", "id", "brand", "product", "sku");
      const qtyCol = col("qty", "quantity", "on hand", "received", "units");
      const batchCol = col("batch", "lot", "batch no");
      const expiryCol = col("expiry", "expires", "expiry date");

      const parsed: ImportRow[] = table.slice(1, 400).map((cells, index) => ({
        line: index + 2,
        ref: (refCol >= 0 ? cells[refCol] : cells[0])?.trim() ?? "",
        qty: qtyCol >= 0 ? Number(cells[qtyCol]) : null,
        batch: batchCol >= 0 ? (cells[batchCol] ?? "").trim() : "",
        expiry: expiryCol >= 0 ? (cells[expiryCol] ?? "").trim() : "",
      }));

      // Resolve each reference against the live catalogue, in one pass.
      const resolved = await Promise.all(
        parsed.map(async (row) => {
          if (!row.ref) return { ...row, problem: "No product reference in this row" };
          if (row.qty !== null && (!Number.isFinite(row.qty) || row.qty < 0)) {
            return { ...row, problem: "Quantity is not a number" };
          }
          const response = await fetch(`/api/suggest?q=${encodeURIComponent(row.ref)}&limit=1`);
          const data = (await response.json()) as { items: Medicine[] };
          const hit = data.items[0];
          if (!hit) return { ...row, problem: "No catalogue product matches this reference" };
          return { ...row, matched: hit };
        }),
      );

      setRows(resolved);
    } catch {
      setRows([]);
      onDone("That file could not be read as CSV.");
    } finally {
      setReading(false);
    }
  }

  const ok = rows?.filter((row) => row.matched).length ?? 0;
  const bad = rows?.filter((row) => !row.matched).length ?? 0;

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Import stock from CSV"
      description="Every row is matched against the live catalogue before anything is committed."
      width={720}
      footer={
        <>
          <button
            type="button"
            className="act"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="act act-primary"
            disabled={!ok}
            onClick={() => {
              onDone(
                `${ok} row${ok === 1 ? "" : "s"} validated against the catalogue. Connect Supabase to commit them to stock.`,
              );
              reset();
              onClose();
            }}
          >
            Validate {ok || ""} {ok === 1 ? "row" : "rows"}
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
              {reading ? "Reading…" : "Choose a CSV file"}
            </span>
            <span className="t-sm mt-1" data-depth="1">
              or drop it here
            </span>
            <input
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
            <p className="t-label">Expected columns</p>
            <p className="t-sm mt-1.5" data-depth="1">
              A header row naming at least a product reference. The importer recognises{" "}
              <span className="t-code">Product ID</span>, <span className="t-code">Brand</span>,{" "}
              <span className="t-code">Qty</span>, <span className="t-code">Batch</span> and{" "}
              <span className="t-code">Expiry</span> in any order. A file exported from this workspace
              imports back without editing.
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-3">
            <span className="t-data" data-depth="3">
              {filename}
            </span>
            <span className="cell cell-access">{ok} matched</span>
            {bad ? <span className="cell cell-reserve">{bad} unmatched</span> : null}
            <button type="button" className="act act-quiet act-sm ml-auto" onClick={reset}>
              Choose another file
            </button>
          </div>

          <div className="panel-flat max-h-[42vh] overflow-auto">
            {rows.length === 0 ? (
              <p className="t-data px-3 py-6 text-center" data-depth="1">
                That file had no data rows.
              </p>
            ) : (
              rows.map((row) => (
                <div key={row.line} className="baseline row flex items-start gap-3 px-3 py-2">
                  <span className="t-sm t-num w-7 shrink-0" data-depth="0">
                    {row.line}
                  </span>
                  <span className="min-w-0 flex-1">
                    {row.matched ? (
                      <>
                        <span className="t-data block truncate" data-depth="3">
                          {row.matched.short}
                          {row.matched.strength ? ` ${row.matched.strength}` : ""}
                        </span>
                        <span className="t-sm block truncate" data-depth="1">
                          {row.matched.molecule} · {row.matched.maker}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="t-data block truncate" data-depth="2">
                          {row.ref || "(empty)"}
                        </span>
                        <span className="t-sm block" style={{ color: "var(--danger)" }}>
                          {row.problem}
                        </span>
                      </>
                    )}
                  </span>
                  <span className="t-sm t-num w-12 shrink-0 text-right" data-depth="2">
                    {row.qty ?? "—"}
                  </span>
                  <span className="t-sm t-code w-20 shrink-0 truncate text-right" data-depth="1">
                    {row.batch || "—"}
                  </span>
                  <span className="t-sm t-num w-20 shrink-0 text-right" data-depth="1">
                    {row.expiry || "—"}
                  </span>
                  <span className={`cell shrink-0 ${row.matched ? "cell-access" : "cell-reserve"}`}>
                    {row.matched ? "OK" : "—"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

/* ═══ Table ════════════════════════════════════════════════════════════════
   Thirteen columns held by alignment alone. No cell borders, no zebra, no card
   — a hairline under each baseline and nothing else. */

function TableView({
  items,
  sort,
  dir,
  onSort,
  open,
  onOpen,
}: {
  items: Medicine[];
  sort: Sort;
  dir: "asc" | "desc";
  onSort: (key: Sort) => void;
  open: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    // The rows scroll, not the page: this makes the wrapper the scroll container
    // in both axes, which is the only way a sticky column header pins correctly
    // while the table can still scroll sideways on a narrow screen.
    <div className="panel min-h-0 flex-1 overflow-auto">
      <div style={{ minWidth: TABLE_MIN }} role="table" aria-label="Catalogue">
        <div
          role="row"
          className="baseline-strong sticky top-0 z-10 grid items-center gap-x-2.5 px-3 py-2"
          style={{ gridTemplateColumns: GRID, background: "var(--surface-sunk)" }}
        >
          {COLUMNS.map((column) => (
            <div
              key={column.key}
              role="columnheader"
              aria-sort={
                column.sort && sort === column.sort
                  ? dir === "asc"
                    ? "ascending"
                    : "descending"
                  : undefined
              }
              className={column.align === "right" ? "text-right" : ""}
            >
              {column.sort ? (
                <button
                  type="button"
                  onClick={() => onSort(column.sort!)}
                  className="t-label inline-flex items-center gap-1 hover:text-(--ink)"
                  // Sort state is chrome, so it takes the interaction colour.
                  // Amber and red belong to clinical meaning alone.
                  style={sort === column.sort ? { color: "var(--primary)" } : undefined}
                >
                  {column.label}
                  {sort === column.sort ? (
                    dir === "asc" ? (
                      <ArrowUp size={12} strokeWidth={2.4} />
                    ) : (
                      <ArrowDown size={12} strokeWidth={2.4} />
                    )
                  ) : null}
                </button>
              ) : (
                <span className="t-label">{column.label}</span>
              )}
            </div>
          ))}
        </div>

        {items.map((medicine) => {
          const live = open === medicine.id;
          const mg = marginOf(medicine);
          return (
            <div
              key={medicine.id}
              role="row"
              tabIndex={0}
              onClick={() => onOpen(medicine.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen(medicine.id);
                }
              }}
              className="baseline row grid cursor-pointer items-center gap-x-2.5 px-3 py-1.5"
              style={{ gridTemplateColumns: GRID, minHeight: 32 }}
              data-live={live}
            >

              <span className="min-w-0 truncate">
                <span className="t-data" data-depth={live ? "4" : "3"}>
                  {medicine.short}
                </span>
                {medicine.strength ? (
                  <span className="t-data t-num ml-1" data-depth="2">
                    {medicine.strength}
                  </span>
                ) : null}
              </span>

              <span className="t-data truncate" data-depth="1">
                {medicine.molecule}
              </span>
              <span className="t-data truncate" data-depth="1">
                {medicine.form}
              </span>
              <span className="t-data truncate" data-depth="1">
                {medicine.maker}
              </span>
              <span>
                <Markers medicine={medicine} />
              </span>
              <span className="t-data t-num text-right" data-depth="1">
                {medicine.pack ?? "—"}
              </span>
              <span className="t-data t-num text-right" data-depth={live ? "4" : "2"}>
                {pkr(medicine.price, true)}
              </span>
              <span
                className="t-data t-num text-right"
                data-depth="1"
                style={mg !== null && mg < 5 ? { color: "var(--danger)" } : undefined}
              >
                {mg === null ? "—" : `${mg.toFixed(0)}%`}
              </span>
              {/* One cell for the one column that replaced the four stock ones. */}
              <span className="t-data truncate" data-depth="1">
                {medicine.counsel >= 0 ? "counselling duty" : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ List ═════════════════════════════════════════════════════════════════
   Same records, more of each. Two baselines per product, the counselling duty
   and the full clinical marker set visible without opening anything. */

function ListView({
  items,
  open,
  onOpen,
}: {
  items: Medicine[];
  open: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    // The rows scroll, not the page. This screen is locked to the viewport, so
    // a list without its own scroll container does not overflow — it is clipped,
    // and every row past the fold becomes unreachable.
    <div className="panel min-h-0 flex-1 overflow-y-auto px-3">
      {items.map((medicine) => {
        const live = open === medicine.id;
        const mg = marginOf(medicine);
        return (
          <div
            key={medicine.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(medicine.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(medicine.id);
              }
            }}
            className="baseline row flex cursor-pointer items-start gap-3 py-2"
            data-live={live}
          >

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="t-data" data-depth={live ? "4" : "3"}>
                  {medicine.short}
                </span>
                {medicine.strength ? (
                  <span className="t-data t-num" data-depth="2">
                    {medicine.strength}
                  </span>
                ) : null}
                <span className="t-data" data-depth="1">
                  {medicine.form}
                </span>
                <Markers medicine={medicine} />
              </span>
              <span className="t-data mt-0.5 block truncate" data-depth="1">
                {medicine.molecule} · {medicine.maker}
                {medicine.pack ? ` · ${medicine.pack}/pack` : ""}
              </span>
            </span>

            {/* Counselling is the catalogue's own obligation, and the thing a
                pharmacist most often opens this screen to check. It replaced a
                shelf meter that belonged to no pharmacy. */}
            <span className="hidden min-w-0 flex-1 shrink md:block">
              {medicine.counsel >= 0 ? (
                <span className="t-data truncate" data-depth="1">
                  counselling duty recorded
                </span>
              ) : null}
            </span>

            <span className="w-[88px] shrink-0 text-right">
              <span className="t-data t-num block" data-depth={live ? "4" : "3"}>
                {pkr(medicine.price, true)}
              </span>
              <span className="t-data t-num mt-0.5 block" data-depth="1">
                {mg === null ? "—" : `${mg.toFixed(0)}% margin`}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ Board ════════════════════════════════════════════════════════════════
   Lanes, each scrolling inside itself, so the board pages sideways instead of
   growing a screen that is locked to the viewport. */

const GROUP_LABEL: Record<string, string> = {
  RESERVE: "Reserve",
  WATCH: "Watch",
  ACCESS: "Access",
  NA: "Not classified",
  out: "Out of stock",
  critical: "Critical",
  low: "Low",
  healthy: "Healthy",
  "not stocked": "Not stocked",
};

const GROUP_TONE: Record<string, string> = {
  RESERVE: "var(--danger)",
  WATCH: "var(--warn)",
  ACCESS: "var(--ok)",
  out: "var(--danger)",
  critical: "var(--danger)",
  low: "var(--warn)",
  healthy: "var(--ok)",
};

function BoardView({
  groups,
  open,
  onOpen,
  groupBy,
}: {
  groups: [string, Medicine[]][];
  open: string | null;
  onOpen: (id: string) => void;
  groupBy: string;
}) {
  if (!groups.length) {
    return (
      <Empty title="Nothing to lay out" hint="No products match the current narrowing, so there are no columns to draw." />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Lanes, each scrolling inside itself. The board pages sideways rather
          than growing the screen downward, which is the whole reason this page
          is locked to the viewport. */}
      <div className="min-h-0 flex-1 overflow-x-auto pb-1">
        <div className="flex h-full gap-3" style={{ minWidth: Math.min(groups.length, 7) * 252 }}>
          {groups.map(([key, list]) => {
            const tone = GROUP_TONE[key];
            const stocked = list.filter((medicine) => medicine.stock).length;
            return (
              <section key={key} className="lane h-full w-[244px] shrink-0">
                <div className="panel-head shrink-0" style={{ padding: "8px 10px" }}>
                  {tone ? (
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: tone }}
                    />
                  ) : null}
                  <h3 className="t-label flex-1 truncate" style={{ color: "var(--ink)" }}>
                    {GROUP_LABEL[key] ?? key}
                  </h3>
                  <span className="cell cell-quiet">{list.length}</span>
                </div>

                {/* One line under the heading that says what the column is, so
                    a lane is readable without counting its cards. */}
                <div className="shrink-0 border-b border-(--line) px-2.5 py-1.5">
                  <span className="t-xs" data-depth="1">
                    <span className="t-num" data-depth={stocked ? "2" : "0"}>
                      {stocked}
                    </span>{" "}
                    stocked here
                  </span>
                </div>

                <div className="lane-body">
                  {list.slice(0, 40).map((medicine) => {
                    const live = open === medicine.id;
                    return (
                      <button
                        key={medicine.id}
                        type="button"
                        onClick={() => onOpen(medicine.id)}
                        className="tile p-2.5"
                        data-live={live}
                      >
                        <span className="flex items-start gap-1.5">
                          <span className="t-data min-w-0 flex-1 truncate" data-depth={live ? "4" : "3"}>
                            {medicine.short}
                            {medicine.strength ? (
                              <span className="t-num ml-1" data-depth="2">
                                {medicine.strength}
                              </span>
                            ) : null}
                          </span>
                          <Markers medicine={medicine} />
                        </span>

                        <span className="t-data mt-0.5 block truncate" data-depth="1">
                          {medicine.molecule} · {medicine.form}
                        </span>

                        <span className="mt-2 flex items-center gap-2">
                          <span className="t-xs" data-depth="1">
                            {medicine.pack ? `${medicine.pack}/pack` : "—"}
                          </span>
                          <span className="t-data t-num ml-auto" data-depth="3">
                            {pkr(medicine.price, true)}
                          </span>
                        </span>
                      </button>
                    );
                  })}

                  {list.length > 40 ? (
                    <p className="t-xs py-1 text-center" data-depth="0">
                      + {(list.length - 40).toLocaleString()} more in this column
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <p className="t-xs shrink-0 pt-2" data-depth="0">
        The board lays out the first 120 results grouped by {groupBy}. Narrow further in the filter panel, or
        switch to table for the full set.
      </p>
    </div>
  );
}

