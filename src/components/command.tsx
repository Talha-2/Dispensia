"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  ClipboardList,
  Download,
  FileText,
  LayoutDashboard,
  Package,
  Printer,
  Search,
  Settings as SettingsIcon,
  ShieldAlert,
  Upload,
  Users,
} from "lucide-react";
import { Identity, Markers } from "@/components/primitives";
import { COMMANDS, MOD_LABEL, isTyping, runCommand, type CommandName } from "@/lib/commands";
import { SHORTCUTS } from "@/lib/shortcuts";
import type { Medicine, Patient } from "@/lib/types";

type Action = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  group: "Go to" | "Actions";
  run: (router: ReturnType<typeof useRouter>) => void;
};

const ICON = { size: 15, strokeWidth: 1.7 } as const;

const ACTIONS: Action[] = [
  { id: "go-counter", label: "Counter", hint: "Alt 1", icon: <ClipboardList {...ICON} />, group: "Go to", run: (r) => r.push("/dispensing") },
  { id: "go-patients", label: "Patients", hint: "Alt 2", icon: <Users {...ICON} />, group: "Go to", run: (r) => r.push("/patients") },
  { id: "go-safety", label: "Safety rule book", hint: "Alt 3", icon: <ShieldAlert {...ICON} />, group: "Go to", run: (r) => r.push("/safety") },
  { id: "go-register", label: "Controlled-drug register", hint: "Alt 4", icon: <BadgeCheck {...ICON} />, group: "Go to", run: (r) => r.push("/register") },
  { id: "go-catalogue", label: "Catalogue", hint: "Alt 5", icon: <Boxes {...ICON} />, group: "Go to", run: (r) => r.push("/catalogue") },
  { id: "go-stock", label: "Stock", hint: "Alt 6", icon: <Package {...ICON} />, group: "Go to", run: (r) => r.push("/inventory") },
  { id: "go-overview", label: "Overview", hint: "Alt 7", icon: <LayoutDashboard {...ICON} />, group: "Go to", run: (r) => r.push("/dashboard") },
  { id: "go-reports", label: "Reports", hint: "Alt 8", icon: <FileText {...ICON} />, group: "Go to", run: (r) => r.push("/reports") },
  { id: "go-settings", label: "Settings", hint: "Alt 9", icon: <SettingsIcon {...ICON} />, group: "Go to", run: (r) => r.push("/settings") },

  { id: "do-export", label: "Export this view to CSV", hint: "Ctrl E", icon: <Download {...ICON} />, group: "Actions", run: () => runCommand(COMMANDS.export) },
  { id: "do-import", label: "Import stock from CSV", hint: "Ctrl I", icon: <Upload {...ICON} />, group: "Actions", run: () => runCommand(COMMANDS.import) },
  { id: "do-patient", label: "Add a patient record", hint: "Ctrl J", icon: <Users {...ICON} />, group: "Actions", run: () => runCommand(COMMANDS.newPatient) },
  { id: "do-checkout", label: "Dispense and record the basket", hint: "Ctrl ⏎", icon: <BadgeCheck {...ICON} />, group: "Actions", run: () => runCommand(COMMANDS.checkout) },
  { id: "do-print", label: "Print the receipt", hint: "Ctrl P", icon: <Printer {...ICON} />, group: "Actions", run: () => runCommand(COMMANDS.print) },
];

type Hit =
  | { kind: "action"; id: string; action: Action }
  | { kind: "product"; id: string; medicine: Medicine }
  | { kind: "patient"; id: string; patient: Patient };

const groupOf = (hit: Hit) =>
  hit.kind === "action" ? hit.action.group : hit.kind === "patient" ? "Patients" : "Products";

/* ═══ The header trigger ═══════════════════════════════════════════════════
   Looks like a field, behaves like a button. The real input lives in the
   palette, so there is one search surface rather than two competing ones. */

export function CommandField({ patients }: { patients: Patient[] }) {
  const [open, setOpen] = useState(false);

  // Global shortcuts. Registered once, here, because the header is on every
  // screen; each command is a no-op on a page that does not listen for it.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        return;
      }
      if (mod && event.key === "Enter") {
        event.preventDefault();
        runCommand(COMMANDS.checkout);
        return;
      }
      if (mod && !event.shiftKey) {
        const map: Record<string, CommandName> = {
          p: COMMANDS.print,
          e: COMMANDS.export,
          i: COMMANDS.import,
          j: COMMANDS.newPatient,
        };
        const command = map[event.key.toLowerCase()];
        if (command) {
          event.preventDefault();
          runCommand(command);
          return;
        }
      }

      if (isTyping(event.target)) return;

      if (event.key === "/") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("[data-filter-field]")?.focus();
      } else if (event.key.toLowerCase() === "a") {
        const field = document.querySelector<HTMLInputElement>("[data-add-field]");
        if (field) {
          event.preventDefault();
          field.focus();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="field-shell w-full max-w-[460px] cursor-text text-left"
        aria-label="Search and commands"
      >
        <Search size={15} strokeWidth={1.8} className="shrink-0" style={{ color: "var(--ink-3)" }} />
        <span className="t-data flex-1 truncate" style={{ color: "var(--ink-4)" }}>
          Search products, patients, batches…
        </span>
        <span className="kbd shrink-0">{MOD_LABEL} K</span>
      </button>

      {/* Mounted only while open, so it starts from a clean slate every time
          rather than an effect wiping its own state on the way in. */}
      {open ? <CommandPalette onClose={() => setOpen(false)} patients={patients} /> : null}
    </>
  );
}

