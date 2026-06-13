# GAIA — a living planet

A self-contained, single-file web toy: open `index.html` and a tiny pixel-art
planet comes to life in the browser. No build step, no dependencies (only Google
Fonts, loaded from a CDN).

## Run locally

Just open the file:

```sh
open index.html        # macOS
xdg-open index.html    # Linux
```

Or serve it (handy for mobile testing on the same network):

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Live site (GitHub Pages)

This repo ships a workflow (`.github/workflows/deploy-pages.yml`) that publishes
the root of the repo to GitHub Pages on every push to `main`.

**One-time setup** — enable Pages with the GitHub Actions source:

1. Go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.

After that, every push to `main` deploys automatically. The live URL will be:

```
https://djessemann.github.io/gaia-sim/
```

The deploy workflow's run page also prints the published URL under the
`github-pages` environment.
