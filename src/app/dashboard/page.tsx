import Link from "next/link";
import { Fact, FactRow, Shell } from "@/components/shell";
import { Markers, Meter, compact, pkr } from "@/components/primitives";
import { daysToExpiry, stockAggregates, stockState } from "@/lib/catalogue";
import { getStockAsQuery } from "@/lib/stock";
import { RULES } from "@/lib/safety";

export const metadata = {
  title: "Overview · Dispensia",
};

/** A queue, not a card: a heading on a baseline and rows running to the edge. */
function Queue({
  title,
  note,
  href,
  children,
  count,
  tone,
}: {
  title: string;
  note: string;
  href: string;
  children: React.ReactNode;
  count: number;
  tone?: string;
}) {
  return (
    <section className="panel flex min-w-0 flex-col overflow-hidden">
      <div
        className="baseline-strong px-3 py-2.5"
        style={{ background: "var(--surface-sunk)" }}
      >
        <div className="flex items-center gap-2">
          <h2 className="t-label flex-1 truncate">{title}</h2>
          <span
            className="t-sm t-num font-semibold"
            style={{ color: count ? (tone ?? "var(--ink)") : "var(--ink-3)" }}
          >
            {count.toLocaleString()}
          </span>
          <Link href={href} className="t-sm" data-depth="4">
            Open
          </Link>
        </div>
        <p className="t-sm mt-0.5" data-depth="1">
          {note}
        </p>
      </div>
      <div className="flex-1 px-3">{children}</div>
    </section>
  );
}

