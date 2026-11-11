#!/usr/bin/env python3
"""Met à jour les données du site Werenoi.

- data.js  : streams Spotify de chaque titre, d'après kworb.net (tous les jours)
- certs.js : certifications SNEP de Werenoi (le lundi, ou si FORCE_SNEP=1)

Aucune dépendance : seulement la bibliothèque standard de Python.
Un fichier n'est réécrit que si la lecture de sa source est complète et cohérente.
"""
import datetime as dt
import html
import json
import os
import re
import sys
import time
import urllib.request
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KWORB = "https://kworb.net/spotify/artist/3YBJLs7RqR0aPGBgU27nDh_songs.html"
SNEP = "https://snepmusique.com/les-certifications/"
SNEP_PUBLIC = SNEP + "?interprete=werenoi"
HEADERS = {"User-Agent": "Mozilla/5.0 (site de suivi Werenoi; mise a jour quotidienne)"}
PARIS = ZoneInfo("Europe/Paris")
FIRST_SNEP_YEAR = 2021


def get(url):
    last = None
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"lecture impossible de {url} : {last}")


def read_js(name):
    path = os.path.join(ROOT, name)
    if not os.path.exists(path):
        return None
    txt = open(path, encoding="utf-8").read()
    return json.loads(txt[txt.index("{"): txt.rindex("}") + 1])


def write_js(name, var, data):
    with open(os.path.join(ROOT, name), "w", encoding="utf-8") as fh:
        fh.write(f"window.{var} = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")


def num(s):
    s = (s or "").replace(",", "").strip()
    return int(s) if s else 0


def now_utc():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------- streams

ROW = re.compile(
    r'<tr><td class="text"><div>(\*\s*)?<a href="https://open\.spotify\.com/track/([A-Za-z0-9]+)"[^>]*>(.*?)</a></div></td>'
    r"<td>([\d,]+)</td><td>([\d,]*)</td></tr>",
    re.S,
)


def parse_kworb(page):
    m = re.search(r"Last updated:\s*(\d{4})/(\d{2})/(\d{2})", page)
    tot = re.search(r'<td class="text">Streams</td><td>([\d,]+)</td>', page)
    ntr = re.search(r'<td class="text">Tracks</td><td>([\d,]+)</td>', page)
    if not (m and tot and ntr):
        raise RuntimeError("page kworb méconnaissable (date ou tableau récapitulatif introuvable)")
    tracks = [
        {"t": html.unescape(title).strip(), "s": num(s), "d": num(d), "f": 1 if star else 0, "i": tid}
        for star, tid, title, s, d in ROW.findall(page)
    ]
    return f"{m[1]}-{m[2]}-{m[3]}", num(tot[1]), num(ntr[1]), tracks


def update_streams(page=None):
    date, exp_total, exp_n, tracks = parse_kworb(page or get(KWORB))
    total = sum(t["s"] for t in tracks)
    if total != exp_total or len(tracks) != exp_n:
        raise RuntimeError(f"kworb incomplet : {len(tracks)} titres / {total} streams lus, {exp_n} / {exp_total} attendus")
    tracks.sort(key=lambda x: -x["s"])

    prev = read_js("data.js")
    if prev and prev.get("updated") == date and all(t.get("i") for t in prev.get("tracks", [])):
        print(f"Streams : déjà à jour ({date}).")
        return False

    prev_tracks = (prev or {}).get("tracks") or []
    same_day = bool(prev) and prev.get("updated") == date
    prev_rank = {(t["t"], t["f"]): i + 1 for i, t in enumerate(prev_tracks)}
    prev_by_key = {(t["t"], t["f"]): t for t in prev_tracks}
    for t in tracks:
        key = (t["t"], t["f"])
        old = prev_by_key.get(key)
        if same_day:
            if old:
                if "p" in old:
                    t["p"] = old["p"]
                if old.get("n"):
                    t["n"] = 1
        elif prev_tracks:
            if key in prev_rank:
                t["p"] = prev_rank[key]
            else:
                t["n"] = 1

    daily = sum(t["d"] for t in tracks)
    history = [h for h in (prev or {}).get("history", []) if h["date"] != date]
    history.append({"date": date, "s": total, "d": daily})
    history.sort(key=lambda h: h["date"])
    write_js("data.js", "WERENOI_DATA", {
        "updated": date,
        "fetched": now_utc(),
        "source": KWORB,
        "totals": {
            "s": total, "d": daily, "n": len(tracks),
            "lead": sum(t["s"] for t in tracks if not t["f"]),
            "feat": sum(t["s"] for t in tracks if t["f"]),
            "nfeat": sum(1 for t in tracks if t["f"]),
        },
        "tracks": tracks,
        "history": history,
    })
    top = max(tracks, key=lambda t: t["d"])
    print(f"Streams : données du {date}, {total:,} streams, {daily:,} en 24 h, en tête : {top['t']}.")
    return True


