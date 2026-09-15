"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  BadgeCheck,
  Boxes,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Settings as SettingsIcon,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useClerk } from "@clerk/nextjs";
import { Mark } from "@/components/mark";
import { OrgSwitcher, type Membership } from "@/components/switchers";

export type RailCounts = {
  reorder: number;
  expiring: number;
  reserve: number;
  controlled: number;
  stocked: number;
  total: number;
};

const ICON = { size: 16, strokeWidth: 1.7 } as const;

const NAV = [
  { label: "Counter", href: "/dispensing", key: "1", group: "Dispensing", icon: <ClipboardList {...ICON} /> },
  { label: "Patients", href: "/patients", key: "2", group: "Dispensing", icon: <Users {...ICON} /> },
  { label: "Safety", href: "/safety", key: "3", group: "Dispensing", icon: <ShieldAlert {...ICON} /> },
  { label: "Register", href: "/register", key: "4", group: "Dispensing", icon: <BadgeCheck {...ICON} /> },
  // Catalogue and Stock were the same screen with one filter locked; the scope
  // toggle inside the catalogue replaced the second entry.
  { label: "Stock", href: "/inventory", key: "5", group: "Inventory", icon: <Package {...ICON} /> },
  { label: "Catalogue", href: "/catalogue", key: "6", group: "Inventory", icon: <Boxes {...ICON} /> },
  { label: "Overview", href: "/dashboard", key: "7", group: "Management", icon: <LayoutDashboard {...ICON} /> },
  { label: "Reports", href: "/reports", key: "8", group: "Management", icon: <FileText {...ICON} /> },
  { label: "Settings", href: "/settings", key: "9", group: "Management", icon: <SettingsIcon {...ICON} /> },
];

const GROUPS = ["Dispensing", "Inventory", "Management"];

/* The rail is collapsed to icons by default and expands on hover, so the work
   area keeps the width the whole time. Pinning it open is a preference that
   survives navigation; localStorage is read through useSyncExternalStore, which
   is the one way to read browser storage during render without an effect
   writing state back on every mount. */
const RAIL_KEY = "sd.rail";
const listeners = new Set<() => void>();

