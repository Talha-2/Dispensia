/**
 * Clinical safety engine.
 *
 * A faithful port of the 34 interaction rules in the incumbent engine
 * (../Safe-dispensing/logic.js, SECTION 7 — CONFLICT DETECTION ENGINE), rewritten
 * against the catalogue's own clinical flags and molecule names rather than the
 * old hand-maintained drug lists.
 *
 * Rule keys are unchanged from the incumbent engine so that an override recorded
 * before the rewrite still refers to the same finding.
 */

import type { Finding, LineItem, Medicine, ScanResult, Severity, Verdict } from "@/lib/types";

export type PatientContext = {
  age?: number;
  sex?: "f" | "m";
};

/** Molecule match. Combination products carry "a+ b+ c", so substring is correct here. */
const isMol = (m: Medicine, name: string) => m.molecule.includes(name);
const withFlag = (items: Medicine[], flag: string) => items.filter((m) => m.flags.includes(flag));
const withMol = (items: Medicine[], name: string) => items.filter((m) => isMol(m, name));

/** A systemic NSAID. Topical diclofenac gel is not a bleeding risk. */
const systemicNsaids = (items: Medicine[]) =>
  items.filter((m) => m.flags.includes("nsaid") && !m.flags.includes("topical"));

/** Omeprazole and esomeprazole specifically — pantoprazole is the safe swap. */
const cyp2c19Ppis = (items: Medicine[]) =>
  items.filter((m) => m.flags.includes("ppi") && (isMol(m, "omeprazole") || isMol(m, "esomeprazole")));

const QT_MOLECULES = [
  "azithromycin", "clarithromycin", "erythromycin", "levofloxacin", "moxifloxacin", "ciprofloxacin",
  "ofloxacin", "ondansetron", "domperidone", "haloperidol", "quetiapine", "risperidone", "citalopram",
  "escitalopram", "amiodarone", "sotalol", "fluconazole", "itraconazole", "hydroxyzine",
];

const qtDrugs = (items: Medicine[]) =>
  items.filter((m) => m.qt === "high" || m.qt === "moderate" || QT_MOLECULES.some((q) => isMol(m, q)));

type Rule = {
  key: string;
  severity: Severity;
  title: string;
  detail: string;
  demographic?: boolean;
  /** Returns the implicated products, or an empty array when the rule does not fire. */
  test: (items: Medicine[], patient: PatientContext) => Medicine[];
};

/** Concatenate matched groups; a rule only fires when every group has a member. */
const pairs = (...groups: Medicine[][]): Medicine[] => {
  if (groups.some((g) => g.length === 0)) return [];
  return [...new Set(groups.flat())];
};

