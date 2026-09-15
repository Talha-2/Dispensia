/** WHO AWaRe antibiotic stewardship classification, carried on every product. */
export type AwareClass = "ACCESS" | "WATCH" | "RESERVE" | "NA";

export type QtRisk = "high" | "moderate" | null;

/** Synthetic branch stock. Product facts are real; this is generated demo data. */
export type Stock = {
  onHand: number;
  reorder: number;
  batch: string;
  expiry: string;
  shelf: string;
  counted: string;
};

export type Medicine = {
  id: string;
  brand: string;
  /** Brand without the strength/pack noise — "Xatral Lp Tab 10mg 3x10s" → "Xatral Lp". */
  short: string;
  generic: string;
  /** Molecule alone, no strength. This is what the interaction engine matches on. */
  molecule: string;
  strength: string | null;
  form: string;
  maker: string;
  /** Units per pack, parsed out of the brand string. Null when unparseable. */
  pack: number | null;
  price: number;
  cost: number;
  aware: AwareClass;
  qt: QtRisk;
  flags: string[];
  /** Index into the catalogue's shared counselling-text table. -1 when absent. */
  counsel: number;
  stock?: Stock;
};

export type FlagMeta = {
  key: string;
  label: string;
  group: "therapeutic" | "interaction" | "risk";
  count: number;
};

export type Facet = { value: string; count: number };

export type Catalogue = {
  version: number;
  generatedAt: string;
  source: string;
  note: string;
  counsel: string[];
  flags: FlagMeta[];
  facets: {
    makers: Facet[];
    forms: Facet[];
    molecules: Facet[];
    aware: Facet[];
  };
  items: Medicine[];
};

/** Derived shelf state for a stocked line. */
export type StockState = "out" | "critical" | "low" | "healthy";

/** Derived expiry state for a batch. */
export type ExpiryState = "expired" | "expiring" | "ok";

export type LineItem = {
  medicine: Medicine;
  qty: number;
};

export type Patient = {
  id: string;
  name: string;
  /** Absent when the record does not carry it. Never defaulted: the rules that
      key off age and sex are the ones that kill, and a guess either fires them
      all or silences them all. */
  age?: number;
  sex?: "f" | "m";
  mrn: string;
  phone: string;
  prescriber: string;
  lastVisit: string;
  allergies: string[];
  conditions: string[];
  notes?: string;
};

/** The five addressable verdict states a basket can be in. */
export type Verdict = "unscanned" | "clear" | "counsel" | "conflict" | "blocked";

export type Severity = "block" | "conflict" | "counsel" | "note";

export type Finding = {
  /** Stable key — the same key the incumbent engine used, so overrides stay comparable. */
  key: string;
  severity: Severity;
  title: string;
  detail: string;
  /** Product ids this finding implicates. */
  implicates: string[];
  /** True when the finding depends on patient age/sex rather than the basket alone. */
  demographic: boolean;
};

export type ScanResult = {
  verdict: Verdict;
  findings: Finding[];
  counselling: { id: string; brand: string; text: string }[];
  controlled: Medicine[];
  aware: { WATCH: Medicine[]; RESERVE: Medicine[] };
};
