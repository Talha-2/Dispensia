"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Mark } from "@/components/mark";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Stage = "checking" | "ready" | "invalid";

/**
 * Setting a new password from a reset link.
 *
 * The link carries a one-time recovery credential. Supabase turns it into a
 * short-lived session — either by detecting it in the URL, or, on the PKCE
 * flow, by exchanging a `code` parameter — and that session is what authorises
 * the change. Both shapes are handled, because which one arrives depends on
 * project settings rather than on anything this page controls.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (alive) setStage("invalid");
        return;
      }

      // PKCE: the link lands with ?code=… and has to be exchanged first.
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code).catch(() => undefined);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!alive) return;
      setStage(session ? "ready" : "invalid");
    })();

    // The implicit flow fires this once it has parsed the URL fragment, which
    // can land after the check above.
    const supabase = getSupabaseBrowserClient();
    const { data: sub } = supabase?.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setStage("ready");
    }) ?? { data: null };

    return () => {
      alive = false;
      sub?.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords do not match.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // The recovery session is now a real one, so there is nothing to sign in
    // to again — straight to the counter.
    router.push("/dispensing");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-6 py-12">
      <Mark size={34} />

      {stage === "checking" ? (
        <p className="t-data blink mt-6" data-depth="1">
          Checking the link…
        </p>
      ) : stage === "invalid" ? (
        <>
          <h1 className="t-display-lg mt-5">This link is not valid</h1>
          <p className="t-prose mt-2" data-depth="1">
            Reset links can only be used once and expire after an hour. Ask for a new one, or have an owner
            reset your password from Settings.
          </p>
          <a href="/forgot-password" className="act act-primary act-lg mt-6 self-start">
            Send a new link
          </a>
        </>
      ) : (
        <>
          <h1 className="t-display-lg mt-5">Set a new password</h1>
          <p className="t-prose mt-2" data-depth="1">
            You will be signed in straight away. Anyone still signed in on another device keeps their
            session until it expires.
          </p>

          <form onSubmit={submit} className="mt-6">
            <label className="block">
              <span className="t-label">New password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError("");
                }}
                className="field mt-1.5"
                autoComplete="new-password"
                required
                autoFocus
              />
              <span className="t-xs mt-1 block" data-depth="1">
                At least 8 characters.
              </span>
            </label>

            <label className="mt-4 block">
              <span className="t-label">Repeat it</span>
              <input
                type="password"
                value={confirm}
                onChange={(event) => {
                  setConfirm(event.target.value);
                  if (error) setError("");
                }}
                className="field mt-1.5"
                autoComplete="new-password"
                required
              />
            </label>

            {error ? (
              <p className="band mt-4 t-sm" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
                {error}
              </p>
            ) : null}

            <button type="submit" className="act act-primary mt-5 h-10 w-full" disabled={busy}>
              <KeyRound size={15} strokeWidth={1.8} />
              {busy ? "Saving…" : "Set the password"}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
