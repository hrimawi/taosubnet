import { NextResponse } from "next/server";
import { ConfigError } from "./env";

/** Shared API-route error envelope: clear setup errors instead of opaque 500s. */
export async function handleRoute(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ConfigError) {
      return NextResponse.json({ error: err.message, setup: true }, { status: 503 });
    }
    console.error("[api]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found"): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}
