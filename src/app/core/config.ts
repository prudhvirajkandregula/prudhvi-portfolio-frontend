/**
 * Site-wide configuration.
 *
 * Requests are issued as root-relative URLs ("/api/..."): in development the
 * Angular dev-server proxy (proxy.conf.json) forwards "/api" to the Spring
 * Cloud API Gateway on http://localhost:8080. In production the app is served
 * from the same origin as the gateway, so the same relative paths work.
 *
 * Mirrors frontend/js/config.js, including the optional runtime override:
 *   window.__PORTFOLIO_CONFIG__ = { API_BASE_URL: "http://localhost:8090" };
 */
export const CONFIG = {
  /** Optional absolute base URL. Empty string = same origin (recommended). */
  API_BASE_URL: '',

  getBaseUrl(): string {
    if (typeof window !== 'undefined') {
      const runtime = (window as unknown as {
        __PORTFOLIO_CONFIG__?: { API_BASE_URL?: unknown };
      }).__PORTFOLIO_CONFIG__;
      if (runtime && typeof runtime.API_BASE_URL === 'string') {
        return stripTrailingSlash(runtime.API_BASE_URL);
      }
    }
    return stripTrailingSlash(CONFIG.API_BASE_URL);
  },
};

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
