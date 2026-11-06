/**
 * Shared OAuth for Meet transcripts + Calendar booking.
 * Tokens: packages/agent/.meet-oauth.{client,tokens}.json via `npm run auth:meet`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const GOOGLE_WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/meetings.space.readonly",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

/** @deprecated use GOOGLE_WORKSPACE_SCOPES — kept for older imports */
export const MEET_SCOPES = GOOGLE_WORKSPACE_SCOPES;

export function resolveOAuthPaths() {
  const candidates = [
    join(dirname(fileURLToPath(import.meta.url)), ".."),
    process.cwd(),
    join(process.cwd(), "packages/agent"),
  ];
  for (const root of candidates) {
    const clientPath = join(root, ".meet-oauth.client.json");
    const tokensPath = join(root, ".meet-oauth.tokens.json");
    if (existsSync(clientPath) && existsSync(tokensPath)) return { clientPath, tokensPath };
  }
  const fallback = join(dirname(fileURLToPath(import.meta.url)), "..");
  return {
    clientPath: join(fallback, ".meet-oauth.client.json"),
    tokensPath: join(fallback, ".meet-oauth.tokens.json"),
  };
}

export function isGoogleOAuthConfigured(): boolean {
  const { clientPath, tokensPath } = resolveOAuthPaths();
  return (
    Boolean(process.env.GOOGLE_MEET_ACCESS_TOKEN?.trim()) ||
    (existsSync(clientPath) && existsSync(tokensPath)) ||
    process.env.GOOGLE_MEET_USE_ADC === "true"
  );
}

export async function getGoogleAccessToken(): Promise<
  { status: "ok"; token: string } | { status: "not_configured"; message: string }
> {
  const pasted = process.env.GOOGLE_MEET_ACCESS_TOKEN?.trim();
  if (pasted) return { status: "ok", token: pasted };

  const { clientPath, tokensPath } = resolveOAuthPaths();
  if (existsSync(clientPath) && existsSync(tokensPath)) {
    try {
      const clientJson = JSON.parse(readFileSync(clientPath, "utf8")) as {
        client_id: string;
        client_secret: string;
      };
      const tokens = JSON.parse(readFileSync(tokensPath, "utf8"));
      const { OAuth2Client } = await import("google-auth-library");
      const oauth2 = new OAuth2Client(clientJson.client_id, clientJson.client_secret);
      oauth2.setCredentials(tokens);
      const fresh = await oauth2.getAccessToken();
      const token = typeof fresh === "string" ? fresh : fresh?.token;
      if (token) {
        writeFileSync(tokensPath, JSON.stringify(oauth2.credentials, null, 2));
        return { status: "ok", token };
      }
    } catch (err) {
      return {
        status: "not_configured",
        message: `OAuth Google falló (${err instanceof Error ? err.message : String(err)}). Corre: npm run auth:meet -w @commercial/agent`,
      };
    }
  }

  if (process.env.GOOGLE_MEET_USE_ADC === "true") {
    try {
      const { GoogleAuth } = await import("google-auth-library");
      const auth = new GoogleAuth({ scopes: [...GOOGLE_WORKSPACE_SCOPES] });
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
      if (token) return { status: "ok", token };
    } catch {
      /* fall through */
    }
  }

  return {
    status: "not_configured",
    message:
      "Google OAuth no configurado. Corre `npm run auth:meet -w @commercial/agent` (scopes Meet + Calendar) o pega GOOGLE_MEET_ACCESS_TOKEN.",
  };
}
