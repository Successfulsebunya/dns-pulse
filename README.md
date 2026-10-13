# DNS Pulse

DNS monitoring dashboard powered by GitHub Pages, GitHub Actions, Python and Chart.js.

## Setup
1. Set **Settings → Pages → Source: GitHub Actions**.
2. The monitoring workflow explicitly requests `contents: write` to commit measurements; Pages requests `contents: read`, `pages: write`, and `id-token: write`.
3. Open **Actions → DNS monitoring → Run workflow**.
4. View https://successfulsebunya.github.io/dns-pulse/.

Successful monitoring runs automatically redeploy Pages with the latest committed measurements. Only dashboard assets, configuration, and monitoring data are published.

Edit `config.json` to choose monitored domains. Scheduled checks run about every 5 minutes (GitHub schedules can be delayed). The dashboard shows a rolling 24-hour history and reads `data/history.json`; data from the last 48 hours is retained.

**Note:** Availability is a DNS address-resolution indicator, not website uptime. Latency measures end-to-end DNS-over-HTTPS request time, including HTTPS overhead. DoH resolvers may cache answers. A public Pages site exposes the configured domains and measurements. There is no live user-input backend on GitHub Pages.

## Personal sessions

The homepage creates a unique session for each visit to the base URL. Enter a domain to run real browser DNS-over-HTTPS checks through Cloudflare and Google. Checks repeat every five minutes while the tab is visible. Every browser reload discards the previous session token, domains, and measurements, and creates a new empty session. Refresh session and New session do the same. Opening a shared link initially restores its domains; refreshing that page starts a new session. Measurements live only in memory. Shared tokens are domain-setting snapshots, so previously copied tokens cannot be globally revoked without a backend.

Copy session link or Copy token shares the session identifier and a snapshot of domain settings. Join session accepts either format. Recipients collect their own measurements; tokens do not synchronize history or later domain edits and are not authentication credentials. Domains encoded in tokens are readable. Invalid domain names and malformed tokens are rejected.

The Scheduled monitoring link opens `public.html`, which preserves the existing shared GitHub Actions dashboard and its continuously collected public dataset. Personal domains are never committed to that dataset.
