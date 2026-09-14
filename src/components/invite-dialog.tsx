"use client";

import { useState } from "react";
import { Copy, Link2, UserPlus } from "lucide-react";
import { Dialog } from "@/components/overlays";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Branch, Role, RoleId } from "@/data/organisation";

/**
 * Inviting a colleague.
 *
 * No email is sent. The organisation gets a link, and passes it on however it
 * already talks to its staff — which is WhatsApp, in most Pakistani pharmacies.
 * That removes an entire class of failure (deliverability, spam folders, SMTP
 * rate limits) from the one flow that decides whether a second person can use
 * the product at all.
 *
 * The link is not a bearer token in the usual sense: the database will only
 * redeem it for an account that has proved it owns the invited address, so a
 * forwarded link cannot be used by whoever it was forwarded to.
 */
export function InviteDialog({
  open,
  roles,
  branches,
  onClose,
  onInvited,
}: {
  open: boolean;
  roles: Role[];
  branches: Branch[];
  onClose: () => void;
  onInvited: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleId>("technician");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const chosen = roles.find((entry) => entry.id === role);

  function reset() {
    setEmail("");
    setError("");
    setLink(null);
    setCopied(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Enter a valid work email address.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured, so invitations cannot be issued in this build.");
      return;
    }

    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc("invite_member", {
      invite_email: email.trim().toLowerCase(),
      invite_role: role,
      // A branch id only exists once the organisation is real; the demo's
      // synthetic ids are not uuids, so they are not sent.
      invite_branch: /^[0-9a-f-]{36}$/i.test(branchId) ? branchId : null,
    });
    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.token) {
      setError("The invitation was not created. Check that your role permits inviting staff.");
      return;
    }

    setLink(`${window.location.origin}/invite/${row.token}`);
    onInvited(email.trim().toLowerCase());
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={link ? "Invitation ready" : "Invite a member"}
      description={
        link
          ? "Send this link to them. It works once, expires in 14 days, and only opens for the address it was issued to."
          : "Creates a single-use join link. No email is sent — you pass the link on yourself."
      }
      width={560}
      footer={
        link ? (
          <>
            <button
              type="button"
              className="act"
              onClick={() => {
                reset();
              }}
            >
              Invite another
            </button>
            <button
              type="button"
              className="act act-primary"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              Done
            </button>
          </>
        ) : (
          <>
            <button type="button" className="act" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" form="invite-member" className="act act-primary" disabled={busy}>
              <UserPlus size={15} strokeWidth={1.8} />
              {busy ? "Creating…" : "Create join link"}
            </button>
          </>
        )
      }
    >
      {link ? (
        <div>
          <div className="panel-flat flex items-center gap-2 p-2.5">
            <Link2 size={15} strokeWidth={1.8} className="shrink-0" style={{ color: "var(--ink-3)" }} />
            <input
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
              className="t-code min-w-0 flex-1 bg-transparent outline-none"
              style={{ color: "var(--ink)" }}
              aria-label="Invitation link"
            />
            <button type="button" className="act act-sm shrink-0" onClick={copy}>
              <Copy size={14} strokeWidth={1.9} />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <p className="t-prose mt-3" data-depth="2">
            Sent to <strong>{email}</strong> as {chosen?.name ?? role}. They will be asked to set a password
            for that address; the link will not open for any other account.
          </p>
        </div>
      ) : (
        <form id="invite-member" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Work email" required className="sm:col-span-2">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field"
              autoComplete="off"
              placeholder="colleague@pharmacy.pk"
            />
          </Field>

          <Field label="Role" required>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as RoleId)}
              className="field"
            >
              {roles
                .filter((entry) => entry.id !== "owner")
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
            </select>
          </Field>

          <Field label="Branch">
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="field"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </Field>

          {chosen ? (
            <div className="band sm:col-span-2" data-sev={role === "pharmacist" ? "counsel" : "ok"}>
              <p className="t-label" style={{ color: "var(--ink)" }}>
                {chosen.name} can
              </p>
              <p className="t-prose mt-1" data-depth="2">
                {chosen.can.join(" · ")}
              </p>
              {chosen.cannot.length ? (
                <p className="t-prose mt-1.5" data-depth="1">
                  Cannot: {chosen.cannot.join(" · ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="band t-sm sm:col-span-2" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          ) : null}
        </form>
      )}
    </Dialog>
  );
}

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="t-label">
        {label}
        {required ? <span style={{ color: "var(--danger)" }}> *</span> : null}
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
