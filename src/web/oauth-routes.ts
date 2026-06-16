import type { FastifyInstance } from "fastify";
import type { Hub } from "../hub.js";
import { MCPNotFoundError } from "../utils/errors.js";

function oauthResultPage(name: string, status: string): string {
  return `<!DOCTYPE html>
<html><body><script>
  if (window.opener) {
    window.opener.postMessage({ type: "mcp-oauth", status: "${status}", name: "${name}" }, "*");
  }
  window.close();
</script></body></html>`;
}

export function registerOAuthRoutes(app: FastifyInstance, hub: Hub): void {
  app.get<{ Params: { name: string } }>(
    "/api/mcps/:name/oauth/status",
    async (req, reply) => {
      const name = req.params.name;
      try {
        const def = hub.registry.getDefinitions().find((d) => d.name === name);
        if (!def) throw new MCPNotFoundError(name);
        const status = hub.registry
          .getStatusSummary()
          .find((s) => s.name === name);
        return {
          name,
          transport: def.transport.type,
          oauthNeeded: status?.oauthNeeded ?? false,
          oauthUrl: status?.oauthUrl ?? null,
          oauthHasToken: hub.registry.hasOAuthToken(name),
          authorized: status?.oauthHasToken ?? false,
        };
      } catch (err) {
        if (err instanceof MCPNotFoundError)
          return reply.status(404).send({ error: err.message });
        throw err;
      }
    },
  );

  app.get<{ Params: { name: string } }>(
    "/api/mcps/:name/oauth/start",
    async (req, reply) => {
      const name = req.params.name;
      try {
        const def = hub.registry.getDefinitions().find((d) => d.name === name);
        if (!def) throw new MCPNotFoundError(name);

        const provider = hub.registry.getOAuthProvider(name);
        if (!provider) {
          return await reply
            .status(400)
            .send({ error: "OAuth not available for this MCP" });
        }

        if (hub.registry.hasOAuthToken(name)) {
          return { authorized: true, message: "Already authorized" };
        }

        let authUrl = hub.registry.getOAuthUrl(name);
        if (!authUrl) {
          await hub.registry.connect(name).catch(() => {});
          authUrl = hub.registry.getOAuthUrl(name);
        }

        if (authUrl) {
          return { authorized: false, authorizationUrl: authUrl };
        }

        return await reply.status(400).send({
          error: "Could not start OAuth flow - no authorization URL available",
        });
      } catch (err) {
        if (err instanceof MCPNotFoundError)
          return reply.status(404).send({ error: err.message });
        throw err;
      }
    },
  );

  app.get<{
    Params: { name: string };
    Querystring: { code?: string; error?: string };
  }>("/api/mcps/:name/oauth/callback", async (req, reply) => {
    const name = req.params.name;
    const { code, error } = req.query;

    if (error || !code) {
      if (error)
        hub.logger.error(
          { mcp: name, oauthError: error },
          "OAuth authorization denied",
        );
      const s = error ? "denied" : "error";
      return reply.type("text/html").send(oauthResultPage(name, s));
    }

    try {
      hub.logger.info(
        { mcp: name },
        "OAuth callback received, completing authorization",
      );
      await hub.registry.finishOAuth(name, code);
      hub.logger.info({ mcp: name }, "OAuth completed, reconnecting");
      await hub.registry.connect(name).catch(() => {});
      return await reply
        .type("text/html")
        .send(oauthResultPage(name, "success"));
    } catch (err) {
      hub.logger.error(
        { mcp: name, err: (err as Error).message },
        "OAuth callback failed",
      );
      return reply.type("text/html").send(oauthResultPage(name, "error"));
    }
  });
}
