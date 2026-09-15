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

export default clerkMiddleware(async (auth, request) => {
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
