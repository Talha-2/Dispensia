import { Counter, type FeedEntry } from "@/components/counter";
import { Shell } from "@/components/shell";
import { getMedicines, query } from "@/lib/catalogue";
import { RULES } from "@/lib/safety";
import { patients } from "@/data/patients";

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

  // The lines this branch holds most of — the fastest way to start a basket
  // without typing, and a realistic stand-in for a fast-mover list.
  const starters = query({ scope: "stocked", sort: "stock", dir: "desc", size: 8 }).items;

  // SYNTHETIC activity, composed from real products so every name, class and
  // obligation on the feed is one the catalogue actually carries.
  const watch = query({ scope: "stocked", aware: ["WATCH"], size: 4 }).items;
  const controlled = query({ scope: "stocked", flags: ["controlled"], size: 2 }).items;
  const nsaid = query({ scope: "stocked", flags: ["nsaid"], size: 2 }).items;
  const ppi = query({ scope: "stocked", flags: ["ppi"], size: 2 }).items;

  const feed: FeedEntry[] = [
    controlled[0] && {
      time: "11:42",
      kind: "register" as const,
      what: `Register entry — ${controlled[0].short}`,
      who: "A. Yousaf",
      detail: `${controlled[0].molecule} · balance checked · prescriber verified`,
    },
    nsaid[0] && {
      time: "11:20",
      kind: "block" as const,
      what: "Blocked — anticoagulant + NSAID",
      who: "A. Yousaf",
      detail: `${nsaid[0].short} withheld; paracetamol supplied instead`,
    },
    watch[0] && {
      time: "10:58",
      kind: "counsel" as const,
      what: `Counselled — ${watch[0].short}`,
      who: "M. Raza",
      detail: "AWaRe Watch · complete the course, do not share",
    },
    ppi[0] && {
      time: "10:31",
      kind: "override" as const,
      what: "Override — clopidogrel + esomeprazole",
      who: "A. Yousaf",
      detail: "Prescriber contacted, switched to pantoprazole on the next fill",
    },
    watch[1] && {
      time: "10:04",
      kind: "dispense" as const,
      what: `Dispensed — ${watch[1].short}`,
      who: "M. Raza",
      detail: "3 lines · clear · no findings",
    },
    nsaid[1] && {
      time: "09:47",
      kind: "dispense" as const,
      what: `Dispensed — ${nsaid[1].short}`,
      who: "A. Yousaf",
      detail: "1 line · counsel · take with food",
    },
    watch[2] && {
      time: "09:26",
      kind: "counsel" as const,
      what: `Counselled — ${watch[2].short}`,
      who: "A. Yousaf",
      detail: "Photosensitivity and tendon pain warning given",
    },
    starters[0] && {
      time: "09:08",
      kind: "dispense" as const,
      what: `Dispensed — ${starters[0].short}`,
      who: "M. Raza",
      detail: "2 lines · clear · first sale of the day",
    },
  ].filter(Boolean) as FeedEntry[];

  return (
    <Shell
      title="Counter"
      meta={
        <>
          <span className="t-data" data-depth="1">
            <span className="t-num" data-depth="2">
              {RULES.length}
            </span>{" "}
            interaction rules armed
          </span>
          <span className="t-data" data-depth="1">
            AWaRe stewardship · controlled-drug register · counselling duties
          </span>
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
