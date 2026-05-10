/** Base URL for Catalog.Api (auth, catalog). Override with `VITE_CATALOG_API_URL` in `.env`. */
const BASE = (import.meta.env.VITE_CATALOG_API_URL as string | undefined)?.replace(/\/$/, "") ?? "http://localhost:5055";

export type AuthSuccess = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  userId: string;
  email: string;
  role: string;
};

async function parseAuthResponse(res: Response): Promise<AuthSuccess> {
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return {
    accessToken: String(data.accessToken ?? ""),
    tokenType: String(data.tokenType ?? "Bearer"),
    expiresIn: Number(data.expiresIn ?? 0),
    userId: String(data.userId ?? ""),
    email: String(data.email ?? ""),
    role: String(data.role ?? "shopper"),
  };
}

export async function loginWithPassword(email: string, password: string): Promise<AuthSuccess> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseAuthResponse(res);
}

export type RegisterParams = {
  email: string;
  password: string;
  role: "shopper" | "vendor";
  profile?: Record<string, unknown>;
};

export async function registerAccount(params: RegisterParams): Promise<AuthSuccess> {
  const res = await fetch(`${BASE}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      role: params.role,
      profile: params.profile ?? undefined,
    }),
  });
  return parseAuthResponse(res);
}

export function getCatalogApiBase(): string {
  return BASE;
}
