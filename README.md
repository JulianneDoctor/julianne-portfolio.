# Julianne Catuyama — portfolio with a database-ready dashboard

A minimalist, responsive personal portfolio for Julianne Catuyama, Virtual Assistant since 2021. Includes editable placeholders rather than invented qualifications, a client inquiry form, and an admin dashboard for updating content and reading messages.

**Status:** the source code and database setup are included. A live Supabase database, admin account, and Turnstile widget are not connected yet. The site stays in static preview mode until you complete [SETUP-DATABASE.md](SETUP-DATABASE.md).

## Open in VS Code on your MacBook

1. Double-click the ZIP to extract it, or use the existing `julianne-portfolio` folder in **Documents → ChatGPT → Code for my portfolio**.
2. In VS Code choose **File → Open Folder** and select the project folder.
3. Edit files and save with **Command-S**. No npm install is needed to run the website.
4. For an immediate static preview, open `index.html` in Safari or Chrome through Finder. The database-backed contact form and authentication require HTTP/HTTPS; see the local preview below.

If you need VS Code, follow its [official Mac installation guide](https://code.visualstudio.com/docs/setup/mac).

## Project files

```text
julianne-portfolio/
├── index.html                 Public portfolio and contact form
├── admin.html                 Admin sign-in and editing dashboard
├── privacy.html               Contact data/privacy explanation
├── styles.css                 Shared responsive design
├── script.js                  Public content and contact form
├── admin.js                   Admin authentication, editing, inbox
├── config.js                  Public project URL, publishable key, site key
├── data.js                    Editable offline placeholders + validation
├── _headers                   Security headers for supporting hosts
├── vendor/                    Pinned official Supabase SDK and license
├── supabase/
│   ├── migrations/001_portfolio.sql   Database schema and access rules
│   ├── seed.sql                       Honest starter content
│   ├── config.toml                    Public contact-function setting
│   └── functions/contact/index.ts     Server-side contact handler
├── tests/                     Security and database test scripts
├── SETUP-DATABASE.md           Beginner-friendly connection guide
├── SECURITY.md                 Implemented controls and limitations
└── .gitignore                  Local files to exclude from Git
```

## What you can edit

Before database setup, edit your introduction, email, skills, work samples, achievements, and profile links in `data.js`. Keep the quotes and commas intact. Use only accurate details and authorized work samples. Blank email or link values remain hidden.

After database setup, open `admin.html` on your hosted site, sign in, complete two-step verification, and edit the live content there. **Save portfolio** publishes those fields on the public page. The name, role, and start year are in `index.html`; colors and typography are in `styles.css`.

The contact form saves inquiries to the database. It does not automatically email you: open the dashboard inbox to read them. The separate contact email link opens the visitor's email app.

## Local preview with Python

In Terminal, change to your project folder and start a local preview:

```sh
cd "$HOME/Documents/ChatGPT/Code for my portfolio/julianne-portfolio"
python3 -m http.server 8000 --bind 127.0.0.1
```

Visit `http://127.0.0.1:8000` for the site and `http://127.0.0.1:8000/admin.html` for the dashboard. Press **Control-C** in Terminal to stop. If you extracted the folder elsewhere, use that location instead. Your production database still requires the setup steps and appropriate development origins/Turnstile settings.

## GitHub and publishing

1. Create a GitHub repository named `julianne-portfolio` in your account. Choose your preferred source visibility; a public repository makes the source readable by everyone.
2. Use **uploading an existing file**, or **Add file → Upload files**. Upload the files inside the folder, including the `vendor` and `supabase` subfolders, rather than the ZIP or an extra enclosing folder.
3. Save the upload. Complete any proposed change/pull request if GitHub creates one.
4. For future edits with this browser-upload method, upload the changed files again. VS Code and GitHub do not automatically sync through this method.
5. GitHub Pages can publish the static website. It does not run the database or server function; those run in your Supabase project. Follow the publishing and security details in [SETUP-DATABASE.md](SETUP-DATABASE.md).

Never upload passwords, secret API keys, local `.env` files, database dumps, or real client exports. Browser uploads do not automatically honor `.gitignore`. Public `config.js` accepts only a modern Supabase publishable key; secrets belong in the server provider's secret store.

Official guides: [GitHub file uploads](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository), [GitHub Pages configuration](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Verification

The source has passed contact-handler and JavaScript checks plus real PostgreSQL policy tests in a temporary, isolated database with simulated Auth claims. This is not a live Supabase deployment test or a penetration test. See [SECURITY.md](SECURITY.md) for exact limits and the production acceptance checks in the setup guide.

Optional developer checks, with a supported Node.js runtime installed:

```sh
node tests/run.mjs
```

For the PostgreSQL policy tests, temporarily install `@electric-sql/pglite@0.5.15` in a separate tools folder, then pass its absolute module path:

```sh
node tests/run-database.mjs /ABSOLUTE/PATH/TO/pglite/dist/index.js
```

PGlite is a test tool, not the production database. The website itself has no build step or Node.js runtime requirement. The SDK file is vendored locally, pinned to 2.119.0, with its source and integrity record in `vendor/README.md`.
