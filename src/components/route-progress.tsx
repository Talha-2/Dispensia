"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  endRouteProgress,
  isNavigating,
  startRouteProgress,
  subscribeRouteProgress,
} from "@/lib/route-progress";

/**
 * The bar itself.
 *
 * Two deliberate behaviours. It waits before appearing, because a navigation
 * that resolves in 80ms should not produce a flash of progress — the flicker
 * reads as a fault rather than as feedback. And it never claims to finish:
 * the width eases toward 90% and stops, because the only honest thing to say
 * while a server component is still streaming is "still going".
 */
export function RouteProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<{ visible: boolean; width: number }>({
    visible: false,
    width: 0,
  });

  const timers = useRef<number[]>([]);
  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  // ── Start: a click on a same-origin link, or the back button ──────────────
  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Anything the browser handles itself is not a route change.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page: nothing will commit, so nothing should start.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      startRouteProgress();
    }

    window.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", startRouteProgress);
    return () => {
      window.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", startRouteProgress);
    };
  }, []);

  // ── Run: creep toward 90% while a navigation is outstanding ───────────────
  useEffect(() => {
    let alive = true;

    const run = () => {
      if (!alive) return;
      clearTimers();

      if (!isNavigating()) {
        // Finish the bar rather than cutting it: a completed action that
        // disappears mid-stride reads as a failure.
        setState((current) => (current.visible ? { visible: true, width: 100 } : current));
        timers.current.push(
          window.setTimeout(() => alive && setState({ visible: false, width: 0 }), 220),
        );
        return;
      }

      timers.current.push(
        window.setTimeout(() => {
          if (!alive || !isNavigating()) return;
          setState({ visible: true, width: 12 });

          // Decelerating steps: fast while there is plenty of bar left, slow as
          // it approaches the cap, so a long wait still looks like movement.
          const creep = () => {
            if (!alive || !isNavigating()) return;
            setState((current) => {
              const next = current.width + Math.max(0.6, (90 - current.width) * 0.12);
              return { visible: true, width: Math.min(90, next) };
            });
            timers.current.push(window.setTimeout(creep, 220));
          };
          timers.current.push(window.setTimeout(creep, 220));
        }, 140),
      );
    };

    const unsubscribe = subscribeRouteProgress(run);
    run();

    return () => {
      alive = false;
      unsubscribe();
      clearTimers();
    };
  }, []);

  // ── Finish: the new route has committed ───────────────────────────────────
  useEffect(() => {
    endRouteProgress();
  }, [pathname, search]);

  // A navigation that never commits — a cancelled prefetch, a link to a file —
  // would otherwise leave the bar parked at 90% for the rest of the session.
  useEffect(() => {
    if (!state.visible) return;
    const bail = window.setTimeout(endRouteProgress, 12_000);
    return () => window.clearTimeout(bail);
  }, [state.visible]);

  if (!state.visible) return null;

  return (
    <div
      className="no-print"
      role="progressbar"
      aria-label="Loading"
      aria-busy="true"
      style={{
        position: "fixed",
        insetInline: 0,
        top: 0,
        height: 2,
        zIndex: 80,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${state.width}%`,
          background: "var(--primary)",
          boxShadow: "0 0 8px var(--primary), 0 0 2px var(--primary)",
          transition: "width 200ms var(--ease), opacity 200ms var(--ease)",
          opacity: state.width >= 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
