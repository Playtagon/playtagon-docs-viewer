#!/usr/bin/env node

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { loadEnv } from "./load_env.mjs";

await loadEnv();

const port = Number(process.env.PORT || process.argv[2] || 8787);
const root = resolve("viewer");
const configFile = resolve("docs-viewer.config.json");
const SESSION_COOKIE = "docs_viewer_session";
const OAUTH_STATE_COOKIE = "docs_viewer_oauth_state";
const DEFAULT_CONFIG = {
  source: {
    type: "local",
    local: { path: "docs-sample" },
    github: {
      owner: "your-org",
      repo: "your-docs-repo",
      branch: "main",
      path: "docs",
    },
  },
  roadmap: {
    includedFolders: ["04-Roadmap-Sample"],
    excludedFolders: [],
    hideUndated: false,
  },
  ignoredFolders: [
    ".git",
    ".claude",
    ".obsidian",
    ".trash",
    "node_modules",
    "__pycache__",
    ".github/workflows",
    "apps/internal",
    "docs/superpowers",
    "scripts",
  ],
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "content-type": contentType });
  res.end(body);
}

function sendHtml(res, status, body) {
  send(res, status, body, "text/html; charset=utf-8");
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { location, ...headers });
  res.end();
}

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function getBaseUrl(req) {
  return (process.env.AUTH_BASE_URL || `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`).replace(/\/$/, "");
}

function parseCookies(req) {
  const cookies = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) continue;
    cookies[rawName] = decodeURIComponent(rawValue.join("=") || "");
  }
  return cookies;
}

