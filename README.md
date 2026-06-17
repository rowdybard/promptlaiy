# Promptlaiy

Promptlaiy is an idea verdict in 5 minutes platform.

The V1 product is intentionally small: dump a messy idea, answer five forced questions, get a structured Idea Brief, then receive one verdict:

- `BUILD`
- `SHRINK`
- `PIVOT`
- `KILL`

## Product Direction

Promptlaiy is not a prompt helper or course product. It is a fast idea-intake and verdict tool for founders, operators, and builders who need a blunt first-pass read before spending time on a build.

The current app includes:

- Messy idea brain dump
- Five-question intake flow
- Local session persistence in `localStorage`
- Mock AI verdict scoring
- Idea Brief output
- Locked monetization skeleton for future continuation assets
- Cloudflare Pages Function at `/api/verdict` shaped for a later OpenAI integration

Out of scope for V1:

- Courses
- Prompt training
- Dashboards
- Teams
- Marketplace
- Payments

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Check and build locally:

```bash
npm run typecheck
npm run build
npm run preview
```

## Environment

```bash
OPENAI_API_KEY=
```

The key is not used yet. The current `/api/verdict` route returns a mock verdict, but the API response shape is ready for an OpenAI-backed implementation.

## Deploy

This repo is configured for Cloudflare Pages.

```bash
npm run build
npx wrangler pages deploy .\dist --project-name promptlaiy --branch main --commit-dirty=true --skip-caching
```
