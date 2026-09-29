export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>SPD Proxy</h1>
      <p>Usage (encode the target URL with encodeURIComponent):</p>
      <ul>
        <li>
          <code>/api/proxy?url=https%3A%2F%2Fapi.example.com%2Fpath%3Fquery%3D1</code>
        </li>
        <li>
          <code>/api/proxy/https%3A%2F%2Fapi.example.com%2Fpath%3Fquery%3D1</code>
        </li>
      </ul>
      <p>
        Example:{" "}
        <code>
          {"fetch(`/api/proxy?url=${encodeURIComponent(\"https://api.example.com/path?query=1\")}`)"}
        </code>
      </p>
      <p>
        The unencoded form <code>/api/proxy/https://api.example.com/...</code> only works when the
        app runs through <code>server.mjs</code>. Elsewhere (e.g. Vercel), Next.js redirects the
        {" "}
        <code>//</code> and the browser reports a CORS error.
      </p>
    </main>
  );
}
