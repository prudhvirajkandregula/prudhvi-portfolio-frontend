/**
 * Shared helpers ported from frontend/js/utils.js (the DOM-building helpers
 * are no longer needed — Angular templates replace them — but URL/date/error
 * helpers are kept behaviour-compatible).
 */

function currentHost(): string {
  if (typeof window !== 'undefined' && window.location) return window.location.host;
  return '';
}

/**
 * Only accept absolute http/https URLs. Everything else is treated as unsafe
 * (javascript:, data:, ftp:, relative paths...) and returns null.
 */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  return null;
}

/** Safe URL for use as an external link; returns null for same-host or unsafe. */
export function safeExternalUrl(value: unknown): string | null {
  const url = safeUrl(value);
  if (!url) return null;
  const { protocol, host } = new URL(url);
  if (protocol !== 'http:' && protocol !== 'https:') return null;
  return host === currentHost() ? null : url;
}

const EMBED_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'youtu.be']);

/**
 * Convert a video URL into an embeddable URL when possible (YouTube).
 * Returns null for anything unverifiable.
 */
export function toVideoEmbedUrl(value: unknown): string | null {
  const url = safeUrl(value);
  if (!url) return null;

  const parsed = new URL(url);
  if (EMBED_HOSTS.has(parsed.hostname)) {
    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    const id = parsed.searchParams.get('v');
    if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
    const parts = parsed.pathname.split('/');
    const lastChild = parts[parts.length - 1];
    if (parsed.pathname.startsWith('/embed/') && lastChild) {
      return `https://www.youtube-nocookie.com/embed/${lastChild}`;
    }
    return null;
  }
  return null;
}

/** Format an ISO date as "Jan 2024" (defensive against bad input). */
export function formatMonthYear(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/**
 * Format a date range. Missing end date is rendered as "Present".
 */
export function formatDateRange(start: unknown, end: unknown): string {
  const startPretty = formatMonthYear(start) ?? 'Unknown';
  const endPretty = end ? formatMonthYear(end) : 'Present';
  return `${startPretty} — ${endPretty}`;
}

/** Coerce any value to display text (never null). */
export function text(value: unknown): string {
  return value == null ? '' : String(value);
}

/** Shared helper text for a backend failure, keeps copy consistent. */
export function errorCopy(status?: number): string {
  if (status === 503) {
    return 'The backend service is temporarily unavailable. Please try again in a moment.';
  }
  return 'The portfolio backend could not be reached. Check that the API Gateway is running, then refresh.';
}
