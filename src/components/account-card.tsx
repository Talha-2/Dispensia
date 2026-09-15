"use client";

import { useState } from "react";
import { Check, KeyRound, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Your own account.
 *
 * Changing a password here needs no email at all — the session already proves
 * who you are. That matters more than it sounds: the emailed reset link is the
 * flow that breaks first, because it depends on deliverability, and a
 * pharmacist locked out mid-shift cannot wait for an inbox.
 *
 * The current password is asked for anyway. The session is enough for Supabase,
 * but a counter terminal left signed in is the normal case in a pharmacy, and
 * without it anyone walking past could take the account.
 */
export function AccountCard({
  name,
  email,
  role,
  branch,
  onDone,
}: {
  name: string;
  email: string;
  role: string;
  branch: string;
  onDone: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError("");
  }

  async function save() {
    setError("");

    if (next.length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("Those two passwords do not match.");
      return;
    }
    if (next === current) {
      setError("That is the password you already have.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured, so the password cannot be changed.");
      return;
    }

    setBusy(true);

    // Re-authenticate before changing anything. Supabase would accept the
    // session alone; a shared counter terminal is why we do not.
    const { error: wrongPassword } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });

    if (wrongPassword) {
      setBusy(false);
      setError("That is not your current password.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    reset();
    setOpen(false);
    onDone("Password changed. Other devices stay signed in until their session expires.");
  }

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

        {open ? (
          <>
            <button
              type="button"
              className="act act-sm"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              disabled={busy}
            >
              <X size={14} strokeWidth={2} />
              Cancel
            </button>
            <button type="button" className="act act-primary act-sm" onClick={save} disabled={busy}>
              <Check size={14} strokeWidth={2} />
              {busy ? "Saving…" : "Save password"}
            </button>
          </>
        ) : (
          <button type="button" className="act act-sm" onClick={() => setOpen(true)}>
            <KeyRound size={14} strokeWidth={1.9} />
            Change password
          </button>
        )}
      </div>

      {[
        ["Name", name],
        ["Email", email],
        ["Role", role],
        ["Branch", branch],
      ].map(([label, value]) => (
        <div key={label} className="baseline flex flex-wrap items-baseline gap-x-3 px-4 py-2">
          <span className="t-sm w-[150px] shrink-0" data-depth="1">
            {label}
          </span>
          <span className="t-data min-w-0 flex-1 font-medium" style={{ color: "var(--ink)" }}>
            {value}
          </span>
        </div>
      ))}

      {open ? (
        <div className="p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="t-label">Current password</span>
              <input
                type="password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                className="field mt-1.5 h-9"
                autoComplete="current-password"
              />
            </label>
            <label className="block">
              <span className="t-label">New password</span>
              <input
                type="password"
                value={next}
                onChange={(event) => setNext(event.target.value)}
                className="field mt-1.5 h-9"
                autoComplete="new-password"
              />
            </label>
            <label className="block">
              <span className="t-label">Repeat it</span>
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="field mt-1.5 h-9"
                autoComplete="new-password"
              />
            </label>
          </div>

          <p className="t-xs mt-2" data-depth="1">
            At least 8 characters. No email is involved — you are already signed in.
          </p>

          {error ? (
            <p className="band t-sm mt-3" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
