"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  KeyRound,
  MapPin,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Store,
  UserPlus,
  Users,
} from "lucide-react";
import { Dialog, Menu, Toast } from "@/components/overlays";
import { InviteDialog } from "@/components/invite-dialog";
import { OrganisationCard } from "@/components/organisation-card";
import type { Branch, Member, Organisation, Role } from "@/data/organisation";
import { SHORTCUTS } from "@/lib/shortcuts";

type Tab = "organisation" | "branches" | "members" | "roles" | "clinical" | "keyboard";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "organisation", label: "Organisation", icon: <Building2 size={15} strokeWidth={1.8} /> },
  { id: "branches", label: "Branches", icon: <Store size={15} strokeWidth={1.8} /> },
  { id: "members", label: "Members", icon: <Users size={15} strokeWidth={1.8} /> },
  { id: "roles", label: "Roles", icon: <ShieldCheck size={15} strokeWidth={1.8} /> },
  { id: "clinical", label: "Clinical defaults", icon: <CheckCircle2 size={15} strokeWidth={1.8} /> },
  { id: "keyboard", label: "Keyboard", icon: <KeyRound size={15} strokeWidth={1.8} /> },
];

const STATUS: Record<Member["status"], { label: string; cell: string }> = {
  active: { label: "Active", cell: "cell-access-soft" },
  invited: { label: "Invited", cell: "cell-primary-soft" },
  suspended: { label: "Suspended", cell: "cell-reserve-soft" },
};

