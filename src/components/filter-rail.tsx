"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, RotateCcw, Search as SearchIcon, X } from "lucide-react";
import type { Facet, FlagMeta } from "@/lib/types";

export type Filters = {
  scope: "all" | "stocked";
  aware: string[];
  stock: string[];
  expiry: string[];
  flags: string[];
  form: string[];
  maker: string[];
  molecule: string[];
  qt: string[];
};

export const EMPTY_FILTERS: Filters = {
  scope: "all",
  aware: [],
  stock: [],
  expiry: [],
  flags: [],
  form: [],
  maker: [],
  molecule: [],
  qt: [],
};

export type FacetSet = {
  aware: Facet[];
  form: Facet[];
  maker: Facet[];
  molecule: Facet[];
  flags: Facet[];
  stock: Facet[];
  expiry: Facet[];
  qt: Facet[];
};

const AWARE_ORDER = ["RESERVE", "WATCH", "ACCESS", "NA"];
const STOCK_ORDER = ["out", "critical", "low", "healthy"];
const EXPIRY_ORDER = ["expired", "expiring", "ok"];

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

/**
 * One facet value. A real checkbox, so it is obvious before you click that
 * several values can be on at once — and the count beside it is what you would
 * be left with, computed with this group's own selection excluded.
 */
function Facet({
  label,
  count,
  on,
  tone,
  onToggle,
  radio = false,
}: {
  label: string;
  count?: number;
  on: boolean;
  tone?: string;
  onToggle: () => void;
  /** Scope is one-of-many, so it announces and draws as a radio, not a checkbox. */
  radio?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role={radio ? "radio" : undefined}
      aria-checked={radio ? on : undefined}
      aria-pressed={radio ? undefined : on}
      className="facet"
      data-on={on}
    >
      <span className={`check ${radio ? "check-radio" : ""}`} aria-hidden="true">
        {radio ? <span className="dot" /> : <Check size={11} strokeWidth={3.2} />}
      </span>
      {tone ? (
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: tone }}
        />
      ) : null}
      <span
        className="t-sm min-w-0 flex-1 truncate"
        style={{ color: on ? "var(--primary-deep)" : "var(--ink-2)", fontWeight: on ? 600 : 450 }}
      >
        {label}
      </span>
      {count === undefined ? null : (
        <span className="t-xs t-num shrink-0 tabular-nums" style={{ color: on ? "var(--primary)" : "var(--ink-3)" }}>
          {count.toLocaleString()}
        </span>
      )}
    </button>
  );
}

function Group({
  title,
  children,
  defaultOpen = true,
  count,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-(--line-soft) py-2.5 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-1.5 py-0.5 text-left"
      >
        <span className="t-label flex-1" style={{ color: open ? "var(--ink)" : "var(--ink-3)" }}>
          {title}
        </span>
        {count ? <span className="cell cell-primary">{count}</span> : null}
        <ChevronDown className="chev" size={14} strokeWidth={2} style={{ color: "var(--ink-4)" }} />
      </button>
      {open ? <div className="reveal mt-1">{children}</div> : null}
    </section>
  );
}

