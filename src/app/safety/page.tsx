import { Fact, FactRow, Shell } from "@/components/shell";
import { SeverityMark, SEVERITY_LABEL, compact } from "@/components/primitives";
import { countWatch, getCatalogueMeta, query } from "@/lib/catalogue";
import { RULES, RULE_WATCH, matchesToken } from "@/lib/safety";

export const metadata = {
  title: "Safety · Dispensia",
};

export default function SafetyPage() {
  const meta = getCatalogueMeta();
  const aware = Object.fromEntries(meta.facets.aware.map((f) => [f.value, f.count]));
  const controlled = query({ flags: ["controlled"], size: 1 });
  const teratogen = query({ flags: ["teratogen"], size: 1 });
  const qtHigh = query({ qt: ["high"], size: 1 });
  const qtModerate = query({ qt: ["moderate"], size: 1 });

  const rules = RULES.map((rule) => ({
    key: rule.key,
    severity: rule.severity,
    title: rule.title,
    detail: rule.detail,
    demographic: Boolean(rule.demographic),
    sides: (RULE_WATCH[rule.key] ?? []).map((side) => ({
      label: side.label,
      ...countWatch(side.tokens, matchesToken),
    })),
  }));

  const blocks = rules.filter((r) => r.severity === "block").length;
  const conflicts = rules.filter((r) => r.severity === "conflict").length;

  return (
    <Shell
      title="Safety"
      meta={
        <>
          <span className="t-data" data-depth="2">
            <span className="t-num" data-depth="3">
              {RULES.length}
            </span>{" "}
            interaction rules
          </span>
          <span className="t-data" data-depth="1">
            scanned against every basket, on every change
          </span>
        </>
      }
    >
      {/* ── Exposure across the real catalogue ─────────────────────────── */}
      <FactRow cols={7}>
        <Fact label="Hard blocks" value={String(blocks)} note="do not dispense" tone="var(--danger)" depth="4" />
        <Fact label="Review gates" value={String(conflicts)} note="pharmacist judgement" tone="var(--warn)" depth="4" />
        <Fact label="AWaRe Reserve" value={String(aware.RESERVE ?? 0)} note="last-resort antibiotics" />
        <Fact label="AWaRe Watch" value={String(aware.WATCH ?? 0)} note="higher resistance risk" />
        <Fact label="Controlled" value={String(controlled.total)} note="register-bound" />
        <Fact label="High QT risk" value={String(qtHigh.total)} note={`${qtModerate.total} moderate`} />
        <Fact label="Teratogens" value={String(teratogen.total)} note="pregnancy check" />
      </FactRow>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(272px,0.62fr)]">
        {/* ── The rule book ───────────────────────────────────────────── */}
        <div className="min-w-0">
          <div className="baseline-strong flex items-center gap-2 pb-1">
            <span className="t-label flex-1" style={{ color: "var(--ink)" }}>
              Rule book
            </span>
            <span className="t-data" data-depth="1">
              ranked by what they cost if missed
            </span>
          </div>

          {/* Grouped by what the rule costs if it is missed, so the reader can
              stop after the blocks rather than scrolling all 34 to find them. */}
          {(["block", "conflict"] as const).map((severity) => {
            const group = rules.filter((rule) => rule.severity === severity);
            if (!group.length) return null;
            return (
              <div key={severity} className="mb-4 last:mb-0">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="t-title">
                    {severity === "block" ? "Hard blocks" : "Review gates"}
                  </h3>
                  <span className={`cell ${severity === "block" ? "cell-reserve-soft" : "cell-watch-soft"}`}>
                    {group.length}
                  </span>
                  <span className="t-sm" data-depth="1">
                    {severity === "block"
                      ? "checkout is disabled until resolved or overridden"
                      : "pharmacist judgement required before supply"}
                  </span>
                </div>
                {/* No items-start: the cards stretch, so every row is one
                    height and the rule book reads as a grid rather than as a
                    ragged masonry of content-sized boxes. */}
                <div className="grid gap-2 xl:grid-cols-2">
                  {group.map((rule) => (
            <article
              key={rule.key}
              className="band flex h-full flex-col"
              style={{ marginTop: 0 }}
              data-sev={rule.severity}
            >
              <div className="flex flex-1 items-start gap-2">
                <SeverityMark severity={rule.severity} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <h3
                    className="t-data"
                    data-depth={rule.severity === "block" ? "4" : "3"}
                    style={{ color: rule.severity === "block" ? "var(--danger)" : undefined }}
                  >
                    {rule.title}
                  </h3>
                  <p className="t-prose mt-1 flex-1" data-depth="2">
                    {rule.detail}
                  </p>

                  {/* Exposure sits on the card's floor, so it lines up across a
                      row however long the rule's own description runs. */}
                  {rule.sides.length ? (
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                      {rule.sides.map((side) => (
                        <span key={side.label} className="t-data" data-depth="1">
                          {side.label}{" "}
                          <span className="t-num" data-depth="2">
                            {side.total.toLocaleString()}
                          </span>{" "}
                          in catalogue ·{" "}
                          <span
                            className="t-num"
                            data-depth={side.stocked ? "3" : "0"}
                            style={side.stocked ? { color: "var(--warn)" } : undefined}
                          >
                            {side.stocked}
                          </span>{" "}
                          on this shelf
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <p className="t-xs mt-1.5" data-depth="1">
                    {SEVERITY_LABEL[rule.severity]}
                    {rule.demographic ? " · fires on patient age or sex" : ""}
                  </p>
                </div>
              </div>
            </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── How the engine behaves ──────────────────────────────────── */}
        <aside className="panel sticky-rail min-w-0 self-start p-4">
          <div className="baseline-strong flex items-center pb-2">
            <span className="t-label">How it runs</span>
          </div>

          {[
            {
              title: "The whole basket, every change",
              body: "Rules are not evaluated per line. Adding a fourth product re-scans all four against each other, because the danger is usually in the combination that was safe a moment ago.",
            },
            {
              title: "Overrides cost something",
              body: "Clearing a finding needs a pharmacist PIN and a written clinical reason. Both are recorded against the basket. A dismissal with no cost becomes a reflex, and a reflex is how a block gets past somebody.",
            },
            {
              title: "Demographic gates stay dark without a record",
              body: "Age and sex rules cannot fire on a walk-in with no patient selected. The counter says so rather than implying the basket was checked against them.",
            },
            {
              title: "Severity never rests on colour alone",
              body: "Every finding carries a rank word, an icon and a tinted band together, so it still reads for a colour-blind pharmacist, on a glare-washed screen, and on a greyscale print of the audit log.",
            },
            {
              title: "Stewardship is an obligation, not advice",
              body: "A Reserve antibiotic and a controlled drug each raise a gate of their own, alongside the interaction rules. Reserve supply without a documented specialist indication is how resistance spreads.",
            },
          ].map((item) => (
            <div key={item.title} className="baseline py-2">
              <h3 className="t-data" data-depth="3">
                {item.title}
              </h3>
              <p className="t-prose mt-1 max-w-[54ch]" data-depth="2">
                {item.body}
              </p>
            </div>
          ))}

          <div className="mt-6">
            <div className="baseline-strong flex items-center pb-1">
              <span className="t-label" style={{ color: "var(--ink)" }}>
                Catalogue coverage
              </span>
            </div>
            <p className="t-prose mt-2 max-w-[54ch]" data-depth="2">
              Every judgement above is read off the product record itself — {compact(meta.total)} products carrying{" "}
              {meta.flags.length} clinical flags, a WHO AWaRe class and a written counselling duty. Nothing is
              inferred at dispense time.
            </p>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