export default async function DashboardPage() {
  // This pharmacy's own shelf. Every count below reads zero for one that has
  // received nothing, which is the honest answer rather than a demonstration.
  const shelf = await getStockAsQuery();
  const stocked = { total: shelf.total, summary: shelf.summary };
  const totals = stockAggregates();

  const expired = { total: shelf.expired.length, items: shelf.expired.slice(0, 6) };
  const critical = { total: shelf.short.length, items: shelf.short.slice(0, 6) };
  const expiring = { total: shelf.expiringSoon.length, items: shelf.expiringSoon.slice(0, 6) };
  const reserve = { total: shelf.watched.length, items: shelf.watched.slice(0, 6) };

  const urgent = expired.total + critical.total;

  return (
    <Shell
      title="Overview"
      meta={
        <>
          <span className="t-data" data-depth="1">
            Main Branch · opened 09:00
          </span>
          <span className="t-data" data-depth="1">
            <span className="t-num" data-depth="2">
              {RULES.length}
            </span>{" "}
            rules armed
          </span>
        </>
      }
      actions={
        <Link href="/dispensing" className="act act-primary">
          Open the counter
        </Link>
      }
    >
      {/* ── What needs the pharmacist now. The front plane. ────────────── */}
      {urgent > 0 ? (
        <div className="band" data-sev={expired.total ? "block" : "conflict"} style={{ padding: "14px 16px" }}>
          <p className="t-label">Needs you now</p>
          <p
            className="t-display mt-1"
            style={{ color: expired.total ? "var(--danger)" : "var(--warn)" }}
          >
            {expired.total > 0
              ? `${expired.total} expired ${expired.total === 1 ? "line is" : "lines are"} still on the shelf`
              : `${critical.total} lines are at or below critical`}
          </p>
          <p className="t-prose mt-1.5 max-w-[80ch]" data-depth="2">
            {expired.total > 0
              ? "Expired stock must be pulled and quarantined before it can reach a counter. The dispensing engine will not let it through, but it should not be on the shelf at all."
              : "These lines will run out during today's trading if nothing is ordered."}
          </p>
        </div>
      ) : null}

      {/* ── Position ───────────────────────────────────────────────────── */}
      <div className="mt-4">
        <FactRow>
        <Fact label="Lines held" value={stocked.total.toLocaleString()} note={`of ${compact(10434)} in catalogue`} />
        <Fact label="Units on shelf" value={compact(totals.units)} note="every stocked line" />
        <Fact label="Holding at cost" value={`PKR ${compact(Math.round(totals.cost))}`} note="purchase value" />
        <Fact
          label="Retail value"
          value={`PKR ${compact(Math.round(totals.retail))}`}
          note={`${totals.margin.toFixed(1)}% blended margin`}
        />
        <Fact
          label="Needs reorder"
          value={stocked.summary.needsReorder.toLocaleString()}
          note="at or below level"
          tone={stocked.summary.needsReorder ? "var(--warn)" : undefined}
          depth="4"
        />
        <Fact
          label="Expiry exposure"
          value={`PKR ${compact(Math.round(totals.expiryBands[0].value + totals.expiryBands[1].value))}`}
          note="expired or within 30 days"
          tone="var(--danger)"
        />
        </FactRow>
      </div>

      {/* ── Queues ─────────────────────────────────────────────────────── */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Queue
          title="Pull from shelf"
          note="Past expiry — quarantine and destroy"
          href="/catalogue?scope=stocked&expiry=expired"
          count={expired.total}
          tone="var(--danger)"
        >
          {expired.items.length ? (
            expired.items.map((medicine) => {
              const days = daysToExpiry(medicine);
              return (
                <div key={medicine.id} className="baseline flex items-start gap-2 py-1.5">
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
                      {medicine.stock?.batch} · {medicine.stock?.shelf}
                    </span>
                  </span>
                  <span className="t-data t-num shrink-0 text-right" style={{ color: "var(--danger)" }}>
                    {days !== null ? `${Math.abs(days)}d` : "—"}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="t-data py-2" data-depth="1">
              Nothing on the shelf is past its expiry.
            </p>
          )}
        </Queue>

        <Queue
          title="Order today"
          note="Out of stock or critically low"
          href="/catalogue?scope=stocked&stock=out,critical"
          count={critical.total}
          tone="var(--warn)"
        >
          {critical.items.map((medicine) => {
            const state = stockState(medicine);
            return (
              <div key={medicine.id} className="baseline flex items-start gap-2 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="t-data block truncate" data-depth="3">
                    {medicine.short}
                    {medicine.strength ? (
                      <span className="t-num ml-1" data-depth="2">
                        {medicine.strength}
                      </span>
                    ) : null}
                  </span>
                  <span className="t-data mt-0.5 flex items-center gap-2">
                    {medicine.stock && state ? (
                      <Meter value={medicine.stock.onHand} of={medicine.stock.reorder} tone={state} />
                    ) : null}
                    <span className="t-num" data-depth="1">
                      {medicine.stock?.onHand}/{medicine.stock?.reorder}
                    </span>
                  </span>
                </span>
              </div>
            );
          })}
        </Queue>

        <Queue
          title="Move first"
          note="Expiring inside 90 days — sell down"
          href="/catalogue?scope=stocked&expiry=expiring"
          count={expiring.total}
          tone="var(--warn)"
        >
          {expiring.items.map((medicine) => {
            const days = daysToExpiry(medicine);
            return (
              <div key={medicine.id} className="baseline flex items-start gap-2 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="t-data block truncate" data-depth="3">
                    {medicine.short}
                  </span>
                  <span className="t-data block truncate" data-depth="1">
                    {medicine.stock?.onHand} units · PKR{" "}
                    {pkr((medicine.stock?.onHand ?? 0) * medicine.cost)} at cost
                  </span>
                </span>
                <span className="t-data t-num shrink-0" style={{ color: "var(--warn)" }}>
                  {days}d
                </span>
              </div>
            );
          })}
        </Queue>

        <Queue
          title="Stewardship"
          note="Watch and Reserve antibiotics on the shelf"
          href="/catalogue?scope=stocked&aware=WATCH,RESERVE"
          count={reserve.total}
        >
          {reserve.items.map((medicine) => (
            <div key={medicine.id} className="baseline flex items-start gap-2 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="t-data block truncate" data-depth="3">
                  {medicine.short}
                </span>
                <span className="t-data block truncate" data-depth="1">
                  {medicine.molecule}
                </span>
              </span>
              <Markers medicine={medicine} />
            </div>
          ))}
        </Queue>
      </div>

      {/* ── Where the money sits ───────────────────────────────────────── */}
      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <section className="panel min-w-0 overflow-hidden">
          <div
            className="baseline-strong flex items-center gap-2 px-3 py-2.5"
            style={{ background: "var(--surface-sunk)" }}
          >
            <h2 className="t-label flex-1">Holding by manufacturer</h2>
            <Link href="/reports" className="t-sm" data-depth="4">
              Reports
            </Link>
          </div>
          {totals.makers.slice(0, 8).map(([maker, stats]) => {
            const share = (stats.value / totals.cost) * 100;
            return (
              <div key={maker} className="baseline row flex items-center gap-3 px-3 py-1.5">
                <span className="t-data min-w-0 flex-1 truncate" data-depth="2">
                  {maker}
                </span>
                <span
                  aria-hidden="true"
                  className="hidden h-2 shrink-0 sm:block"
                  style={{ width: `${Math.max(2, share * 4)}px`, maxWidth: 160, background: "var(--ink-2)" }}
                />
                <span className="t-data t-num w-10 shrink-0 text-right" data-depth="1">
                  {stats.lines}
                </span>
                <span className="t-data t-num w-20 shrink-0 text-right" data-depth="3">
                  {compact(Math.round(stats.value))}
                </span>
              </div>
            );
          })}
        </section>

        <section className="panel min-w-0 overflow-hidden">
          <div
            className="baseline-strong flex items-center gap-2 px-3 py-2.5"
            style={{ background: "var(--surface-sunk)" }}
          >
            <h2 className="t-label flex-1">Expiry exposure</h2>
            <span className="t-sm" data-depth="1">
              value at cost
            </span>
          </div>
          {totals.expiryBands.map((band, index) => {
            const max = Math.max(...totals.expiryBands.map((b) => b.value));
            const tone = index === 0 ? "var(--danger)" : index === 1 ? "var(--warn)" : "var(--ink-4)";
            return (
              <div key={band.label} className="baseline row flex items-center gap-3 px-3 py-1.5">
                <span className="t-data w-[124px] shrink-0" data-depth={index < 2 ? "3" : "2"}>
                  {band.label}
                </span>
                <span
                  aria-hidden="true"
                  className="h-2 shrink-0"
                  style={{ width: `${Math.max(2, (band.value / max) * 180)}px`, background: tone }}
                />
                <span className="t-data t-num w-10 shrink-0 text-right" data-depth="1">
                  {band.lines}
                </span>
                <span
                  className="t-data t-num ml-auto shrink-0 text-right"
                  data-depth="3"
                  style={index < 2 ? { color: tone } : undefined}
                >
                  PKR {compact(Math.round(band.value))}
                </span>
              </div>
            );
          })}
        </section>
      </div>
    </Shell>
  );
}
