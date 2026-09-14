"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { Mark } from "@/components/mark";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Creating an organisation.
 *
 * The one write that cannot be gated by membership, because the person doing it
 * is not a member of anything yet — so it goes through the `create_organization`
 * function, which makes the organisation, its first branch and the caller's
 * owner profile in a single transaction.
 *
 * Only the name is required. Everything else prints on a receipt or a register
 * entry, and can be filled in later in Settings rather than blocking the way in.
 */
export default function OnboardingPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [branch, setBranch] = useState("Main Branch");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [ntn, setNtn] = useState("");
  const [licence, setLicence] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (name.trim().length < 2) {
      setError("Enter the name your pharmacy trades under.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured, so organisations cannot be created in this build.");
      return;
    }

    setBusy(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login?next=/onboarding");
      return;
    }

    const { error: rpcError } = await supabase.rpc("create_organization", {
      org_name: name.trim(),
      branch_name: branch.trim() || "Main Branch",
      full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
      legal_name: legalName.trim() || null,
      ntn: ntn.trim() || null,
      drap_licence: licence.trim() || null,
      address: address.trim() || null,
      phone: phone.trim() || null,
      city: city.trim() || null,
    });

    if (rpcError) {
      setError(rpcError.message);
      setBusy(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[720px] px-6 py-12">
      <Mark size={34} />
      <h1 className="t-display-lg mt-5">Create your organisation</h1>
      <p className="t-prose mt-2 max-w-[60ch]" data-depth="1">
        This names the pharmacy on every receipt, register entry and audit line. You can change any of
        it later in Settings — only the trading name is needed now.
      </p>

      <form onSubmit={submit} className="panel mt-7 grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Trading name" required className="sm:col-span-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="field"
            placeholder="City Care Pharmacy"
            autoComplete="organization"
            autoFocus
          />
        </Field>

        <Field label="Registered legal name" hint="Printed on the receipt footer" className="sm:col-span-2">
          <input
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
            className="field"
            placeholder="City Care Pharmacy (Private) Limited"
          />
        </Field>

        <Field label="First branch" hint="You can add more branches later">
          <input value={branch} onChange={(event) => setBranch(event.target.value)} className="field" />
        </Field>

        <Field label="City">
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="field"
            placeholder="Lahore"
          />
        </Field>

        <Field label="Address" className="sm:col-span-2">
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="field"
            autoComplete="street-address"
          />
        </Field>

        <Field label="Phone">
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="field"
            autoComplete="tel"
            placeholder="+92 42 ..."
          />
        </Field>

        <Field label="Tax number (NTN)">
          <input value={ntn} onChange={(event) => setNtn(event.target.value)} className="field" />
        </Field>

        <Field
          label="DRAP retail licence"
          hint="Required on a controlled-drug register entry"
          className="sm:col-span-2"
        >
          <input value={licence} onChange={(event) => setLicence(event.target.value)} className="field" />
        </Field>

        {error ? (
          <p className="band t-sm sm:col-span-2" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" className="act act-primary act-lg" disabled={busy}>
            <Building2 size={16} strokeWidth={1.8} />
            {busy ? "Creating…" : "Create organisation"}
          </button>
          <a href="/dashboard" className="act act-lg">
            Keep looking around the demo
          </a>
        </div>
      </form>

      <p className="t-sm mt-6" data-depth="1">
        Until you create one, the workspace runs on the shared <strong>Demo Pharmacy</strong> — real
        products, synthetic stock and patients. Nothing you do there touches a real organisation.
      </p>
    </main>
  );
}

function Field({
  label,
  hint,
  required,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
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
      {hint ? (
        <span className="t-xs mt-1 block" data-depth="1">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
