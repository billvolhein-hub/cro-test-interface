"""Enrich sitesearchresults.csv with ahrefs Keywords Explorer data.

Reads the ahrefs API token from the AHREFS_API_KEY environment variable
(never hard-code it). Usage:  AHREFS_API_KEY=xxx python3 fetch_ahrefs.py
"""
import csv, json, subprocess, os

KEY = os.environ["AHREFS_API_KEY"]
SELECT = "keyword,volume,global_volume,difficulty,cpc,clicks,traffic_potential,parent_topic"
COUNTRY = "us"

seen = {}
for r in csv.DictReader(open("sitesearchresults.csv")):
    k = r["Keyphrase"].strip()
    if k and k.lower() not in seen:
        seen[k.lower()] = k
kws = list(seen.values())

raw = {}
for i in range(0, len(kws), 40):
    chunk = kws[i:i+40]
    p = subprocess.run([
        "curl", "-sS", "-G", "https://api.ahrefs.com/v3/keywords-explorer/overview",
        "--data-urlencode", f"country={COUNTRY}",
        "--data-urlencode", f"select={SELECT}",
        "--data-urlencode", "keywords=" + ",".join(chunk),
        "-H", f"Authorization: Bearer {KEY}", "-H", "Accept: application/json",
    ], capture_output=True, text=True)
    for kw in json.loads(p.stdout).get("keywords", []):
        raw[kw["keyword"].lower()] = kw

json.dump(raw, open("ahrefs_raw.json", "w"))
print(f"fetched ahrefs metrics for {len(raw)}/{len(kws)} keyphrases")
