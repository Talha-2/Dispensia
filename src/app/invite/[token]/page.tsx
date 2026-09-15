"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignUpButton, useAuth, useClerk, useUser } from "@clerk/nextjs";
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
 * Clerk handles making the account. The token is not sufficient on its own:
 * the database redeems it only for an account whose Clerk-verified email
 * matches the invited address, so a forwarded link is not a way into somebody
 * else's pharmacy.
 */
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  const [peek, setPeek] = useState<Peek | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const signedInAs = user?.primaryEmailAddress?.emailAddress ?? null;
  const mismatch = Boolean(signedInAs && peek && signedInAs.toLowerCase() !== peek.email.toLowerCase());

  useEffect(() => {
    let alive = true;

    (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (alive) setState("missing");
        return;
      }

      const { data } = await supabase.rpc("peek_invitation", { invite_token: token });
      if (!alive) return;

      const row = Array.isArray(data) ? data[0] : data;
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

  async function accept() {
    setError("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setBusy(true);
    const { error: acceptError } = await supabase.rpc("accept_invitation", { invite_token: token });
    setBusy(false);

    if (acceptError) {
      setError(acceptError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col justify-center px-6 py-12">
      <Mark size={34} />

      {state === "loading" || !isLoaded ? (
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
          <Link href="/sign-in" className="act act-lg mt-6 self-start">
            Go to sign in
          </Link>
        </>
      ) : peek.claimed ? (
        <>
          <h1 className="t-display-lg mt-5">Already accepted</h1>
          <p className="t-prose mt-2" data-depth="1">
            This invitation to {peek.organization_name} has already been used. Sign in with{" "}
            <strong>{peek.email}</strong>.
          </p>
          <Link href="/sign-in" className="act act-primary act-lg mt-6 self-start">
            Sign in
          </Link>
        </>
      ) : peek.expired ? (
        <>
          <h1 className="t-display-lg mt-5">This invitation has expired</h1>
          <p className="t-prose mt-2" data-depth="1">
            Invitations to {peek.organization_name} last 14 days. Ask an owner to send a new one.
          </p>
          <Link href="/sign-in" className="act act-lg mt-6 self-start">
            Go to sign in
          </Link>
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

          {!isSignedIn ? (
            <>
              <p className="t-prose mt-4" data-depth="1">
                Create an account with <strong>{peek.email}</strong> — or sign in if you already have one —
                and this page will let you in.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <SignUpButton mode="modal">
                  <button type="button" className="act act-primary act-lg">
                    <UserCheck size={16} strokeWidth={1.8} />
                    Create an account
                  </button>
                </SignUpButton>
                <a href={`/sign-in?redirect_url=/invite/${token}`} className="act act-lg">
                  I already have one
                </a>
              </div>
            </>
          ) : mismatch ? (
            <>
              <p className="band mt-4 t-sm" data-sev="conflict" role="alert">
                You are signed in as <strong>{signedInAs}</strong>, but this invitation was sent to{" "}
                <strong>{peek.email}</strong>. Sign out and sign in as that address to accept it.
              </p>
              <button
                type="button"
                className="act act-lg mt-4 self-start"
                onClick={() => signOut({ redirectUrl: `/invite/${token}` })}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              {error ? (
                <p className="band mt-4 t-sm" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                className="act act-primary act-lg mt-5 w-full"
                onClick={accept}
                disabled={busy}
              >
                <UserCheck size={16} strokeWidth={1.8} />
                {busy ? "Joining…" : `Join ${peek.organization_name}`}
              </button>
            </>
          )}
        </>
      )}
    </main>
  );
}