export const RULES: Rule[] = [
  {
    key: "NSAID+Hemorrhage_TripleWhammy",
    severity: "block",
    title: "NSAID + anticoagulant / triple whammy",
    detail:
      "An NSAID alongside an anticoagulant or antiplatelet — or on top of an ACE inhibitor plus a diuretic — carries immediate haemorrhage risk or acute renal shutdown.",
    test: (items) => {
      const nsaid = systemicNsaids(items);
      if (!nsaid.length) return [];
      const warfarin = withMol(items, "warfarin");
      const clopidogrel = withMol(items, "clopidogrel");
      const acei = withFlag(items, "acei");
      const diuretic = withFlag(items, "diuretic");
      if (warfarin.length) return pairs(nsaid, warfarin);
      if (clopidogrel.length) return pairs(nsaid, clopidogrel);
      if (acei.length && diuretic.length) return pairs(nsaid, acei, diuretic);
      return [];
    },
  },
  {
    key: "Clopidogrel+OmeprazoleEsomeprazole",
    severity: "block",
    title: "Clopidogrel + omeprazole / esomeprazole",
    detail:
      "Omeprazole and esomeprazole suppress the CYP2C19 activation of clopidogrel, leaving the patient unprotected. Switch to pantoprazole.",
    test: (items) => pairs(withMol(items, "clopidogrel"), cyp2c19Ppis(items)),
  },
  {
    key: "BetaBlocker+NonDHP_HeartBlock",
    severity: "block",
    title: "Beta-blocker + verapamil / diltiazem",
    detail: "Profound synergistic AV-node suppression. High risk of fatal heart block.",
    test: (items) => pairs(withFlag(items, "betaBlocker"), withFlag(items, "ccbNonDhp")),
  },
  {
    key: "ACEi+KSparingDiuretic_Hyperkalemia",
    severity: "block",
    title: "ACE inhibitor + potassium-sparing diuretic",
    detail: "Double suppression of potassium excretion. High risk of fatal hyperkalaemia.",
    test: (items) => pairs(withFlag(items, "acei"), withFlag(items, "kSparingDiuretic")),
  },
  {
    key: "Pediatric_Aspirin_Reyes",
    severity: "block",
    title: "Aspirin in a patient under 16 — Reye's syndrome",
    detail:
      "Strictly contraindicated under 16 years. Risk of fatal acute encephalopathy and hepatic infiltration.",
    demographic: true,
    test: (items, patient) =>
      patient.age !== undefined && patient.age < 16 ? withMol(items, "aspirin") : [],
  },
  {
    key: "Pediatric_Benzo_Caution",
    severity: "block",
    title: "Benzodiazepine in a patient under 18",
    detail:
      "Paradoxical agitation, respiratory depression and dependence risk are elevated in children and adolescents. Requires explicit specialist indication and prescriber justification.",
    demographic: true,
    test: (items, patient) =>
      patient.age !== undefined && patient.age < 18 ? withFlag(items, "benzo") : [],
  },
  {
    key: "BZD+Opioid_RespDepression",
    severity: "block",
    title: "Benzodiazepine + opioid / codeine cough syrup",
    detail: "Profound CNS and respiratory depression. High risk of fatal respiratory arrest.",
    test: (items) => {
      const benzo = withFlag(items, "benzo");
      if (!benzo.length) return [];
      const opioid = [...withFlag(items, "opioid"), ...withMol(items, "codeine")];
      const cough = withFlag(items, "coughPrep");
      if (opioid.length) return pairs(benzo, opioid);
      if (cough.length) return pairs(benzo, cough);
      return [];
    },
  },
  {
    key: "Promethazine+PediatricAge2",
    severity: "block",
    title: "Promethazine in a patient under 2",
    detail: "Contraindicated below 2 years. Risk of fatal respiratory depression.",
    demographic: true,
    test: (items, patient) =>
      patient.age !== undefined && patient.age < 2 ? withMol(items, "promethazine") : [],
  },
  {
    key: "DXM+SSRI_SerotoninSyndrome",
    severity: "block",
    title: "Dextromethorphan + SSRI — serotonin syndrome",
    detail: "Potentially fatal hyperthermia, agitation and neuromuscular instability.",
    test: (items) =>
      pairs([...withFlag(items, "dxm"), ...withMol(items, "dextromethorphan")], withFlag(items, "ssri")),
  },
  {
    key: "Anticoagulant+NSAID_Hemorrhage",
    severity: "block",
    title: "Anticoagulant + NSAID — haemorrhage",
    detail: "Fatal GI or systemic haemorrhage risk. Replace the NSAID with paracetamol.",
    test: (items) => pairs(withFlag(items, "anticoagulant"), systemicNsaids(items)),
  },
  {
    key: "Warfarin+Clopidogrel_DualAntithrombotic",
    severity: "block",
    title: "Warfarin + clopidogrel — dual antithrombotic",
    detail: "Dangerous potentiation of bleeding risk. Prescriber validation required.",
    test: (items) => pairs(withMol(items, "warfarin"), withMol(items, "clopidogrel")),
  },
  {
    key: "ACEiARB_FemalePt_PregnancyGate",
    severity: "conflict",
    title: "ACE inhibitor / ARB in a female of reproductive age",
    detail:
      "Category D/X in pregnancy — causes severe fetal renal failure and fetal death. Confirm the patient is not pregnant before authorising.",
    demographic: true,
    test: (items, patient) => {
      const reproductive =
        patient.sex === "f" && patient.age !== undefined && patient.age >= 15 && patient.age <= 50;
      if (!reproductive) return [];
      return [...withFlag(items, "acei"), ...withFlag(items, "arb")];
    },
  },
  {
    key: "ACEi+ARB_DualRASBlockade",
    severity: "block",
    title: "ACE inhibitor + ARB — dual RAS blockade",
    detail:
      "Contraindicated. Dramatically increases renal failure, hyperkalaemia and hypotension risk.",
    test: (items) => pairs(withFlag(items, "acei"), withFlag(items, "arb")),
  },
  {
    key: "Corticosteroid+NSAID_GIPerforation",
    severity: "block",
    title: "Corticosteroid + NSAID — GI perforation",
    detail:
      "Synergistic risk of severe gastric ulceration, perforation and haemorrhage. Use paracetamol instead.",
    test: (items) => pairs(withFlag(items, "systemicSteroid"), systemicNsaids(items)),
  },
  {
    key: "Antidiabetic+Corticosteroid_HyperglycaemicCrisis",
    severity: "conflict",
    title: "Antidiabetic + corticosteroid — hyperglycaemic crisis",
    detail:
      "Steroids can override antidiabetic medication. The prescriber must be contacted for urgent dose adjustment.",
    test: (items) => pairs(withFlag(items, "antidiabetic"), withFlag(items, "systemicSteroid")),
  },
  {
    key: "Sulfonylurea+Fluconazole_SevereHypoglycaemia",
    severity: "block",
    title: "Sulfonylurea + fluconazole — severe hypoglycaemia",
    detail:
      "Fluconazole inhibits CYP2C9 clearance of the sulfonylurea. Risk of prolonged, severe hypoglycaemia.",
    test: (items) => pairs(withFlag(items, "sulfonylurea"), withMol(items, "fluconazole")),
  },
  {
    key: "OCP+EnzymeInducer_ContraceptiveFailure",
    severity: "conflict",
    title: "Oral contraceptive + enzyme inducer — contraceptive failure",
    detail:
      "The inducer accelerates hormone clearance and the contraceptive can fail. Additional barrier protection is required.",
    test: (items) => pairs(withFlag(items, "contraceptive"), withFlag(items, "enzymeInducer")),
  },
  {
    key: "COC+Age35_CardiovascularRisk",
    severity: "conflict",
    title: "Combined oral contraceptive over 35",
    detail:
      "Markedly raised thromboembolic and cardiovascular risk over 35, especially in smokers. Review the indication.",
    demographic: true,
    test: (items, patient) =>
      patient.age !== undefined && patient.age > 35
        ? [...withFlag(items, "combinedOcp"), ...withFlag(items, "contraceptive")]
        : [],
  },
  {
    key: "ClarithroErythro+Statin_Rhabdomyolysis",
    severity: "block",
    title: "Clarithromycin / erythromycin + statin — rhabdomyolysis",
    detail:
      "CYP3A4 inhibition multiplies statin exposure. Risk of rhabdomyolysis and acute renal failure. Hold the statin for the antibiotic course.",
    test: (items) =>
      pairs(
        [...withMol(items, "clarithromycin"), ...withMol(items, "erythromycin")],
        withFlag(items, "statin"),
      ),
  },
  {
    key: "ClarithroErythro+Warfarin_INRBleed",
    severity: "block",
    title: "Clarithromycin / erythromycin + warfarin — INR surge",
    detail: "Sharp INR rise and bleeding risk. INR monitoring required during and after the course.",
    test: (items) =>
      pairs(
        [...withMol(items, "clarithromycin"), ...withMol(items, "erythromycin")],
        withMol(items, "warfarin"),
      ),
  },
  {
    key: "MacrolideFQ+QTdrug_TorsadesPointes",
    severity: "block",
    title: "Macrolide / fluoroquinolone + QT-prolonging drug",
    detail: "Additive QT prolongation. Risk of torsades de pointes and sudden cardiac death.",
    test: (items) => {
      const abx = [...withFlag(items, "macrolide"), ...withFlag(items, "fluoroquinolone")];
      if (!abx.length) return [];
      const qt = qtDrugs(items).filter((m) => !abx.includes(m));
      return pairs(abx, qt);
    },
  },
  {
    key: "Tetracycline+Isotretinoin_PseudotumorCerebri",
    severity: "block",
    title: "Tetracycline + isotretinoin — pseudotumor cerebri",
    detail: "Combined use raises intracranial pressure. Contraindicated together.",
    test: (items) => pairs(withFlag(items, "tetracycline"), withMol(items, "isotretinoin")),
  },
  {
    key: "Tetracycline+PediatricUnder8",
    severity: "block",
    title: "Tetracycline in a patient under 8",
    detail: "Permanent tooth discolouration and enamel hypoplasia. Contraindicated under 8 years.",
    demographic: true,
    test: (items, patient) =>
      patient.age !== undefined && patient.age < 8 ? withFlag(items, "tetracycline") : [],
  },
  {
    key: "Fluoroquinolone_Under18",
    severity: "conflict",
    title: "Fluoroquinolone in a patient under 18",
    detail:
      "Cartilage and tendon toxicity in the growing skeleton. Reserve for infections with no alternative.",
    demographic: true,
    test: (items, patient) =>
      patient.age !== undefined && patient.age < 18 ? withFlag(items, "fluoroquinolone") : [],
  },
  {
    key: "Fluoroquinolone+Warfarin_INRBleed",
    severity: "block",
    title: "Fluoroquinolone + warfarin — INR surge",
    detail: "Potentiates anticoagulation. INR monitoring required.",
    test: (items) => pairs(withFlag(items, "fluoroquinolone"), withMol(items, "warfarin")),
  },
  {
    key: "Fluoroquinolone+Theophylline_Toxicity",
    severity: "block",
    title: "Fluoroquinolone + theophylline — toxicity",
    detail: "Clearance is blocked and theophylline accumulates. Risk of seizures and arrhythmia.",
    test: (items) => pairs(withFlag(items, "fluoroquinolone"), withMol(items, "theophylline")),
  },
  {
    key: "Fluconazole+Warfarin_INRSurge",
    severity: "block",
    title: "Fluconazole + warfarin — INR surge",
    detail: "Strong CYP2C9 inhibition sharply raises INR. Bleeding risk.",
    test: (items) => pairs(withMol(items, "fluconazole"), withMol(items, "warfarin")),
  },
  {
    key: "AzoleAntifungal+HighRiskStatin_Rhabdomyolysis",
    severity: "block",
    title: "Azole antifungal + high-risk statin — rhabdomyolysis",
    detail: "CYP3A4 inhibition multiplies statin exposure. Hold the statin for the antifungal course.",
    test: (items) =>
      pairs(
        [...withMol(items, "fluconazole"), ...withMol(items, "itraconazole"), ...withMol(items, "ketoconazole")],
        withFlag(items, "highRiskStatin"),
      ),
  },
  {
    key: "Itraconazole+Benzodiazepine_FatalSedation",
    severity: "block",
    title: "Itraconazole + benzodiazepine — prolonged sedation",
    detail: "CYP3A4 blockade prolongs benzodiazepine action. Risk of profound, prolonged sedation.",
    test: (items) => pairs(withMol(items, "itraconazole"), withFlag(items, "benzo")),
  },
  {
    key: "HCVDAA+Rifampicin_TreatmentFailure",
    severity: "block",
    title: "HCV direct-acting antiviral + rifampicin — treatment failure",
    detail: "Induction collapses antiviral levels and the cure fails. Contraindicated together.",
    test: (items) => pairs(withFlag(items, "hcvDaa"), withFlag(items, "rifamycin")),
  },
  {
    key: "ARV_DAA+StJohnsWort_ResistanceBlock",
    severity: "block",
    title: "Antiviral + St John's wort — resistance risk",
    detail: "Potent induction drops antiviral levels and can drive resistance.",
    test: (items) =>
      pairs(
        [...withFlag(items, "hcvDaa"), ...withFlag(items, "antiviral")],
        [...withMol(items, "hypericum"), ...withMol(items, "st john")],
      ),
  },
  {
    key: "Ritonavir+SimvaLova_Rhabdomyolysis",
    severity: "block",
    title: "Ritonavir + simvastatin / lovastatin — rhabdomyolysis",
    detail: "Contraindicated. Statin exposure rises many-fold.",
    test: (items) =>
      pairs(withMol(items, "ritonavir"), [...withMol(items, "simvastatin"), ...withMol(items, "lovastatin")]),
  },
  {
    key: "Acyclovir+NSAID_Nephrotoxicity",
    severity: "conflict",
    title: "Aciclovir + NSAID — nephrotoxicity",
    detail: "Additive renal insult. Ensure hydration and review renal function.",
    test: (items) => pairs(withMol(items, "acyclovir"), systemicNsaids(items)),
  },
  {
    key: "Tenofovir+NSAID_Nephrotoxicity",
    severity: "conflict",
    title: "Tenofovir + NSAID — nephrotoxicity",
    detail: "Additive proximal tubular injury. Avoid the NSAID where possible.",
    test: (items) => pairs(withMol(items, "tenofovir"), systemicNsaids(items)),
  },
];