function cookieHeader(name, value, req, options = {}) {
  const baseUrl = getBaseUrl(req);
  const secure = baseUrl.startsWith("https://");
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    options.maxAge === 0 ? "Max-Age=0" : options.maxAge ? `Max-Age=${options.maxAge}` : "",
  ].filter(Boolean);
  return parts.join("; ");
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payload, secret) {
  const body = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifySignedPayload(value, secret) {
  if (!value || !secret) return null;
  const [body, signature] = String(value).split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const givenBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (givenBuffer.length !== expectedBuffer.length || !timingSafeEqual(givenBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function authConfig() {
  const enabled = isTruthy(process.env.AUTH_ENABLED);
  const providers = parseList(process.env.AUTH_PROVIDERS || "google,github,oidc").filter((provider) =>
    ["google", "github", "oidc"].includes(provider),
  );
  return {
    enabled,
    providers,
    allowedEmails: parseList(process.env.AUTH_ALLOWED_EMAILS),
    allowedDomains: parseList(process.env.AUTH_ALLOWED_DOMAINS),
    adminEmails: parseList(process.env.AUTH_ADMIN_EMAILS),
    sessionSecret: process.env.AUTH_SESSION_SECRET || "",
    sessionTtlMs: Number(process.env.AUTH_SESSION_TTL_HOURS || 12) * 60 * 60 * 1000,
  };
}

function currentSession(req) {
  const config = authConfig();
  if (!config.enabled) return { email: "local@docs-viewer", provider: "disabled" };
  return verifySignedPayload(parseCookies(req)[SESSION_COOKIE], config.sessionSecret);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isAllowedEmail(email) {
  const config = authConfig();
  const normalized = normalizeEmail(email);
  const domain = normalized.split("@")[1] || "";
  return config.allowedEmails.includes(normalized) || config.allowedDomains.includes(domain);
}

function isAdminEmail(email) {
  const config = authConfig();
  if (!config.enabled) return true;
  if (!config.adminEmails.length) return true;
  return config.adminEmails.includes(normalizeEmail(email));
}

function ensureAuthReady(res) {
  const config = authConfig();
  if (!config.enabled) return true;
  if (!config.sessionSecret || config.sessionSecret.length < 32) {
    send(res, 500, "AUTH_SESSION_SECRET must be set to at least 32 characters when AUTH_ENABLED=true");
    return false;
  }
  if (!config.allowedEmails.length && !config.allowedDomains.length) {
    send(res, 500, "AUTH_ALLOWED_EMAILS or AUTH_ALLOWED_DOMAINS must be set when AUTH_ENABLED=true");
    return false;
  }
  if (!config.providers.length) {
    send(res, 500, "AUTH_PROVIDERS must include at least one provider: google, github, oidc");
    return false;
  }
  return true;
}

function authProviderConfig(provider) {
  if (provider === "google") {
    return {
      authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenEndpoint: "https://oauth2.googleapis.com/token",
      userinfoEndpoint: "https://openidconnect.googleapis.com/v1/userinfo",
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      scope: "openid email profile",
    };
  }

  if (provider === "github") {
    return {
      authorizationEndpoint: "https://github.com/login/oauth/authorize",
      tokenEndpoint: "https://github.com/login/oauth/access_token",
      userinfoEndpoint: "https://api.github.com/user",
      emailsEndpoint: "https://api.github.com/user/emails",
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      scope: "read:user user:email",
    };
  }

  return null;
}

async function oidcProviderConfig() {
  const issuer = (process.env.OIDC_ISSUER || "").replace(/\/$/, "");
  if (!issuer) return null;
  const response = await fetch(`${issuer}/.well-known/openid-configuration`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("OIDC discovery failed");
  const discovery = await response.json();
  return {
    authorizationEndpoint: discovery.authorization_endpoint,
    tokenEndpoint: discovery.token_endpoint,
    userinfoEndpoint: discovery.userinfo_endpoint,
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    scope: process.env.OIDC_SCOPE || "openid email profile",
  };
}

async function getProviderConfig(provider) {
  return provider === "oidc" ? oidcProviderConfig() : authProviderConfig(provider);
}

function authLoginPage(req, message = "") {
  const config = authConfig();
  const providers = config.providers
    .map((provider) => `<a class="auth-button" href="/__auth/login/${provider}">Continue with ${provider.toUpperCase()}</a>`)
    .join("");
  const escapedMessage = message ? `<div class="auth-message">${escapeHtml(message)}</div>` : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sign in · Docs Viewer</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { align-items: center; background: #f7f7f4; color: #202522; display: grid; margin: 0; min-height: 100vh; padding: 24px; }
      main { margin: 0 auto; max-width: 420px; width: 100%; }
      h1 { font-size: 32px; letter-spacing: 0; line-height: 1.1; margin: 0 0 10px; }
      p { color: #68716b; line-height: 1.5; margin: 0 0 24px; }
      .auth-panel { background: #fff; border: 1px solid #dfe4df; border-radius: 8px; padding: 28px; }
      .auth-actions { display: grid; gap: 10px; }
      .auth-button { align-items: center; background: #19736c; border-radius: 6px; color: #fff; display: flex; font-weight: 700; height: 44px; justify-content: center; text-decoration: none; }
      .auth-button:hover { background: #105a54; }
      .auth-message { background: #fff3f1; border: 1px solid #e4b6af; border-radius: 6px; color: #8b2f28; margin-bottom: 16px; padding: 10px 12px; }
    </style>
  </head>
  <body>
    <main class="auth-panel">
      <h1>Docs Viewer</h1>
      <p>Sign in with an approved, verified email to access the documentation.</p>
      ${escapedMessage}
      <div class="auth-actions">${providers || "<p>No auth providers configured.</p>"}</div>
    </main>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function readConfig() {
  try {
    return JSON.parse(await readFile(configFile, "utf8"));
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function writeConfig(config) {
  await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function exchangeCodeForToken(provider, providerConfig, code, redirectUri) {
  const response = await fetch(providerConfig.tokenEndpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: providerConfig.clientId,
      client_secret: providerConfig.clientSecret,
    }),
  });
  const token = await response.json();
  if (!response.ok || token.error) {
    throw new Error(token.error_description || token.error || `${provider} token exchange failed`);
  }
  return token;
}

async function fetchJson(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      "user-agent": "docs-viewer-auth",
    },
  });
  if (!response.ok) throw new Error(`Auth provider request failed: ${response.status}`);
  return response.json();
}

async function loadIdentity(provider, providerConfig, token) {
  const accessToken = token.access_token;
  if (!accessToken) throw new Error("OAuth provider did not return an access token");

  if (provider === "github") {
    const [profile, emails] = await Promise.all([
      fetchJson(providerConfig.userinfoEndpoint, accessToken),
      fetchJson(providerConfig.emailsEndpoint, accessToken),
    ]);
    const verifiedEmail =
      emails.find((email) => email.primary && email.verified)?.email || emails.find((email) => email.verified)?.email || "";
    return {
      provider,
      providerUserId: String(profile.id || ""),
      email: normalizeEmail(verifiedEmail),
      emailVerified: Boolean(verifiedEmail),
      name: profile.name || profile.login || "",
      avatarUrl: profile.avatar_url || "",
    };
  }

  const profile = await fetchJson(providerConfig.userinfoEndpoint, accessToken);
  return {
    provider,
    providerUserId: String(profile.sub || profile.id || ""),
    email: normalizeEmail(profile.email),
    emailVerified: profile.email_verified === true || profile.email_verified === "true",
    name: profile.name || "",
    avatarUrl: profile.picture || "",
  };
}

async function handleAuth(req, res, url) {
  const config = authConfig();
  if (!url.pathname.startsWith("/__auth")) {
    return false;
  }

  if (!config.enabled) {
    if (req.method === "GET" && url.pathname === "/__auth/me") {
      send(res, 200, JSON.stringify({ authenticated: false, authEnabled: false }), "application/json; charset=utf-8");
      return true;
    }
    redirect(res, "/");
    return true;
  }
  if (!ensureAuthReady(res)) return true;

  if (req.method === "GET" && url.pathname === "/__auth/login") {
    sendHtml(res, 200, authLoginPage(req, url.searchParams.get("error") || ""));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/__auth/me") {
    const session = currentSession(req);
    if (!session) {
      send(res, 401, JSON.stringify({ authenticated: false }), "application/json; charset=utf-8");
      return true;
    }
    send(
      res,
      200,
      JSON.stringify({
        authenticated: true,
        email: session.email,
        provider: session.provider,
        name: session.name || "",
        isAdmin: isAdminEmail(session.email),
      }),
      "application/json; charset=utf-8",
    );
    return true;
  }

  if (req.method === "GET" && url.pathname === "/__auth/logout") {
    redirect(res, "/__auth/login", {
      "set-cookie": cookieHeader(SESSION_COOKIE, "", req, { maxAge: 0 }),
    });
    return true;
  }

  const loginMatch = url.pathname.match(/^\/__auth\/login\/([a-z]+)$/);
  if (req.method === "GET" && loginMatch) {
    const provider = loginMatch[1];
    if (!config.providers.includes(provider)) {
      send(res, 404, "Auth provider not configured");
      return true;
    }

    const providerConfig = await getProviderConfig(provider);
    if (!providerConfig?.clientId || !providerConfig?.clientSecret) {
      send(res, 500, `${provider.toUpperCase()} client id/secret are not configured`);
      return true;
    }

    const state = randomBytes(24).toString("base64url");
    const redirectUri = `${getBaseUrl(req)}/__auth/callback/${provider}`;
    const authorizeUrl = new URL(providerConfig.authorizationEndpoint);
    authorizeUrl.searchParams.set("client_id", providerConfig.clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", providerConfig.scope);
    authorizeUrl.searchParams.set("state", state);
    if (provider === "google" || provider === "oidc") {
      authorizeUrl.searchParams.set("prompt", "select_account");
    }

    redirect(res, authorizeUrl.toString(), {
      "set-cookie": cookieHeader(
        OAUTH_STATE_COOKIE,
        signPayload({ state, provider, exp: Date.now() + 10 * 60 * 1000 }, config.sessionSecret),
        req,
        { maxAge: 10 * 60 },
      ),
    });
    return true;
  }

  const callbackMatch = url.pathname.match(/^\/__auth\/callback\/([a-z]+)$/);
  if (req.method === "GET" && callbackMatch) {
    const provider = callbackMatch[1];
    const storedState = verifySignedPayload(parseCookies(req)[OAUTH_STATE_COOKIE], config.sessionSecret);
    if (!storedState || storedState.provider !== provider || storedState.state !== url.searchParams.get("state")) {
      sendHtml(res, 400, authLoginPage(req, "OAuth state check failed. Please try again."));
      return true;
    }

    try {
      const providerConfig = await getProviderConfig(provider);
      const redirectUri = `${getBaseUrl(req)}/__auth/callback/${provider}`;
      const token = await exchangeCodeForToken(provider, providerConfig, url.searchParams.get("code") || "", redirectUri);
      const identity = await loadIdentity(provider, providerConfig, token);
      if (!identity.email || !identity.emailVerified || !isAllowedEmail(identity.email)) {
        sendHtml(res, 403, authLoginPage(req, "This verified email is not allowed to access the docs."));
        return true;
      }

      const session = {
        provider,
        providerUserId: identity.providerUserId,
        email: identity.email,
        name: identity.name,
        exp: Date.now() + config.sessionTtlMs,
      };
      redirect(res, "/", {
        "set-cookie": [
          cookieHeader(SESSION_COOKIE, signPayload(session, config.sessionSecret), req, {
            maxAge: Math.floor(config.sessionTtlMs / 1000),
          }),
          cookieHeader(OAUTH_STATE_COOKIE, "", req, { maxAge: 0 }),
        ],
      });
      return true;
    } catch (error) {
      sendHtml(res, 500, authLoginPage(req, error.message));
      return true;
    }
  }

  return false;
}

function rebuildIndex() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["scripts/build_viewer_index.mjs"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `Build failed with code ${code}`));
      }
    });
  });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = normalize(join(root, requested));

  if (!filePath.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      send(res, 404, "Not found");
      return;
    }

    res.writeHead(200, {
      "content-type": MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(filePath).pipe(res);
  } catch {
    send(res, 404, "Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

  if (await handleAuth(req, res, url)) {
    return;
  }

  const config = authConfig();
  if (config.enabled) {
    if (!ensureAuthReady(res)) return;
    const session = currentSession(req);
    if (!session) {
      if (req.method === "GET" && (url.pathname === "/" || url.pathname.endsWith(".html"))) {
        redirect(res, "/__auth/login");
      } else {
        send(res, 401, JSON.stringify({ error: "Authentication required" }), "application/json; charset=utf-8");
      }
      return;
    }
  }

  if (req.method === "GET" && url.pathname === "/__config") {
    if (!isAdminEmail(currentSession(req)?.email)) {
      send(res, 403, JSON.stringify({ error: "Admin access required" }), "application/json; charset=utf-8");
      return;
    }

    try {
      const viewerConfig = await readConfig();
      send(
        res,
        200,
        JSON.stringify({
          ...viewerConfig,
          githubTokenConfigured: Boolean(process.env.DOCS_VIEWER_GITHUB_TOKEN || process.env.GITHUB_TOKEN),
          auth: {
            enabled: config.enabled,
            providers: config.providers,
            allowedEmailsConfigured: config.allowedEmails.length,
            allowedDomainsConfigured: config.allowedDomains.length,
            adminEmailsConfigured: config.adminEmails.length,
          },
        }),
        "application/json; charset=utf-8",
      );
    } catch (error) {
      send(res, 500, JSON.stringify({ error: error.message }), "application/json; charset=utf-8");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/__config") {
    if (!isAdminEmail(currentSession(req)?.email)) {
      send(res, 403, JSON.stringify({ error: "Admin access required" }), "application/json; charset=utf-8");
      return;
    }

    try {
      const nextConfig = await readJsonBody(req);
      await writeConfig(nextConfig);
      send(res, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
    } catch (error) {
      send(res, 500, JSON.stringify({ ok: false, error: error.message }), "application/json; charset=utf-8");
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/__rebuild") {
    if (!isAdminEmail(currentSession(req)?.email)) {
      send(res, 403, JSON.stringify({ error: "Admin access required" }), "application/json; charset=utf-8");
      return;
    }

    try {
      const result = await rebuildIndex();
      send(res, 200, JSON.stringify({ ok: true, output: result.stdout.trim() }), "application/json; charset=utf-8");
    } catch (error) {
      send(res, 500, JSON.stringify({ ok: false, error: error.message }), "application/json; charset=utf-8");
    }
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method not allowed");
    return;
  }

  await serveStatic(req, res);
});

server.listen(port, "::", () => {
  console.log(`Docs viewer dev server: http://127.0.0.1:${port}`);
});
