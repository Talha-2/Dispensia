import { Suspense } from "react";
import { CatalogueView } from "@/components/catalogue-view";
import { Shell } from "@/components/shell";
import { getCatalogueMeta, query } from "@/lib/catalogue";

export const metadata = {
  title: "Catalogue · Dispensia",
};

export default function CataloguePage() {
  const meta = getCatalogueMeta();
  const stocked = query({ scope: "stocked", size: 1 });

  return (
    <Shell
      fill
      title="Catalogue"
      meta={
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
