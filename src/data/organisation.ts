/**
 * The Demo tenant.
 *
 * Dispensia is a product, not one pharmacy's install: a real organisation is
 * created at sign-up and read from Supabase, scoped by row-level security to
 * the signed-in staff member. This module is the shared **Demo Pharmacy** that
 * every account can open before it has an organisation of its own — so the
 * counter, the register and the settings screen all have something real to run
 * against, and all quote the same names rather than each hard-coding a branch.
 *
 * SYNTHETIC throughout, and labelled as such wherever it surfaces.
 */

export type Role = {
  id: RoleId;
  name: string;
  summary: string;
  /** What this role may do, in the product's own terms. */
  can: string[];
  /** What it explicitly may not, so the boundary is stated rather than implied. */
  cannot: string[];
};

export type RoleId = "owner" | "pharmacist" | "technician" | "cashier" | "auditor";

export type Branch = {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  licence: string;
  hours: string;
  isPrimary: boolean;
  staff: number;
  /** A closed site: kept for its register history, but not somewhere you stand. */
  closed?: boolean;
};

export type Member = {
  id: string;
  name: string;
  email: string;
  role: RoleId;
  branchId: string;
  status: "active" | "invited" | "suspended";
  lastActive: string;
  /** Set for anyone who may clear a clinical finding. */
  pharmacistLicence?: string;
};

export type Organisation = {
  name: string;
  legalName: string;
  ntn: string;
  drapLicence: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  taxNote: string;
  /** True for the shared showroom tenant, so the UI can say so out loud. */
  isDemo?: boolean;
};

export const organisation: Organisation = {
  name: "Demo Pharmacy",
  legalName: "Demo Pharmacy (Private) Limited",
  ntn: "NTN 0000000-0",
  drapLicence: "DRAP-RP-DEMO-0001",
  address: "14-C Main Boulevard, Gulberg III, Lahore 54660",
  phone: "+92 42 111 723 723",
  email: "demo@dispensia.app",
  currency: "PKR",
  taxNote: "Demonstration data. Prices include GST where applicable.",
  isDemo: true,
};

export const branches: Branch[] = [
  {
    id: "br-main",
    name: "Main Branch",
    city: "Lahore",
    address: "14-C Main Boulevard, Gulberg III, Lahore",
    phone: "+92 42 111 723 723",
    licence: "DRAP-RP-LHR-04412",
    hours: "09:00 – 23:00, seven days",
    isPrimary: true,
    staff: 6,
  },
  {
    id: "br-johar",
    name: "Johar Town",
    city: "Lahore",
    address: "Block G1, Johar Town, Lahore",
    phone: "+92 42 111 723 724",
    licence: "DRAP-RP-LHR-05180",
    hours: "09:00 – 22:00, seven days",
    isPrimary: false,
    staff: 4,
  },
  {
    id: "br-dha",
    name: "DHA Phase 5",
    city: "Lahore",
    address: "Commercial Broadway, DHA Phase 5, Lahore",
    phone: "+92 42 111 723 725",
    licence: "DRAP-RP-LHR-05902",
    hours: "10:00 – 00:00, seven days",
    isPrimary: false,
    staff: 3,
  },
];

/**
 * Roles are written around the one thing that matters clinically: who may clear
 * a safety finding. Everything else follows from that.
 */
export const roles: Role[] = [
  {
    id: "owner",
    name: "Owner / Admin",
    summary: "Runs the organisation. Full access everywhere, including billing and staff.",
    can: [
      "Add and remove branches",
      "Invite, suspend and remove members",
      "Change clinical defaults for the whole organisation",
      "See every branch's reports and margins",
    ],
    cannot: ["Override a clinical finding without a pharmacist licence on the account"],
  },
  {
    id: "pharmacist",
    name: "Pharmacist",
    summary: "Clinically responsible for what leaves the counter.",
    can: [
      "Override a clinical finding, with a PIN and a written reason",
      "Sign controlled-drug register entries",
      "Dispense, counsel and close a basket",
      "Receive stock and run a stock audit",
    ],
    cannot: ["Change organisation-wide clinical defaults", "Manage members or branches"],
  },
  {
    id: "technician",
    name: "Pharmacy technician",
    summary: "Prepares and dispenses under a pharmacist's supervision.",
    can: ["Build a basket and dispense a clear one", "Receive stock", "Record a missed sale"],
    cannot: [
      "Override any clinical finding",
      "Dispense a basket carrying a block",
      "Sign the controlled-drug register",
    ],
  },
  {
    id: "cashier",
    name: "Cashier",
    summary: "Takes payment and prints the bill.",
    can: ["Close a basket a pharmacist has cleared", "Print and reprint receipts"],
    cannot: ["Add products to a basket", "Override anything", "See cost prices or margins"],
  },
  {
    id: "auditor",
    name: "Auditor",
    summary: "Read-only. For inspections and internal review.",
    can: [
      "Read every register entry and override, with its reason",
      "Read reports and stock history",
      "Export any view to CSV",
    ],
    cannot: ["Change anything at all"],
  },
];

export const members: Member[] = [
  {
    id: "m-1",
    name: "A. Yousaf",
    email: "a.yousaf@dispensia.pk",
    role: "pharmacist",
    branchId: "br-main",
    status: "active",
    lastActive: "Now",
    pharmacistLicence: "PC-PB-2019-11482",
  },
  {
    id: "m-2",
    name: "M. Raza",
    email: "m.raza@dispensia.pk",
    role: "pharmacist",
    branchId: "br-main",
    status: "active",
    lastActive: "12 minutes ago",
    pharmacistLicence: "PC-PB-2021-30974",
  },
  {
    id: "m-3",
    name: "Talha Yousaf",
    email: "owner@dispensia.pk",
    role: "owner",
    branchId: "br-main",
    status: "active",
    lastActive: "Yesterday",
  },
  {
    id: "m-4",
    name: "H. Salim",
    email: "h.salim@dispensia.pk",
    role: "technician",
    branchId: "br-main",
    status: "active",
    lastActive: "2 hours ago",
  },
  {
    id: "m-5",
    name: "S. Bibi",
    email: "s.bibi@dispensia.pk",
    role: "cashier",
    branchId: "br-main",
    status: "active",
    lastActive: "40 minutes ago",
  },
  {
    id: "m-6",
    name: "K. Ahmed",
    email: "k.ahmed@dispensia.pk",
    role: "pharmacist",
    branchId: "br-johar",
    status: "active",
    lastActive: "3 hours ago",
    pharmacistLicence: "PC-PB-2018-08120",
  },
  {
    id: "m-7",
    name: "N. Fatima",
    email: "n.fatima@dispensia.pk",
    role: "technician",
    branchId: "br-johar",
    status: "invited",
    lastActive: "Invitation sent 2 days ago",
  },
  {
    id: "m-8",
    name: "R. Iqbal",
    email: "audit@dispensia.pk",
    role: "auditor",
    branchId: "br-main",
    status: "active",
    lastActive: "Last week",
  },
  {
    id: "m-9",
    name: "F. Javed",
    email: "f.javed@dispensia.pk",
    role: "cashier",
    branchId: "br-dha",
    status: "suspended",
    lastActive: "Suspended 12 Sep",
  },
];

export const roleById = (id: RoleId) => roles.find((role) => role.id === id)!;
export const branchById = (id: string) => branches.find((branch) => branch.id === id);
export const currentBranch = branches[0];
