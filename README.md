# Promptlaiy

Short browser lessons that help founders write better requests for Codex and Cursor.

## Local Development

```bash
npm install
npm run build
```

For Cloudflare Pages Functions with D1:

```bash
npx wrangler d1 migrations apply promptlaiy-waitlist --local
npx wrangler pages dev dist --d1 DB=promptlaiy-waitlist
```

## Production

- Site: https://promptlaiy.pages.dev/
- Waitlist API: `/api/waitlist`
- Events API: `/api/events`
- D1 database: `promptlaiy-waitlist`

View waitlist rows:

```bash
npx wrangler d1 execute promptlaiy-waitlist --remote --command "SELECT email, source, beta_interest, created_at FROM waitlist_signups ORDER BY created_at DESC"
```
