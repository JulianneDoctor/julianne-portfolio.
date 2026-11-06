// PUBLIC SETTINGS ONLY. Visible to visitors and safe to upload to GitHub.
// NEVER enter a database password, sb_secret_ key, service_role key, or Turnstile secret.
window.SITE_CONFIG = Object.freeze({
  supabaseUrl: '', // https://YOUR-PROJECT-REF.supabase.co
  supabasePublishableKey: '', // sb_publishable_... (not a secret key)
  turnstileSiteKey: '' // Public Cloudflare Turnstile site key
});
