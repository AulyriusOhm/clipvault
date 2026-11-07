import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.ts";
import { createUser, db, findBySubject, getSettings, redeemInvite, usableInvite, type User } from "./db.ts";

declare module "fastify" {
  interface Session {
    userId?: number;
    oidcState?: string;
    oidcNonce?: string;
    oidcVerifier?: string;
    inviteToken?: string;
  }
}

interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  end_session_endpoint?: string;
}

let discoveryCache: Discovery | undefined;

async function discovery(): Promise<Discovery> {
  if (discoveryCache) {
    return discoveryCache;
  }
  const oidc = config.auth;
  if (oidc.mode !== "oidc") {
    throw new Error("Découverte OIDC demandée en mode dev");
  }
  const url = new URL(".well-known/openid-configuration", oidc.issuer.endsWith("/") ? oidc.issuer : `${oidc.issuer}/`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Découverte OIDC impossible (${response.status}) sur ${url}`);
  }
  discoveryCache = (await response.json()) as Discovery;
  return discoveryCache;
}

function base64url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

export function currentUser(request: FastifyRequest): User | undefined {
  const id = request.session.userId;
  if (!id) {
    return undefined;
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | undefined;
  return user;
}

export function requireUser(request: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void): void {
  if (!currentUser(request)) {
    reply.redirect(`/login?next=${encodeURIComponent(request.url)}`);
    return;
  }
  done();
}

export function devSignIn(request: FastifyRequest): User {
  const subject = "dev:kael_";
  const existing = findBySubject(subject);
  if (existing) {
    request.session.userId = existing.id;
    return existing;
  }
  const user = createUser(subject, "kael_", "Kael", "admin");
  request.session.userId = user.id;
  return user;
}

export function redirectUri(request: FastifyRequest): string {
  const oidc = config.auth;
  if (oidc.mode !== "oidc") {
    throw new Error("redirectUri appelé en mode dev");
  }
  const publicUrl = getSettings().public_url;
  if (publicUrl) {
    return `${publicUrl.replace(/\/+$/, "")}/auth/callback`;
  }
  if (oidc.redirectUri) {
    return oidc.redirectUri;
  }
  const proto = (request.headers["x-forwarded-proto"] as string | undefined) ?? request.protocol;
  return `${proto}://${request.headers.host}/auth/callback`;
}

export async function buildLoginUrl(request: FastifyRequest): Promise<string> {
  const oidc = config.auth;
  if (oidc.mode !== "oidc") {
    throw new Error("buildLoginUrl appelé en mode dev");
  }
  const meta = await discovery();

  const state = base64url(crypto.randomBytes(24));
  const nonce = base64url(crypto.randomBytes(24));
  const verifier = base64url(crypto.randomBytes(48));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());

  request.session.oidcState = state;
  request.session.oidcNonce = nonce;
  request.session.oidcVerifier = verifier;

  const url = new URL(meta.authorization_endpoint);
  url.searchParams.set("client_id", oidc.clientId);
  url.searchParams.set("redirect_uri", redirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", oidc.scopes);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

interface UserInfo {
  sub: string;
  preferred_username?: string;
  nickname?: string;
  name?: string;
  email?: string;
  groups?: string[];
}

export async function completeLogin(request: FastifyRequest, code: string, state: string): Promise<User> {
  const oidc = config.auth;
  if (oidc.mode !== "oidc") {
    throw new Error("completeLogin appelé en mode dev");
  }
  if (!request.session.oidcState || request.session.oidcState !== state) {
    throw new Error("state OIDC invalide — relancez la connexion");
  }
  const verifier = request.session.oidcVerifier;
  if (!verifier) {
    throw new Error("code_verifier absent de la session");
  }

  const meta = await discovery();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(request),
    code_verifier: verifier,
  });

  const basic = Buffer.from(`${oidc.clientId}:${oidc.clientSecret}`).toString("base64");
  const tokenResponse = await fetch(meta.token_endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${basic}`,
    },
    body,
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw new Error(`Échange de code refusé (${tokenResponse.status}) : ${text.slice(0, 300)}`);
  }

  const tokens = (await tokenResponse.json()) as { access_token?: string };
  if (!tokens.access_token) {
    throw new Error("Pas d'access_token dans la réponse du token_endpoint");
  }

  const userinfoResponse = await fetch(meta.userinfo_endpoint, {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userinfoResponse.ok) {
    throw new Error(`userinfo refusé (${userinfoResponse.status})`);
  }
  const info = (await userinfoResponse.json()) as UserInfo;

  const username = info.preferred_username ?? info.nickname ?? info.email?.split("@")[0] ?? info.sub;
  const displayName = info.name ?? username;
  const role = (info.groups ?? []).includes(oidc.adminGroup) ? "admin" : "member";

  let user = findBySubject(info.sub);
  if (!user) {
    if (!oidc.autoCreate) {
      throw new Error(`Compte inconnu (${username}) et création automatique désactivée`);
    }
    if (getSettings().invite_only === "true") {
      const invite = request.session.inviteToken ? usableInvite(request.session.inviteToken) : undefined;
      if (!invite) {
        throw new Error("cette instance est sur invitation — demandez un lien à un administrateur");
      }
      user = createUser(info.sub, username, displayName, role);
      redeemInvite(invite.token, user.id);
      delete request.session.inviteToken;
    } else {
      user = createUser(info.sub, username, displayName, role);
    }
  } else if (user.role !== role) {
    db.prepare("UPDATE users SET role = ?, display_name = ?, username = ? WHERE id = ?")
      .run(role, displayName, username, user.id);
    user = findBySubject(info.sub);
  }

  delete request.session.oidcState;
  delete request.session.oidcNonce;
  delete request.session.oidcVerifier;
  request.session.userId = user!.id;
  return user!;
}

export async function logoutUrl(request: FastifyRequest): Promise<string | undefined> {
  const oidc = config.auth;
  if (oidc.mode !== "oidc") {
    return undefined;
  }
  const meta = await discovery();
  if (!meta.end_session_endpoint) {
    return undefined;
  }
  return `${meta.end_session_endpoint}?post_logout_redirect_uri=${encodeURIComponent(config.baseUrl)}`;
}
