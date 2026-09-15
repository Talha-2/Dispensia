"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog as ShadDialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * App-level overlays.
 *
 * These are thin compositions over shadcn/ui — which is the way shadcn is meant
 * to be used. The primitives underneath (Base UI) own focus trapping, portals,
 * dismissal, ARIA wiring and the animation states; this file owns the shape the
 * rest of the app talks to, so a call site says `<Dialog title=… footer=…>`
 * rather than assembling six parts every time.
 */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 520,
  printable = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  /** Marks this dialog as the thing to print, hiding everything else. */
  printable?: boolean;
}) {
  return (
    <ShadDialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className={printable ? "print-sheet" : "no-print"}
        style={{ maxWidth: width, width: "calc(100vw - 2rem)" }}
      >
        <DialogHeader>
          <DialogTitle className="t-display">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="t-sm">{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto">{children}</div>

        {footer ? <DialogFooter className="no-print">{footer}</DialogFooter> : null}
      </DialogContent>
    </ShadDialog>
  );
}

/* ═══ Menu ═════════════════════════════════════════════════════════════════ */

export type MenuItem = {
  label: string;
  onSelect?: () => void;
  icon?: ReactNode;
  hint?: string;
  disabled?: boolean;
  separator?: never;
};

export type MenuEntry = MenuItem | { separator: true } | { label: string; heading: true };

export function Menu({
  label,
  items,
  align = "end",
  trigger,
  buttonClass = "act",
}: {
  label: string;
  items: MenuEntry[];
  align?: "start" | "end";
  trigger?: ReactNode;
  buttonClass?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className={buttonClass} aria-label={trigger ? label : undefined} />
        }
      >
        {trigger ?? (
          <>
            {label}
            <ChevronDown size={14} strokeWidth={1.8} style={{ opacity: 0.7 }} />
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="min-w-[236px]">
        {items.map((item, index) => {
          if ("separator" in item) return <DropdownMenuSeparator key={index} />;
          // Base UI requires a GroupLabel to sit inside a Group; on its own it
          // throws MenuGroupContext is missing and takes the whole page with it.
          if ("heading" in item)
            return (
              <DropdownMenuGroup key={index}>
                <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
              </DropdownMenuGroup>
            );
          return (
            <DropdownMenuItem key={index} disabled={item.disabled} onClick={item.onSelect}>
              {item.icon ? (
                <span className="shrink-0 opacity-70" aria-hidden="true">
                  {item.icon}
                </span>
              ) : null}
              <span className="flex-1 truncate">{item.label}</span>
              {item.hint ? <DropdownMenuShortcut>{item.hint}</DropdownMenuShortcut> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ═══ Toast ════════════════════════════════════════════════════════════════
   The old component held its own timer and rendered itself. sonner owns the
   queue now, so this is just the bridge: call it with a message and it fires. */

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  if (message) {
    // Fired during render on purpose: sonner's store is external to React, and
    // the caller clears the message immediately afterwards.
    queueMicrotask(() => {
      toast(message);
      onDone();
    });
  }
  return null;
}

export { Button, toast };
