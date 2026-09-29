# SPD Proxy

Passthrough proxy for third-party HTTPS APIs that can't be called directly from the browser (CORS). Deployed at https://tkm-proxy-server.vercel.app.

## Usage

Pass the full target URL, encoded with `encodeURIComponent`, in the `url` query parameter:

```
/api/proxy?url=https%3A%2F%2Fapi.example.com%2Fpath%3Fquery%3D1
```

```ts
const target = "https://api.example.com/path?query=1";
const res = await fetch(
  `https://tkm-proxy-server.vercel.app/api/proxy?url=${encodeURIComponent(target)}`,
  { headers: { Authorization: "Bearer <token>" } },
);
```

- Encode the whole target URL, including its query string.
- Don't add a trailing slash after `/api/proxy` (`/api/proxy/?url=` redirects and fails the CORS preflight).
- Only `https://` targets are allowed.
- Supported methods: `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`.
- Forwarded to the target: `Authorization`, `Accept` and `Content-Type`. Other request headers are accepted by the preflight but not forwarded.
- Optional `X-SPD-Tenant` header (e.g. SPFx `pageContext.aad.tenantId`) is logged with the caller's origin. It isn't verified, so it's for logging only.

The path form `/api/proxy/https://...` doesn't work on Vercel: its edge 308-redirects any path containing `//`, and browsers can't follow a redirect on a CORS preflight.

## Development

```sh
npm install
npm run dev     # http://localhost:3000
npm run build
npm start
```