/** A long facet list (841 manufacturers, 2,017 molecules) needs its own search. */
function Searchable({
  facets,
  selected,
  onToggle,
  placeholder,
  initial = 6,
  labelFor,
}: {
  facets: Facet[];
  selected: string[];
  onToggle: (value: string) => void;
  placeholder: string;
  initial?: number;
  labelFor?: (value: string) => string;
}) {
  const [term, setTerm] = useState("");
  const [expanded, setExpanded] = useState(false);
  const label = (value: string) => labelFor?.(value) ?? LABELS[value] ?? value;

  const filtered = useMemo(() => {
    const lower = term.toLowerCase().trim();
    const text = (value: string) => (labelFor?.(value) ?? LABELS[value] ?? value).toLowerCase();
    const base = lower
      ? facets.filter((f) => f.value.toLowerCase().includes(lower) || text(f.value).includes(lower))
      : facets;
    // Selected values stay visible even when they fall outside the top slice.
    const chosen = facets.filter((f) => selected.includes(f.value));
    const rest = base.filter((f) => !selected.includes(f.value));
    return [...chosen, ...rest];
  }, [facets, term, selected, labelFor]);

  const visible = expanded || term ? filtered.slice(0, 80) : filtered.slice(0, initial);
  const hidden = filtered.length - visible.length;

  return (
    <>
      {facets.length > initial ? (
        <div className="field-shell mx-1 mb-1.5" style={{ height: 30 }}>
          <SearchIcon size={13} strokeWidth={1.9} className="shrink-0" style={{ color: "var(--ink-4)" }} />
          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={placeholder}
            className="t-sm"
            spellCheck={false}
          />
          {term ? (
            <button type="button" onClick={() => setTerm("")} aria-label="Clear" style={{ color: "var(--ink-4)" }}>
              <X size={13} strokeWidth={2} />
            </button>
          ) : null}
        </div>
      ) : null}

      {visible.map((facet) => (
        <Facet
          key={facet.value}
          label={label(facet.value)}
          count={facet.count}
          on={selected.includes(facet.value)}
          tone={TONES[facet.value]}
          onToggle={() => onToggle(facet.value)}
        />
      ))}

      {!term && hidden > 0 ? (
        <button type="button" onClick={() => setExpanded(true)} className="more">
          Show {hidden.toLocaleString()} more
          <ChevronDown size={13} strokeWidth={2.2} />
        </button>
      ) : null}

      {!term && expanded && filtered.length > initial ? (
        <button type="button" onClick={() => setExpanded(false)} className="more" style={{ color: "var(--ink-3)" }}>
          Show fewer
        </button>
      ) : null}

      {term && !filtered.length ? (
        <p className="t-sm px-2 py-2" data-depth="1">
          No match for “{term}”.
        </p>
      ) : null}
    </>
  );
}