function subscribeRail(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Pinned open is the opt-in; icons-with-hover is the default. */
function readRail() {
  try {
    return window.localStorage.getItem(RAIL_KEY) === "pinned";
  } catch {
    return false;
  }
}

function writeRail(pinned: boolean) {
  try {
    window.localStorage.setItem(RAIL_KEY, pinned ? "pinned" : "hover");
  } catch {
    /* private mode — the rail simply forgets between visits */
  }
  listeners.forEach((listener) => listener());
}

/**
 * The navigation rail is fixed for the whole session: it never scrolls with the
 * page, and it scrolls inside itself only if the viewport is too short to hold
 * it. The branch-signal block is pinned to the bottom so the counts a
 * pharmacist glances at are always in the same place.
 */
export function Rail({
  counts,
  organisation,
  branch,
  memberships,
}: {
  counts: RailCounts;
  organisation: string;
  branch: string;
  memberships: Membership[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const pinned = useSyncExternalStore(subscribeRail, readRail, () => false);
  const [hovered, setHovered] = useState(false);
  const toggle = useCallback(() => writeRail(!readRail()), []);

  // Expanded when pinned or hovered; the page's left inset follows the PINNED
  // width only, so hovering overlays the content instead of reflowing the table
  // underneath the pointer.
  const open = pinned || hovered;

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--rail-width",
      pinned ? "var(--rail)" : "var(--rail-collapsed)",
    );
  }, [pinned]);

  // A client-side push, never a hard navigation: Alt+1–9 must not discard a
  // basket the pharmacist is part-way through building.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!event.altKey || event.metaKey || event.ctrlKey) return;
      const item = NAV.find((entry) => entry.key === event.key);
      if (!item) return;
      event.preventDefault();
      router.push(item.href);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setHovered(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setHovered(false);
      }}
      className="no-print fixed inset-y-0 left-0 z-40 hidden shrink-0 flex-col border-r border-(--line) bg-(--surface) transition-[width] duration-200 ease-out lg:flex"
      style={{
        width: open ? "var(--rail)" : "var(--rail-collapsed)",
        boxShadow: open && !pinned ? "var(--shadow-lg)" : undefined,
      }}
    >
      <div
        className={`flex h-[var(--header)] shrink-0 items-center border-b border-(--line) ${
          open ? "px-4" : "justify-center"
        }`}
      >
        {/* The wordmark is also the answer to "whose counter is this", so the
            switch lives on it rather than somewhere else in the chrome. */}
        <span className={open ? "flex w-full items-center gap-2" : ""}>
          <Link href="/dispensing" aria-label="Dispensia home" className="shrink-0">
            <Mark size={open ? 26 : 24} />
          </Link>
          {open ? (
            <OrgSwitcher current={organisation} branch={branch} memberships={memberships} />
          ) : null}
        </span>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3" aria-label="Primary">
        {GROUPS.map((group) => (
          <div key={group} className="mb-4 last:mb-0">
            {open ? <p className="pop-label px-2 pb-0.5">{group}</p> : null}
            <div className="space-y-0.5">
              {NAV.filter((item) => item.group === group).map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={open ? undefined : `${item.label} (Alt+${item.key})`}
                    className={`group relative flex h-9 items-center rounded-(--radius-sm) text-[13.5px] transition-colors duration-150 ${
                      open ? "gap-2.5 px-2.5" : "justify-center"
                    }`}
                    style={{
                      background: active ? "var(--primary-soft)" : undefined,
                      color: active ? "var(--primary-deep)" : "var(--ink-2)",
                      fontWeight: active ? 600 : 450,
                      boxShadow: active ? "inset 0 0 0 1px var(--primary-line)" : undefined,
                    }}
                  >
                    <span
                      className="shrink-0 transition-opacity"
                      style={{ opacity: active ? 1 : 0.62 }}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                    {open ? (
                      <span className="flex-1 truncate">{item.label}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {open ? (
        <div className="shrink-0 px-3 pb-2">
          <div className="rounded-(--radius) border border-(--line) bg-(--surface-sunk) p-3">
            <p className="pop-label px-0 pt-0">Needs attention</p>
            <dl className="mt-1.5 space-y-1.5">
              {[
                { label: "Needs reorder", value: counts.reorder, tone: counts.reorder ? "var(--warn)" : undefined, href: "/inventory" },
                { label: "Expiring 90d", value: counts.expiring, tone: counts.expiring ? "var(--warn)" : undefined, href: "/inventory" },
                { label: "Reserve antibiotics", value: counts.reserve, href: "/catalogue?aware=RESERVE" },
                { label: "Controlled lines", value: counts.controlled, href: "/register" },
              ].map((row) => (
                <Link
                  key={row.label}
                  href={row.href}
                  className="row -mx-1 flex items-baseline justify-between gap-2 rounded-(--radius-xs) px-1 py-0.5"
                >
                  <dt className="t-sm truncate" data-depth="1">
                    {row.label}
                  </dt>
                  <dd className="t-sm t-num font-semibold" style={{ color: row.tone ?? "var(--ink)" }}>
                    {row.value.toLocaleString()}
                  </dd>
                </Link>
              ))}
            </dl>
            <p className="t-xs mt-2.5 border-t border-(--line) pt-2" data-depth="1">
              <span className="font-semibold" style={{ color: "var(--ink)" }}>
                {counts.stocked.toLocaleString()}
              </span>{" "}
              stocked of {counts.total.toLocaleString()}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex shrink-0 items-center gap-1 border-t border-(--line) p-2">
        {/* A link to /sign-in was never a sign-out: Clerk sees a live session,
            bounces straight back, and the session survives. Ending it has to be
            an actual call. */}
        <button
          type="button"
          title="Sign out"
          onClick={() => signOut({ redirectUrl: "/sign-in" })}
          className={`act act-quiet act-sm ${open ? "flex-1 justify-start" : "act-icon"}`}
        >
          <LogOut size={15} strokeWidth={1.7} />
          {open ? "Sign out" : null}
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-label={pinned ? "Unpin navigation" : "Pin navigation open"}
          className={`act act-quiet act-sm act-icon ${open ? "" : "mx-auto"}`}
        >
          {pinned ? <ChevronsLeft size={15} strokeWidth={1.7} /> : <ChevronsRight size={15} strokeWidth={1.7} />}
        </button>
      </div>
    </aside>
  );
}

/**
 * The rail has no room on a phone, so the sections become a scrolling strip.
 * Four of nine fit at 390px, so the strip fades at its right edge — otherwise
 * there is nothing on screen to say the rest exist.
 */
export function RailStrip() {
  const pathname = usePathname();
  return (
    <nav
      className="no-print relative flex gap-1 overflow-x-auto border-t border-(--line-soft) px-3 py-1.5 lg:hidden"
      aria-label="Primary"
      style={{
        scrollbarWidth: "none",
        maskImage: "linear-gradient(to right, var(--ink) calc(100% - 28px), transparent)",
        WebkitMaskImage: "linear-gradient(to right, var(--ink) calc(100% - 28px), transparent)",
      }}
    >
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-(--radius-sm) px-2.5 text-[13px]"
            style={{
              background: active ? "var(--primary-soft)" : undefined,
              color: active ? "var(--primary-deep)" : "var(--ink-3)",
              fontWeight: active ? 600 : 450,
            }}
          >
            <span style={{ opacity: active ? 1 : 0.6 }} aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
