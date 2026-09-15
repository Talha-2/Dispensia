import type { ReactNode } from "react";
import { CommandField } from "@/components/command";
import { Rail, RailStrip } from "@/components/rail";
import { BranchSwitcher } from "@/components/switchers";
import { query } from "@/lib/catalogue";
import { getPatients } from "@/lib/records";
import { getStock } from "@/lib/stock";
import { getTenant } from "@/lib/tenant";

/** Initials for the avatar, from whatever name the account actually carries. */
function monogram(name: string) {
  const parts = name.split(/[\s.]+/).filter(Boolean);
  if (!parts.length) return "??";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : (parts[0][1] ?? "");
  return `${first}${last}`.toUpperCase();
}

/**
 * The frame every screen rides on: a fixed nav rail carrying live branch
 * counts, a header holding the one command field that addresses everything,
 * and a page head that names the surface and states its scale before any
 * controls appear.
 */
export async function Shell({
  title,
  meta,
  actions,
  children,
  fill = false,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /**
   * Locks the page to the viewport: nothing scrolls except the region that opts
   * in. Used by the catalogue, where paging is the way through the data and a
   * page scrollbar just means you have two scrollbars fighting each other.
   */
  fill?: boolean;
}) {
  const tenant = await getTenant();
  const [patients, stock] = await Promise.all([getPatients(), getStock()]);

  // Reserve and controlled are catalogue facts — how many such products exist.
  // Everything else is this shelf, and reads zero until something is received.
  const reserve = query({ aware: ["RESERVE"], size: 1 });
  const controlled = query({ flags: ["controlled"], size: 1 });
  const all = query({ size: 1 });

  const counts = {
    reorder: stock.summary.needsReorder,
    expiring: stock.summary.expiringSoon,
    reserve: reserve.total,
    controlled: controlled.total,
    stocked: stock.summary.lines,
    total: all.total,
  };

  return (
    <div className={fill ? "h-screen overflow-hidden" : "min-h-screen"}>
      <Rail
        counts={counts}
        organisation={tenant.organisation.name}
        branch={tenant.currentBranch.name}
      />

      <div
        className={`lg:pl-[var(--rail-width,var(--rail))] ${fill ? "flex h-screen flex-col overflow-hidden" : ""}`}
      >
        {/* The header is fixed for the session — search and identity never
            scroll away, because they are the two things reached for mid-task. */}
        <header
          className="no-print sticky top-0 z-30 border-b border-(--line)"
          style={{ background: "color-mix(in srgb, var(--surface) 88%, transparent)", backdropFilter: "blur(10px)" }}
        >
          <div className="flex h-[var(--header)] items-center gap-4 px-4 lg:px-6">
            <div className="min-w-0 flex-1">
              <CommandField patients={patients} />
            </div>

            <div className="hidden items-center gap-4 md:flex">
              {/* Which branch this shift is on. The pharmacy itself is named on
                  the wordmark, where the switch between pharmacies lives; the
                  DEMO mark stays here because whether the data is real is the
                  one thing a pharmacist must never have to guess. */}
              {tenant.isDemo ? <span className="cell cell-watch-soft">DEMO</span> : null}

              <BranchSwitcher branches={tenant.branches} current={tenant.currentBranch} />
              <span
                aria-hidden="true"
                className="h-5 w-px shrink-0"
                style={{ background: "var(--line)" }}
              />
              <span className="t-sm" data-depth="1">
                Mon 14 Sep 2026
              </span>
              <span
                aria-hidden="true"
                className="h-5 w-px shrink-0"
                style={{ background: "var(--line)" }}
              />
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[11.5px] font-semibold"
                  style={{
                    background: "linear-gradient(180deg, var(--primary), var(--primary-deep))",
                    color: "var(--on-primary)",
                    boxShadow: "var(--shadow-xs)",
                  }}
                >
                  {monogram(tenant.signedInAs ?? "A. Yousaf")}
                </span>
                <span className="leading-tight">
                  <span className="block text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
                    {tenant.signedInAs ?? "A. Yousaf"}
                  </span>
                  <span className="block text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                    {tenant.needsOnboarding ? "No organisation yet" : "Pharmacist on duty"}
                  </span>
                </span>
              </span>
            </div>
          </div>
          <RailStrip />
        </header>

        <main
          className={
            fill
              ? "flex min-h-0 flex-1 flex-col px-4 pb-4 pt-4 lg:px-6"
              : "px-4 pb-16 pt-5 lg:px-6"
          }
        >
          <div className={`flex flex-wrap items-end gap-x-6 gap-y-3 ${fill ? "mb-3" : "mb-4"}`}>
            <div className="min-w-0">
              <h1 className="t-display-lg">{title}</h1>
              {meta ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">{meta}</div>
              ) : null}
            </div>
            {actions ? (
              <div className="no-print ml-auto flex flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </div>

          {fill ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : children}
        </main>
      </div>
    </div>
  );
}

/**
 * One figure with its label. Grouped on a single panel rather than scattered
 * across identical cards, so the row reads as one summary instead of six boxes.
 */
export function Fact({
  label,
  value,
  note,
  depth = "3",
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  depth?: "1" | "2" | "3" | "4";
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="t-label truncate">{label}</div>
      <div className="t-stat mt-1" data-depth={depth} style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {note ? (
        <div className="t-sm mt-0.5 truncate" data-depth="1">
          {note}
        </div>
      ) : null}
    </div>
  );
}

/** The container the Fact row sits in — one panel, not a row of cards. */
export function FactRow({ children, cols = 6 }: { children: ReactNode; cols?: 5 | 6 | 7 }) {
  const wide = { 5: "lg:grid-cols-5", 6: "lg:grid-cols-6", 7: "lg:grid-cols-7" }[cols];
  return (
    <section className={`panel grid grid-cols-2 gap-x-6 gap-y-5 p-4 sm:grid-cols-3 ${wide}`}>
      {children}
    </section>
  );
}
