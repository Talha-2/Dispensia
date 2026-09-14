import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "dispensia",
    backendEnabled: process.env.NEXT_PUBLIC_BACKEND_ENABLED === "true",
    timestamp: new Date().toISOString(),
  });
}
