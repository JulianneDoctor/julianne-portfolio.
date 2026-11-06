# Connect your database and private dashboard

The database-ready code is included. A live database has NOT been created or connected yet. You need your own Supabase project and Cloudflare Turnstile widget. Never send passwords or secret keys in chat or put them on GitHub.

You can do this setup in your browser and VS Code. No npm install is needed to run the website.

## 1. Open the project in VS Code

Open **File → Open Folder → julianne-portfolio**. Keep the whole folder together. The public page is `index.html`; the dashboard is `admin.html`.

Without database settings, the public page displays the editable preview in `data.js`, the contact form stays hidden, and the dashboard shows setup instructions. This is intentional: it never claims to save data without a connected backend.

## 2. Create your Supabase project

1. Open [Supabase](https://supabase.com/dashboard) and create a project in your own account. Choose the region appropriate for your visitors and data. Review the current plan's limits and billing before choosing it.
2. Save the generated database password in your password manager. It does not go in website files.
3. In **SQL Editor**, create a new query. Copy the complete contents of `supabase/migrations/001_portfolio.sql`, then run it once in this new project.
4. In another query, run `supabase/seed.sql`. This inserts honest placeholder content and does not overwrite an existing portfolio.
5. In the Data API settings, leave the exposed schema as `public`. **Do not expose `private`.** Keep Row Level Security enabled on both public tables.

The `portfolio` table holds public website content. The `inquiries` table holds private messages. The private schema holds the admin allowlist and short-lived submission counters.

## 3. Create your admin account

1. In Supabase **Authentication → Users**, add your own user with your email and a strong, unique password. Confirm the email as part of your provider's admin user-creation flow. Do not use an example email or password from a guide.
2. Copy the user's UUID (the long User ID), not the email address.
3. In SQL Editor, run this after replacing the placeholder with that exact UUID:

```sql
insert into private.portfolio_admins (user_id)
values ('REPLACE-WITH-YOUR-USER-UUID');
```

4. Disable **Allow new users to sign up** in the Supabase Auth settings. This app has no public registration.
5. Enable **Authenticator app / TOTP MFA** enrollment and verification. Do not disable either after setup: database rules require an `aal2` session.
6. Review Auth rate limits and password policy. Enable available leaked-password protection. Set the access-token lifetime to an appropriate short value (for example 15 minutes, if supported by your project settings). The dashboard also locks locally after 15 minutes of inactivity; this local lock does not itself invalidate an already stolen token.
7. Protect your Supabase owner account and GitHub account with their own two-step verification. They are separate from your website admin account.

To revoke an admin's database access immediately, remove their row from `private.portfolio_admins` using SQL Editor. This database check applies even to an unexpired admin JWT. Revoke their Auth sessions as well. Keep a secure authenticator backup. If you lose it, use your protected Supabase owner account to recover the user's MFA; this website intentionally has no recovery bypass.

## 4. Configure public settings

Find your **Project URL** and modern **Publishable key** in Supabase project settings. Edit `config.js`:

```js
window.SITE_CONFIG = Object.freeze({
  supabaseUrl: 'https://YOUR-PROJECT-REF.supabase.co',
  supabasePublishableKey: 'YOUR-sb_publishable_-KEY',
  turnstileSiteKey: ''
});
```

Replace the strings with your real settings. The modern key starts with `sb_publishable_`. These values are public by design, and database permissions protect access. The app rejects `sb_secret_` and legacy service-role keys in this file. **Do not put any secret in it even temporarily**: browser rejection cannot remove a secret already published on GitHub.

The live site loads content from the database. Later edits to `data.js` affect only the offline fallback; use the dashboard to change live content.

## 5. Set up Cloudflare Turnstile

1. In your Cloudflare account, open Turnstile and create a managed widget.
2. Add your website hostname, such as `YOUR-USERNAME.github.io`, without a path. Add only hostnames you use. For separate development testing, use a separate widget allowing `localhost` and `127.0.0.1`.
3. Copy the **site key** into `turnstileSiteKey` in `config.js`.
4. Keep the **secret key** for the server settings in the next step. Never put it in website files.

The form checks the token on the server and verifies its hostname and `contact` action. The widget alone is not sufficient. Dummy/test keys must not be used on your public production site.

## 6. Deploy the contact server function

In Supabase **Edge Functions**, create a function named exactly **contact** using the editor. Copy `supabase/functions/contact/index.ts` into its entry file and deploy it. Keep the same source committed in GitHub so you have its history; dashboard edits do not sync back to VS Code.

Add these **server secrets** in the Supabase Edge Functions secrets settings:

| Secret | Value |
| --- | --- |
| `TURNSTILE_SECRET_KEY` | Your private Cloudflare Turnstile secret |
| `CONTACT_HASH_SECRET` | A randomly generated secret of at least 32 characters, from your password manager |
| `ALLOWED_ORIGINS` | Your exact website origin, such as `https://YOUR-USERNAME.github.io`, without a path or trailing slash |

Supabase supplies `SUPABASE_URL` and the legacy `SUPABASE_SERVICE_ROLE_KEY` to its managed function runtime. This implementation uses that server-only service-role JWT to call a restricted database function. Do not copy it to the browser or commit it. If your environment does not provide it, configure it only in the server's secret store according to the provider's instructions.

For multiple origins, separate them with commas. GitHub project sites use the origin `https://YOUR-USERNAME.github.io`, not `/julianne-portfolio/`. Add `http://127.0.0.1:8000` and `http://localhost:8000` only for a development project; remove development origins from production.

**For this contact function only**, disable the gateway's legacy **Verify JWT** requirement (the exact UI label can vary). The included `supabase/config.toml` makes this setting explicit for CLI deployments. The contact endpoint must accept visitors who are not signed in; its handler still requires Turnstile verification, validates input, restricts origins, and enforces database submission limits. Admin database access remains protected by RLS and MFA. Do not weaken any database policy to make the form work.

Optional CLI alternative, if you already use the Supabase CLI:

```sh
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy contact
```

Set the same secrets in the dashboard. Do not pass secret values in shell command history.

## 7. Preview and sign in

Opening `index.html` directly works for the static preview. Authentication and Turnstile need an HTTP/HTTPS origin. On your Mac, open Terminal and run:

```sh
cd "$HOME/Documents/ChatGPT/Code for my portfolio/julianne-portfolio"
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/admin.html`. If you extracted the folder elsewhere, change the first command to that folder. Press **Control-C** to stop the preview.

1. Sign in using the user you added to the admin allowlist.
2. On first login, add the displayed setup key to your authenticator app, using manual setup with a time-based code. Store a secure backup; do not screenshot it into public files.
3. Enter the six-digit code. No portfolio changes or private messages are accessible until verification succeeds.
4. Edit your about text, email, skills, work samples, achievements, and links. **Save portfolio** makes those values public.
5. Submit a test inquiry on the public website, then use **Refresh** in the dashboard inbox. You can mark it as read or delete it.
6. Sign out. Refreshing the admin page requires another login because tokens are not saved in local storage.

## 8. Upload code and publish

You can store all project source on GitHub, including SQL, tests, and function code. Keep passwords, secrets, real client exports, database dumps, and local `.env` files out of the repository. `.gitignore` helps with local Git; browser uploads do not apply its rules automatically.

For the public website, upload/deploy these files together:

- `index.html`, `admin.html`, `privacy.html`
- `styles.css`, `script.js`, `admin.js`, `data.js`, `config.js`
- The complete `vendor/` folder
- `_headers` if your host supports it

On GitHub Pages, select **Settings → Pages → Deploy from a branch → main → / (root)** if those files are at the repository root. Uploading the ZIP itself will not publish the website. Turn on **Enforce HTTPS** when available. Public Pages serves only static files; your Supabase project separately runs the database and contact function.

Cloudflare Pages and Netlify apply the included `_headers` file. **GitHub Pages does not apply custom `_headers` rules**. On GitHub Pages, the HTML Content Security Policy still applies, but the additional anti-framing/cache/security headers in `_headers` are not supplied by this project. For control over those headers, choose a host that supports them.

Anyone can open the admin login page. The URL is not a secret or a security control. The database protects the actual content updates and private messages.

## 9. Check before collecting real inquiries

- Confirm the live website uses HTTPS with no certificate warning.
- Replace the placeholders and set a real public contact email. Review `privacy.html` and your retention practice.
- Confirm that an unsigned visitor can read public content but cannot read messages, insert directly, or edit content through the Data API.
- Confirm a non-allowlisted account cannot access the dashboard, even after MFA.
- Confirm your allowlisted account cannot read inquiries or save changes before MFA.
- Test a real Turnstile submission on your exact production hostname. Refresh the inbox and verify the message exists. Then delete the test.
- Confirm invalid or expired challenge tokens cannot save messages. Limit is 3 successful messages per normalized email per hour, plus 100 site-wide per hour. These limits use fixed clock-hour windows, not rolling windows, and do not stop every denial-of-service attack.
- Configure provider backups and verify a restore process. Backup availability and retention depend on your provider plan; no automatic backup job is included in these website files.
- Keep the pinned Supabase library current with reviewed updates, and monitor provider alerts, logs, quotas, and access lists.

## Troubleshooting

- **Dashboard says setup required:** use the modern `sb_publishable_` key and the exact `https://PROJECT.supabase.co` URL without a trailing slash.
- **Account not approved:** the Auth user's UUID must match the row in `private.portfolio_admins`.
- **MFA enrollment fails:** enable TOTP enrollment and verification in Auth settings. Use automatic time on your authenticator device.
- **Portfolio will not load:** run the seed SQL and verify the public read policy and Data API schema. Do not turn off RLS.
- **Contact returns 401:** check that legacy gateway JWT verification is disabled for the public contact function, not for admin/database access.
- **Contact returns 403:** check the exact `ALLOWED_ORIGINS` value, widget hostname, and real production Turnstile keys. Do not remove hostname/action checks.
- **Contact returns 503:** check function secrets and the migration. Inspect provider logs without copying credentials or message bodies into public issues.
- **Contact returns 429:** wait for the next clock-hour limit window. Shared-email or site-wide limits may apply.

Official references: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [MFA](https://supabase.com/docs/guides/auth/auth-mfa), [Function editor](https://supabase.com/docs/guides/functions/quickstart-dashboard), [Function security](https://supabase.com/docs/guides/functions/auth), [Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
