import csv, re
from collections import defaultdict

HUB='https://www.arizona.edu/degree-search'
UG={'ba','bs','bfa','bis','bla','bsae','bsba','bsbe','bsce','bscse','bsee','bsie','bsme','bsse','bas','bsw'}
CERT={'gc','psm'}
GRAD={'ma','ms','mba','mla','mm','mph','es','med','mfa','msw','msn','meng'}|CERT
PHD={'dp','dma','dnp','dph','edd','aud','dpt','pharmd','jd','psyd'}
LVLCODE=UG|GRAD|PHD; MARK={'emphasis','track'}; STOP={'and','of','the','in','a','s'}
def norm(t): return t[:-1] if len(t)>3 and t.endswith('s') else t
def slug_of(u): return u.rstrip('/').split('/')[-1]

def analyze(slug):
    toks=slug.split('-')
    spelled=slug.startswith(('doctor-of','master-of','bachelor-of'))
    has_conc=('emphasis' in toks) or ('track' in toks)
    if slug.startswith('doctor-of'): level='PHD'
    elif slug.startswith('master-of'): level='GRAD'
    elif slug.startswith('bachelor-of'): level='UG'
    else:
        codes=[t for t in toks if t in LVLCODE]
        if codes:
            c=codes[-1]; level='PHD' if c in PHD else ('CERT' if c in CERT else 'GRAD') if c in GRAD else 'UG'
        else: level='BASE'
    core=tuple(norm(t) for t in toks if t not in MARK and t not in LVLCODE and t not in STOP)
    return level, has_conc, spelled, core

# --- universe of known major pages (from original data) ---
orig=list(csv.DictReader(open('data.csv')))
univ={}
for r in orig:
    u=r['promote_url'].rstrip('/')
    if '/degree-search/majors/' in u: univ[slug_of(u)]=u
base_stems=set()
for slug in univ:
    lvl,hc,sp,core=analyze(slug)
    if not hc and not sp and core: base_stems.add(core)
def family_key(slug):
    lvl,hc,sp,core=analyze(slug)
    if sp: return None
    if not hc: return core
    for i in range(len(core),0,-1):
        if core[:i] in base_stems: return core[:i]
    return None

# build families: key -> list of (rankgroup, level, url)  DEGREE LEVELS ONLY (no emphasis)
RANK={'BASE':1,'UG':2,'GRAD':3,'CERT':4,'PHD':5}
fam=defaultdict(list)
for slug,u in univ.items():
    lvl,hc,sp,core=analyze(slug)
    if hc or sp: continue          # degree levels only
    k=family_key(slug)
    if k is not None: fam[k].append((RANK[lvl],lvl,u))
for k in fam:
    fam[k]=sorted(set(fam[k]), key=lambda x:(x[0],x[2]))

# --- expand v2 into v3 long format ---
v2=list(csv.DictReader(open('U_of_A_SearchStax_Promotion_Rules_v2.csv')))
ctxcols=['source','target_current_rank','current_top_result','priority','promotion_needed','disambiguated']
out=[]; stats=defaultdict(int); famsizes=[]
for r in v2:
    trig=r['trigger']; ctx={c:r[c] for c in ctxcols}
    is_generic = r['rule_applied'].startswith('Rule 1')
    members=[]
    if is_generic:
        k=family_key(slug_of(r['previous_promote_url']))
        members=fam.get(k, [])
    if is_generic and len(members)>=2:
        stats['generic_multi']+=1; famsizes.append(len(members))
        for i,(rg,lvl,u) in enumerate(members,1):
            out.append({'trigger':trig,'match_type':'exact','promote_url':u,'promote_rank':i,
                        'promote_level':lvl,'rule_applied':'Rule 2 — family multi-promote', **ctx})
    elif is_generic:
        stats['generic_hub_fallback']+=1
        out.append({'trigger':trig,'match_type':'exact','promote_url':HUB,'promote_rank':1,
                    'promote_level':'HUB','rule_applied':'Rule 1 — generic → DS home (no family)', **ctx})
    else:
        stats['single']+=1
        lvl=analyze(slug_of(r['promote_url']))[0] if '/majors/' in r['promote_url'] else 'NAV'
        out.append({'trigger':trig,'match_type':'exact','promote_url':r['promote_url'],'promote_rank':1,
                    'promote_level':lvl,'rule_applied':r['rule_applied'], **ctx})

cols=['trigger','match_type','promote_url','promote_rank','promote_level','rule_applied']+ctxcols
with open('U_of_A_SearchStax_Promotion_Rules_v3_multi.csv','w',newline='') as fh:
    w=csv.DictWriter(fh, fieldnames=cols); w.writeheader(); w.writerows(out)

print("v2 triggers:",len(v2)," -> v3 output rows:",len(out))
for k,v in sorted(stats.items()): print(f"  {k}: {v}")
print(f"  avg family size: {sum(famsizes)/len(famsizes):.1f}  (max {max(famsizes)})")
print("\n--- sample: accounting ---")
for o in out:
    if o['trigger']=='accounting': print(f"  {o['promote_rank']} [{o['promote_level']:4}] {o['promote_url'].split('majors/')[-1]}")
print("--- sample: computer science ---")
for o in out:
    if o['trigger']=='computer science': print(f"  {o['promote_rank']} [{o['promote_level']:4}] {o['promote_url'].split('majors/')[-1]}")
print("--- sample: accounting ms (specific, should stay single) ---")
for o in out:
    if o['trigger']=='accounting ms': print(f"  {o['promote_rank']} [{o['promote_level']:4}] {o['promote_url'].split('majors/')[-1]}")
