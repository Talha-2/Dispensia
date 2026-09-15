import { SignIn } from "@clerk/nextjs";
import { Activity, BookLock, ShieldCheck } from "lucide-react";
import { Mark } from "@/components/mark";

export const metadata = { title: "Sign in · Dispensia" };

/**
 * Signing in.
 *
 * Clerk owns the form — passwords, Google, resets and the whole recovery path
 * are its problem now, which is the point of using it. The page around it is
 * ours: what this workspace is, argued with the mechanism rather than a list of
 * catalogue sizes.
 */
export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-[400px]">
          <Mark size={36} />
          <h1 className="t-display-lg mt-5">Dispensia</h1>
          <p className="t-prose mt-2" data-depth="1">
            Counter dispensing, stock and the controlled-drug register for your pharmacy — with the
            clinical safety engine running on every basket.
          </p>

          <div className="mt-7">
            <SignIn />
          </div>
        </div>
      </div>

      <Pitch />
    </main>
  );
}

export function Pitch() {
  return (
    <div
      className="flex items-center border-t border-(--line) px-6 py-12 lg:w-[46%] lg:border-l lg:border-t-0 lg:px-14"
      style={{ background: "var(--surface)" }}
    >
      <div className="mx-auto w-full max-w-[460px]">
        <p className="t-label">What this workspace does</p>
        <h2 className="t-display mt-3">
          The safety engine runs on the whole basket, every time it changes.
        </h2>

        <div className="mt-7">
          {[
            {
              icon: <ShieldCheck size={17} strokeWidth={1.7} />,
              title: "Interactions, before handover",
              body: "34 rules ported from the incumbent engine, evaluated against every product in the basket together — not line by line, because the danger is usually in the combination that was safe a moment ago.",
            },
            {
              icon: <Activity size={17} strokeWidth={1.7} />,
              title: "Stewardship that is an obligation",
              body: "WHO AWaRe class is read off the product record. A Reserve antibiotic raises a gate of its own, alongside the interaction rules.",
            },
            {
              icon: <BookLock size={17} strokeWidth={1.7} />,
              title: "A register that cannot be edited",
              body: "Controlled supplies write an append-only entry before the basket can close. A correction is a new line, never a change to an old one.",
            },
          ].map((item) => (
            <div key={item.title} className="baseline flex items-start gap-3 py-3 last:border-b-0">
              <span className="mt-0.5 shrink-0" style={{ color: "var(--primary)" }}>
                {item.icon}
              </span>
              <div className="min-w-0">
                <h3 className="t-data" data-depth="3">
                  {item.title}
                </h3>
                <p className="t-prose mt-1" data-depth="1">
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-x-4 border-t border-(--line) pt-4">
          {[
            ["10,434", "products"],
            ["2,017", "molecules"],
            ["1,406", "AWaRe graded"],
          ].map(([value, label]) => (
            <div key={label}>
              <dt className="t-stat">{value}</dt>
              <dd className="t-sm mt-0.5" data-depth="1">
                {label}
              </dd>
            </div>
          ))}
        </dl>

        <p className="t-sm mt-5" data-depth="0">
          Product facts are real. Stock levels, batches, patients and register entries are demo data and
          are labelled as such throughout the workspace.
        </p>
      </div>
    </div>
  );
}