export function SettingsView({
  organisation,
  branches,
  members: seedMembers,
  roles,
  catalogue,
  isDemo = false,
}: {
  organisation: Organisation;
  branches: Branch[];
  members: Member[];
  roles: Role[];
  catalogue: { label: string; value: string }[];
  /** The shared showroom tenant is readable by everyone and writable by nobody. */
  isDemo?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("organisation");
  const [members, setMembers] = useState(seedMembers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const roleName = useMemo(
    () => new Map(roles.map((role) => [role.id, role.name])),
    [roles],
  );
  const branchName = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch.name])),
    [branches],
  );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[188px_minmax(0,1fr)]">
      {/* Section rail — a settings index, not a second navigation. */}
      <nav
        className="panel sticky-rail flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible"
        aria-label="Settings sections"
      >
        {TABS.map((entry) => {
          const on = entry.id === tab;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              aria-current={on ? "page" : undefined}
              className="flex h-9 shrink-0 items-center gap-2.5 rounded-(--radius-sm) px-2.5 text-left text-[13.5px] transition-colors"
              style={{
                background: on ? "var(--primary-soft)" : undefined,
                color: on ? "var(--primary-deep)" : "var(--ink-2)",
                fontWeight: on ? 600 : 450,
                boxShadow: on ? "inset 0 0 0 1px var(--primary-line)" : undefined,
              }}
            >
              <span style={{ opacity: on ? 1 : 0.62 }} aria-hidden="true">
                {entry.icon}
              </span>
              <span className="whitespace-nowrap">{entry.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0">
        {tab === "organisation" ? (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            <OrganisationCard organisation={organisation} canEdit={!isDemo} onSaved={setToast} />

            <div className="grid gap-4">
              <Card title="Data behind this workspace">
                {catalogue.map((entry) => (
                  <Row key={entry.label} label={entry.label} value={entry.value} />
                ))}
              </Card>

              <div className="band" data-sev="conflict">
                <p className="t-label">Backend</p>
                <p className="t-prose mt-1" data-depth="2">
                  No Supabase credentials are set, so sign-in is open, members and branches live in this
                  session only, and nothing persists between reloads. Product facts are real either way;
                  stock, batches, patients and register entries are demo data.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "branches" ? (
          <Card
            title={`Branches · ${branches.length}`}
            note="Each branch holds its own stock, register and staff"
            action={
              <button type="button" className="act act-primary act-sm" onClick={() => setBranchOpen(true)}>
                <Plus size={14} strokeWidth={2} />
                Add branch
              </button>
            }
          >
            {branches.map((branch) => (
              <div key={branch.id} className="baseline row flex flex-wrap items-start gap-3 px-4 py-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-(--radius-sm)"
                  style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
                >
                  <MapPin size={15} strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="t-data font-semibold" style={{ color: "var(--ink)" }}>
                      {branch.name}
                    </span>
                    {branch.isPrimary ? <span className="cell cell-primary-soft">Primary</span> : null}
                  </span>
                  <span className="t-sm mt-0.5 block" data-depth="1">
                    {branch.address}
                  </span>
                  <span className="t-sm mt-0.5 block" data-depth="1">
                    {branch.hours} · {branch.phone}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="t-sm t-code block" data-depth="2">
                    {branch.licence}
                  </span>
                  <span className="t-sm mt-0.5 block" data-depth="1">
                    {branch.staff} staff
                  </span>
                </span>
                <Menu
                  label={`Actions for ${branch.name}`}
                  buttonClass="act act-quiet act-sm act-icon shrink-0"
                  trigger={<MoreHorizontal size={16} strokeWidth={1.9} />}
                  items={[
                    { label: "Edit branch", onSelect: () => setToast(`Editing ${branch.name} needs the backend connected.`) },
                    { label: "Switch to this branch", onSelect: () => setToast(`Switched to ${branch.name}.`), disabled: branch.isPrimary },
                    { separator: true },
                    { label: "Close branch", disabled: branch.isPrimary, onSelect: () => setToast(`Closing a branch needs the backend connected.`) },
                  ]}
                />
              </div>
            ))}
          </Card>
        ) : null}

        {tab === "members" ? (
          <Card
            title={`Members · ${members.length}`}
            note="Who can sign in, and what each of them may do"
            action={
              <button type="button" className="act act-primary act-sm" onClick={() => setInviteOpen(true)}>
                <UserPlus size={14} strokeWidth={2} />
                Invite member
              </button>
            }
          >
            <div
              className="baseline-strong grid items-center gap-x-3 px-4 py-2"
              style={{
                gridTemplateColumns: "minmax(160px,1.4fr) minmax(120px,1fr) minmax(110px,0.9fr) 96px 120px 32px",
                background: "var(--surface-sunk)",
              }}
            >
              {["Member", "Role", "Branch", "Status", "Last active", ""].map((label) => (
                <span key={label} className="t-label">
                  {label}
                </span>
              ))}
            </div>

            {members.map((member) => (
              <div
                key={member.id}
                className="baseline row grid items-center gap-x-3 px-4 py-2"
                style={{
                  gridTemplateColumns: "minmax(160px,1.4fr) minmax(120px,1fr) minmax(110px,0.9fr) 96px 120px 32px",
                  minHeight: 46,
                }}
              >
                <span className="min-w-0">
                  <span className="t-data block truncate font-medium" style={{ color: "var(--ink)" }}>
                    {member.name}
                  </span>
                  <span className="t-sm block truncate" data-depth="1">
                    {member.email}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="t-sm block truncate" data-depth="2">
                    {roleName.get(member.role)}
                  </span>
                  {member.pharmacistLicence ? (
                    <span className="t-sm t-code block truncate" data-depth="1">
                      {member.pharmacistLicence}
                    </span>
                  ) : null}
                </span>
                <span className="t-sm truncate" data-depth="1">
                  {branchName.get(member.branchId)}
                </span>
                <span>
                  <span className={`cell ${STATUS[member.status].cell}`}>{STATUS[member.status].label}</span>
                </span>
                <span className="t-sm truncate" data-depth="1">
                  {member.lastActive}
                </span>
                <Menu
                  label={`Actions for ${member.name}`}
                  buttonClass="act act-quiet act-sm act-icon shrink-0"
                  trigger={<MoreHorizontal size={16} strokeWidth={1.9} />}
                  items={[
                    { label: "Change role", onSelect: () => setToast(`Role changes need the backend connected.`) },
                    { label: "Move to another branch", onSelect: () => setToast(`Branch moves need the backend connected.`) },
                    { separator: true },
                    {
                      label: member.status === "suspended" ? "Restore access" : "Suspend access",
                      onSelect: () => {
                        setMembers((current) =>
                          current.map((entry) =>
                            entry.id === member.id
                              ? { ...entry, status: entry.status === "suspended" ? "active" : "suspended" }
                              : entry,
                          ),
                        );
                        setToast(
                          member.status === "suspended"
                            ? `${member.name} can sign in again.`
                            : `${member.name} can no longer sign in.`,
                        );
                      },
                    },
                  ]}
                />
              </div>
            ))}
          </Card>
        ) : null}

        {tab === "roles" ? (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {roles.map((role) => (
              <Card key={role.id} title={role.name} note={`${members.filter((m) => m.role === role.id).length} assigned`}>
                <div className="px-4 py-3">
                  <p className="t-prose" data-depth="2">
                    {role.summary}
                  </p>

                  <p className="t-label mt-3">Can</p>
                  <ul className="mt-1 space-y-1">
                    {role.can.map((entry) => (
                      <li key={entry} className="t-sm flex gap-2" data-depth="2">
                        <span aria-hidden="true" style={{ color: "var(--ok)" }}>
                          ✓
                        </span>
                        {entry}
                      </li>
                    ))}
                  </ul>

                  <p className="t-label mt-3">Cannot</p>
                  <ul className="mt-1 space-y-1">
                    {role.cannot.map((entry) => (
                      <li key={entry} className="t-sm flex gap-2" data-depth="1">
                        <span aria-hidden="true" style={{ color: "var(--danger)" }}>
                          ✕
                        </span>
                        {entry}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            ))}
          </div>
        ) : null}

        {tab === "clinical" ? (
          <Card title="Clinical defaults" note="Applied across every branch in the organisation">
            <Toggle
              label="Block dispensing on a hard contraindication"
              note="A block verdict disables checkout entirely until a pharmacist records an override. Turning this off would make the engine advisory."
            />
            <Toggle
              label="Require a PIN and a written reason for every override"
              note="Both are stored against the basket and printed on the receipt. An override that costs nothing becomes a reflex."
            />
            <Toggle
              label="Require a register entry before closing a controlled supply"
              note="The basket cannot be completed until the narcotics register line is written and signed by a pharmacist."
            />
            <Toggle
              label="Gate Reserve antibiotics on a documented indication"
              note="130 products in the catalogue are WHO AWaRe Reserve. Routine supply without an indication drives resistance."
            />
            <Toggle
              label="Refuse to dispense from an expired batch"
              note="Expiry is checked against the batch on the shelf, not the product record."
            />
            <Toggle
              label="Show counselling text for every product in the basket"
              note="255 distinct counselling duties are carried in the catalogue."
            />
            <Toggle
              label="Let technicians dispense a clear basket unsupervised"
              note="Only applies when the engine returns no findings at all. A counsel, conflict or block still needs a pharmacist."
              on={false}
            />
          </Card>
        ) : null}

        {tab === "keyboard" ? (
          <Card title="Keyboard" note="The counter is built to be worked without a mouse">
            <div className="grid sm:grid-cols-2">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.keys} className="baseline flex items-center gap-3 px-4 py-2.5">
                  <span className="flex w-[104px] shrink-0 flex-wrap gap-1">
                    {shortcut.keys.split(" ").map((key) => (
                      <kbd key={key} className="kbd">
                        {key}
                      </kbd>
                    ))}
                  </span>
                  <span className="t-sm min-w-0 flex-1" data-depth="2">
                    {shortcut.what}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>

      <InviteDialog
        open={inviteOpen}
        roles={roles}
        branches={branches}
        onClose={() => setInviteOpen(false)}
        onInvited={(email) => {
          setTab("members");
          setToast(`Join link created for ${email}. Send it to them — it works once.`);
        }}
      />

      <BranchDialog
        open={branchOpen}
        onClose={() => setBranchOpen(false)}
        onDone={(name) => {
          setBranchOpen(false);
          setToast(`${name} needs the backend connected before it can be created.`);
        }}
      />

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

/* ═══ Pieces ═══════════════════════════════════════════════════════════════ */

function Card({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel overflow-hidden">
      <div
        className="baseline-strong flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5"
        style={{ background: "var(--surface-sunk)" }}
      >
        <h2 className="t-label">{title}</h2>
        {note ? (
          <span className="t-sm" data-depth="1">
            {note}
          </span>
        ) : null}
        {action ? <span className="ml-auto">{action}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="baseline flex flex-wrap items-baseline gap-x-3 px-4 py-2">
      <span className="t-sm w-[150px] shrink-0" data-depth="1">
        {label}
      </span>
      <span className={`t-data min-w-0 flex-1 font-medium ${mono ? "t-code" : ""}`} style={{ color: "var(--ink)" }}>
        {value}
      </span>
    </div>
  );
}

function Toggle({ label, note, on = true }: { label: string; note: string; on?: boolean }) {
  return (
    <label className="baseline row flex cursor-pointer items-start gap-3 px-4 py-3">
      <input type="checkbox" defaultChecked={on} className="sr-only" />
      <span aria-hidden="true" className="switch mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="t-data block font-medium" style={{ color: "var(--ink)" }}>
          {label}
        </span>
        <span className="t-sm mt-0.5 block max-w-[78ch]" data-depth="1">
          {note}
        </span>
      </span>
    </label>
  );
}

function Field({
  label,
  required,
  hint,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
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

function BranchDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("Lahore");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [licence, setLicence] = useState("");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) return setError("Give the branch a name staff will recognise.");
    if (!address.trim()) return setError("A branch needs an address — it is printed on its receipts.");
    if (!licence.trim()) return setError("A DRAP retail licence number is required to dispense from a site.");
    onDone(name.trim());
    setName("");
    setAddress("");
    setPhone("");
    setLicence("");
    setError("");
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a branch"
      description="A branch holds its own stock, controlled-drug register and staff."
      width={560}
      footer={
        <>
          <button type="button" className="act" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="add-branch" className="act act-primary">
            <Plus size={15} strokeWidth={2} />
            Create branch
          </button>
        </>
      }
    >
      <form id="add-branch" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Branch name" required>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field" autoComplete="off" />
        </Field>
        <Field label="City" required>
          <input value={city} onChange={(e) => setCity(e.target.value)} className="field" autoComplete="off" />
        </Field>
        <Field label="Address" required className="sm:col-span-2">
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="field" autoComplete="off" />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="field" autoComplete="off" />
        </Field>
        <Field label="DRAP retail licence" required hint="Printed on this branch's receipts">
          <input
            value={licence}
            onChange={(e) => setLicence(e.target.value)}
            className="field t-code"
            placeholder="DRAP-RP-LHR-00000"
            autoComplete="off"
          />
        </Field>
        {error ? (
          <p className="band t-sm sm:col-span-2" data-sev="block" role="alert" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        ) : null}
      </form>
    </Dialog>
  );
}
