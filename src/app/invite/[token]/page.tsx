"use client";

import { FormEvent, use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";
import { Mark } from "@/components/mark";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type Peek = {
  organization_name: string;
  role: string;
  email: string;
  expired: boolean;
  claimed: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner / Admin",
  admin: "Admin",
  pharmacist: "Pharmacist",
  technician: "Pharmacy technician",
  cashier: "Cashier",
  auditor: "Auditor",
};

/**
 * Accepting an invitation.
 *
 * The person arriving here is not a member of anything yet, so nothing on this
 * page can be read through the tenant policies — `peek_invitation` answers for
 * them with the little that is safe to show before sign-in: who invited them,
 * and as what.
 *
 * The token is not sufficient on its own. It was sent to one address, and the
 * database will only redeem it for an account that has proved it owns that
 * address, so a forwarded link is not a way into somebody else's pharmacy.
 */
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const [peek, setPeek] = useState<Peek | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (alive) setState("missing");
        return;
      }

      const [{ data }, { data: auth }] = await Promise.all([
        supabase.rpc("peek_invitation", { invite_token: token }),
        supabase.auth.getUser(),
      ]);
      if (!alive) return;
      const row = Array.isArray(data) ? data[0] : data;
      setSignedInAs(auth.user?.email ?? null);
      if (!row) {
        setState("missing");
        return;
      }
      setPeek(row as Peek);
      setState("ready");
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  async function accept(event: FormEvent) {
    event.preventDefault();
    setError("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !peek) return;

    setBusy(true);

    // An invitee usually has no account yet, so the first step is to make one
    // at the address the invitation was sent to. If they already have it, this
    // fails and we simply sign them in instead.
    if (!signedInAs) {
      if (password.length < 8) {
        setError("Choose a password of at least 8 characters.");
        setBusy(false);
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email: peek.email,
        password,
        options: { data: { full_name: name.trim() || undefined } },
      });

      if (signUpError) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: peek.email,
          password,
        });
        if (signInError) {
          setError(signInError.message);
          setBusy(false);
          return;
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError(
          `Account created for ${peek.email}. Confirm the link in your inbox, then open this invitation again.`,
        );
        setBusy(false);
        return;
      }
    }

    const { error: acceptError } = await supabase.rpc("accept_invitation", { invite_token: token });
    if (acceptError) {
      setError(acceptError.message);
      setBusy(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col justify-center px-6 py-12">
      <Mark size={34} />

      {state === "loading" ? (
        <p className="t-data blink mt-6" data-depth="1">
          Checking the invitation…
        </p>
      ) : state === "missing" || !peek ? (
        <>
          <h1 className="t-display-lg mt-5">This link is not valid</h1>
          <p className="t-prose mt-2" data-depth="1">
            The invitation may have been revoked, or the link may be incomplete. Ask whoever invited you to
            send a new one.
          </p>
          <a href="/login" className="act act-lg mt-6 self-start">
            Go to sign in
          </a>
        </>
      ) : peek.claimed ? (
        <>
          <h1 className="t-display-lg mt-5">Already accepted</h1>
          <p className="t-prose mt-2" data-depth="1">
            This invitation to {peek.organization_name} has already been used. Sign in with{" "}
            <strong>{peek.email}</strong>.
          </p>
          <a href="/login" className="act act-primary act-lg mt-6 self-start">
            Sign in
          </a>
        </>
      ) : peek.expired ? (
        <>
          <h1 className="t-display-lg mt-5">This invitation has expired</h1>
          <p className="t-prose mt-2" data-depth="1">
            Invitations to {peek.organization_name} last 14 days. Ask an owner to send a new one.
          </p>
          <a href="/login" className="act act-lg mt-6 self-start">
            Go to sign in
          </a>
        </>
      ) : (
        <>
          <h1 className="t-display-lg mt-5">Join {peek.organization_name}</h1>
          <p className="t-prose mt-2" data-depth="1">
            You have been invited as <strong>{ROLE_LABEL[peek.role] ?? peek.role}</strong>. Every dispense,
            override and register entry you make will be recorded against your name.
          </p>

          <div className="band mt-5" data-sev="counsel">
            <p className="t-sm">
              <span className="t-label">Invited address</span>
              <br />
              {peek.email}
            </p>
          </div>

          {signedInAs && signedInAs.toLowerCase() !== peek.email.toLowerCase() ? (
            <>
              <p className="band mt-4 t-sm" data-sev="conflict" role="alert">
                You are signed in as <strong>{signedInAs}</strong>, but this invitation was sent to{" "}
                <strong>{peek.email}</strong>. Sign out and sign in as that address to accept it.
              </p>
              <button
                type="button"
                className="act act-lg mt-4 self-start"
                onClick={async () => {
                  await getSupabaseBrowserClient()?.auth.signOut();
                  router.refresh();
                  setSignedInAs(null);
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <form onSubmit={accept} className="mt-5">
              {!signedInAs ? (
                <>
                  <label className="block">
                    <span className="t-label">Your full name</span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="field mt-1.5"
                      autoComplete="name"
                      placeholder="A. Yousaf"
                    />
                    <span className="t-xs mt-1 block" data-depth="1">
                      Printed on every receipt and register entry you sign.
                    </span>
                  </label>

                  <label className="mt-4 block">
                    <span className="t-label">Choose a password</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="field mt-1.5"
                      autoComplete="new-password"
                      required
                    />
                    <span className="t-xs mt-1 block" data-depth="1">
                      At least 8 characters. If you already have an account at this address, enter its
                      password instead.
                    </span>
                  </label>
                </>
              ) : null}

              {error ? (
                <p className="band mt-4 t-sm" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
                  {error}
                </p>
              ) : null}

              <button type="submit" className="act act-primary act-lg mt-5 w-full" disabled={busy}>
                <UserCheck size={16} strokeWidth={1.8} />
                {busy ? "Joining…" : `Join ${peek.organization_name}`}
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
