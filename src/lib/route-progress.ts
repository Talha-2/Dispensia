/**
 * The navigation-progress store.
 *
 * Deliberately a plain leaf module rather than part of the component that
 * renders the bar. Navigation starts in three places — a link click, the back
 * button, and a router.push from code — and the last of those lives in client
 * components that have no business importing a component just to say "I am
 * navigating now".
 */

let outstanding = 0;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

/** Begin a navigation. Call it when you push or refresh from code. */
export function startRouteProgress() {
  outstanding += 1;
  notify();
}

/** End it. Safe to call when nothing is running. */
export function endRouteProgress() {
  if (outstanding === 0) return;
  outstanding = 0;
  notify();
}

export const isNavigating = () => outstanding > 0;

export function subscribeRouteProgress(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}
