import { Suspense } from "react";
import { CatalogueView } from "@/components/catalogue-view";
import { Shell } from "@/components/shell";
import { getCatalogueMeta, query } from "@/lib/catalogue";

export const metadata = {
  title: "Catalogue · Dispensia",
};

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams;
  const stockedOnly = scope === "stocked";

  const meta = getCatalogueMeta();
  const stocked = query({ scope: "stocked", size: 1 });

  return (
    <Shell
      fill
      // One screen, two scopes. The heading follows the scope because a page
      // that still says "Catalogue" while showing only the 1,885 lines on this
      // shelf is telling the reader the wrong thing about what they are looking
      // at — and the count under it is the first thing they will act on.
      title={stockedOnly ? "Stock" : "Catalogue"}
      meta={
        stockedOnly ? (
          <>
            <span className="t-sm" data-depth="2">
              <span className="t-num font-semibold" style={{ color: "var(--ink)" }}>
                {stocked.total.toLocaleString()}
              </span>{" "}
              lines on this shelf
            </span>
            <span className="t-sm" data-depth="1">
              <span className="t-num" data-depth="2">
                {stocked.summary.needsReorder.toLocaleString()}
              </span>{" "}
              need reorder
            </span>
            <span className="t-sm" data-depth="1">
              <span className="t-num" data-depth="2">
                {stocked.summary.expiringSoon.toLocaleString()}
              </span>{" "}
              expiring soon
            </span>
            <span className="t-sm" data-depth="1">
              of{" "}
              <span className="t-num" data-depth="2">
                {meta.total.toLocaleString()}
              </span>{" "}
              in the catalogue
            </span>
          </>
        ) : (
          <>
            <span className="t-sm" data-depth="2">
              <span className="t-num font-semibold" style={{ color: "var(--ink)" }}>
                {meta.total.toLocaleString()}
              </span>{" "}
              products
            </span>
            <span className="t-sm" data-depth="1">
              <span className="t-num" data-depth="2">
                {stocked.total.toLocaleString()}
              </span>{" "}
              stocked here
            </span>
            <span className="t-sm" data-depth="1">
              <span className="t-num" data-depth="2">
                {meta.facets.molecules.length.toLocaleString()}
              </span>{" "}
              molecules
            </span>
            <span className="t-sm" data-depth="1">
              <span className="t-num" data-depth="2">
                {meta.facets.makers.length.toLocaleString()}
              </span>{" "}
              manufacturers
            </span>
          </>
        )
      }
    >
      <Suspense
        fallback={
          <p className="t-sm blink py-6" data-depth="1">
            Loading catalogue…
          </p>
        }
      >
        <CatalogueView flagMeta={meta.flags} />
      </Suspense>
    </Shell>
  );
}
