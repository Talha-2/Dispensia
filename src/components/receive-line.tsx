"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus, Search as SearchIcon, X } from "lucide-react";
import { Dialog } from "@/components/overlays";
import { Identity, Markers } from "@/components/primitives";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Branch } from "@/data/organisation";
import type { Medicine } from "@/lib/types";

/**
 * Receiving one line by hand.
 *
 * The product is chosen from the catalogue rather than typed, so a batch can
 * never be booked against a name that does not exist — which is what keeps the
 * interaction rules and the AWaRe class attached to whatever is on the shelf.
 * Controlled products are received exactly like any other; what makes them
 * controlled is the flag on the catalogue record, and the register picks them
 * up from there when they are dispensed.
 */
export function ReceiveLineDialog({
  open,
  branches,
  onClose,
  onDone,
}: {
  open: boolean;
  branches: Branch[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const router = useRouter();

  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<Medicine[]>([]);
  const [chosen, setChosen] = useState<Medicine | null>(null);

  const [qty, setQty] = useState("");
  const [reorder, setReorder] = useState("");
  const [batch, setBatch] = useState("");
  const [expiry, setExpiry] = useState("");
  const [shelf, setShelf] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Derived rather than stored: a short or already-resolved query simply has no
  // results, so there is nothing to write back into state for it.
  const query = term.trim();
  const showing = query.length >= 2 && !chosen ? hits : [];

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2 || chosen) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(q)}&limit=6`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data: { items: Medicine[] }) => setHits(data.items))
        .catch(() => undefined);
    }, 120);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term, chosen]);

  function reset() {
    setTerm("");
    setHits([]);
    setChosen(null);
    setQty("");
    setReorder("");
    setBatch("");
    setExpiry("");
    setShelf("");
    setCost("");
    setPrice("");
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!chosen) return setError("Choose the product this delivery is for.");
    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) return setError("Enter the quantity received.");
    if (expiry && Number.isNaN(Date.parse(expiry))) return setError("That expiry date is not a date.");
    if (expiry && new Date(expiry) <= new Date()) {
      return setError("That expiry has already passed — expired stock cannot be received.");
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError("Supabase is not configured, so stock cannot be received.");

    setSaving(true);
    const { error: rpcError } = await supabase.rpc("receive_stock", {
      p_catalogue_id: chosen.id,
      p_quantity: quantity,
      p_batch: batch.trim() || null,
      p_expiry: expiry || null,
      p_shelf: shelf.trim() || null,
      p_reorder: Number(reorder) || null,
      p_cost: cost.trim() ? Number(cost) : null,
      p_price: price.trim() ? Number(price) : null,
      p_branch: /^[0-9a-f-]{36}$/i.test(branchId) ? branchId : null,
    });
    setSaving(false);

    if (rpcError) return setError(rpcError.message);

    const name = chosen.short;
    reset();
    onDone(
      `${quantity} units of ${name} received${batch.trim() ? ` on batch ${batch.trim().toUpperCase()}` : ""}.`,
    );
    router.refresh();
    return undefined;
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Receive a stock line"
      description="Receiving is additive: the same batch arriving twice adds to the line you already hold."
      width={620}
      footer={
        <>
          <button type="button" className="act" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="receive-line" className="act act-primary" disabled={saving}>
            <PackagePlus size={15} strokeWidth={1.8} />
            {saving ? "Receiving…" : "Receive"}
          </button>
        </>
      }
    >
      <form id="receive-line" onSubmit={submit}>
        <label className="block">
          <span className="t-label">
            Product<span style={{ color: "var(--danger)" }}> *</span>
          </span>

          {chosen ? (
            <span className="panel-flat mt-1.5 flex items-center gap-3 p-2.5">
              <span className="min-w-0 flex-1">
                <Identity medicine={chosen} depth={3} />
              </span>
              <Markers medicine={chosen} />
              <button
                type="button"
                className="act act-sm shrink-0"
                onClick={() => {
                  setChosen(null);
                  setTerm("");
                }}
              >
                <X size={14} strokeWidth={1.9} />
                Change
              </button>
            </span>
          ) : (
            <span className="relative mt-1.5 block">
              <span className="field-shell">
                <SearchIcon size={15} strokeWidth={1.8} className="shrink-0" style={{ color: "var(--ink-3)" }} />
                <input
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                  placeholder="Search the catalogue by brand, molecule or manufacturer"
                  className="t-data"
                  autoComplete="off"
                  spellCheck={false}
                />
              </span>

              {showing.length ? (
                <span className="panel absolute left-0 right-0 top-11 z-10 block max-h-[240px] overflow-y-auto py-1">
                  {showing.map((medicine) => (
                    <button
                      key={medicine.id}
                      type="button"
                      className="pop-item w-full"
                      style={{ height: 46 }}
                      onClick={() => {
                        setChosen(medicine);
                        setHits([]);
                        // The catalogue's prices are the national reference;
                        // they seed the fields and you correct them to what this
                        // delivery actually cost.
                        setCost(medicine.cost ? String(medicine.cost) : "");
                        setPrice(medicine.price ? String(medicine.price) : "");
                      }}
                    >
                      <span className="min-w-0 flex-1 text-left">
                        <Identity medicine={medicine} depth={3} />
                      </span>
                      <Markers medicine={medicine} />
                    </button>
                  ))}
                </span>
              ) : null}
            </span>
          )}

          {chosen?.flags.includes("controlled") ? (
            <span className="band band-sm mt-2 block" data-sev="conflict">
              <span className="t-sm">
                Controlled drug. Every supply from this line writes a register entry automatically, with
                the balance it leaves behind.
              </span>
            </span>
          ) : null}
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Quantity received" required>
            <input
              value={qty}
              onChange={(event) => setQty(event.target.value)}
              className="field t-num"
              inputMode="numeric"
              autoComplete="off"
            />
          </Field>

          <Field label="Reorder at" hint="When to flag it low">
            <input
              value={reorder}
              onChange={(event) => setReorder(event.target.value)}
              className="field t-num"
              inputMode="numeric"
              autoComplete="off"
            />
          </Field>

          <Field label="Shelf">
            <input
              value={shelf}
              onChange={(event) => setShelf(event.target.value)}
              className="field"
              placeholder="A3"
              autoComplete="off"
            />
          </Field>

          <Field label="Batch number">
            <input
              value={batch}
              onChange={(event) => setBatch(event.target.value)}
              className="field t-code"
              autoComplete="off"
            />
          </Field>

          <Field label="Expiry">
            <input
              type="date"
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
              className="field"
            />
          </Field>

          {branches.length > 1 ? (
            <Field label="Into branch">
              <select
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                className="field"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <Field label="Cost per unit" hint="What you paid">
            <input
              value={cost}
              onChange={(event) => setCost(event.target.value)}
              className="field t-num"
              inputMode="decimal"
              autoComplete="off"
            />
          </Field>

          <Field label="Retail per unit" hint="What you charge">
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="field t-num"
              inputMode="decimal"
              autoComplete="off"
            />
          </Field>
        </div>

        {error ? (
          <p className="band t-sm mt-4" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
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
