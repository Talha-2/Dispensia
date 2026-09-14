"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ListFilter, RotateCcw, Search as SearchIcon, X } from "lucide-react";
import { EMPTY_FILTERS, type FacetSet, type Filters } from "@/components/filter-rail";
import type { Facet, FlagMeta } from "@/lib/types";

/* ═══ Labels and tones ═════════════════════════════════════════════════════ */

const LABELS: Record<string, string> = {
  out: "Out of stock",
  critical: "Critical",
  low: "Low",
  healthy: "Healthy",
  expired: "Expired",
  expiring: "Expiring in 90 days",
  ok: "In date",
  high: "High QT risk",
  moderate: "Moderate QT risk",
  NA: "Not an antibiotic",
  RESERVE: "Reserve",
  WATCH: "Watch",
  ACCESS: "Access",
};

const TONES: Record<string, string> = {
  RESERVE: "var(--danger)",
  WATCH: "var(--warn-solid)",
  ACCESS: "var(--ok-solid)",
  out: "var(--danger)",
  critical: "var(--danger)",
  low: "var(--warn-solid)",
  healthy: "var(--ok-solid)",
  expired: "var(--danger)",
  expiring: "var(--warn-solid)",
  ok: "var(--ok-solid)",
  high: "var(--danger)",
  moderate: "var(--warn-solid)",
  controlled: "var(--info-solid)",
  teratogen: "var(--danger)",
};

const ORDER: Record<string, string[]> = {
  aware: ["RESERVE", "WATCH", "ACCESS", "NA"],
  stock: ["out", "critical", "low", "healthy"],
  expiry: ["expired", "expiring", "ok"],
  qt: ["high", "moderate"],
};

type GroupKey = keyof Omit<Filters, "scope">;

type Category = {
  id: string;
  title: string;
  hint: string;
  key: GroupKey;
  /** Flag categories draw from one slice of the flag facet. */
  flagGroup?: "risk" | "therapeutic" | "interaction";
};

const CATEGORIES: Category[] = [
  { id: "aware", title: "AWaRe class", hint: "WHO antibiotic stewardship classification", key: "aware" },
  { id: "stock", title: "Shelf state", hint: "How much is on hand against the reorder level", key: "stock" },
  { id: "expiry", title: "Expiry", hint: "How long a batch has left", key: "expiry" },
  { id: "risk", title: "Risk", hint: "Controlled drugs and known teratogens", key: "flags", flagGroup: "risk" },
  { id: "qt", title: "QT risk", hint: "Graded QT-prolongation risk", key: "qt" },
  { id: "therapeutic", title: "Therapeutic class", hint: "What the product is for", key: "flags", flagGroup: "therapeutic" },
  { id: "interaction", title: "Interaction profile", hint: "Enzyme and transporter behaviour", key: "flags", flagGroup: "interaction" },
  { id: "form", title: "Dosage form", hint: "Tablet, injection, syrup and the rest", key: "form" },
  { id: "molecule", title: "Molecule", hint: "2,017 distinct actives", key: "molecule" },
  { id: "maker", title: "Manufacturer", hint: "841 manufacturers", key: "maker" },
];

/**
 * The filter builder.
 *
 * Categories on the left, that category's values on the right with their own
 * search — the same shape as the reference. Edits are held in a draft and only
 * committed on Apply, so a long narrowing does not re-query the catalogue on
 * every click, and Cancel really does leave the result set alone.
 */
