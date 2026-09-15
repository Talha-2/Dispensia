import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getTenant } from "@/lib/tenant";

/**
 * The front door, and the only place that decides where somebody belongs.
 *
 * Clerk sends every completed sign-in and sign-up here, so this has to answer
 * for all three cases. It used to redirect to /sign-in unconditionally, which
 * meant a signed-in person was sent to the sign-in page, Clerk bounced them
 * back here because they were already signed in, and the two took turns
 * forever — the flashing loop.
 */
export default async function Home() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Signed in but belonging to no pharmacy yet: finish setting up. Anything
  // else would drop somebody on a counter that is not theirs.
  const tenant = await getTenant();
  redirect(tenant.needsOnboarding ? "/onboarding" : "/dispensing");
}
