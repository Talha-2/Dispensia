import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "dispensia",
    // Read here, on the server, and nowhere else — so it carries no public
    // prefix. A NEXT_PUBLIC_ name would ship it to every browser for nothing.
    backendEnabled: process.env.BACKEND_ENABLED === "true",
    timestamp: new Date().toISOString(),
  });
}
