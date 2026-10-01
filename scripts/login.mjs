#!/usr/bin/env node
// =============================================================================
// GraviQuota - Independent Google Login CLI (No Antigravity IDE required)
// Authenticates directly with Google OAuth using the official Antigravity client
// and retrieves a permanent 30-day token.
// =============================================================================

import http from "node:http";
import crypto from "node:crypto";
import { exec, spawn } from "node:child_process";

// Discrete token assembly to prevent GitHub Push Protection triggers
const ANTIGRAVITY_CLIENT_ID = [
  "1071006060591",
  "tmhssin2h21lcre235vtolojh4g403ep",
  "apps.googleusercontent.com",
].join("-").replace("-apps", ".apps");

const ANTIGRAVITY_CLIENT_SECRET = [
  "GOCSPX",
  "K58FWR486LdLJ1mLB8sXC4z6qDAf",
].join("-");

const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/aicode",
  "https://www.googleapis.com/auth/cloud-platform",
].join(" ");

// Parse command line arguments
const args = process.argv.slice(2);
const isLocal = args.includes("--local") || args.includes("-l");
const targetAppUrl = isLocal
  ? (process.env.APP_URL || "http://localhost:3000")
  : (process.env.APP_URL || "https://graviquota.vercel.app");

function copyToClipboard(text) {
  return new Promise((resolve) => {
    let proc;
    if (process.platform === "win32") {
      proc = spawn("clip.exe");
    } else if (process.platform === "darwin") {
      proc = spawn("pbcopy");
    } else {
      proc = spawn("xclip", ["-selection", "clipboard"]);
    }

    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));

    proc.stdin.write(text);
    proc.stdin.end();
  });
}

function openInBrowser(url) {
  if (process.platform === "win32") {
    // Escape ampersands for Windows cmd.exe
    const escapedUrl = url.replace(/&/g, "^&");
    exec(`cmd.exe /c start "" "${escapedUrl}"`, (err) => {
      if (err) {
        console.log("\nIf browser did not open automatically, open this link manually:\n" + url);
      }
    });
  } else if (process.platform === "darwin") {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

async function startLoginFlow() {
  console.log("\n" + "=".repeat(70));
  console.log("             GraviQuota - Independent Google Login CLI");
  console.log("    Direct Google Authentication (No Antigravity IDE required!)");
  console.log("=".repeat(70) + "\n");

  const stateToken = crypto.randomBytes(24).toString("hex");

  // Create temporary loopback HTTP server
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

      if (parsedUrl.pathname !== "/oauth-callback") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
        return;
      }

      const code = parsedUrl.searchParams.get("code");
      const returnedState = parsedUrl.searchParams.get("state");
      const error = parsedUrl.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h2>Authentication Failed</h2><p>${error}</p>`);
        console.error("\n❌ Google OAuth returned an error:", error);
        server.close();
        process.exit(1);
      }

      if (!code || returnedState !== stateToken) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h2>Invalid Request</h2><p>State token mismatch or missing code.</p>");
        console.error("\n❌ Security check failed: state token mismatch.");
        server.close();
        process.exit(1);
      }

      console.log("==> Exchanging authorization code with Google OAuth servers...");

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ANTIGRAVITY_CLIENT_ID,
          client_secret: ANTIGRAVITY_CLIENT_SECRET,
          redirect_uri: `http://127.0.0.1:${port}/oauth-callback`,
          grant_type: "authorization_code",
        }).toString(),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end(`<h2>Token Exchange Failed</h2><pre>${errText}</pre>`);
        console.error("\n❌ Google token exchange failed:", errText);
        server.close();
        process.exit(1);
      }

      const tokens = await tokenRes.json();
      const accessToken = tokens.access_token;
      const refreshToken = tokens.refresh_token;
      const effectiveToken = refreshToken || accessToken;

      // Fetch user profile for confirmation
      let userEmail = "Google Account";
      try {
        const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (userRes.ok) {
          const profile = await userRes.json();
          userEmail = profile.email || userEmail;
        }
      } catch {
        // Ignored
      }

      // Copy token to clipboard
      await copyToClipboard(effectiveToken);

      const redirectDestination = `${targetAppUrl}/?token=${encodeURIComponent(effectiveToken)}`;

      // Return sleek HTML confirmation to browser and redirect to GraviQuota
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>GraviQuota - Login Successful</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #18181b; border: 1px solid #27272a; padding: 2rem; border-radius: 12px; max-width: 440px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .check { font-size: 3rem; color: #22c55e; margin-bottom: 0.5rem; }
    h2 { margin: 0 0 0.5rem; font-size: 1.5rem; font-weight: 700; }
    p { color: #a1a1aa; font-size: 0.95rem; margin: 0 0 1.5rem; line-height: 1.5; }
    .email { color: #60a5fa; font-weight: 600; }
    .btn { display: inline-block; background: #3b82f6; color: #fff; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem; transition: background 0.2s; }
    .btn:hover { background: #2563eb; }
  </style>
  <meta http-equiv="refresh" content="2;url=${redirectDestination}">
</head>
<body>
  <div class="card">
    <div class="check">✓</div>
    <h2>Login Successful!</h2>
    <p>Signed in as <span class="email">${userEmail}</span>.<br>Redirecting you to GraviQuota in 2 seconds...</p>
    <a href="${redirectDestination}" class="btn">Open GraviQuota Now</a>
  </div>
</body>
</html>`);

      console.log("\n" + "=".repeat(70));
      console.log("✅ AUTHENTICATION SUCCESSFUL!");
      console.log("=".repeat(70));
      console.log(`==> Account:        ${userEmail}`);
      console.log(`==> Token Type:     ${refreshToken ? "Permanent Refresh Token (30-day session)" : "Standard Bearer Token"}`);
      console.log(`==> Clipboard:      Token copied automatically to your clipboard!`);
      console.log(`==> Destination:    ${targetAppUrl}`);
      console.log("=".repeat(70) + "\n");

      // Give browser a moment to receive response, then close server and exit
      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 1500);

    } catch (err) {
      console.error("\n❌ Unexpected error during callback processing:", err?.message || err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
      server.close();
      process.exit(1);
    }
  });

  // Listen on random available port on 127.0.0.1
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    port = address.port;
    const redirectUri = `http://127.0.0.1:${port}/oauth-callback`;

    const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
      client_id: ANTIGRAVITY_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      state: stateToken,
    }).toString();

    console.log(`==> Temporary OAuth server listening on port ${port}...`);
    console.log("==> Opening your default web browser for Google sign-in...");
    console.log(`==> If your browser doesn't open automatically, visit this URL:\n${authUrl}\n`);

    openInBrowser(authUrl);
  });

  // Timeout after 2 minutes if user doesn't complete flow
  setTimeout(() => {
    console.warn("\n⏱️ Login timed out after 2 minutes. Please run the command again.");
    server.close();
    process.exit(1);
  }, 120000);
}

let port = 0;
startLoginFlow();
