import { AsyncLocalStorage } from 'async_hooks';

// Per-request storage base URL. A middleware (see main.ts) computes the base
// from the incoming request's host and runs the rest of the request inside
// this context. Any service can then build image URLs that point at the SAME
// origin the client used to reach the API — so uploaded images always load,
// even when the STORAGE_BASE_URL env is wrong / a stale LAN IP.
export const storageContext = new AsyncLocalStorage<{ baseUrl?: string }>();

/** The /storage base URL for the current request. Prefers the request-derived
 *  host, then STORAGE_BASE_URL, then a localhost default. No trailing slash. */
export function storageBaseUrl(): string {
  const fromReq = storageContext.getStore()?.baseUrl;
  const base = fromReq || process.env.STORAGE_BASE_URL || 'http://127.0.0.1:3000/storage';
  return base.replace(/\/$/, '');
}

/** Build a full image URL for `/storage/<folder>/<file>`. Returns null for an
 *  empty file, and passes already-absolute URLs (external CDN links) through. */
export function storageFullUrl(folder: string, file?: string | null): string | null {
  if (!file || !String(file).trim()) return null;
  const f = String(file);
  if (/^https?:\/\//i.test(f)) return f;
  return `${storageBaseUrl()}/${folder}/${f}`;
}
