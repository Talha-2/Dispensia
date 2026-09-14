/**
 * The keyboard table.
 *
 * Deliberately NOT in a "use client" module: a Server Component importing a
 * value from a client module receives a client reference rather than the value,
 * which fails at build time rather than in the browser. Plain data lives here
 * so both sides can read it.
 */
export const SHORTCUTS: { keys: string; what: string }[] = [
  { keys: "Ctrl K", what: "Open the command palette" },
  { keys: "Ctrl Enter", what: "Dispense and record the basket" },
  { keys: "Ctrl P", what: "Print the receipt" },
  { keys: "Ctrl E", what: "Export the current view to CSV" },
  { keys: "Ctrl I", what: "Import stock from a CSV file" },
  { keys: "Ctrl J", what: "Add a patient record" },
  { keys: "/", what: "Jump to the filter field" },
  { keys: "A", what: "Focus the add-product field" },
  { keys: "Alt 1–9", what: "Go to a section" },
  { keys: "Esc", what: "Close the open panel or dialog" },
];