# ---------------------------------------------------------- certifications

def _text(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def _field(chunk, cls):
    m = re.search(r'<div class="%s(?: [^"]*)?">(.*?)</div>' % cls, chunk, re.S)
    return _text(m[1]) if m else ""


def _iso(d):
    if not d:
        return ""
    dd, mm, yy = d.split("/")
    return f"{yy}-{mm}-{dd}"


def parse_snep(page):
    out = []
    for chunk in re.split(r'<div class="certification[" ]', page)[1:]:
        dates = dict(re.findall(r"<span>\s*(Date de sortie|Date de constat)\s*</span>\s*(\d{2}/\d{2}/\d{4})", chunk))
        out.append({
            "c": _field(chunk, "categorie"),
            "t": _field(chunk, "titre"),
            "a": _field(chunk, "artiste"),
            "l": _field(chunk, "editeur"),
            "n": _field(chunk, "certif"),
            "r": _iso(dates.get("Date de sortie", "")),
            "d": _iso(dates.get("Date de constat", "")),
        })
    return out


def fetch_snep(year_to, fetch=get):
    rows = {}
    for year in range(FIRST_SNEP_YEAR, year_to + 1):
        for cat in ("Singles", "Albums", "Vid%C3%A9os"):
            for p in range(1, 30):
                qs = f"interprete=werenoi&annee={year}&categorie={cat}"
                url = f"{SNEP}?{qs}" if p == 1 else f"{SNEP}page/{p}?{qs}"
                items = parse_snep(fetch(url))
                for x in items:
                    if not (x["t"] and x["n"] and x["d"]):
                        raise RuntimeError(f"fiche SNEP incomplète sur {url} : {x}")
                    rows[(x["c"], x["t"], x["n"], x["d"])] = x
                time.sleep(0.5) if fetch is get else None
                if len(items) < 30:
                    break
    return list(rows.values())


def update_certs(today, fetch=get):
    rows = fetch_snep(int(today[:4]), fetch)
    prev = read_js("certs.js")
    prev_seen = {(x["c"], x["t"], x["n"], x["d"]): x.get("seen") for x in (prev or {}).get("certs", [])}
    if prev and len(rows) < len(prev_seen):
        raise RuntimeError(f"SNEP : {len(rows)} certifications lues contre {len(prev_seen)} avant ; lecture incomplète, rien n'est modifié")
    new = []
    for x in rows:
        k = (x["c"], x["t"], x["n"], x["d"])
        if prev is None:
            continue
        if k in prev_seen:
            if prev_seen[k]:
                x["seen"] = prev_seen[k]
        else:
            x["seen"] = today
            new.append(x)
    rows.sort(key=lambda x: (x["d"], x["t"]), reverse=True)
    write_js("certs.js", "WERENOI_CERTS", {"checked": today, "source": SNEP_PUBLIC, "certs": rows})
    print(f"SNEP : {len(rows)} certifications, {len(new)} nouvelle(s).")
    for x in new:
        print(f"  NOUVEAU : {x['t']} ({x['a']}) {x['n']} le {x['d']}")
    return new


def main():
    errors = []
    try:
        update_streams()
    except Exception as e:  # noqa: BLE001
        errors.append(f"Streams : {e}")
    today = dt.datetime.now(PARIS)
    if today.weekday() == 0 or os.environ.get("FORCE_SNEP") == "1":
        try:
            update_certs(today.date().isoformat())
        except Exception as e:  # noqa: BLE001
            errors.append(f"Certifications : {e}")
    else:
        print("SNEP : vérification prévue le lundi.")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
