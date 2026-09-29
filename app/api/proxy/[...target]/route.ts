import type { NextRequest } from "next/server";

/**
 * Route: /api/proxy/[...target]
 *
 * Generic passthrough proxy for third-party APIs that can't be called
 * directly from the browser (CORS). Any HTTPS host is proxied.
 *
 * Usage:
 *  https://<your-app>/api/proxy/https://api.bamboohr.com/...
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFIX = "/api/proxy/";

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-SPD-Tenant",
  };
}

function parseTarget(req: NextRequest): URL | null {
  // Read from the raw pathname (not params) so percent-encoding is preserved.
  // Proxies/platforms may collapse "https://" to "https:/" in paths — repair it
  const path = req.nextUrl.pathname;
  const raw = (path.startsWith(PREFIX) ? path.slice(PREFIX.length) : "").replace(
    /^(https?):\/(?!\/)/,
    "$1://",
  );
  try {
    return new URL(raw + req.nextUrl.search);
  } catch {
    return null;
  }
}

/**
 * Identifies the calling tenant. Both values are client-supplied and
 * NOT verified — use for logging/analytics only, not access control.
 *  - host: from the browser's Origin (or Referer) header, e.g. "contoso.sharepoint.com"
 *  - tenantId: from the X-SPD-Tenant header (SPFx: pageContext.aad.tenantId)
 */
function getCaller(req: NextRequest): { host: string | null; tenantId: string | null } {
  const source = req.headers.get("origin") ?? req.headers.get("referer");
  let host: string | null = null;
  try {
    if (source) host = new URL(source).hostname;
  } catch {
    // Malformed header — leave host null
  }
  return { host, tenantId: req.headers.get("x-spd-tenant") };
}

// Browser preflight (triggered by the Authorization header)
export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function handler(req: NextRequest): Promise<Response> {
  const target = parseTarget(req);
  if (!target) {
    return new Response("Invalid target URL", { status: 400, headers: corsHeaders() });
  }

  if (target.protocol !== "https:") {
    return new Response("Only HTTPS targets are allowed", { status: 403, headers: corsHeaders() });
  }

  const caller = getCaller(req);
  console.log(
    `SPDProxy ${req.method} ${target.host} | host=${caller.host ?? "-"} tenant=${caller.tenantId ?? "-"}`,
  );

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const headers: Record<string, string> = {
    Accept: req.headers.get("accept") ?? "application/json",
  };
  const auth = req.headers.get("authorization");
  if (auth) headers.Authorization = auth;
  if (hasBody) {
    headers["Content-Type"] = req.headers.get("content-type") ?? "application/json";
  }

  try {
    const res = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      cache: "no-store",
    });

    // Response() throws if a body is attached to a null-body status
    const nullBody = [101, 204, 205, 304].includes(res.status);
    return new Response(nullBody ? null : await res.arrayBuffer(), {
      status: res.status,
      headers: {
        ...corsHeaders(),
        "Content-Type": res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err) {
    return new Response(`Upstream request failed: ${(err as Error).message}`, {
      status: 502,
      headers: corsHeaders(),
    });
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
