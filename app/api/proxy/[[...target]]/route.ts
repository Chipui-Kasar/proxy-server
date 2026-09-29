import type { NextRequest } from "next/server";

/**
 * Route: /api/proxy/[[...target]]
 *
 * Generic passthrough proxy for third-party APIs that can't be called
 * directly from the browser (CORS). Any HTTPS host is proxied.
 *
 * Usage (any of these):
 *  https://<your-app>/api/proxy/https://api.bamboohr.com/...        (needs server.mjs)
 *  https://<your-app>/api/proxy/https%3A%2F%2Fapi.bamboohr.com%2F...  (encodeURIComponent)
 *  https://<your-app>/api/proxy?url=https%3A%2F%2Fapi.bamboohr.com%2F...
 *
 * Next.js 308-redirects paths containing "//" and a preflight can't follow a
 * redirect, so without server.mjs (e.g. on Vercel) use an encoded form.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREFIX = "/api/proxy/";

function corsHeaders(req: NextRequest): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
    // Echo whatever the browser asks for so extra client headers don't fail the preflight
    "Access-Control-Allow-Headers":
      req.headers.get("access-control-request-headers") ??
      "Content-Type, Authorization, Accept, X-SPD-Tenant",
    "Access-Control-Max-Age": "86400",
  };
}

function parseTarget(req: NextRequest): URL | null {
  // ?url=<encoded target> form
  const fromQuery = req.nextUrl.searchParams.get("url");
  if (fromQuery) {
    try {
      return new URL(fromQuery);
    } catch {
      return null;
    }
  }

  // Read from the raw pathname (not params) so percent-encoding is preserved.
  const path = req.nextUrl.pathname;
  let raw = path.startsWith(PREFIX) ? path.slice(PREFIX.length) : "";
  // Fully encoded target: /api/proxy/https%3A%2F%2Fhost%2Fpath
  if (/^https?%3A/i.test(raw)) {
    try {
      raw = decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  // Proxies/platforms may collapse "https://" to "https:/" in paths — repair it
  raw = raw.replace(/^(https?):\/(?!\/)/, "$1://");
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
export function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

async function handler(req: NextRequest): Promise<Response> {
  const target = parseTarget(req);
  if (!target) {
    return new Response("Invalid target URL", { status: 400, headers: corsHeaders(req) });
  }

  if (target.protocol !== "https:") {
    return new Response("Only HTTPS targets are allowed", { status: 403, headers: corsHeaders(req) });
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
        ...corsHeaders(req),
        "Content-Type": res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err) {
    return new Response(`Upstream request failed: ${(err as Error).message}`, {
      status: 502,
      headers: corsHeaders(req),
    });
  }
}

export {
  handler as GET,
  handler as HEAD,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
