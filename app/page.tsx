export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>SPD Proxy</h1>
      <p>
        Usage: <code>/api/proxy?url=https%3A%2F%2Fapi.example.com%2Fpath%3Fquery%3D1</code>
      </p>
      <p>
        Example:{" "}
        <code>
          {"fetch(`/api/proxy?url=${encodeURIComponent(\"https://api.example.com/path?query=1\")}`)"}
        </code>
      </p>
      <p>
        Encode the full target URL (including its query string) with{" "}
        <code>encodeURIComponent</code>, and don&apos;t add a trailing slash after{" "}
        <code>/api/proxy</code>.
      </p>
    </main>
  );
}
