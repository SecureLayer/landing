[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/SecureLayer/landing/badge)](https://scorecard.dev/viewer/?uri=github.com/SecureLayer/landing)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/11681/badge)](https://www.bestpractices.dev/projects/11681)
[![OpenSSF Baseline](https://www.bestpractices.dev/projects/11681/baseline)](https://www.bestpractices.dev/projects/11681)
[![CI](https://github.com/SecureLayer/landing/actions/workflows/ci.yml/badge.svg)](https://github.com/SecureLayer/landing/actions/workflows/ci.yml)
[![CodeQL](https://github.com/SecureLayer/landing/actions/workflows/codeql.yml/badge.svg)](https://github.com/SecureLayer/landing/actions/workflows/codeql.yml)
[![DeepScan grade](https://deepscan.io/api/teams/30657/projects/32423/branches/1072240/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=30657&pid=32423&bid=1072240)

# SecureLayer

This repository hosts [securelayer.co](https://securelayer.co), an informational landing page presenting SecureLayer's freelance cybersecurity service catalogue (Application Security, SecDevOps, IT Security, AI Security, security advice) and links to social media. The site does not provide any interactive tool, download, or service directly — book a call at [cal.com/securelayer](https://cal.com/securelayer).

This is a static site built with [Astro](https://astro.build).

---

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for a full description of the system's actors (visitor, maintainer, CI/CD, Dependabot, Cloudflare Workers/R2, Cal.com) and the actions available to each.

---

## Local development

Prerequisites: Node.js >= 22.12.0

```sh
npm install
npm run dev        # dev server at http://localhost:4321
npm run build      # production build → ./dist/
npm run preview    # preview the production build locally
```

---

## Dependencies

This project intentionally keeps its dependency surface minimal — two runtime dependencies (`astro`, `@astrojs/sitemap`) and two dev dependencies (`@astrojs/check`, `typescript`), all obtained from the public npm registry and pinned via `package-lock.json` (installed reproducibly in CI with `npm ci`).

A new dependency is only added when it removes real, non-trivial custom code, and preference goes to actively maintained packages with no known open vulnerabilities. [Dependabot](.github/dependabot.yml) checks the npm ecosystem weekly and opens pull requests for available updates; GitHub's Dependabot security alerts additionally flag known vulnerabilities directly.

---

## Versioning

This project uses [Calendar Versioning](https://calver.org/) (`YYYY.MM.PATCH`). Releases are tagged in git and documented in [CHANGELOG.md](CHANGELOG.md).

---

## Reporting a vulnerability

Please do not open a public issue for security vulnerabilities — see [SECURITY.md](SECURITY.md).

## Feedback and bug reports

Open a GitHub issue for anything else (broken links, incorrect content, site bugs).

---

## Contributing

Contributions are welcome — site fixes, content corrections, and CI/build improvements. See [CONTRIBUTING.md](CONTRIBUTING.md). Participation in this project is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## License

[AGPL-3.0-only](LICENSE) © 2026 SecureLayer
