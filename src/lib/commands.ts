"use client";

import { useEffect } from "react";

/**
 * A tiny command bus.
 *
 * The palette and the keyboard shortcuts fire named commands; whichever screen
 * is mounted picks up the ones it can perform. That keeps the shortcut table in
 * one place without the palette needing to know what a counter or a catalogue
 * is, and it means a command silently does nothing on a page that cannot do it
 * rather than throwing.
 */
export const COMMANDS = {
  export: "sd:export",
  import: "sd:import",
  newPatient: "sd:new-patient",
  checkout: "sd:checkout",
  print: "sd:print",
  focusAdd: "sd:focus-add",
  clearBasket: "sd:clear-basket",
} as const;

export type CommandName = (typeof COMMANDS)[keyof typeof COMMANDS];

export function runCommand(name: CommandName, detail?: unknown) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

/** Subscribe the current screen to a command for as long as it is mounted. */
export function useCommand(name: CommandName, handler: (detail?: unknown) => void) {
  useEffect(() => {
    const listener = (event: Event) => handler((event as CustomEvent).detail);
    window.addEventListener(name, listener);
    return () => window.removeEventListener(name, listener);
  }, [name, handler]);
}

/** True when focus is in a field, so a bare letter shortcut must not fire. */
export function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable === true
  );
}

export const MOD_LABEL =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";

export { SHORTCUTS } from "@/lib/shortcuts";
