# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | Yes                |
| < 2.0   | No                 |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them privately by emailing **mickwh@msn.com** with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

You will receive acknowledgment within 48 hours and a detailed response within 7 days.

## Security Practices

This project implements the following security measures:

- **Helmet.js** for HTTP security headers (HSTS, CSP, X-Frame-Options, etc.)
- **Rate limiting** on all download, upload, and computationally heavy endpoints
- **Path traversal protection** via `sanitizePathParam()` on all file operations
- **File upload validation** with MIME type and extension whitelisting (CSV/TSV/TXT only, 25MB limit)
- **Scanner/probe blocking** for common exploit paths (`.git`, `.env`, `wp-admin`, etc.)
- **Timing-safe password comparison** using `crypto.timingSafeEqual()`
- **No credentials in source code** — all secrets via environment variables

## Dependency Management

Dependencies are monitored via `npm audit`. To check for known vulnerabilities:

```bash
npm audit
```
