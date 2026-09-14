"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mark } from "@/components/mark";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { organisation } from "@/data/organisation";

type Mode = "signin" | "signup";

function Auth() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dispensing";

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const switchTo = (to: Mode) => {
    setMode(to);
    setError("");
    setNotice("");
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    // A password a counter can guess is a password that ends up on a sticky
    // note, so the floor is enforced here rather than left to the server.
    if (mode === "signup" && password.length < 8) {
      setError("Choose a password of at least 8 characters.");
      return;
    }

    setBusy(true);
    const supabase = getSupabaseBrowserClient();

    // Without Supabase configured the workspace still opens, on demo data.
    if (!supabase) {
      router.push(next);
      return;
    }

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: typeof window === "undefined" ? undefined : `${window.location.origin}${next}`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setBusy(false);
        return;
      }

      // Supabase returns a user with no session when email confirmation is on.
      if (!data.session) {
        setNotice(`Account created. Confirm the link sent to ${email}, then sign in.`);
        setMode("signin");
        setPassword("");
        setBusy(false);
        return;
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setBusy(false);
        return;
      }
    }

    router.push(next);
    router.refresh();
  }

  return (
    <>
      <div className="seg mt-6 w-full" role="group" aria-label="Sign in or create an account">
        <button
          type="button"
          className="flex-1"
          aria-pressed={mode === "signin"}
          onClick={() => switchTo("signin")}
        >
          Sign in
        </button>
        <button
          type="button"
          className="flex-1"
          aria-pressed={mode === "signup"}
          onClick={() => switchTo("signup")}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5">
        {mode === "signup" ? (
          <label className="mb-4 block">
            <span className="t-label">Full name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field mt-1.5"
              autoComplete="name"
              placeholder="A. Yousaf"
              required
            />
            <span className="t-xs mt-1 block" data-depth="1">
              Printed on every receipt and register entry you sign.
            </span>
          </label>
        ) : null}

        <label className="block">
          <span className="t-label">Staff email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field mt-1.5"
            autoComplete="username"
            placeholder={`you@${organisation.email.split("@")[1] ?? "dispensia.pk"}`}
            required
          />
        </label>

        <label className="mt-4 block">
          <span className="t-label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field mt-1.5"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
          />
          {mode === "signup" ? (
            <span className="t-xs mt-1 block" data-depth="1">
              At least 8 characters.
            </span>
          ) : null}
        </label>

        {error ? (
          <p className="band mt-4 t-sm" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}

        {notice ? (
          <p className="band mt-4 t-sm" data-sev="ok" role="status" style={{ color: "var(--ok)" }}>
            {notice}
          </p>
        ) : null}

        <button type="submit" className="act act-primary mt-5 h-10 w-full" disabled={busy}>
          {busy
            ? mode === "signup"
              ? "Creating account…"
              : "Signing in…"
            : mode === "signup"
              ? "Create account"
              : "Sign in"}
        </button>

        <p className="t-sm mt-4" data-depth="1">
          {mode === "signup"
            ? "A new account starts with no branch role. An owner assigns one in Settings before it can clear a clinical finding."
            : "Every dispense, override and register entry is recorded against the person signed in."}
        </p>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* Sign-in is the task; it gets the calm half. */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-[380px]">
          <Mark size={36} />
          <h1 className="t-display-lg mt-5">Dispensia</h1>
          <p className="t-prose mt-2" data-depth="1">
            The counter workspace for {organisation.name} — dispensing, stock and the controlled-drug
            register, with the safety engine running on every basket.
          </p>
          <Suspense fallback={null}>
            <Auth />
          </Suspense>
        </div>
      </div>

      {/* What the workspace is, stated in facts rather than claims. */}
      <div
        className="border-t border-(--line) px-6 py-12 lg:w-[46%] lg:border-l lg:border-t-0 lg:px-14"
        style={{ background: "var(--surface)" }}
      >
        <div className="mx-auto max-w-[460px]">
          <p className="t-label">Main Branch · Lahore</p>
          <h2 className="t-display mt-3">
            The safety engine runs on the whole basket, every time it changes.
          </h2>
          <p className="t-prose mt-3" data-depth="1">
            Interactions, WHO AWaRe stewardship, controlled-drug obligations and counselling duties are
            read off each product record — not inferred at the counter.
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5">
            {[
              ["10,434", "products in the catalogue"],
              ["2,017", "distinct molecules"],
              ["34", "interaction rules armed"],
              ["1,406", "AWaRe-classified antibiotics"],
              ["841", "manufacturers"],
              ["255", "counselling duties"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="t-stat">{value}</dt>
                <dd className="t-sm mt-0.5" data-depth="1">
                  {label}
                </dd>
              </div>
            ))}
          </dl>

          <p className="t-sm mt-8 border-t border-(--line) pt-4" data-depth="0">
            Product facts are real. Stock levels, batches, patients and register entries are demo data and
            are labelled as such throughout the workspace.
          </p>
        </div>
      </div>
    </main>
  );
}
