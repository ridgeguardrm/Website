# RidgeGuard Risk Management — website

Static site with no build step. Upload the contents of this folder to the root of your GitHub
repository (so `index.html` sits at the top level) and publish with GitHub Pages.

```
index.html                 page structure and copy
.nojekyll                  tells GitHub Pages to serve files as-is
assets/
  css/site.css             all styling; colour tokens at the top
  js/config.js             contact email and client-login link
  js/data.js               chart data (see "Data" below)
  js/site.js               navigation, animations and the three interactive charts
  img/mark.svg             shield mark, also the favicon
scripts/
  generate_synthetic_portfolios.py   regenerates the synthetic portfolio data
```

## Publish on GitHub Pages

1. Create a repository (for example `ridgeguard-website`) and upload everything in this folder,
   keeping the structure above. The `.nojekyll` file is hidden on some systems; make sure it is
   included.
2. In the repository: **Settings → Pages → Build and deployment**.
   Source: **Deploy from a branch**. Branch: `main`, folder: `/ (root)`. Save.
3. The site goes live at `https://<username>.github.io/<repository>/` within a few minutes.
4. Custom domain (optional): enter it on the same screen, add the DNS record GitHub shows,
   and tick **Enforce HTTPS** once the certificate is issued.

## Settings

Edit `assets/js/config.js`:

| Setting | Current value |
|---|---|
| `contactEmail` | gautamjain@ridgeguard.com |
| `loginUrl` | https://ridgeguard-demo.onrender.com/ (check this matches the live dashboard) |

## Data

- **Portfolio charts (Rebalancing section):** India Family Office, India Multi-Asset ETFs and
  Balanced 60/40 are **synthetic**. Returns are simulated from a one-factor model with
  Student-t shocks and one stress episode over three years of trading days. No actual portfolio,
  client or back-test data is used. The page and footer say so.
- **Tail-risk charts:** statistics computed from public daily closes of the Nifty 50,
  Euro Stoxx 50 and S&P 500, October 2007 to September 2026.

To regenerate the synthetic portfolios (Python 3 with NumPy):

```
python scripts/generate_synthetic_portfolios.py            # scenarios used on the site
python scripts/generate_synthetic_portfolios.py 1 2 3      # different seeds
```

## Preview locally

Open `index.html` in a browser, or run `python -m http.server` in this folder and visit
http://localhost:8000.
