import { SettingsView } from "@/components/settings-view";
import { Shell } from "@/components/shell";
import { roles, type Member, type RoleId } from "@/data/organisation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant";
import { getCatalogueMeta, query } from "@/lib/catalogue";
import { RULES } from "@/lib/safety";

export const metadata = {
  title: "Settings · Dispensia",
};

export default async function SettingsPage() {
  const tenant = await getTenant();
  const { organisation, branches } = tenant;

  // The real roster, read from the database rather than invented. Without it
  // the Members screen could show a team but never change one.
  //
  // Scoped to this organisation by hand, because a membership row is readable
  // either as a colleague's or as your own — the second clause is what lets you
  // discover the organisations you belong to before one is active, and left
  // unfiltered it listed you twice: once here, once for the other pharmacy.
  const supabase = await getSupabaseServerClient();
  const { data: activeOrg } = supabase
    ? await supabase.rpc("current_organization_id")
    : { data: null };

  const { data: staff } = supabase
    ? await supabase
        .from("staff_profiles")
        .select("id, full_name, email, role, branch_id, active, created_at")
        .eq("organization_id", activeOrg ?? "00000000-0000-0000-0000-000000000000")
        .order("created_at")
    : { data: null };

  const members: Member[] = (staff ?? []).map((row) => ({
    id: row.id as string,
    name: (row.full_name as string) || (row.email as string) || "Member",
    email: (row.email as string) ?? "—",
    role: (row.role as RoleId) ?? "technician",
    branchId: (row.branch_id as string) ?? tenant.currentBranch.id,
    status: row.active ? "active" : "suspended",
    lastActive: "—",
  }));

  const meta = getCatalogueMeta();
  const stocked = query({ scope: "stocked", size: 1 });

  const catalogue = [
    { label: "Products", value: meta.total.toLocaleString() },
    { label: "Stocked lines", value: stocked.total.toLocaleString() },
    { label: "Molecules", value: meta.facets.molecules.length.toLocaleString() },
    { label: "Manufacturers", value: meta.facets.makers.length.toLocaleString() },
    { label: "Dosage forms", value: String(meta.facets.forms.length) },
    { label: "Clinical flags", value: String(meta.flags.length) },
    { label: "Counselling texts", value: String(meta.counsel.length) },
    { label: "Interaction rules", value: String(RULES.length) },
    { label: "Source", value: meta.source },
    { label: "Built", value: meta.generatedAt.slice(0, 19).replace("T", " ") },
  ];

  return (
    <Shell
      title="Settings"
      meta={
        <>
          <span className="t-sm" data-depth="2">
            {organisation.name}
          </span>
          <span className="t-sm" data-depth="1">
            {branches.length} branches · {members.length} members · {roles.length} roles
          </span>
        </>
      }
    >
      <SettingsView
        organisation={organisation}
        branches={branches}
        members={members}
        roles={roles}
        catalogue={catalogue}
        isDemo={tenant.isDemo}
        account={
          tenant.signedInAs
            ? {
                name: tenant.signedInAs,
                email: tenant.signedInEmail ?? organisation.email,
                role: members[0]?.role ?? "member",
                branch: tenant.currentBranch.name,
              }
            : null
        }
      />
    </Shell>
  );
}
