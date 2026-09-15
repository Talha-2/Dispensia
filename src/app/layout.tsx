import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TenantProvider } from "@/components/tenant";
import { RouteProgress } from "@/components/route-progress";
import { getTenant } from "@/lib/tenant";
import "./globals.css";

// Plus Jakarta Sans — pinned by the user. A modern geometric humanist with a
// wide weight range, which gives the interface a clear voice at 11px labels and
// 27px headings from a single family. (shadcn's init swapped this for Geist; the
// pinned face wins.)
const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Machine values — batch, lot and reference codes, where character-by-character
// comparison is the actual task.
const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dispensia",
  description:
    "Counter dispensing with the clinical safety engine in the workflow: 10,434 products, WHO AWaRe classification, and 34 interaction rules scanned on every basket.",
};

export const viewport: Viewport = {
  // Exporting `viewport` replaces Next's default tag wholesale, so width and
  // scale have to be restated here or the page lays out at 980px on a phone.
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f8fc",
  colorScheme: "light",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Resolved once per request and handed down, so every surface that names the
  // organisation — receipt, register, settings — names the same one.
  const tenant = await getTenant();

  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${sans.variable} ${mono.variable}`}>
      <body>
        {/* Clerk renders against the shadcn theme, which reads the same tokens
            the rest of this system does — so its forms are in this product's
            colours rather than Clerk's defaults. */}
        <ClerkProvider appearance={{ theme: shadcn }}>
          {/* Above the header, because a page that is still arriving should say
              so before anything else on screen does. */}
          <Suspense fallback={null}>
            <RouteProgress />
          </Suspense>
          {/*
          THESIS: The safety verdict is the product. A clinical workspace where the
          engine's judgement on the basket is the most prominent thing on screen, and
          everything else — catalogue, stock, price — is ordered beneath it. Refuses the
          KPI-cards-over-a-chart dashboard as the landing surface; the counter is.
          OWN-WORLD: Hospital-grade clinical software. Light blue-grey ground, white data
          surfaces, four measured ink levels, one cyan for interaction only. Colour with
          meaning is reserved for three data domains — WHO AWaRe class, safety severity, and
          shelf/expiry state — and never for chrome, navigation or control state, so nothing
          competes with a safety signal. Plus Jakarta Sans throughout, mono for codes.
          34px rows, many columns, soft edges, layered elevation.
          STORY: The pharmacist searches 10,434 products, builds a basket, and sees every
          interaction, stewardship duty and statutory obligation before handover.
          FIRST VIEWPORT: Fixed nav rail with live branch counts; a command field
          addressing the whole catalogue; the basket as a dense table; the verdict panel
          holding the right column at full height.
          FORM: Clinical system — the category standard, executed at full fidelity, pinned
          by the user against Epic/Cerner-class software after the roll's direction was
          built and rejected. Seed b44fc97b.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
          review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
          */}
          <TenantProvider value={tenant}>{children}</TenantProvider>
          {/* One toast host for the whole app — sonner owns the queue. */}
          <Toaster position="bottom-right" closeButton richColors={false} />
        </ClerkProvider>
      </body>
    </html>
  );
}