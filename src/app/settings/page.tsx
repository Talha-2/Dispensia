import { SettingsView } from "@/components/settings-view";
import { Shell } from "@/components/shell";
import { branches, members, organisation, roles } from "@/data/organisation";
import { getCatalogueMeta, query } from "@/lib/catalogue";
import { RULES } from "@/lib/safety";

export const metadata = {
  title: "Settings · Dispensia",
};

export default function SettingsPage() {
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
      />
    </Shell>
  );
}
