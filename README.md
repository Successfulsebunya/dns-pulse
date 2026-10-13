# DNS Pulse

DNS monitoring dashboard powered by GitHub Pages, GitHub Actions, Python and Chart.js.

## Setup
1. Set **Settings → Pages → Source: GitHub Actions**.
2. Set **Settings → Actions → General → Workflow permissions: Read and write permissions**.
3. Open **Actions → DNS monitoring → Run workflow**.
4. View https://successfulsebunya.github.io/dns-pulse/.

Edit `config.json` to choose monitored domains. Scheduled checks run about every 5 minutes (GitHub schedules can be delayed). The dashboard shows a rolling 24-hour history and reads `data/history.json`; data from the last 48 hours is retained.

**Note:** Availability is a DNS address-resolution indicator, not website uptime. Latency measures end-to-end DNS-over-HTTPS request time, including HTTPS overhead. DoH resolvers may cache answers. A public Pages site exposes the configured domains and measurements. There is no live user-input backend on GitHub Pages.