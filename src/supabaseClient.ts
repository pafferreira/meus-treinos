import type { UserPlan } from "./App";

export type MonthProgress = { target: number; done: number };
export type RemoteUserSnapshot = {
  avatarId?: string;
  plan?: UserPlan;
  points?: number;
  progressByMonth?: Record<string, MonthProgress>;
};

const TABLE_NAME = "benfit_user_state";

function readEnv(key: string): string {
  const metaEnv = typeof import.meta !== "undefined" ? ((import.meta as any).env ?? {}) : {};
  const globalEnv = typeof globalThis !== "undefined" ? ((globalThis as any).process?.env ?? {}) : {};
  const value = metaEnv[key] ?? metaEnv[`VITE_${key}`] ?? globalEnv[key] ?? globalEnv[`VITE_${key}`];
  return typeof value === "string" ? value.trim() : "";
}

const SUPABASE_URL = (() => {
  const url = readEnv("SUPABASE_URL") || readEnv("PUBLIC_SUPABASE_URL");
  return url ? url.replace(/\/$/, "") : "";
})();
const SUPABASE_ANON_KEY = readEnv("SUPABASE_ANON_KEY") || readEnv("PUBLIC_SUPABASE_ANON_KEY");

const config = SUPABASE_URL && SUPABASE_ANON_KEY ? { url: SUPABASE_URL, key: SUPABASE_ANON_KEY } : null;

export const isSupabaseConfigured = !!config;

function buildHeaders(base?: Record<string, string>): Record<string, string> {
  if (!config) return base ?? {};
  return {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
    ...base,
  };
}

export type RemoteLoadResult = { snapshot: RemoteUserSnapshot | null; error?: string };

export async function loadRemoteUserState(userId: string): Promise<RemoteLoadResult> {
  if (!config) return { snapshot: null };
  try {
    const url = `${config.url}/rest/v1/${TABLE_NAME}?user_id=eq.${encodeURIComponent(userId)}&select=state`;
    const res = await fetch(url, {
      headers: buildHeaders({ Accept: "application/json" }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("Supabase load error", res.status, text);
      return { snapshot: null, error: `HTTP ${res.status}` };
    }
    const payload = await res.json();
    const row = Array.isArray(payload) ? payload[0] : payload;
    if (!row || row.state == null) return { snapshot: null };
    if (typeof row.state === "string") {
      try {
        return { snapshot: JSON.parse(row.state) as RemoteUserSnapshot };
      } catch (err) {
        console.warn("Supabase state parse error", err);
        return { snapshot: null, error: "invalid_json" };
      }
    }
    return { snapshot: row.state as RemoteUserSnapshot };
  } catch (error) {
    console.warn("Supabase load exception", error);
    return { snapshot: null, error: error instanceof Error ? error.message : "unknown" };
  }
}

export async function saveRemoteUserState(userId: string, snapshot: RemoteUserSnapshot): Promise<boolean> {
  if (!config) return false;
  try {
    const res = await fetch(`${config.url}/rest/v1/${TABLE_NAME}`, {
      method: "POST",
      headers: buildHeaders({
        "Content-Type": "application/json",
        Prefer: "return=minimal,resolution=merge-duplicates",
      }),
      body: JSON.stringify({
        user_id: userId,
        state: snapshot,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("Supabase save error", res.status, text);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("Supabase save exception", error);
    return false;
  }
}