/**
 * What each rule watches, as catalogue tokens: `flag:<key>` or `mol:<substring>`.
 * Each inner array is one side of the interaction, so the safety reference can
 * say how many real products sit on either side of every rule rather than
 * describing the rules in the abstract.
 */
export const RULE_WATCH: Record<string, { label: string; tokens: string[] }[]> = {
  "NSAID+Hemorrhage_TripleWhammy": [
    { label: "Systemic NSAID", tokens: ["flag:nsaid"] },
    { label: "Warfarin, clopidogrel, or ACEi + diuretic", tokens: ["mol:warfarin", "mol:clopidogrel", "flag:acei"] },
  ],
  "Clopidogrel+OmeprazoleEsomeprazole": [
    { label: "Clopidogrel", tokens: ["mol:clopidogrel"] },
    { label: "Omeprazole / esomeprazole", tokens: ["mol:omeprazole", "mol:esomeprazole"] },
  ],
  "BetaBlocker+NonDHP_HeartBlock": [
    { label: "Beta-blocker", tokens: ["flag:betaBlocker"] },
    { label: "Verapamil / diltiazem", tokens: ["flag:ccbNonDhp"] },
  ],
  "ACEi+KSparingDiuretic_Hyperkalemia": [
    { label: "ACE inhibitor", tokens: ["flag:acei"] },
    { label: "K-sparing diuretic", tokens: ["flag:kSparingDiuretic"] },
  ],
  Pediatric_Aspirin_Reyes: [{ label: "Aspirin", tokens: ["mol:aspirin"] }],
  Pediatric_Benzo_Caution: [{ label: "Benzodiazepine", tokens: ["flag:benzo"] }],
  "BZD+Opioid_RespDepression": [
    { label: "Benzodiazepine", tokens: ["flag:benzo"] },
    { label: "Opioid or codeine cough prep", tokens: ["flag:opioid", "mol:codeine", "flag:coughPrep"] },
  ],
  "Promethazine+PediatricAge2": [{ label: "Promethazine", tokens: ["mol:promethazine"] }],
  "DXM+SSRI_SerotoninSyndrome": [
    { label: "Dextromethorphan", tokens: ["flag:dxm", "mol:dextromethorphan"] },
    { label: "SSRI", tokens: ["flag:ssri"] },
  ],
  "Anticoagulant+NSAID_Hemorrhage": [
    { label: "Anticoagulant", tokens: ["flag:anticoagulant"] },
    { label: "Systemic NSAID", tokens: ["flag:nsaid"] },
  ],
  "Warfarin+Clopidogrel_DualAntithrombotic": [
    { label: "Warfarin", tokens: ["mol:warfarin"] },
    { label: "Clopidogrel", tokens: ["mol:clopidogrel"] },
  ],
  ACEiARB_FemalePt_PregnancyGate: [{ label: "ACE inhibitor or ARB", tokens: ["flag:acei", "flag:arb"] }],
  "ACEi+ARB_DualRASBlockade": [
    { label: "ACE inhibitor", tokens: ["flag:acei"] },
    { label: "ARB", tokens: ["flag:arb"] },
  ],
  "Corticosteroid+NSAID_GIPerforation": [
    { label: "Systemic corticosteroid", tokens: ["flag:systemicSteroid"] },
    { label: "Systemic NSAID", tokens: ["flag:nsaid"] },
  ],
  "Antidiabetic+Corticosteroid_HyperglycaemicCrisis": [
    { label: "Antidiabetic", tokens: ["flag:antidiabetic"] },
    { label: "Systemic corticosteroid", tokens: ["flag:systemicSteroid"] },
  ],
  "Sulfonylurea+Fluconazole_SevereHypoglycaemia": [
    { label: "Sulfonylurea", tokens: ["flag:sulfonylurea"] },
    { label: "Fluconazole", tokens: ["mol:fluconazole"] },
  ],
  "OCP+EnzymeInducer_ContraceptiveFailure": [
    { label: "Oral contraceptive", tokens: ["flag:contraceptive"] },
    { label: "Enzyme inducer", tokens: ["flag:enzymeInducer"] },
  ],
  "COC+Age35_CardiovascularRisk": [
    { label: "Combined oral contraceptive", tokens: ["flag:combinedOcp", "flag:contraceptive"] },
  ],
  "ClarithroErythro+Statin_Rhabdomyolysis": [
    { label: "Clarithromycin / erythromycin", tokens: ["mol:clarithromycin", "mol:erythromycin"] },
    { label: "Statin", tokens: ["flag:statin"] },
  ],
  "ClarithroErythro+Warfarin_INRBleed": [
    { label: "Clarithromycin / erythromycin", tokens: ["mol:clarithromycin", "mol:erythromycin"] },
    { label: "Warfarin", tokens: ["mol:warfarin"] },
  ],
  "MacrolideFQ+QTdrug_TorsadesPointes": [
    { label: "Macrolide or fluoroquinolone", tokens: ["flag:macrolide", "flag:fluoroquinolone"] },
    { label: "QT-prolonging drug", tokens: ["qt:any"] },
  ],
  "Tetracycline+Isotretinoin_PseudotumorCerebri": [
    { label: "Tetracycline", tokens: ["flag:tetracycline"] },
    { label: "Isotretinoin", tokens: ["mol:isotretinoin"] },
  ],
  "Tetracycline+PediatricUnder8": [{ label: "Tetracycline", tokens: ["flag:tetracycline"] }],
  Fluoroquinolone_Under18: [{ label: "Fluoroquinolone", tokens: ["flag:fluoroquinolone"] }],
  "Fluoroquinolone+Warfarin_INRBleed": [
    { label: "Fluoroquinolone", tokens: ["flag:fluoroquinolone"] },
    { label: "Warfarin", tokens: ["mol:warfarin"] },
  ],
  "Fluoroquinolone+Theophylline_Toxicity": [
    { label: "Fluoroquinolone", tokens: ["flag:fluoroquinolone"] },
    { label: "Theophylline", tokens: ["mol:theophylline"] },
  ],
  "Fluconazole+Warfarin_INRSurge": [
    { label: "Fluconazole", tokens: ["mol:fluconazole"] },
    { label: "Warfarin", tokens: ["mol:warfarin"] },
  ],
  "AzoleAntifungal+HighRiskStatin_Rhabdomyolysis": [
    { label: "Azole antifungal", tokens: ["mol:fluconazole", "mol:itraconazole", "mol:ketoconazole"] },
    { label: "High-risk statin", tokens: ["flag:highRiskStatin"] },
  ],
  "Itraconazole+Benzodiazepine_FatalSedation": [
    { label: "Itraconazole", tokens: ["mol:itraconazole"] },
    { label: "Benzodiazepine", tokens: ["flag:benzo"] },
  ],
  "HCVDAA+Rifampicin_TreatmentFailure": [
    { label: "HCV direct-acting antiviral", tokens: ["flag:hcvDaa"] },
    { label: "Rifamycin", tokens: ["flag:rifamycin"] },
  ],
  "ARV_DAA+StJohnsWort_ResistanceBlock": [
    { label: "Antiviral", tokens: ["flag:antiviral", "flag:hcvDaa"] },
    { label: "St John's wort", tokens: ["mol:hypericum"] },
  ],
  "Ritonavir+SimvaLova_Rhabdomyolysis": [
    { label: "Ritonavir", tokens: ["mol:ritonavir"] },
    { label: "Simvastatin / lovastatin", tokens: ["mol:simvastatin", "mol:lovastatin"] },
  ],
  "Acyclovir+NSAID_Nephrotoxicity": [
    { label: "Aciclovir", tokens: ["mol:acyclovir"] },
    { label: "Systemic NSAID", tokens: ["flag:nsaid"] },
  ],
  "Tenofovir+NSAID_Nephrotoxicity": [
    { label: "Tenofovir", tokens: ["mol:tenofovir"] },
    { label: "Systemic NSAID", tokens: ["flag:nsaid"] },
  ],
};

