# Security Policy

See [SECURITY_ASSESSMENT.md](SECURITY_ASSESSMENT.md) for the project's threat assessment — the most likely and impactful security risks, and what mitigates each.

## Supported versions

| Version              | Supported |
| -------------------- | --------- |
| latest (main branch) | ✅        |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report privately via [GitHub Security Advisories](https://github.com/SecureLayer/landing/security/advisories/new).

Include:

- Description of the vulnerability
- Steps to reproduce
- Affected component (site code, build pipeline, dependencies)
- Potential impact

We will acknowledge receipt within **14 days** and aim to resolve confirmed vulnerabilities within **60 days** of confirmation.

### Coordinated disclosure

This project follows coordinated disclosure: please give us the time above to investigate and ship a fix before any public disclosure. Once a confirmed vulnerability is resolved, we will publish a [GitHub Security Advisory](https://github.com/SecureLayer/landing/security/advisories) describing the issue and crediting the reporter (unless you'd prefer to remain anonymous — just say so in your report). If a fix isn't possible within 60 days, we will proactively update you with a revised timeline rather than go silent.

### Safe harbor

We will not pursue legal action against anyone who reports a vulnerability in good faith through the private channel above, provided they:

- Make a good-faith effort to avoid privacy violations, data destruction, and service disruption
- Do not access or modify data beyond what's needed to demonstrate the issue
- Give us a reasonable opportunity to fix it before any public disclosure

## Scope

This project is a static informational landing page. The primary security concerns are:

- Supply chain issues in build dependencies
- Deployment pipeline integrity
- Content injection or defacement

## Out of scope

- Social engineering
- Issues in third-party infrastructure (GitHub, Cloudflare, Cal.com)

## Project access

The repository owner ([@SecureLayer](https://github.com/SecureLayer)) holds sole repository admin rights, deployment credentials, and secrets. A second collaborator has repository write access — able to push changes, review and merge pull requests, manage issues, and cut releases — as a backup maintainer for project continuity. Cloudflare account access, the domain registrar, and repository secrets remain solely with the repository owner.

## Roles and responsibilities

- **Development & review**: the repository owner writes and merges most changes; the backup maintainer can also review and merge pull requests. External contributions (see [CONTRIBUTING.md](CONTRIBUTING.md)) are reviewed by either.
- **Security response**: the repository owner triages and responds to reports per the timelines above.
- **Release management**: the repository owner decides when to cut a release and maintains [CHANGELOG.md](CHANGELOG.md); the backup maintainer can also cut a release if needed.
- **Deployment**: the repository owner holds the only Cloudflare deployment credentials and is the only one who can change hosting/DNS configuration.

This is not yet full project-continuity coverage — see [SECURITY_ASSESSMENT.md](SECURITY_ASSESSMENT.md) for the current gap (Cloudflare/domain access is not shared).
