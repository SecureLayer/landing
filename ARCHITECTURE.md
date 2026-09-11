# Architecture

This document describes the actors that interact with this system and the actions available to each. SecureLayer is a static informational landing page — there is no application server, database, or user accounts.

## Actors

### Site visitor

No account, no login, no data submission forms exist on the site itself.

- Browses the static pages (home, security, sustainability, legal).
- Downloads the service-catalogue PDF.
- Follows outbound links to [cal.com/securelayer](https://cal.com/securelayer) to book a call — booking data (name, email, timezone) is handled entirely by Cal.com, never touches this codebase or its infrastructure.
- Follows outbound links to social media (Bluesky, Instagram, GitHub).
- Can report a security vulnerability via [GitHub Security Advisories](https://github.com/SecureLayer/landing/security/advisories/new) (private) or open a public GitHub issue for non-security bugs/content problems.

### Maintainer (sole)

See [SECURITY.md](SECURITY.md#project-access) for the full access/responsibilities breakdown. In short: writes and reviews all code, responds to security reports, cuts releases, holds the only deployment credentials, and manually manages the image/PDF assets that are hosted separately from git (see "Asset hosting" below).

### GitHub Actions (CI/CD)

Runs automatically, no human interaction required once triggered:

- **On every push/PR to `main`**: installs dependencies, type-checks (`astro check`), builds the site, runs the link-checker test suite ([`ci.yml`](.github/workflows/ci.yml)).
- **On every push/PR to `main`**: CodeQL static analysis ([`codeql.yml`](.github/workflows/codeql.yml)).
- **On every PR**: verifies every commit has a DCO sign-off ([`dco.yml`](.github/workflows/dco.yml)).
- **Weekly + on push**: OpenSSF Scorecard supply-chain analysis ([`scorecard.yml`](.github/workflows/scorecard.yml)).
- **Weekly + on demand**: Lighthouse audit of the live site ([`lighthouse.yml`](.github/workflows/lighthouse.yml)).
- **On every published release**: builds a source archive, hashes it, and cryptographically signs both via Sigstore build-provenance attestation, then uploads them as release assets ([`release-signing.yml`](.github/workflows/release-signing.yml)).

### Dependabot

Weekly scan of the npm dependency tree ([`dependabot.yml`](.github/dependabot.yml)); opens pull requests for available updates and raises security alerts for known vulnerabilities. The maintainer reviews and merges.

### Cloudflare Workers

Hosts and serves the built static site. Deployment is triggered by pushes to `main` (Cloudflare's own "Workers Builds" watches the repo directly — not a GitHub Actions workflow).

### Cloudflare R2 (asset hosting)

Serves `public/images/*` and `public/docs/*` (the service-catalogue PDF) directly — these are **not** part of the git-tracked build. The maintainer uploads/updates these manually, independent of the normal git push flow. (`scripts/check-links.mjs` in CI is deliberately configured to exclude these two paths from its checks for this reason.)

### Cal.com

Third-party scheduling service. Not integrated via any API or webhook in this codebase — it's purely an outbound link. Cal.com is solely responsible for any data a visitor provides when booking.

## External software interfaces

Every external system boundary the released software (the deployed site plus its build/release pipeline) actually crosses, and what crosses it:

| Interface                                                                              | Direction                                                                                  | What crosses it                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Google Fonts](https://fonts.google.com) (`fonts.googleapis.com`, `fonts.gstatic.com`) | Visitor's browser → Google                                                                 | Font file requests at page load; Google may log the requester's IP. The only third-party request made by the rendered pages themselves — see [legal.astro](https://securelayer.co/legal/) "Cookies & Data".                                    |
| [Cal.com](https://cal.com/securelayer)                                                 | Visitor's browser → Cal.com                                                                | Outbound link only — no API call, no webhook, no data returned to this system. Booking data (name, email, timezone) is handled entirely by Cal.com.                                                                                            |
| npm registry                                                                           | Build pipeline → registry.npmjs.org                                                        | Dependency resolution at `npm ci` time, pinned via `package-lock.json`.                                                                                                                                                                        |
| GitHub REST API + Sigstore/Rekor transparency log                                      | Release pipeline → GitHub API, `token.actions.githubusercontent.com`, `rekor.sigstore.dev` | `release-signing.yml` requests an OIDC token, submits a signing request, and publishes the resulting attestation to the public transparency log — see [OSPS-BR-06.01 discussion / the workflow itself](.github/workflows/release-signing.yml). |
| Cloudflare Workers Builds                                                              | GitHub → Cloudflare                                                                        | Cloudflare's own integration polls/receives push events from this repo to trigger a deploy — not a GitHub Actions workflow, no credentials stored in this repo for it.                                                                         |
| GitHub Security Advisories                                                             | Reporter → GitHub                                                                          | Private vulnerability report intake — see [SECURITY.md](SECURITY.md).                                                                                                                                                                          |

No interface accepts unauthenticated write input from an anonymous visitor beyond opening a GitHub issue/advisory (both gated by GitHub's own account system, not this codebase).

## Data flow summary

```
Visitor ──browse──> Cloudflare Workers (static pages, built from git)
        ──images/PDF──> Cloudflare R2 (assets, uploaded manually, outside git)
        ──book a call──> Cal.com (entirely external, no data returns to this system)
        ──report a vuln──> GitHub Security Advisories

Maintainer ──git push──> GitHub Actions (build, typecheck, test, CodeQL, DCO)
                                │
                                └──success──> Cloudflare Workers auto-deploys from main

Maintainer ──publish release──> release-signing.yml ──> Sigstore attestation ──> GitHub Release assets

Dependabot ──weekly scan──> PR ──> Maintainer reviews/merges
```

No user data is collected, stored, or processed by this system directly — see [legal.astro](https://securelayer.co/legal/)'s "Cookies & Data" section for the full statement.
