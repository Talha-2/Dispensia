"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Dialog } from "@/components/overlays";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Putting the demo back.
 *
 * The demo is a fully writable tenant — you can add branches, invite people and
 * edit the organisation, because a pharmacy you cannot change does not
 * demonstrate a pharmacy system. That only works if there is a way back, so
 * this undoes everything added since the seed and restores the three branches
 * and the organisation record exactly as they were.
 *
 * It is a real deletion and it is not undoable, so it asks first and names what
 * it will remove rather than saying "are you sure".
 */
export function DemoReset({ onDone }: { onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function reset() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured, so there is nothing to reset.");
      return;
    }

    setBusy(true);
    setError("");

    const { error: rpcError } = await supabase.rpc("reset_demo_organization");

    if (rpcError) {
      setBusy(false);
      setError(rpcError.message);
      return;
    }

    // Reset empties it; seeding puts the demonstration data back. A demo with
    // no stock and no patients demonstrates nothing.
    const seeded = await fetch("/api/demo/seed", { method: "POST" });
    const data = await seeded.json();
    setBusy(false);

    if (!seeded.ok) {
      setError(data.error ?? "The demo was cleared but could not be refilled.");
      return;
    }

    setOpen(false);
    onDone(`Demo reset — ${data.stock} stock lines, ${data.patients} patients and ${data.register} register entries restored.`);
    // The whole page is built from the tenant, so it is re-read rather than
    // patched in half a dozen places.
    window.location.reload();
  }

  return (
    <>
      <div className="band" data-sev="conflict">
        <div className="flex flex-wrap items-start gap-3">
          <span className="min-w-0 flex-1">
            <p className="t-label" style={{ color: "var(--ink)" }}>
              Demo organisation
            </p>
            <p className="t-prose mt-1 max-w-[60ch]" data-depth="2">
              This tenant is fully writable — add branches, invite staff, edit these details, dispense
              against it. Resetting removes everything added since the seed and puts the original organisation,
              its three branches and the demonstration stock, patients and register back.
            </p>
          </span>
          <button type="button" className="act act-sm shrink-0" onClick={() => setOpen(true)}>
            <RotateCcw size={14} strokeWidth={1.9} />
            Reset demo data
          </button>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reset the demo organisation?"
        description="This cannot be undone."
        width={520}
        footer={
          <>
            <button type="button" className="act" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="act act-danger" onClick={reset} disabled={busy}>
              <RotateCcw size={15} strokeWidth={1.8} />
              {busy ? "Resetting…" : "Reset the demo"}
            </button>
          </>
        }
      >
        <p className="t-prose" data-depth="2">
          Everything added to Demo Pharmacy since it was seeded will be deleted:
        </p>

        <ul className="mt-3">
          {[
            "Branches you added, and any edits to the seeded three",
            "Members who joined, and every outstanding invitation",
            "Patients, products, stock batches and prescriptions",
            "Register entries and audit lines",
            "Edits to the organisation's name, licence, address and tax number",
          ].map((item) => (
            <li key={item} className="baseline t-data flex items-baseline gap-2 py-1.5" data-depth="2">
              <span aria-hidden="true" style={{ color: "var(--danger)" }}>
                —
              </span>
              {item}
            </li>
          ))}
        </ul>

        <p className="t-prose mt-3" data-depth="1">
          The demo sign-in itself is kept, so you will stay signed in and land back on the seeded
          organisation. Nothing outside the demo tenant is touched.
        </p>

        {error ? (
          <p className="band t-sm mt-4" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
