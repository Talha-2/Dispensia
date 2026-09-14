"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, BookLock, ShieldCheck } from "lucide-react";
import { Mark } from "@/components/mark";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

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

  // Any message describes the attempt that produced it. The moment the reader
  // changes something, it is describing the past — so it goes.
  const edit = <T,>(set: (value: T) => void) => (value: T) => {
    if (error) setError("");
    if (notice) setNotice("");
    set(value);
  };

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

      // Supabase returns a user with no session when email confirmation is on —
      // but it returns the same shape for an address that already exists and is
      // already confirmed. Rather than telling somebody to go and confirm an
      // account they confirmed last week, try signing them in: if the address is
      // usable, that succeeds and they are simply in.
      if (!data.session) {
        const { error: straightIn } = await supabase.auth.signInWithPassword({ email, password });

        if (straightIn) {
          setNotice(
            `Check ${email} for a confirmation link. Once you have clicked it, sign in here with the password you just chose.`,
          );
          setMode("signin");
          setBusy(false);
          return;
        }
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
              onChange={(event) => edit(setName)(event.target.value)}
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
            onChange={(event) => edit(setEmail)(event.target.value)}
            className="field mt-1.5"
            autoComplete="username"
            placeholder="you@pharmacy.pk"
            required
          />
        </label>

        <label className="mt-4 block">
          <span className="t-label">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => edit(setPassword)(event.target.value)}
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
          {/* The product, not a tenant: this page is reached before anybody
              knows which pharmacy you belong to. */}
          <p className="t-prose mt-2" data-depth="1">
            Counter dispensing, stock and the controlled-drug register for your pharmacy — with the
            clinical safety engine running on every basket.
          </p>
          <Suspense fallback={null}>
            <Auth />
          </Suspense>
        </div>
      </div>

      {/* What the workspace is, stated in facts rather than claims. */}
      <div
        className="flex items-center border-t border-(--line) px-6 py-12 lg:w-[46%] lg:border-l lg:border-t-0 lg:px-14"
        style={{ background: "var(--surface)" }}
      >
        <div className="mx-auto w-full max-w-[460px]">
          <p className="t-label">What this workspace does</p>
          <h2 className="t-display mt-3">
            The safety engine runs on the whole basket, every time it changes.
          </h2>

          {/* Three claims, each with the mechanism that makes it true. A stat
              grid alone said how big the catalogue is and nothing about why a
              pharmacist would trust it. */}
          <div className="mt-7">
            {[
              {
                icon: <ShieldCheck size={17} strokeWidth={1.7} />,
                title: "Interactions, before handover",
                body: "34 rules ported from the incumbent engine, evaluated against every product in the basket together — not line by line, because the danger is usually in the combination that was safe a moment ago.",
              },
              {
                icon: <Activity size={17} strokeWidth={1.7} />,
                title: "Stewardship that is an obligation",
                body: "WHO AWaRe class is read off the product record. A Reserve antibiotic raises a gate of its own, alongside the interaction rules.",
              },
              {
                icon: <BookLock size={17} strokeWidth={1.7} />,
                title: "A register that cannot be edited",
                body: "Controlled supplies write an append-only entry before the basket can close. A correction is a new line, never a change to an old one.",
              },
            ].map((item) => (
              <div key={item.title} className="baseline flex items-start gap-3 py-3 last:border-b-0">
                <span className="mt-0.5 shrink-0" style={{ color: "var(--primary)" }}>
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <h3 className="t-data" data-depth="3">
                    {item.title}
                  </h3>
                  <p className="t-prose mt-1" data-depth="1">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* The scale of the catalogue, as a footer strip rather than the
              headline — it is evidence for the claims above, not the pitch. */}
          <dl className="mt-6 grid grid-cols-3 gap-x-4 border-t border-(--line) pt-4">
            {[
              ["10,434", "products"],
              ["2,017", "molecules"],
              ["1,406", "AWaRe graded"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="t-stat">{value}</dt>
                <dd className="t-sm mt-0.5" data-depth="1">
                  {label}
                </dd>
              </div>
            ))}
          </dl>

          <p className="t-sm mt-5" data-depth="0">
            Product facts are real. Stock levels, batches, patients and register entries are demo data and
            are labelled as such throughout the workspace.
          </p>
        </div>
      </div>
    </main>
  );
}
