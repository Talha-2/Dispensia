import { Fact, FactRow, Shell } from "@/components/shell";
import { compact, pkr } from "@/components/primitives";
import { getCatalogueMeta, query, stockAggregates } from "@/lib/catalogue";

export const metadata = {
  title: "Reports · Dispensia",
};

const AWARE_TONE: Record<string, string> = {
  ACCESS: "var(--ok)",
  WATCH: "var(--warn)",
  RESERVE: "var(--danger)",
  NA: "var(--ink-3)",
};

/** A bar is a run of ink on a baseline. No axes, no gridlines, no chart chrome. */
function Bar({
  label,
  value,
  max,
  right,
  tone,
  sub,
  depth = "2",
}: {
  label: string;
  value: number;
  max: number;
  right: string;
  tone?: string;
  sub?: string;
  depth?: "1" | "2" | "3" | "4";
}) {
  return (
    <div className="baseline flex items-center gap-3 py-1">
      <span className="min-w-0 flex-1">
        <span className="t-data block truncate" data-depth={depth}>
          {label}
        </span>
        {sub ? (
          <span className="t-data block truncate" data-depth="0">
            {sub}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className="hidden h-2 shrink-0 sm:block"
        style={{
          width: `${Math.max(2, (value / Math.max(max, 1)) * 200)}px`,
          background: tone ?? "var(--ink-2)",
        }}
      />
      <span className="t-data t-num w-24 shrink-0 text-right" data-depth="3" style={tone ? { color: tone } : undefined}>
        {right}
      </span>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="panel min-w-0 overflow-hidden">
      <div
        className="baseline-strong flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
        style={{ background: "var(--surface-sunk)" }}
      >
        <h2 className="t-label flex-1">{title}</h2>
        {note ? (
          <span className="t-sm" data-depth="1">
            {note}
          </span>
        ) : null}
      </div>
      <div className="px-4 pb-3 pt-1">{children}</div>
    </section>
  );
}

export default function ReportsPage() {
  const meta = getCatalogueMeta();
  const totals = stockAggregates();
  const stocked = query({ scope: "stocked", size: 1 });

  const makerMax = totals.makers[0]?.[1].value ?? 1;
  const formMax = totals.forms[0]?.[1].value ?? 1;
  const awareOrder = ["RESERVE", "WATCH", "ACCESS", "NA"];
  const awareRows = awareOrder
    .map((key) => [key, totals.aware.find(([k]) => k === key)?.[1]] as const)
    .filter((row): row is readonly [string, { lines: number; units: number; value: number }] => Boolean(row[1]));
  const awareMax = Math.max(...awareRows.map(([, stats]) => stats.value), 1);
  const marginMax = Math.max(...totals.marginBands.map((b) => b.lines), 1);
  const thinMargin = totals.marginBands[0].lines + totals.marginBands[1].lines;

  return (
    <Shell
      title="Reports"
      meta={
        <>
          <span className="t-data" data-depth="1">
            every figure computed over all {stocked.total.toLocaleString()} stocked lines
          </span>
          <span className="t-data" data-depth="0">
            catalogue built {meta.generatedAt.slice(0, 10)}
          </span>
        </>
      }
      actions={
        <button type="button" className="act">
          Export CSV
        </button>
      }
    >
      <FactRow>
        <Fact label="Stock at cost" value={`PKR ${compact(Math.round(totals.cost))}`} note="purchase value" />
        <Fact label="Stock at retail" value={`PKR ${compact(Math.round(totals.retail))}`} note="if it all sold" />
        <Fact
          label="Blended margin"
          value={`${totals.margin.toFixed(1)}%`}
          note="weighted by holding"
          depth="4"
          tone="var(--warn)"
        />
        <Fact label="Lines held" value={totals.lines.toLocaleString()} note={`${compact(totals.units)} units`} />
        <Fact
          label="Thin-margin lines"
          value={thinMargin.toLocaleString()}
          note="under 10% or at a loss"
          tone={thinMargin ? "var(--danger)" : undefined}
        />
        <Fact label="Suppliers" value={String(totals.makers.length)} note={`of ${meta.facets.makers.length} known`} />
      </FactRow>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Section title="Holding by manufacturer" note="top 8 by value at cost">
          {totals.makers.slice(0, 8).map(([maker, stats]) => (
            <Bar
              key={maker}
              label={maker}
              sub={`${stats.lines} lines · ${compact(stats.units)} units`}
              value={stats.value}
              max={makerMax}
              right={`PKR ${compact(Math.round(stats.value))}`}
            />
          ))}
        </Section>

        <Section title="AWaRe stewardship mix" note="WHO classification, by holding value">
          {awareRows.map(([key, stats]) => (
            <Bar
              key={key}
              label={key === "NA" ? "Not an antibiotic" : key}
              sub={`${stats.lines} lines · ${compact(stats.units)} units`}
              value={stats.value}
              max={awareMax}
              tone={AWARE_TONE[key]}
              right={`PKR ${compact(Math.round(stats.value))}`}
              depth={key === "RESERVE" || key === "WATCH" ? "3" : "2"}
            />
          ))}
          <p className="t-prose mt-3 max-w-[62ch]" data-depth="2">
            Reserve and Watch antibiotics are{" "}
            <span className="t-num" data-depth="3">
              {(
                ((awareRows.find(([k]) => k === "RESERVE")?.[1].value ?? 0) +
                  (awareRows.find(([k]) => k === "WATCH")?.[1].value ?? 0)) /
                  Math.max(totals.cost, 1) *
                100
              ).toFixed(1)}
              %
            </span>{" "}
            of holding value. A rising share is the early signal that this branch is dispensing second-line
            antibiotics where a first-line one would do.
          </p>
        </Section>

        <Section title="Expiry exposure" note="what is at risk, and when">
          {totals.expiryBands.map((band, index) => (
            <Bar
              key={band.label}
              label={band.label}
              sub={`${band.lines} lines`}
              value={band.value}
              max={Math.max(...totals.expiryBands.map((b) => b.value), 1)}
              tone={index === 0 ? "var(--danger)" : index === 1 ? "var(--warn)" : "var(--ink-2)"}
              right={`PKR ${compact(Math.round(band.value))}`}
              depth={index < 2 ? "3" : "2"}
            />
          ))}
          <p className="t-prose mt-3 max-w-[62ch]" data-depth="2">
            PKR{" "}
            <span className="t-num" style={{ color: "var(--danger)" }}>
              {pkr(Math.round(totals.expiryBands[0].value))}
            </span>{" "}
            is already unsellable. Another PKR{" "}
            <span className="t-num" style={{ color: "var(--warn)" }}>
              {pkr(Math.round(totals.expiryBands[1].value))}
            </span>{" "}
            has thirty days left to move.
          </p>
        </Section>

        <Section title="Margin distribution" note="lines by retail margin band">
          {totals.marginBands.map((band, index) => (
            <Bar
              key={band.label}
              label={band.label}
              value={band.lines}
              max={marginMax}
              tone={index === 0 ? "var(--danger)" : index === 1 ? "var(--warn)" : "var(--ok)"}
              right={`${band.lines} lines`}
              depth={index < 2 ? "3" : "2"}
            />
          ))}
          <p className="t-prose mt-3 max-w-[62ch]" data-depth="2">
            Retail and cost price are both carried on every product record, so margin is a fact about the
            catalogue rather than an estimate. Anything under ten percent barely covers the cost of holding it.
          </p>
        </Section>

        <Section title="Holding by dosage form" note="top 8 by value">
          {totals.forms.slice(0, 8).map(([form, stats]) => (
            <Bar
              key={form}
              label={form}
              sub={`${stats.lines} lines`}
              value={stats.value}
              max={formMax}
              right={`PKR ${compact(Math.round(stats.value))}`}
            />
          ))}
        </Section>

        <Section title="Catalogue reach" note="what this branch could sell but does not stock">
          <Bar
            label="Stocked here"
            value={stocked.total}
            max={meta.total}
            right={stocked.total.toLocaleString()}
            tone="var(--warn)"
            depth="3"
            sub={`${((stocked.total / meta.total) * 100).toFixed(1)}% of the national catalogue`}
          />
          <Bar
            label="Available to order"
            value={meta.total - stocked.total}
            max={meta.total}
            right={(meta.total - stocked.total).toLocaleString()}
            sub={`across ${meta.facets.makers.length} manufacturers`}
          />
          <p className="t-prose mt-3 max-w-[62ch]" data-depth="2">
            Every product the counter cannot find on the shelf is still addressable in the catalogue, with its
            price, its AWaRe class and its counselling duty attached. A missed sale is a line to order, not a
            dead end.
          </p>
        </Section>
      </div>
    </Shell>
  );
}
