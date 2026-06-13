# GAIA — a living planet

A pixel-art, SimEarth-spirited "living planet" sim that runs entirely in the
browser. No build step, no dependencies (only Google Fonts, from a CDN).

Two front-ends share one engine (`game.js`):

| Layout | File | Live URL | Best saved as |
|---|---|---|---|
| Phone (portrait) | `index.html` | https://djessemann.github.io/gaia-sim/ | iPhone web app |
| iPad (landscape) | `ipad/index.html` | https://djessemann.github.io/gaia-sim/ipad/ | iPad web app |

The simulation — terrain, climate, life/evolution, civilization — lives in the
shared **`game.js`**. Each shell is just HTML + CSS using the same element IDs,
so changes to the engine apply to both. The iPad shell adds a 3-column landscape
layout with the planet monitors always visible (it opts in via `<body class="wide">`).

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
