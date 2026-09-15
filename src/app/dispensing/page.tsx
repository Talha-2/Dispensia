import { Counter, type FeedEntry } from "@/components/counter";
import { Shell } from "@/components/shell";
import { getMedicines } from "@/lib/catalogue";
import { RULES } from "@/lib/safety";
import { getPatients, getRegister } from "@/lib/records";
import { getStock } from "@/lib/stock";

export const metadata = {
  title: "Counter · Dispensia",
};

export default async function DispensingPage({
  searchParams,
}: {
  searchParams: Promise<{ lines?: string; patient?: string }>;
}) {
  const params = await searchParams;
  const initialLines = getMedicines((params.lines ?? "").split(",").filter(Boolean));
  const initialPatient = params.patient ?? "";

  const [patients, { lines: stock }, register] = await Promise.all([
    getPatients(),
    getStock(),
    getRegister(),
  ]);

  // The fast-mover shortcuts are this pharmacy's own deepest lines. They used to
  // come from the catalogue's synthetic stock, which put eight products on the
  // bench of a shop that had never received a delivery.
  const starters = stock
    .filter((line) => line.onHand > 0)
    .slice(0, 8)
    .map((line) => line.medicine);

  // Today at this counter, read off the register. Empty until something is
  // actually dispensed, rather than a demonstration of what activity looks like.
  const feed: FeedEntry[] = register.slice(0, 8).map((entry) => ({
    time: entry.time,
    kind: entry.override ? ("override" as const) : ("register" as const),
    what: `Register entry — ${entry.brand}`,
    who: entry.pharmacist,
    detail: entry.override
      ? `${entry.molecule} · overridden — ${entry.override}`
      : `${entry.molecule} · ${entry.qty} supplied · balance ${entry.balance}`,
  }));

  return (
    <Shell
      title="Counter"
      meta={
        <>
          <span className="t-sm" data-depth="2">
            <span className="t-num font-semibold" style={{ color: "var(--ink)" }}>
              {RULES.length}
            </span>{" "}
            interaction rules armed
          </span>
          <span className="t-sm" data-depth="1">
            AWaRe stewardship · controlled-drug register · counselling duties
          </span>
          {stock.length === 0 ? (
            <span className="t-sm" data-depth="0">
              no stock received yet — search the catalogue to build a basket
            </span>
          ) : null}
        </>
      }
    >
      <Counter
        patients={patients}
        starters={starters}
        feed={feed}
        initialLines={initialLines}
        initialPatient={initialPatient}
      />
    </Shell>
  );
}
