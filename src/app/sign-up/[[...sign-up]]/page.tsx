import { SignUp } from "@clerk/nextjs";
import { Mark } from "@/components/mark";
import { Pitch } from "../../sign-in/[[...sign-in]]/page";

export const metadata = { title: "Create an account · Dispensia" };

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-[400px]">
          <Mark size={36} />
          <h1 className="t-display-lg mt-5">Create your account</h1>
          <p className="t-prose mt-2" data-depth="1">
            Next you will register your pharmacy or join one with an invitation link.
          </p>

          <div className="mt-7">
            <SignUp />
          </div>
        </div>
      </div>

      <Pitch />
    </main>
  );
}
