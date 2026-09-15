import { StockView } from "@/components/stock-view";
import { Fact, FactRow, Shell } from "@/components/shell";
import { getCatalogueMeta } from "@/lib/catalogue";
import { getStock } from "@/lib/stock";
import { getTenant } from "@/lib/tenant";
import { compact } from "@/components/primitives";

export const metadata = {
  title: "Stock · Dispensia",
};

/**
 * The shelf.
 *
 * Separate from the catalogue now, because they stopped being the same data:
 * the catalogue is the shared reference every pharmacy reads, and this is what
 * this organisation has actually bought. A new pharmacy therefore opens this
 * screen empty, which is correct — it has not received anything yet.
 */
export default async function StockPage() {
  const tenant = await getTenant();
  const { lines, summary } = await getStock();
  const meta = getCatalogueMeta();

  return (
    <Shell
      fill
      title="Stock"
      meta={
        <>
          <span className="t-sm" data-depth="2">
            <span className="t-num font-semibold" style={{ color: "var(--ink)" }}>
              {summary.lines.toLocaleString()}
            </span>{" "}
            lines held
          </span>
          <span className="t-sm" data-depth="1">
            {tenant.organisation.name}
            {tenant.branches.length > 1 ? ` · ${tenant.branches.length} branches` : ""}
          </span>
          <span className="t-sm" data-depth="0">
            from {compact(meta.total)} catalogue products
          </span>
        </>
      }
    >
      <div className="mb-3">
        <FactRow cols={6}>
          <Fact label="Lines held" value={summary.lines.toLocaleString()} note="distinct batches" depth="4" />
          <Fact label="Units on hand" value={compact(summary.units)} note="across all lines" />
          <Fact
            label="Value at cost"
            value={`PKR ${compact(summary.valueAtCost)}`}
            note="what the shelf is worth"
          />
          <Fact
            label="Need reorder"
            value={summary.needsReorder.toLocaleString()}
            note="at or below the trigger"
            tone={summary.needsReorder ? "var(--warn)" : undefined}
          />
          <Fact
            label="Expiring soon"
            value={summary.expiringSoon.toLocaleString()}
            note="within 90 days"
            tone={summary.expiringSoon ? "var(--warn)" : undefined}
          />
          <Fact
            label="Expired"
            value={summary.expired.toLocaleString()}
            note="quarantine these"
            tone={summary.expired ? "var(--danger)" : undefined}
          />
        </FactRow>
      </div>

      <StockView
        lines={lines}
        branches={tenant.branches}
        organisation={tenant.organisation.name}
        flagMeta={meta.flags}
      />
    </Shell>
  );
}