export function FilterRail({
  facets,
  filters,
  flagMeta,
  onChange,
  total,
}: {
  facets: FacetSet;
  filters: Filters;
  flagMeta: FlagMeta[];
  onChange: (next: Filters) => void;
  total: number;
}) {
  const flagLabel = useMemo(() => new Map(flagMeta.map((f) => [f.key, f.label])), [flagMeta]);
  const flagGroup = useMemo(() => new Map(flagMeta.map((f) => [f.key, f.group])), [flagMeta]);

  const toggle = (key: keyof Omit<Filters, "scope">, value: string) => {
    const current = filters[key];
    onChange({
      ...filters,
      [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
    });
  };

  const groupKeys = ["aware", "stock", "expiry", "flags", "form", "maker", "molecule", "qt"] as const;
  const activeCount =
    groupKeys.reduce((sum, key) => sum + filters[key].length, 0) + (filters.scope === "stocked" ? 1 : 0);

  const labelOf = (key: (typeof groupKeys)[number], value: string) =>
    key === "flags" ? (flagLabel.get(value) ?? value) : (LABELS[value] ?? value);

  const stockedCount = facets.stock.reduce((sum, facet) => sum + facet.count, 0);

  const order = (list: Facet[], sequence: string[]) =>
    [...list].sort((a, b) => sequence.indexOf(a.value) - sequence.indexOf(b.value));

  const flagsIn = (group: string) => facets.flags.filter((f) => flagGroup.get(f.value) === group);
  const countIn = (group: string) => filters.flags.filter((f) => flagGroup.get(f) === group).length;

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-(--line) pb-2.5">
        <span className="t-label flex-1" style={{ color: "var(--ink)" }}>
          Filters
        </span>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="act act-quiet act-sm"
          >
            <RotateCcw size={13} strokeWidth={1.9} />
            Reset
          </button>
        ) : (
          <span className="t-xs t-num" data-depth="1">
            {total.toLocaleString()} results
          </span>
        )}
      </div>

      {/* Active filters as removable chips — the fastest way to see and undo
          what is currently narrowing the set. */}
      {activeCount > 0 ? (
        <div className="reveal flex flex-wrap gap-1.5 border-b border-(--line-soft) py-2.5">
          {filters.scope === "stocked" ? (
            <Chip label="Stocked here" onRemove={() => onChange({ ...filters, scope: "all" })} />
          ) : null}
          {groupKeys.flatMap((key) =>
            filters[key].map((value) => (
              <Chip
                key={`${key}-${value}`}
                label={labelOf(key, value)}
                tone={TONES[value]}
                onRemove={() => toggle(key, value)}
              />
            )),
          )}
        </div>
      ) : null}

      <div className="pt-2.5">
        <Group title="Scope">
          <div role="radiogroup" aria-label="Scope">
            <Facet
              radio
              label="Whole catalogue"
              on={filters.scope === "all"}
              onToggle={() => onChange({ ...filters, scope: "all" })}
            />
            <Facet
              radio
              label="Stocked at this branch"
              count={stockedCount}
              on={filters.scope === "stocked"}
              onToggle={() => onChange({ ...filters, scope: "stocked" })}
            />
          </div>
        </Group>

        <Group title="AWaRe class" count={filters.aware.length || undefined}>
          {order(facets.aware, AWARE_ORDER).map((facet) => (
            <Facet
              key={facet.value}
              label={LABELS[facet.value] ?? facet.value}
              count={facet.count}
              on={filters.aware.includes(facet.value)}
              tone={TONES[facet.value]}
              onToggle={() => toggle("aware", facet.value)}
            />
          ))}
        </Group>

        <Group title="Shelf state" count={filters.stock.length || undefined}>
          {order(facets.stock, STOCK_ORDER).map((facet) => (
            <Facet
              key={facet.value}
              label={LABELS[facet.value] ?? facet.value}
              count={facet.count}
              on={filters.stock.includes(facet.value)}
              tone={TONES[facet.value]}
              onToggle={() => toggle("stock", facet.value)}
            />
          ))}
        </Group>

        <Group title="Expiry" count={filters.expiry.length || undefined}>
          {order(facets.expiry, EXPIRY_ORDER).map((facet) => (
            <Facet
              key={facet.value}
              label={LABELS[facet.value] ?? facet.value}
              count={facet.count}
              on={filters.expiry.includes(facet.value)}
              tone={TONES[facet.value]}
              onToggle={() => toggle("expiry", facet.value)}
            />
          ))}
        </Group>

        {flagsIn("risk").length ? (
          <Group title="Risk" count={countIn("risk") || undefined}>
            {flagsIn("risk").map((facet) => (
              <Facet
                key={facet.value}
                label={flagLabel.get(facet.value) ?? facet.value}
                count={facet.count}
                on={filters.flags.includes(facet.value)}
                tone={TONES[facet.value] ?? "var(--danger)"}
                onToggle={() => toggle("flags", facet.value)}
              />
            ))}
          </Group>
        ) : null}

        <Group title="QT risk" count={filters.qt.length || undefined} defaultOpen={false}>
          {order(facets.qt, ["high", "moderate"]).map((facet) => (
            <Facet
              key={facet.value}
              label={LABELS[facet.value] ?? facet.value}
              count={facet.count}
              on={filters.qt.includes(facet.value)}
              tone={TONES[facet.value]}
              onToggle={() => toggle("qt", facet.value)}
            />
          ))}
        </Group>

        <Group title="Therapeutic class" count={countIn("therapeutic") || undefined}>
          <Searchable
            facets={flagsIn("therapeutic")}
            selected={filters.flags}
            onToggle={(value) => toggle("flags", value)}
            labelFor={(value) => flagLabel.get(value) ?? value}
            placeholder="Find a class"
            initial={8}
          />
        </Group>

        <Group title="Interaction profile" count={countIn("interaction") || undefined} defaultOpen={false}>
          <Searchable
            facets={flagsIn("interaction")}
            selected={filters.flags}
            onToggle={(value) => toggle("flags", value)}
            labelFor={(value) => flagLabel.get(value) ?? value}
            placeholder="Find a profile"
            initial={6}
          />
        </Group>

        <Group title="Dosage form" count={filters.form.length || undefined} defaultOpen={false}>
          <Searchable
            facets={facets.form}
            selected={filters.form}
            onToggle={(value) => toggle("form", value)}
            placeholder="Find a form"
          />
        </Group>

        <Group title="Molecule" count={filters.molecule.length || undefined} defaultOpen={false}>
          <Searchable
            facets={facets.molecule}
            selected={filters.molecule}
            onToggle={(value) => toggle("molecule", value)}
            placeholder="Find a molecule"
          />
        </Group>

        <Group title="Manufacturer" count={filters.maker.length || undefined} defaultOpen={false}>
          <Searchable
            facets={facets.maker}
            selected={filters.maker}
            onToggle={(value) => toggle("maker", value)}
            placeholder="Find a manufacturer"
          />
        </Group>
      </div>
    </div>
  );
}

function Chip({ label, tone, onRemove }: { label: string; tone?: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-full border px-2 text-[11.5px] font-medium"
      style={{
        borderColor: "var(--primary-line)",
        background: "var(--primary-soft)",
        color: "var(--primary-deep)",
      }}
    >
      {tone ? (
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tone }} />
      ) : null}
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
      >
        <X size={12} strokeWidth={2.4} />
      </button>
    </span>
  );
}
