# Last Done

A small **progressive web app** for tracking **when you last did** recurring tasks—fill the gas tank, pay a bill, rotate tires, anything you want to remember by date rather than on a fixed schedule.

## Features

- **Activities** — Add named items; each keeps a log of timestamps.
- **Log a completion** — “I did it now” or pick a **date and time** for backdating.
- **Relative time** — See “2 days ago” style summaries next to absolute dates (locale-aware).
- **History** — Per-activity list of past entries.
- **Sort** — Most overdue first, recently logged, or name A–Z.
- **Export / import** — Download JSON backups and restore them on this or another device.
- **Offline-capable PWA** — Installable on supported browsers; a service worker precaches core assets.

## Privacy and data

All data is stored in **browser local storage** on your device. Nothing is sent to a server. Clear site data or remove the app and the data is gone unless you have an **Export** backup.

## Tech

Vanilla **HTML**, **CSS**, and **JavaScript** (no build step). Icons live under `icons/`; optional regeneration:

```bash
python3 scripts/generate_icons.py
```

## Run locally

Open `index.html` in a browser, or serve the folder with any static file server (PWA features such as the service worker work best on **localhost** or **HTTPS**).

## Deploy (e.g. GitHub Pages)

Push the repo to GitHub, then in the repository **Settings → Pages** choose **Deploy from a branch** (typically `main` / root). The app is static files only; no build is required.
