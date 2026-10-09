"""Synthetic portfolio paths for the RidgeGuard website demo.
No market or client data: returns are simulated from a one-factor model with
Student-t shocks and a stress episode, so heavy tails and drawdowns look realistic.
"""
import json, sys
import numpy as np

DAYS = 756  # three years of trading days
SCHED = {"1M": 21, "3M": 63, "12M": 252}

def simulate(assets, seed, stress=(300, 345), stress_mult=2.6):
    rng = np.random.default_rng(seed)
    n = len(assets)
    mu = np.array([a[1] for a in assets]) / 252
    vol = np.array([a[2] for a in assets]) / np.sqrt(252)
    beta = np.array([a[3] for a in assets])
    df = 4
    tscale = np.sqrt((df - 2) / df)
    f = rng.standard_t(df, DAYS) * tscale
    e = rng.standard_t(df, (DAYS, n)) * tscale
    regime = np.ones(DAYS)
    regime[stress[0]:stress[1]] = stress_mult
    drift_f = np.zeros(DAYS)
    drift_f[stress[0]:stress[0] + 18] = -0.0045  # sell-off
    drift_f[stress[1]:stress[1] + 60] = 0.0018   # partial rebound
    fac_share = np.clip(np.abs(beta) * 0.75, 0, 0.9)
    idio = np.sqrt(1 - fac_share ** 2)
    # scale factor drift into each asset in proportion to beta
    r = mu + vol * (np.outer(f * regime, np.sign(beta) * fac_share) + e * idio * np.sqrt(regime)[:, None]) \
        + np.outer(drift_f, beta)
    return np.clip(r, -0.25, 0.25)

def run(r, w, every):
    """Portfolio wealth with rebalancing to w every `every` days (None = buy and hold)."""
    w = np.array(w, float); w /= w.sum()
    hold = w.copy(); wealth = [1.0]; v = 1.0
    for t in range(len(r)):
        hold = hold * (1 + r[t])
        v = hold.sum()
        wealth.append(v)
        if every and (t + 1) % every == 0:
            hold = w * v
    return np.array(wealth)

def metrics(path, rf):
    r = path[1:] / path[:-1] - 1
    n = len(r)
    ann = path[-1] ** (252 / n) - 1
    vol = r.std() * np.sqrt(252)
    dn = r[r < 0].std() * np.sqrt(252)
    peak = np.maximum.accumulate(path)
    dd = (path / peak - 1).min()
    q = np.quantile(r, 0.01)
    return {
        "total_return": round(float(path[-1] - 1), 4),
        "ann_return": round(float(ann), 4),
        "volatility": round(float(vol), 4),
        "sharpe": round(float((ann - rf) / vol), 4),
        "sortino": round(float((ann - rf) / dn), 4),
        "max_drawdown": round(float(dd), 4),
        "calmar": round(float(ann / abs(dd)), 4),
        "cvar99": round(float(r[r <= q].mean()), 4),
    }

def pack(path, rf):
    return {"path": [round(float(x), 4) for x in path], **metrics(path, rf)}

