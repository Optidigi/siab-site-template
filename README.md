# siab-site-template

Astro 5 + Tailwind 4 boilerplate consumed by `optidigi/siab-site-orchestrator`.
Per-engagement, the orchestrator copies this template into `sandbox/site-<slug>/`,
integrates a theme from `siab-site-themes/`, fills content via subagents, and pushes.

## What's in the box

- **Astro 5.x**, `output: static`, with `@astrojs/sitemap` + `astro-seo`
- **Tailwind 4** via `@tailwindcss/vite` + `@tailwindcss/typography`
- **SEO baseline**: per-page `<title>`/meta/OG/Twitter, sitemap, dynamic `robots.txt`,
  `llms.txt`, `humans.txt`, `/.well-known/security.txt`, JSON-LD `Organization`
  (always) + `LocalBusiness` (if NAP supplied), favicon set, manifest
- **ContactForm** component: mailto fallback by default; renders Web3Forms
  POST form when `PUBLIC_WEB3FORMS_KEY` is set
- **Dockerfile**: multi-stage `node:lts-alpine` → `nginx:alpine`, ~30MB final image
- **nginx.conf**: gzip, asset/HTML cache strategy, security headers (CSP, X-Frame-Options, etc.)
- **GHA `publish.yml`**: push to `main` → `ghcr.io/<owner>/<repo>:latest` + `:sha-<short>`

## Local development

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # static output to dist/
pnpm astro check  # type / schema check
```

## Environment variables

See `.env.example`. `SITE_URL` is the only one the build needs;
`PUBLIC_WEB3FORMS_KEY` and `PUBLIC_CONTACT_EMAIL` are optional.

## Don't edit this template directly during a site engagement

The orchestrator copies the template into `sandbox/site-<slug>/` and works there.
Edits to this template apply to *all future* sites. Land them in a PR and pull
into `siab-site-template/` on disk before starting the next engagement.

## Rich-text rendering contract

This template ships the `rt-*` class contract per `siab-payload/docs/runbooks/rt-dom-contract.md`. Block renderers in `src/components/cms/` consume `RtRoot` shapes via `RtNodeRenderer.tsx`. Role tokens (`--font-{title,heading,text}`, `--radius-{sm,md,lg}`) declared in `global.css @theme {}` are placeholders — themes override during siab-site-orchestrator Phase 3 integration.

The post-CMS-ification SSR flow (the `site-converter` subagent in `siab-payload-orchestrator`) wires these renderers to Payload data; in static-mode they remain inert until the CMS-ification phase runs.

Per-tenant block menu subsetting + themed-node declarations + type styles + color tokens live in `siteManifest.example.json` (this template ships a generic example). Tenant forks customise it; `siab-payload-orchestrator` Phase 4 reads it and seeds `Tenant.siteManifest`.
