/**
 * Public Supabase settings used by the browser.
 *
 * Both values are PUBLIC by design and are shipped in the JavaScript bundle:
 *   - url:            the project's API endpoint
 *   - publishableKey: grants only what Row Level Security allows, which for
 *                     this project is read-only access to the portfolio tables
 *
 * Never put the secret / service-role key, the database password or any
 * other credential in this file (or anywhere in the frontend).
 *
 * Source of truth: backend/.env (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY).
 */
export const SUPABASE_CONFIG = {
  url: 'https://peawovcjectzexvlurjp.supabase.co',
  publishableKey: 'sb_publishable_AIhYRbR70aR-0TPAQtyIZQ_9XZqjclG',
} as const;