# name, annual drift, annual vol, factor beta
PORTFOLIOS = {
    "india_family_office": {
        "name": "India Family Office",
        "desc": "Synthetic book: Indian large and mid caps, PSU, gold and liquid sleeves",
        "rf": 0.065,
        "assets": [("Financials", .14, .24, 1.1), ("IT services", .12, .22, .8), ("Consumer staples", .11, .17, .6),
                   ("Energy & industrials", .15, .26, 1.1), ("PSU basket", .17, .30, 1.2), ("Mid caps", .16, .28, 1.25),
                   ("Gold", .09, .14, -.15), ("Liquid fund", .065, .008, 0.0)],
        "rg": [.11, .12, .17, .10, .09, .07, .18, .16],
        "bench": [("Equal weight", [1] * 8, 63), ("Mean-variance", [.06, .05, .05, .14, .30, .30, .05, .05], 63),
                  ("Buy and hold", [1] * 8, None)],
        "seed": None,
    },
    "india_mutual_funds": {
        "name": "India Multi-Asset ETFs",
        "desc": "Synthetic book: Nifty 50, Next 50, banking, IT, gold, debt and international equity ETFs",
        "rf": 0.065,
        "assets": [("Nifty 50", .12, .17, 1.0), ("Nifty Next 50", .14, .22, 1.15), ("Bank ETF", .13, .25, 1.2),
                   ("IT ETF", .12, .22, .75), ("Gold ETF", .09, .14, -.15), ("Gilt ETF", .07, .045, -.1),
                   ("Liquid ETF", .065, .008, 0.0), ("Intl equity ETF", .11, .19, .6)],
        "rg": [.20, .09, .07, .08, .17, .17, .10, .12],
        "bench": [("Equal weight", [1] * 8, 63), ("Mean-variance", [.15, .25, .25, .15, .05, .05, .02, .08], 63),
                  ("Buy and hold", [1] * 8, None)],
        "seed": None,
    },
    "sixty_forty": {
        "name": "Balanced 60/40",
        "desc": "Synthetic book: 60% equities, 40% fixed income",
        "rf": 0.04,
        "assets": [("Domestic equity", .10, .17, 1.0), ("Developed intl equity", .09, .16, .9), ("Emerging equity", .11, .21, 1.1),
                   ("Government bonds", .045, .06, -.2), ("Investment-grade credit", .052, .07, .15), ("Short-term bonds", .04, .02, 0.0)],
        "rg": [.27, .21, .12, .22, .08, .10],
        "bench": [("Static 60/40", [.20, .20, .20, .1333, .1333, .1334], 63), ("Equity-heavy 80/20", [.30, .30, .20, .0667, .0667, .0666], 63),
                  ("Buy and hold 60/40", [.20, .20, .20, .1333, .1333, .1334], None)],
        "seed": None,
    },
}

def build(seeds):
    out = {}
    for (k, P), seed in zip(PORTFOLIOS.items(), seeds):
        r = simulate(P["assets"], seed)
        o = {"name": P["name"], "desc": P["desc"], "n_assets": len(P["assets"]), "days": DAYS,
             "synthetic": True, "schemes": {}, "bench": {}}
        for sc, every in SCHED.items():
            o["schemes"][sc] = pack(run(r, P["rg"], every), P["rf"])
        for label, w, every in P["bench"]:
            o["bench"][label] = pack(run(r, w, every), P["rf"])
        out[k] = o
    return out

if __name__ == "__main__":
    # Seeds for the scenarios currently on the site (India FO, India ETFs, 60/40).
    seeds = [int(s) for s in sys.argv[1:4]] if len(sys.argv) > 3 else [277, 373, 91]
    data = build(seeds)
    for k, o in data.items():
        print(k)
        for s, x in list(o["schemes"].items()) + list(o["bench"].items()):
            print(f"   {s:22s} end {100*(1+x['total_return']):6.1f}  ann {x['ann_return']:.3f} vol {x['volatility']:.3f} "
                  f"sh {x['sharpe']:.2f} dd {x['max_drawdown']:.3f} cvar {x['cvar99']:.4f}")
    # Write the portfolios into assets/js/data.js, keeping the tail-risk block as it is.
    import os, re
    here = os.path.dirname(os.path.abspath(__file__))
    target = os.path.join(here, "..", "assets", "js", "data.js")
    src = open(target, encoding="utf-8").read()
    head, body = src.split("window.RG_DATA=", 1)
    blob = json.loads(body.strip().rstrip(";"))
    blob["portfolios"] = data
    open(target, "w", encoding="utf-8").write(head + "window.RG_DATA=" + json.dumps(blob, separators=(",", ":")) + ";\n")
    print("updated", os.path.normpath(target))
