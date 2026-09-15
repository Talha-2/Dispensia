"use client";

import { UserButton, useClerk } from "@clerk/nextjs";
import { KeyRound } from "lucide-react";

/**
 * Your own account.
 *
 * Passwords, connected Google accounts, two-factor and the whole recovery path
 * belong to Clerk now, so this does not reimplement any of them — it opens
 * Clerk's own account screen. What it does own is the part Clerk cannot know:
 * which pharmacy you belong to, on which branch, in which role, because that is
 * what decides whether you may clear a clinical finding.
 */
export function AccountCard({
  name,
  email,
  role,
  branch,
}: {
  name: string;
  email: string;
  role: string;
  branch: string;
}) {
  const { openUserProfile } = useClerk();

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="min-w-0 flex-1">
          <span className="t-data block font-semibold" style={{ color: "var(--ink)" }}>
            Your account
          </span>
          <span className="t-xs block" data-depth="1">
            The name recorded against every dispense you make
          </span>
        </span>

        <button type="button" className="act act-sm" onClick={() => openUserProfile()}>
          <KeyRound size={14} strokeWidth={1.9} />
          Password and security
        </button>
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        <UserButton appearance={{ elements: { userButtonAvatarBox: { width: 36, height: 36 } } }} />
        <span className="min-w-0">
          <span className="t-data block font-semibold" style={{ color: "var(--ink)" }}>
            {name}
          </span>
          <span className="t-sm block truncate" data-depth="1">
            {email}
          </span>
        </span>
      </div>

      {[
        ["Role", role],
        ["Branch", branch],
      ].map(([label, value]) => (
        <div key={label} className="baseline flex flex-wrap items-baseline gap-x-3 px-4 py-2 last:border-b-0">
          <span className="t-sm w-[150px] shrink-0" data-depth="1">
            {label}
          </span>
          <span className="t-data min-w-0 flex-1 font-medium" style={{ color: "var(--ink)" }}>
            {value}
          </span>
        </div>
      ))}
    </section>
  );
}
