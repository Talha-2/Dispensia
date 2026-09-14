import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  branches as demoBranches,
  organisation as demoOrganisation,
  type Branch,
  type Organisation,
} from "@/data/organisation";

export type Tenant = {
  organisation: Organisation;
  branches: Branch[];
  currentBranch: Branch;
  /** The signed-in person's display name, for receipts and register entries. */
  signedInAs: string | null;
  /** True when the workspace is showing the shared showroom tenant. */
  isDemo: boolean;
  /** True when the account has no organisation yet and should be onboarded. */
  needsOnboarding: boolean;
};

type OrgRow = {
  id: string;
  name: string;
  legal_name: string | null;
  ntn: string | null;
  drap_licence: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string | null;
  tax_note: string | null;
  is_demo: boolean | null;
};

type BranchRow = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  licence: string | null;
  hours: string | null;
  is_primary: boolean | null;
};

const ORG_FIELDS =
  "id, name, legal_name, ntn, drap_licence, address, phone, email, currency, tax_note, is_demo";
const BRANCH_FIELDS = "id, name, city, address, phone, licence, hours, is_primary";

const toOrganisation = (row: OrgRow): Organisation => ({
  name: row.name,
  legalName: row.legal_name ?? row.name,
  ntn: row.ntn ?? "—",
  drapLicence: row.drap_licence ?? "—",
  address: row.address ?? "—",
  phone: row.phone ?? "—",
  email: row.email ?? "—",
  currency: row.currency ?? "PKR",
  taxNote: row.tax_note ?? "Prices include GST where applicable.",
  isDemo: Boolean(row.is_demo),
});

const toBranch = (row: BranchRow): Branch => ({
  id: row.id,
  name: row.name,
  city: row.city ?? "—",
  address: row.address ?? "—",
  phone: row.phone ?? "—",
  licence: row.licence ?? "—",
  hours: row.hours ?? "—",
  isPrimary: Boolean(row.is_primary),
  staff: 0,
});

const demoTenant = (extra: Partial<Tenant> = {}): Tenant => ({
  organisation: demoOrganisation,
  branches: demoBranches,
  currentBranch: demoBranches[0],
  signedInAs: null,
  isDemo: true,
  needsOnboarding: false,
  ...extra,
});

/**
 * The organisation this request is acting for.
 *
 * Without Supabase configured, or for an account that has not created an
 * organisation yet, this is the shared Demo tenant — the product is usable
 * immediately rather than presenting an empty shell. `needsOnboarding` says
 * which of the two it is, so the UI can offer to create a real one without
 * blocking the way in.
 */
export async function getTenant(): Promise<Tenant> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return demoTenant();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return demoTenant();

  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.trim() || user.email || null;

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("organization_id, branch_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  // Signed in, but not a member of anything yet: show the demo and offer to
  // create a real organisation.
  if (!profile?.organization_id) {
    return demoTenant({ signedInAs: displayName, needsOnboarding: true });
  }

  const [{ data: org }, { data: rows }] = await Promise.all([
    supabase.from("organizations").select(ORG_FIELDS).eq("id", profile.organization_id).maybeSingle(),
    supabase
      .from("branches")
      .select(BRANCH_FIELDS)
      .eq("organization_id", profile.organization_id)
      .order("is_primary", { ascending: false })
      .order("name"),
  ]);

  if (!org) return demoTenant({ signedInAs: displayName, needsOnboarding: true });

  const list = (rows ?? []).map(toBranch);
  const current =
    list.find((branch) => branch.id === profile.branch_id) ?? list[0] ?? demoBranches[0];

  return {
    organisation: toOrganisation(org as OrgRow),
    branches: list.length ? list : demoBranches,
    currentBranch: current,
    signedInAs: profile.full_name?.trim() || displayName,
    isDemo: Boolean((org as OrgRow).is_demo),
    needsOnboarding: false,
  };
}
