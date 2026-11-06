/**
 * OAuth login for Meet transcripts + Google Calendar booking.
 *
 *   npm run auth:meet -w @commercial/agent
 *
 * Add BOTH scopes in Console → Acceso a los datos, then run this.
 * Writes .meet-oauth.tokens.json (gitignored). Restart adk web after.
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { OAuth2Client } from "google-auth-library";
import { GOOGLE_WORKSPACE_SCOPES } from "./google-oauth.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const clientPath = join(root, ".meet-oauth.client.json");
const tokensPath = join(root, ".meet-oauth.tokens.json");

const clientJson = JSON.parse(readFileSync(clientPath, "utf8")) as {
  client_id: string;
  client_secret: string;
};

const port = 8765;
const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
const oauth2 = new OAuth2Client(clientJson.client_id, clientJson.client_secret, redirectUri);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [...GOOGLE_WORKSPACE_SCOPES],
  include_granted_scopes: true,
});

console.log("1) Redirect URI en el cliente OAuth (si es Web):");
console.log(`   ${redirectUri}`);
console.log("2) Acceso a los datos — scopes:");
for (const s of GOOGLE_WORKSPACE_SCOPES) console.log(`   - ${s}`);
console.log("3) Habilita Calendar API en el proyecto GCP");
console.log("4) Inicia sesión con aarrietamorelo89@correo.unicordoba.edu.co\n");
console.log(authUrl);
console.log(`\nEscuchando ${redirectUri} … (no abras esa URL a mano)\n`);

exec(`open '${authUrl.replace(/'/g, "'\\''")}'`);

await new Promise<void>((resolve, reject) => {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      if (url.pathname !== "/oauth2callback") {
        res.writeHead(404).end("Not found");
        return;
      }

      const code = url.searchParams.get("code");
      const err = url.searchParams.get("error");

      if (!code && !err) {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Esperando el redirect de Google con ?code=… No cierres la terminal.");
        return;
      }

      if (err || !code) {
        const msg = `OAuth error: ${err ?? "missing code"}`;
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(msg);
        console.error(msg);
        console.error("Si ves redirect_uri_mismatch, añade exactamente:", redirectUri);
        server.close();
        reject(new Error(msg));
        return;
      }

      const { tokens } = await oauth2.getToken(code);
      writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>Google OAuth OK (Meet + Calendar)</h1><p>Puedes cerrar esta pestaña.</p>");
      console.log(`\nTokens guardados en ${tokensPath}`);
      console.log("Reinicia: npx adk web");
      server.close();
      resolve();
    } catch (e) {
      res.writeHead(500).end(String(e));
      console.error(e);
      server.close();
      reject(e);
    }
  });
  server.listen(port, "127.0.0.1");
});