/** Does a product satisfy one of a watch group's tokens? */
export function matchesToken(medicine: Medicine, token: string): boolean {
  if (token === "qt:any") return medicine.qt !== null;
  const [kind, value] = token.split(":");
  if (kind === "flag") return medicine.flags.includes(value);
  if (kind === "mol") return medicine.molecule.includes(value);
  return false;
}

const SEVERITY_RANK: Record<Severity, number> = { block: 0, conflict: 1, counsel: 2, note: 3 };

export type ScanInput = {
  lines: LineItem[];
  patient?: PatientContext;
  /** Rule keys the pharmacist has already overridden on this basket. */
  cleared?: string[];
  /** Counselling text, indexed as in the catalogue. */
  counselText: (m: Medicine) => string | null;
};

/**
 * Scans a whole basket at once, the way the counter works: every product against
 * every rule, plus the stewardship and controlled-drug obligations the data carries.
 */
export function scan({ lines, patient = {}, cleared = [], counselText }: ScanInput): ScanResult {
  const items = lines.map((line) => line.medicine);
  const clearedSet = new Set(cleared);

  const findings: Finding[] = [];
  for (const rule of RULES) {
    if (clearedSet.has(rule.key)) continue;
    const implicated = rule.test(items, patient);
    if (!implicated.length) continue;
    findings.push({
      key: rule.key,
      severity: rule.severity,
      title: rule.title,
      detail: rule.detail,
      implicates: implicated.map((m) => m.id),
      demographic: Boolean(rule.demographic),
    });
  }

  // Stewardship and statutory obligations — not interactions, but they gate the dispense.
  const controlled = items.filter((m) => m.flags.includes("controlled"));
  if (controlled.length && !clearedSet.has("Controlled_RegisterEntry")) {
    findings.push({
      key: "Controlled_RegisterEntry",
      severity: "conflict",
      title: "Controlled drug — register entry required",
      detail:
        "A controlled-drug entry must be written to the narcotics register, with the prescriber and patient identity verified, before this basket can be closed.",
      implicates: controlled.map((m) => m.id),
      demographic: false,
    });
  }

  const reserve = items.filter((m) => m.aware === "RESERVE");
  if (reserve.length && !clearedSet.has("AWaRe_Reserve")) {
    findings.push({
      key: "AWaRe_Reserve",
      severity: "conflict",
      title: "WHO AWaRe RESERVE antibiotic",
      detail:
        "A last-resort antibiotic. Dispense only against a documented specialist indication — routine supply drives resistance.",
      implicates: reserve.map((m) => m.id),
      demographic: false,
    });
  }

  const watch = items.filter((m) => m.aware === "WATCH");
  if (watch.length && !clearedSet.has("AWaRe_Watch")) {
    findings.push({
      key: "AWaRe_Watch",
      severity: "counsel",
      title: "WHO AWaRe WATCH antibiotic",
      detail: "Higher resistance potential. Confirm the indication and reinforce completing the course.",
      implicates: watch.map((m) => m.id),
      demographic: false,
    });
  }

  const teratogens = items.filter((m) => m.flags.includes("teratogen"));
  if (teratogens.length && patient.sex === "f" && (patient.age ?? 0) >= 15 && (patient.age ?? 99) <= 50) {
    if (!clearedSet.has("Teratogen_PregnancyCheck")) {
      findings.push({
        key: "Teratogen_PregnancyCheck",
        severity: "conflict",
        title: "Known teratogen — pregnancy check required",
        detail: "Confirm the patient is not pregnant and document the check before dispensing.",
        implicates: teratogens.map((m) => m.id),
        demographic: true,
      });
    }
  }

  const highQt = items.filter((m) => m.qt === "high");
  if (highQt.length > 1 && !clearedSet.has("QT_Stacking")) {
    findings.push({
      key: "QT_Stacking",
      severity: "conflict",
      title: "Two or more high QT-risk drugs in one basket",
      detail: "Additive QT prolongation. An ECG or a prescriber review is warranted before supply.",
      implicates: highQt.map((m) => m.id),
      demographic: false,
    });
  }

  findings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  const counselling = items
    .map((m) => ({ id: m.id, brand: m.brand, text: counselText(m) }))
    .filter((entry): entry is { id: string; brand: string; text: string } => Boolean(entry.text));

  let verdict: Verdict = "clear";
  if (!lines.length) verdict = "unscanned";
  else if (findings.some((f) => f.severity === "block")) verdict = "blocked";
  else if (findings.some((f) => f.severity === "conflict")) verdict = "conflict";
  else if (findings.length || counselling.length) verdict = "counsel";

  return {
    verdict,
    findings,
    counselling,
    controlled,
    aware: { WATCH: watch, RESERVE: reserve },
  };
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  unscanned: "Nothing to scan",
  clear: "Clear to dispense",
  counsel: "Counsel before handover",
  conflict: "Conflict — pharmacist review",
  blocked: "Blocked — do not dispense",
};

export const VERDICT_RANK: Record<Verdict, number> = {
  unscanned: 0,
  clear: 1,
  counsel: 2,
  conflict: 3,
  blocked: 4,
};

/**
 * How many rules cannot fire without a patient.
 *
 * Counted from the rule book rather than written down, so it cannot drift away
 * from the truth as rules are added. The counter shows it when a basket is
 * scanned with nobody attached, because a "clear" verdict reached without an
 * age or a sex is a narrower claim than it looks.
 */
export const DEMOGRAPHIC_RULE_COUNT =
  RULES.filter((rule) => rule.demographic).length +
  // Plus the teratogen gate, which scan() raises outside the rule table and
  // which asks the same question of a patient: sex, and age of childbearing.
  1;
