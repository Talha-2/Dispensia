"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Organisation } from "@/data/organisation";

/** Form field → database column. One place, so a rename cannot drift. */
const COLUMNS = {
  name: "name",
  legalName: "legal_name",
  ntn: "ntn",
  drapLicence: "drap_licence",
  address: "address",
  phone: "phone",
  email: "email",
} as const;

type FieldKey = keyof typeof COLUMNS;

const FIELDS: { key: FieldKey; label: string; mono?: boolean; hint?: string }[] = [
  { key: "name", label: "Trading name", hint: "Heads every receipt" },
  { key: "legalName", label: "Legal entity" },
  { key: "ntn", label: "Tax number", mono: true },
  { key: "drapLicence", label: "DRAP licence", mono: true, hint: "Required on a controlled-drug entry" },
  { key: "address", label: "Registered address" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
];

/**
 * The organisation's own record, editable in place.
 *
 * Everything here prints on a receipt or a register entry, so it has to be
 * correctable without a support ticket — in the demo tenant as much as in a
 * real one, since a demo you cannot edit does not demonstrate much.
 */
export function OrganisationCard({
  organisation,
  onSaved,
}: {
  organisation: Organisation;
  onSaved: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(organisation);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const start = () => {
    setDraft(organisation);
    setError("");
    setEditing(true);
  };

  async function save() {
    if (draft.name.trim().length < 2) {
      setError("An organisation needs a trading name.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured, so this record cannot be saved.");
      return;
    }

    setBusy(true);
    setError("");

    const patch = Object.fromEntries(
      (Object.keys(COLUMNS) as FieldKey[]).map((key) => [COLUMNS[key], String(draft[key] ?? "").trim() || null]),
    );

    // Scoped by the update policy to the caller's own organisation, so the id
    // never has to be trusted from the client.
    const { error: saveError, data } = await supabase
      .from("organizations")
      .update(patch)
      .select("id");

    setBusy(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    if (!data?.length) {
      setError("Nothing was updated — your role may not permit changing the organisation.");
      return;
    }

    setEditing(false);
    onSaved("Organisation details saved. New receipts carry them immediately.");
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="min-w-0 flex-1">
          <span className="t-data block font-semibold" style={{ color: "var(--ink)" }}>
            Organisation
          </span>
          <span className="t-xs block" data-depth="1">
            Printed on every receipt and register entry
          </span>
        </span>

        {editing ? (
          <>
            <button type="button" className="act act-sm" onClick={() => setEditing(false)} disabled={busy}>
              <X size={14} strokeWidth={2} />
              Cancel
            </button>
            <button type="button" className="act act-primary act-sm" onClick={save} disabled={busy}>
              <Check size={14} strokeWidth={2} />
              {busy ? "Saving…" : "Save"}
            </button>
          </>
        ) : (
          <button type="button" className="act act-sm" onClick={start}>
            <Pencil size={14} strokeWidth={1.9} />
            Edit
          </button>
        )}
      </div>


      {FIELDS.map((field) => (
        <div key={field.key} className="baseline flex flex-wrap items-baseline gap-x-3 px-4 py-2">
          <span className="t-sm w-[150px] shrink-0" data-depth="1">
            {field.label}
          </span>
          {editing ? (
            <span className="min-w-0 flex-1">
              <input
                value={String(draft[field.key] ?? "")}
                onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                className={`field h-9 ${field.mono ? "t-code" : ""}`}
                aria-label={field.label}
              />
              {field.hint ? (
                <span className="t-xs mt-1 block" data-depth="1">
                  {field.hint}
                </span>
              ) : null}
            </span>
          ) : (
            <span
              className={`t-data min-w-0 flex-1 font-medium ${field.mono ? "t-code" : ""}`}
              style={{ color: "var(--ink)" }}
            >
              {String(organisation[field.key] ?? "—")}
            </span>
          )}
        </div>
      ))}

      <div className="baseline flex flex-wrap items-baseline gap-x-3 px-4 py-2 last:border-b-0">
        <span className="t-sm w-[150px] shrink-0" data-depth="1">
          Currency
        </span>
        <span className="t-data min-w-0 flex-1 font-medium" style={{ color: "var(--ink)" }}>
          {organisation.currency} — retail and cost carried per product
        </span>
      </div>

      {error ? (
        <p className="band t-sm m-4" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