/* ═══ The palette ══════════════════════════════════════════════════════════ */

function CommandPalette({ onClose, patients }: { onClose: () => void; patients: Patient[] }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState("");
  const [found, setFound] = useState<{ term: string; items: Medicine[] }>({ term: "", items: [] });
  const [cursor, setCursor] = useState(0);

  const query = term.trim();
  const lower = query.toLowerCase();

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      document.body.style.overflow = overflow;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(query)}&limit=6`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data: { items: Medicine[] }) => setFound({ term: query, items: data.items }))
        .catch(() => undefined);
    }, 110);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const hits = useMemo<Hit[]>(() => {
    const actions = ACTIONS.filter(
      (action) => !lower || action.label.toLowerCase().includes(lower) || action.group.toLowerCase().includes(lower),
    ).map((action) => ({ kind: "action" as const, id: action.id, action }));

    if (query.length < 2) return actions;

    const people = patients
      .filter(
        (patient) =>
          patient.name.toLowerCase().includes(lower) ||
          patient.mrn.toLowerCase().includes(lower) ||
          patient.phone.replace(/\s/g, "").includes(lower.replace(/\s/g, "")),
      )
      .slice(0, 3)
      .map((patient) => ({ kind: "patient" as const, id: patient.id, patient }));

    const products =
      found.term === query
        ? found.items.map((medicine) => ({ kind: "product" as const, id: medicine.id, medicine }))
        : [];

    return [...actions.slice(0, 4), ...people, ...products];
  }, [lower, query, patients, found]);

  const active = Math.min(cursor, Math.max(0, hits.length - 1));

  // Group headings are derived by comparing each hit with the one before it,
  // so nothing is mutated while the list renders.
  const listed = useMemo(
    () =>
      hits.map((hit, index) => {
        const group = groupOf(hit);
        return { hit, group, showHeading: index === 0 || groupOf(hits[index - 1]) !== group };
      }),
    [hits],
  );

  const go = useCallback(
    (hit: Hit) => {
      onClose();
      if (hit.kind === "action") hit.action.run(router);
      else if (hit.kind === "patient") router.push(`/patients?open=${hit.patient.id}`);
      else router.push(`/catalogue?open=${encodeURIComponent(hit.medicine.id)}`);
    },
    [onClose, router],
  );

  return (
    <div
      className="scrim no-print"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="dialog w-full max-w-[600px] overflow-hidden"
      >
        <div className="flex items-center gap-3 border-b border-(--line) px-4">
          <Search size={17} strokeWidth={1.8} style={{ color: "var(--ink-3)" }} />
          <input
            ref={inputRef}
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setCursor(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (!hits.length) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setCursor((active + 1) % hits.length);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setCursor((active - 1 + hits.length) % hits.length);
              } else if (event.key === "Enter") {
                event.preventDefault();
                go(hits[active]);
              }
            }}
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={hits.length ? `${listId}-${active}` : undefined}
            placeholder="Search products, patients and batches, or run a command…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none"
            style={{ color: "var(--ink)" }}
            spellCheck={false}
            autoComplete="off"
          />
          <span className="kbd shrink-0">Esc</span>
        </div>

        <ul id={listId} role="listbox" className="max-h-[52vh] overflow-y-auto p-1.5">
          {hits.length === 0 ? (
            <li className="px-3 py-8 text-center">
              <p className="t-data" data-depth="2">
                Nothing matches “{query}”.
              </p>
              <p className="t-sm mt-1" data-depth="1">
                Search runs over 10,434 products, every patient record and every batch code.
              </p>
            </li>
          ) : null}

          {listed.map(({ hit, group, showHeading }, index) => {
            return (
              <li key={`${hit.kind}-${hit.id}`}>
                {showHeading ? <div className="pop-label">{group}</div> : null}
                <button
                  type="button"
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  data-active={index === active}
                  onMouseEnter={() => setCursor(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    go(hit);
                  }}
                  className="pop-item"
                  style={{ height: hit.kind === "action" ? 34 : 46 }}
                >
                  {hit.kind === "action" ? (
                    <>
                      <span className="shrink-0 opacity-75">{hit.action.icon}</span>
                      <span className="flex-1 truncate">{hit.action.label}</span>
                      {hit.action.hint ? <span className="kbd shrink-0">{hit.action.hint}</span> : null}
                    </>
                  ) : hit.kind === "patient" ? (
                    <>
                      <span className="cell cell-info shrink-0">PT</span>
                      <span className="min-w-0 flex-1">
                        <span className="t-data block truncate" style={{ color: "inherit", fontWeight: 550 }}>
                          {hit.patient.name}
                        </span>
                        <span className="t-sm block truncate" data-depth="1">
                          {hit.patient.mrn} · {hit.patient.age}
                          {hit.patient.sex === "f" ? "F" : "M"} · {hit.patient.prescriber}
                        </span>
                      </span>
                      <ArrowRight size={14} strokeWidth={1.8} className="shrink-0 opacity-50" />
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1">
                        <Identity medicine={hit.medicine} depth={3} />
                      </span>
                      <Markers medicine={hit.medicine} />
                      <span className="t-sm t-num w-16 shrink-0 text-right" data-depth="1">
                        {hit.medicine.price.toFixed(2)}
                      </span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-(--line) bg-(--surface-sunk) px-4 py-2.5">
          {SHORTCUTS.slice(0, 4).map((shortcut) => (
            <span key={shortcut.keys} className="t-xs flex items-center gap-1.5" data-depth="1">
              <span className="kbd">{shortcut.keys}</span>
              {shortcut.what}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
