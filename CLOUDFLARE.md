# Cloudflare deployment

Live site: https://qa-avatar-command.kazihamidur.workers.dev

## Hosting and access

The cloud target uses a Worker with static assets and Cloudflare D1. It starts with an empty workspace, and does not import local project data or example results. A browser sign-in page and signed 12-hour HttpOnly session cookie protect the website and every API route. The default username is qa-admin; the password is a Wrangler secret. Local credentials are saved in data/cloudflare-login.txt and .dev.vars, both excluded from Git.

No paid Workers subscription was enabled. The deployment does not use R2, an external AI service, a custom domain, or a local agent connection. D1 Free requests stop if account quotas are reached; limits are shared with other applications in the same account. Keep the account on Workers Free to retain that behavior.

Original documents are stored in D1 in 512 KB chunks. The app caps document storage at 100 MB. AI Review stays off unless an administrator explicitly configures a paid API key. Localhost agent execution is unavailable from the cloud; use manual execution or file handoff.

## Deploy updates

1. Install dependencies with npm install.
2. Sign in with npx wrangler login.
3. Apply database migrations with npx wrangler d1 migrations apply DB --remote.
4. Build and deploy with npm run deploy:cloudflare.

The checked-in wrangler.jsonc identifies this account's database. Use a separate database binding to deploy to another account. Password secrets remain on Cloudflare across deployments. To rotate access, run npx wrangler secret put APP_PASSWORD and enter the password directly in the terminal. Never commit .dev.vars or credentials.

For local cloud development, configure APP_USER and APP_PASSWORD in .dev.vars, apply D1 migrations with --local, then run npm run dev:cloudflare. The normal npm start command still runs the original local app with its SQLite database and local files.

## Verification

The cloud build and Wrangler dry run passed. Local Workers tests verified authentication, cross-origin write rejection, empty workspace initialization, D1 workspace persistence, document uploads/downloads and requirement analysis. The sign-in page loads without an HTTP authentication challenge. Workspace APIs reject unsigned requests, and signed sessions permit access. Changing the admin password invalidates existing sessions.

## Automatic GitHub deployment

Every push to development runs .github/workflows/deploy-cloudflare.yml. The workflow installs locked dependencies, checks types, runs unit and local API tests, builds the Cloudflare target, applies pending D1 migrations and deploys the Worker. A failed check stops deployment. Pushes to main or other branches do not replace the live application. Manual runs are available from GitHub Actions on development.

One-time setup: create a Cloudflare API token with Workers Scripts Edit and D1 Edit restricted to this account. Save it as the repository Actions secret CLOUDFLARE_API_TOKEN. The account ID is non-secret and is configured in the workflow. Do not use the app admin password or local Wrangler OAuth login as this token.

Workflow runs: https://github.com/Kazihamid/qa-avatar-command/actions
Secret setup: https://github.com/Kazihamid/qa-avatar-command/settings/secrets/actions

The pipeline preserves the existing app password and database. CI receives the deployment token only during the deployment step. It uses a standard Ubuntu runner and does not enable paid Cloudflare features.
