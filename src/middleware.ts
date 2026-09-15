import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Everything behind the counter needs a signed-in person, because every
 * dispense, override and register entry is recorded against one.
 */
const isProtected = createRouteMatcher([
  "/dashboard(.*)",
  "/catalogue(.*)",
  "/inventory(.*)",
  "/dispensing(.*)",
  "/patients(.*)",
  "/safety(.*)",
  "/register(.*)",
  "/reports(.*)",
  "/settings(.*)",
  "/onboarding(.*)",
]);

/**
 * The endpoints that change something, or that answer for a particular
 * pharmacy. They were unguarded: row-level security still refused an anonymous
 * caller everything, but the refusal arrived from Postgres as a puzzle — "join
 * an organisation" — rather than as "you are not signed in".
 *
 * The read-only catalogue endpoints are deliberately left open: /api/suggest,
 * /api/scan, /api/catalogue, /api/inventory and /api/product all describe the
 * national drug catalogue and a public rule book, and carry nothing belonging
 * to anybody.
 */
const isProtectedApi = createRouteMatcher(["/api/dispense(.*)", "/api/demo(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedApi(request)) {
    const { userId } = await auth();
    if (userId) return NextResponse.next();
    // An API answers an API caller. Redirecting one to a sign-in page hands it
    // an HTML document where it expected a result.
    return NextResponse.json({ error: "Sign in to do that." }, { status: 401 });
  }

  if (!isProtected(request)) return NextResponse.next();

  const { userId } = await auth();
  if (userId) return NextResponse.next();

  // Send them to sign-in with the page they wanted, so they land back on it
  // rather than on a default screen they did not ask for.
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = "";
  url.searchParams.set("redirect_url", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: [
    // Everything except Next internals and static files, so Clerk can keep the
    // session fresh on ordinary navigations too.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
