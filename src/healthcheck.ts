/**
 * IMPL: Docker HEALTHCHECK probe — hits the Web UI version endpoint.
 * Exits 0 when healthy, 1 otherwise.
 */
const port = Number(
  process.env.MORPH_WEB_PORT ?? process.env.MORPH_TRANSPORT_PORT ?? process.env.PORT ?? 3100,
);

try {
  const res = await fetch(`http://127.0.0.1:${port}/api/version`);
  process.exit(res.ok ? 0 : 1);
} catch {
  process.exit(1);
}
