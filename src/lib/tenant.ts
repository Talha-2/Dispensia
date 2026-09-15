import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
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
  /** Their account address — what invitations are matched against. */
  signedInEmail: string | null;
  /** True when the workspace is showing the shared demo tenant. */
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
  signedInEmail: null,
  isDemo: true,
  needsOnboarding: false,
  ...extra,
});

/**
 * The organisation this request is acting for.
 *
 * Identity comes from Clerk; the organisation behind it comes from Postgres,
 * read through a Clerk-signed token that the database validates itself. For an
 * account with no organisation yet this is the shared Demo tenant, so the
 * product is usable immediately rather than presenting an empty shell —
 * `needsOnboarding` says which of the two it is.
 */
export async function getTenant(): Promise<Tenant> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return demoTenant();

  // The session token carries these when the instance's token template adds
  // them. Falling back to the Clerk API keeps the header honest if it does not,
  // though the database still needs the claim for invitations to match.
  const claims = sessionClaims as { email?: string; name?: string } | null;
  let email = claims?.email ?? null;
  let name = claims?.name ?? null;

  if (!email || !name) {
    const user = await currentUser().catch(() => null);
    email = email ?? user?.primaryEmailAddress?.emailAddress ?? null;
    name =
      name ??
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ??
      null;
  }

  const displayName = name?.trim() || email || null;

  const supabase = await getSupabaseServerClient();
  if (!supabase) return demoTenant({ signedInAs: displayName, signedInEmail: email });

  // Which pharmacy this person is acting for. Since an account can belong to
  // more than one, the id alone no longer identifies a membership — asking for
  // a single row by user returned an error the moment somebody joined a second
  // organisation, and dropped them silently onto the demo.
  const { data: activeOrg } = await supabase.rpc("current_organization_id");

  const { data: profiles } = await supabase
    .from("staff_profiles")
    .select("organization_id, branch_id, full_name")
    .eq("id", userId)
    .eq("organization_id", activeOrg ?? "00000000-0000-0000-0000-000000000000")
    .limit(1);

  const profile = profiles?.[0] ?? null;

  if (!profile?.organization_id) {
    return demoTenant({ signedInAs: displayName, signedInEmail: email, needsOnboarding: true });
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

  if (!org) {
    return demoTenant({ signedInAs: displayName, signedInEmail: email, needsOnboarding: true });
  }

  const list = (rows ?? []).map(toBranch);
  const current =
    list.find((branch) => branch.id === profile.branch_id) ?? list[0] ?? demoBranches[0];

  return {
    organisation: toOrganisation(org as OrgRow),
    branches: list.length ? list : demoBranches,
    currentBranch: current,
    signedInAs: profile.full_name?.trim() || displayName,
    signedInEmail: email,
    isDemo: Boolean((org as OrgRow).is_demo),
    needsOnboarding: false,
  };
}
