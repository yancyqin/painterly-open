const API_ORIGIN = String(import.meta.env.VITE_API_ORIGIN ?? "").replace(/\/+$/u, "");
const SESSION_STORAGE_KEY = "pc:itch:anonymous-session";

export function apiUrl(path: string): string {
  if (!path.startsWith("/api/")) throw new Error("API paths must begin with /api/.");
  return API_ORIGIN ? `${API_ORIGIN}${path}` : path;
}

export function usesCrossOriginApi(): boolean {
  return Boolean(API_ORIGIN && API_ORIGIN !== location.origin);
}

/**
 * Fetch through the optional canonical Worker API. In an itch iframe the
 * anonymous signed token lives in localStorage, not a third-party cookie.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (usesCrossOriginApi()) {
    const session = localStorage.getItem(SESSION_STORAGE_KEY);
    if (session) headers.set("X-PC-Session", session);
  }

  const response = await fetch(apiUrl(path), {
    ...init,
    headers,
    // Cookie credentials are deliberately omitted in the iframe. The Worker
    // returns X-PC-Session instead, avoiding third-party-cookie dependence.
    credentials: usesCrossOriginApi() ? "omit" : "same-origin",
  });

  if (usesCrossOriginApi()) {
    const session = response.headers.get("X-PC-Session");
    if (session) localStorage.setItem(SESSION_STORAGE_KEY, session);
  }
  return response;
}