export function FilterPopover({
  facets,
  filters,
  flagMeta,
  onChange,
}: {
  facets: FacetSet;
  filters: Filters;
  flagMeta: FlagMeta[];
  onChange: (next: Filters) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>(filters);
  const [category, setCategory] = useState<string>("aware");
  const [term, setTerm] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const flagLabel = useMemo(() => new Map(flagMeta.map((f) => [f.key, f.label])), [flagMeta]);
  const flagGroup = useMemo(() => new Map(flagMeta.map((f) => [f.key, f.group])), [flagMeta]);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const groupKeys: GroupKey[] = ["aware", "stock", "expiry", "flags", "form", "maker", "molecule", "qt"];
  const applied = groupKeys.reduce((sum, key) => sum + filters[key].length, 0);
  const drafted = groupKeys.reduce((sum, key) => sum + draft[key].length, 0);

  const valuesFor = (entry: Category): Facet[] => {
    if (entry.key === "flags") {
      return facets.flags.filter((f) => flagGroup.get(f.value) === entry.flagGroup);
    }
    const list = facets[entry.key as "aware" | "stock" | "expiry" | "form" | "maker" | "molecule" | "qt"];
    const sequence = ORDER[entry.id];
    return sequence
      ? [...list].sort((a, b) => sequence.indexOf(a.value) - sequence.indexOf(b.value))
      : list;
  };

  const labelFor = (entry: Category, value: string) =>
    entry.key === "flags" ? (flagLabel.get(value) ?? value) : (LABELS[value] ?? value);

  const countIn = (entry: Category, source: Filters) =>
    entry.key === "flags"
      ? source.flags.filter((f) => flagGroup.get(f) === entry.flagGroup).length
      : source[entry.key].length;

  const active = CATEGORIES.find((entry) => entry.id === category) ?? CATEGORIES[0];
  const values = valuesFor(active);
  const lower = term.toLowerCase().trim();
  const visible = lower
    ? values.filter(
        (facet) =>
          facet.value.toLowerCase().includes(lower) ||
          labelFor(active, facet.value).toLowerCase().includes(lower),
      )
    : values;

  const toggle = (entry: Category, value: string) => {
    const current = draft[entry.key];
    setDraft({
      ...draft,
      [entry.key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    });
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className="act"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setDraft(filters);
          setOpen((v) => !v);
        }}
        style={applied ? { borderColor: "var(--primary)", color: "var(--primary-deep)" } : undefined}
      >
        <ListFilter size={15} strokeWidth={1.8} />
        Filter
        {applied ? <span className="cell cell-primary">{applied}</span> : null}
        <ChevronDown size={14} strokeWidth={1.8} style={{ opacity: 0.7 }} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Filter catalogue"
          className="pop absolute right-0 z-50 mt-2 w-[min(680px,calc(100vw-32px))] overflow-hidden p-0"
          style={{ boxShadow: "var(--shadow-pop)" }}
        >
          <div className="flex min-h-0" style={{ height: 380 }}>
            {/* Categories */}
            <div
              className="w-[212px] shrink-0 overflow-y-auto border-r border-(--line) p-2"
              style={{ background: "var(--surface-sunk)" }}
            >
              <p className="px-2 pb-1 pt-1.5 text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                Filter catalogue
              </p>
              <p className="px-2 pb-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
                Narrow the list down to what you are looking for.
              </p>
              {CATEGORIES.map((entry) => {
                const on = entry.id === category;
                const n = countIn(entry, draft);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      setCategory(entry.id);
                      setTerm("");
                    }}
                    className="flex h-9 w-full items-center gap-2 rounded-(--radius-xs) px-2 text-left transition-colors"
                    style={{
                      background: on ? "var(--surface)" : undefined,
                      boxShadow: on ? "var(--shadow-xs)" : undefined,
                      color: on ? "var(--ink)" : "var(--ink-2)",
                      fontWeight: on ? 600 : 450,
                    }}
                  >
                    <span className="flex-1 truncate text-[13px]">{entry.title}</span>
                    {n ? <span className="cell cell-primary">{n}</span> : null}
                  </button>
                );
              })}
            </div>

            {/* Values */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="border-b border-(--line) p-3">
                <p className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                  {active.title}
                </p>
                <p className="mt-0.5 text-[12px]" style={{ color: "var(--ink-3)" }}>
                  {active.hint}
                </p>
                {values.length > 8 ? (
                  <div className="field-shell mt-2.5" style={{ height: 32 }}>
                    <SearchIcon size={14} strokeWidth={1.9} className="shrink-0" style={{ color: "var(--ink-3)" }} />
                    <input
                      value={term}
                      onChange={(event) => setTerm(event.target.value)}
                      placeholder={`Search ${active.title.toLowerCase()}`}
                      className="t-sm"
                      spellCheck={false}
                    />
                    {term ? (
                      <button type="button" onClick={() => setTerm("")} aria-label="Clear" style={{ color: "var(--ink-3)" }}>
                        <X size={13} strokeWidth={2} />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {visible.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[13px]" style={{ color: "var(--ink-3)" }}>
                    {lower ? `Nothing matches “${term}”.` : "Nothing to filter by here."}
                  </p>
                ) : (
                  visible.map((facet) => {
                    const on = draft[active.key].includes(facet.value);
                    return (
                      <button
                        key={facet.value}
                        type="button"
                        onClick={() => toggle(active, facet.value)}
                        aria-pressed={on}
                        data-on={on}
                        className="facet"
                      >
                        <span className="check" aria-hidden="true">
                          <Check size={11} strokeWidth={3.2} />
                        </span>
                        {TONES[facet.value] ? (
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: TONES[facet.value] }}
                          />
                        ) : null}
                        <span
                          className="t-sm min-w-0 flex-1 truncate"
                          style={{ color: on ? "var(--primary-deep)" : "var(--ink-2)", fontWeight: on ? 600 : 450 }}
                        >
                          {labelFor(active, facet.value)}
                        </span>
                        <span
                          className="t-xs t-num shrink-0"
                          style={{ color: on ? "var(--primary)" : "var(--ink-3)" }}
                        >
                          {facet.count.toLocaleString()}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div
            className="flex items-center gap-2 border-t border-(--line) px-3 py-2.5"
            style={{ background: "var(--surface-sunk)" }}
          >
            <button
              type="button"
              className="act act-quiet act-sm"
              onClick={() => setDraft({ ...EMPTY_FILTERS, scope: draft.scope })}
              disabled={!drafted}
            >
              <RotateCcw size={13} strokeWidth={1.9} />
              Reset
            </button>
            <span className="t-xs ml-auto" style={{ color: "var(--ink-3)" }}>
              {drafted === 0
                ? "No filters selected"
                : `${drafted} filter${drafted === 1 ? "" : "s"} selected`}
            </span>
            <button type="button" className="act act-sm" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="act act-primary act-sm"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Apply filters
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The applied filters, shown outside the popover so they are always visible. */
export function FilterChips({
  filters,
  flagMeta,
  onChange,
}: {
  filters: Filters;
  flagMeta: FlagMeta[];
  onChange: (next: Filters) => void;
}) {
  const flagLabel = useMemo(() => new Map(flagMeta.map((f) => [f.key, f.label])), [flagMeta]);
  const groupKeys: GroupKey[] = ["aware", "stock", "expiry", "flags", "form", "maker", "molecule", "qt"];
  const total = groupKeys.reduce((sum, key) => sum + filters[key].length, 0);

  if (!total) return null;

  const labelOf = (key: GroupKey, value: string) =>
    key === "flags" ? (flagLabel.get(value) ?? value) : (LABELS[value] ?? value);

  return (
    <div className="reveal flex flex-wrap items-center gap-1.5">
      {groupKeys.flatMap((key) =>
        filters[key].map((value) => (
          <span
            key={`${key}-${value}`}
            className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border px-2 text-[11.5px] font-medium"
            style={{
              borderColor: "var(--primary-line)",
              background: "var(--primary-soft)",
              color: "var(--primary-deep)",
            }}
          >
            {TONES[value] ? (
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONES[value] }} />
            ) : null}
            <span className="truncate">{labelOf(key, value)}</span>
            <button
              type="button"
              aria-label={`Remove ${labelOf(key, value)} filter`}
              className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
              onClick={() =>
                onChange({ ...filters, [key]: filters[key].filter((v) => v !== value) })
              }
            >
              <X size={12} strokeWidth={2.4} />
            </button>
          </span>
        )),
      )}
      <button
        type="button"
        className="act act-quiet act-sm"
        onClick={() => onChange({ ...EMPTY_FILTERS, scope: filters.scope })}
      >
        Clear all
      </button>
    </div>
  );
}
