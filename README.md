# Promptlaiy

Promptlaiy is a manual prototype and evaluation service for early software ideas.

The public offer is intentionally narrow:

- One clickable web workflow
- A blunt evaluation and practical test plan
- One revision
- Source ZIP and setup instructions
- A Cloudflare preview hosted for 60 days
- Optional domain launch and managed hosting

The base project price shown on the site is `$499`.

## Architecture

The site has no frontend framework, build step, or runtime package dependencies.

- `public/` contains the static HTML, CSS, JavaScript, headers, redirects, and crawl files.
- `functions/api/apply.js` accepts project applications.
- `migrations/` contains the D1 schema for prototype requests.
- `wrangler.jsonc` configures Cloudflare Pages and the existing D1 database.

The application draft is saved in `localStorage`. Submitted applications are stored in the `prototype_requests` D1 table.

## Local Development

Wrangler 4 is required. Run Pages locally with:

```bash
npx wrangler d1 migrations apply promptlaiy-waitlist --local
npx wrangler pages dev public
```

No `npm install` or frontend build is required.

## Deploy

Apply new migrations first:

```bash
npx wrangler d1 migrations apply promptlaiy-waitlist --remote
```

Deploy the static site and Pages Function:

```bash
npx wrangler pages deploy .\public --project-name promptlaiy --branch main --commit-dirty=true --skip-caching
```

## Review Applications

```bash
npx wrangler d1 execute promptlaiy-waitlist --remote --command "SELECT id, name, email, package_choice, hosting_interest, status, created_at FROM prototype_requests ORDER BY created_at DESC"
```

Update an application after review:

```bash
npx wrangler d1 execute promptlaiy-waitlist --remote --command "UPDATE prototype_requests SET status = 'contacted' WHERE id = 'REQUEST_ID'"
```

## Product Boundary

Promptlaiy delivers testable prototypes, not production systems. Authentication, payments, sensitive customer data, app-store releases, and open-ended revisions are outside the base offer.
