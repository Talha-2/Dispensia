"use client";

import { useEffect, useState } from "react";
import { Identity, Markers, Meter, pkr, STOCK_LABEL } from "@/components/primitives";
import type { ExpiryState, FlagMeta, Medicine, StockState } from "@/lib/types";

type Detail = {
  medicine: Medicine;
  counsel: string | null;
  margin: number | null;
  stockState: StockState | null;
  expiryState: ExpiryState | null;
  daysToExpiry: number | null;
  alternatives: (Medicine & { stockState: StockState | null })[];
};

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="baseline flex items-baseline gap-3 py-1">
      <span className="t-data w-[104px] shrink-0" data-depth="1">
        {label}
      </span>
      <span className="t-data min-w-0 flex-1" data-depth="2">
        {children}
      </span>
    </div>
  );
}

/**
 * The product plane. A panel, not a modal — the pharmacist keeps the result set
 * in view while they read, because the next thing they do is usually compare.
 */
export function ProductPanel({
  id,
  flagMeta,
  onClose,
  onAdd,
}: {
  id: string;
  flagMeta: FlagMeta[];
  onClose: () => void;
  onAdd?: (medicine: Medicine) => void;
}) {
  // Keyed by the id it was fetched for, so switching products shows the loading
  // state by derivation rather than by writing null back into state.
  const [loaded, setLoaded] = useState<{ id: string; detail?: Detail; failed?: boolean } | null>(null);
  const detail = loaded?.id === id ? loaded.detail : undefined;
  const error = loaded?.id === id && loaded.failed;

  useEffect(() => {
    let alive = true;
    fetch(`/api/product/${encodeURIComponent(id)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("not found"))))
      .then((data: Detail) => alive && setLoaded({ id, detail: data }))
      .catch(() => alive && setLoaded({ id, failed: true }));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const labelOf = (key: string) => flagMeta.find((f) => f.key === key)?.label ?? key;

  return (
    <aside
      aria-label="Product detail"
      className="panel flex h-full min-h-0 flex-col overflow-y-auto p-4"
    >
      <div className="baseline-strong flex h-7 items-center gap-2 pb-1">
        <span className="t-label flex-1" style={{ color: "var(--ink)" }}>
          Product
        </span>
        <button type="button" onClick={onClose} className="t-data" data-depth="1" aria-label="Close product detail">
          close ✕
        </button>
      </div>

      {error ? (
        <p className="t-data py-6" data-depth="2">
          That product is no longer in the catalogue.
        </p>
      ) : !detail ? (
        <p className="t-data blink py-6" data-depth="1">
          loading···
        </p>
      ) : (
        <>
          <div className="py-3">
            <p className="t-display" style={{ fontSize: 20, lineHeight: "24px" }}>
              {detail.medicine.short}
            </p>
            <p className="t-data mt-1" data-depth="2">
              {detail.medicine.generic}
            </p>
            <p className="t-data mt-0.5" data-depth="1">
              {detail.medicine.brand}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <Markers medicine={detail.medicine} />
              {detail.medicine.aware !== "NA" ? (
                <span className="t-data ml-1" data-depth="1">
                  AWaRe {detail.medicine.aware}
                </span>
              ) : null}
            </div>
          </div>

          {detail.counsel ? (
            <div className="band mt-2" data-sev="counsel">
              <p className="t-label" style={{ color: "var(--ink)" }}>
                Counsel the patient
              </p>
              <p className="t-prose mt-1 max-w-[62ch]" data-depth="3">
                {detail.counsel}
              </p>
            </div>
          ) : null}

          <div className="mt-4">
            <p className="t-label baseline pb-1">Commercial</p>
            <Line label="Retail">
              <span className="t-num" data-depth="3">
                PKR {pkr(detail.medicine.price, true)}
              </span>
            </Line>
            <Line label="Cost">
              <span className="t-num">PKR {pkr(detail.medicine.cost, true)}</span>
            </Line>
            <Line label="Margin">
              {detail.margin === null ? (
                "—"
              ) : (
                <span
                  className="t-num"
                  style={{ color: detail.margin < 5 ? "var(--danger)" : undefined }}
                >
                  {detail.margin.toFixed(1)}%
                </span>
              )}
            </Line>
            <Line label="Pack">{detail.medicine.pack ? `${detail.medicine.pack} units` : "—"}</Line>
          </div>

          <div className="mt-4">
            <p className="t-label baseline pb-1">Shelf</p>
            {detail.medicine.stock && detail.stockState ? (
              <>
                <Line label="On hand">
                  <span className="flex items-center gap-2">
                    <Meter
                      value={detail.medicine.stock.onHand}
                      of={detail.medicine.stock.reorder}
                      tone={detail.stockState}
                    />
                    <span className="t-num" data-depth="3">
                      {detail.medicine.stock.onHand}
                    </span>
                    <span data-depth="1">{STOCK_LABEL[detail.stockState]}</span>
                  </span>
                </Line>
                <Line label="Reorder at">
                  <span className="t-num">{detail.medicine.stock.reorder}</span>
                </Line>
                <Line label="Batch">
                  <span className="t-num">{detail.medicine.stock.batch}</span>
                </Line>
                <Line label="Expiry">
                  <span
                    className="t-num"
                    style={{
                      color:
                        detail.expiryState === "expired"
                          ? "var(--danger)"
                          : detail.expiryState === "expiring"
                            ? "var(--warn)"
                            : undefined,
                    }}
                  >
                    {detail.medicine.stock.expiry}
                    {detail.daysToExpiry !== null ? (
                      <span data-depth="1">
                        {" "}
                        ·{" "}
                        {detail.daysToExpiry < 0
                          ? `${Math.abs(detail.daysToExpiry)}d past`
                          : `${detail.daysToExpiry}d left`}
                      </span>
                    ) : null}
                  </span>
                </Line>
                <Line label="Location">{detail.medicine.stock.shelf}</Line>
                <Line label="Last counted">
                  <span className="t-num">{detail.medicine.stock.counted}</span>
                </Line>
              </>
            ) : (
              <p className="t-data py-2" data-depth="1">
                Not stocked at this branch. It is in the national catalogue and can be ordered.
              </p>
            )}
          </div>

          {detail.medicine.flags.length ? (
            <div className="mt-4">
              <p className="t-label baseline pb-1">Clinical profile</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                {detail.medicine.flags.map((flag) => (
                  <span key={flag} className="t-data" data-depth="2">
                    {labelOf(flag)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {detail.alternatives.length ? (
            <div className="mt-4">
              <p className="t-label baseline pb-1">
                Same molecule · {detail.medicine.molecule}
              </p>
              {detail.alternatives.map((alt) => (
                <div key={alt.id} className="baseline row flex items-center gap-2 py-1">
                  <span className="min-w-0 flex-1">
                    <Identity medicine={alt} depth={2} showMaker={false} />
                  </span>
                  <span className="t-data t-num shrink-0 text-right" data-depth="2">
                    {alt.price.toFixed(2)}
                  </span>
                  <span className="t-data w-12 shrink-0 text-right" data-depth={alt.stock ? "2" : "0"}>
                    {alt.stock ? alt.stock.onHand : "—"}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {onAdd ? (
            <div className="sticky bottom-0 mt-4 bg-(--surface) py-3">
              <button type="button" className="act act-primary w-full" onClick={() => onAdd(detail.medicine)}>
                Add to basket
              </button>
            </div>
          ) : null}
        </>
      )}
    </aside>
  );
}
