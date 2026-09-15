"use client";

import { FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { Mark } from "@/components/mark";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Asking for a reset link.
 *
 * The response is deliberately the same whether or not the address has an
 * account. Saying "no account found" turns this form into a way to discover
 * which of a pharmacy's staff addresses are registered, which is worth more to
 * somebody attacking the account than the small convenience it buys a person
 * who mistyped their own email.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured, so passwords cannot be reset in this build.");
      return;
    }

    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);

    // A rate limit is worth saying out loud — it is the one failure the reader
    // can do something about, by waiting.
    if (resetError && /rate|limit|seconds/i.test(resetError.message)) {
      setError(resetError.message);
      return;
    }

    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-6 py-12">
      <Mark size={34} />

      {sent ? (
        <>
          <h1 className="t-display-lg mt-5">Check your email</h1>
          <p className="t-prose mt-2" data-depth="1">
            If <strong>{email.trim()}</strong> has an account, a link to set a new password is on its way.
            It expires in an hour.
          </p>
          <p className="t-prose mt-3" data-depth="1">
            Nothing arrived? The link only reaches addresses this workspace can send to, and sending is
            rate-limited. An owner can reset your password for you from Settings instead.
          </p>
          <a href="/login" className="act act-lg mt-6 self-start">
            Back to sign in
          </a>
        </>
      ) : (
        <>
          <h1 className="t-display-lg mt-5">Reset your password</h1>
          <p className="t-prose mt-2" data-depth="1">
            Enter the address you sign in with and we will send a link to set a new one.
          </p>

          <form onSubmit={submit} className="mt-6">
            <label className="block">
              <span className="t-label">Staff email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError("");
                }}
                className="field mt-1.5"
                autoComplete="username"
                placeholder="you@pharmacy.pk"
                required
                autoFocus
              />
            </label>

            {error ? (
              <p className="band mt-4 t-sm" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            ) : null}

            <button type="submit" className="act act-primary mt-5 h-10 w-full" disabled={busy}>
              <KeyRound size={15} strokeWidth={1.8} />
              {busy ? "Sending…" : "Send the reset link"}
            </button>
          </form>

          <a href="/login" className="t-sm mt-5 self-start" data-depth="1">
            ← Back to sign in
          </a>
        </>
      )}
    </main>
  );
}
