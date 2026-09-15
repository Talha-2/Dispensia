"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, FlaskConical, MapPin, Plus } from "lucide-react";
import { Menu, type MenuEntry } from "@/components/overlays";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { endRouteProgress, startRouteProgress } from "@/lib/route-progress";
import type { Branch } from "@/data/organisation";

export type Membership = {
  organization_id: string;
  name: string;
  is_demo: boolean;
  role: string;
  branch_id: string | null;
  is_active: boolean;
};

/**
 * Switching pharmacy.
 *
 * Sits on the wordmark because that is where the answer to "whose counter am I
 * standing at" belongs — the same place the name is already shown. A locum who
 * covers two shops must never be uncertain which register they are writing to,
 * so the current one is named rather than implied, and the switch reloads the
 * whole page: every screen is built from the active organisation, and patching
 * half of them in place would be a way to read one pharmacy's stock under
 * another's heading.
 */
export function OrgSwitcher({
  current,
  branch,
  collapsed = false,
}: {
  current: string;
  branch: string;
  collapsed?: boolean;
}) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Membership[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const { data } = await supabase.rpc("my_organizations");
      if (alive) setOrgs((data as Membership[]) ?? []);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function switchTo(id: string) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || busy) return;
    setBusy(true);
    startRouteProgress();
    const { error } = await supabase.rpc("switch_organization", { target: id });
    setBusy(false);
    if (error) endRouteProgress();
    if (!error) {
      router.push("/dispensing");
      router.refresh();
    }
  }

  async function joinDemo() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || busy) return;
    setBusy(true);
    startRouteProgress();
    const { error } = await supabase.rpc("join_demo");
    if (error) {
      setBusy(false);
      endRouteProgress();
      return;
    }

    // Fill it on the way in. A demo with no stock and no patients demonstrates
    // nothing, and the seed is idempotent, so a second visitor costs nothing.
    await fetch("/api/demo/seed", { method: "POST" }).catch(() => undefined);
    setBusy(false);
    router.push("/dispensing");
    router.refresh();
  }

  const inDemo = orgs?.some((org) => org.is_demo && org.is_active) ?? false;
  const hasDemo = orgs?.some((org) => org.is_demo) ?? false;

  const items: MenuEntry[] = [
    { label: "Pharmacies", heading: true },
    ...(orgs ?? []).map((org) => ({
      label: `${org.name}${org.is_demo ? " · demo" : ""}`,
      onSelect: () => switchTo(org.organization_id),
      disabled: org.is_active,
      icon: org.is_active ? <Check size={14} strokeWidth={2.2} /> : undefined,
    })),
    { separator: true },
    ...(hasDemo
      ? []
      : [
          {
            label: "Open the demo pharmacy",
            onSelect: joinDemo,
            icon: <FlaskConical size={14} strokeWidth={1.9} />,
          },
        ]),
    {
      label: "Register another pharmacy",
      onSelect: () => router.push("/onboarding"),
      icon: <Plus size={14} strokeWidth={2} />,
    },
  ];

  return (
    <Menu
      label="Switch pharmacy"
      buttonClass={
        collapsed
          ? "act act-quiet act-sm act-icon"
          : "flex w-full items-center gap-2 rounded-(--radius-sm) px-1.5 py-1 text-left transition-colors hover:bg-(--surface-hover)"
      }
      trigger={
        collapsed ? (
          <Building2 size={16} strokeWidth={1.7} />
        ) : (
          <>
            <span className="min-w-0 flex-1 leading-none">
              <span
                className="block truncate"
                style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--ink)" }}
              >
                {current}
              </span>
              <span className="mt-0.5 block truncate" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                {inDemo ? "Demo · resettable" : branch}
              </span>
            </span>
            <ChevronsUpDown size={13} strokeWidth={1.9} className="shrink-0" style={{ color: "var(--ink-4)" }} />
          </>
        )
      }
      items={items}
    />
  );
}

/**
 * Switching branch.
 *
 * A branch is where the stock is and where the register is kept, so this is a
 * property of the shift rather than of the account — it lives in the top bar,
 * beside the organisation it belongs to.
 */
export function BranchSwitcher({
  branches,
  current,
}: {
  branches: Branch[];
  current: Branch;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function switchTo(id: string) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || busy) return;
    setBusy(true);
    startRouteProgress();
    const { error } = await supabase.rpc("switch_branch", { target: id });
    setBusy(false);
    if (error) {
      endRouteProgress();
      return;
    }
    router.refresh();
    // refresh() re-renders in place, so no route commits to end the bar.
    window.setTimeout(endRouteProgress, 900);
  }

  // A closed site takes no deliveries and dispenses nothing, so it is not
  // somewhere you can switch to.
  const open = branches.filter((branch) => !branch.closed);

  if (open.length < 2) {
    return (
      <span className="t-sm flex items-center gap-1.5" data-depth="1">
        <MapPin size={13} strokeWidth={1.8} style={{ color: "var(--ink-4)" }} />
        {current.name}
      </span>
    );
  }

  return (
    <Menu
      label="Switch branch"
      buttonClass="act act-quiet act-sm"
      trigger={
        <>
          <MapPin size={14} strokeWidth={1.8} />
          <span className="max-w-[140px] truncate">{current.name}</span>
          <ChevronsUpDown size={12} strokeWidth={1.9} style={{ color: "var(--ink-4)" }} />
        </>
      }
      items={[
        { label: "Branches", heading: true },
        ...open.map((branch) => ({
          label: branch.name,
          onSelect: () => switchTo(branch.id),
          disabled: branch.id === current.id,
          icon: branch.id === current.id ? <Check size={14} strokeWidth={2.2} /> : undefined,
        })),
      ]}
    />
  );
}
