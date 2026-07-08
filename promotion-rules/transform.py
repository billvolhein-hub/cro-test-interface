import csv, re
from collections import Counter, defaultdict

HUB='https://www.arizona.edu/degree-search'
UG={'ba','bs','bfa','bis','bla','bsae','bsba','bsbe','bsce','bscse','bsee','bsie','bsme','bsse','bas','bsw'}
GRAD={'ma','ms','mba','mla','mm','mph','psm','gc','es','med','mfa','msw','msn','meng'}
PHD={'dp','dma','dnp','dph','edd','aud','dpt','pharmd','jd','psyd'}
LVLCODE=UG|GRAD|PHD
MARK={'emphasis','track'}
STOP={'and','of','the','in','a','s'}

def norm(tok):  # light singularize
    return tok[:-1] if len(tok)>3 and tok.endswith('s') else tok

def slug_of(u): return u.rstrip('/').split('/')[-1]

def analyze(slug):
    """Return (label, level, has_conc, spelled, core_tokens).
    label = display bucket; has_conc = names an emphasis/track concentration;
    core_tokens = field+concentration tokens (normalized, minus level codes/markers)."""
    toks=slug.split('-')
    spelled = slug.startswith('doctor-of') or slug.startswith('master-of') or slug.startswith('bachelor-of')
    has_conc = ('emphasis' in toks) or ('track' in toks)
    if slug.startswith('doctor-of'):   level='PHD'
    elif slug.startswith('master-of'): level='GRAD'
    elif slug.startswith('bachelor-of'):level='UG'
    else:
        codes=[t for t in toks if t in LVLCODE]
        if codes:
            c=codes[-1]; level='PHD' if c in PHD else 'GRAD' if c in GRAD else 'UG'
        else: level='BASE'
    label = ('EMPHASIS' if 'emphasis' in toks else 'TRACK') if has_conc else level
    core=[norm(t) for t in toks if t not in MARK and t not in LVLCODE and t not in STOP]
    return label, level, has_conc, spelled, core

def url_level(u):
    u=u.rstrip('/')
    if '/degree-search/majors/' not in u: return 'NAV'
    return analyze(slug_of(u))[0]

LVL_WORDS={'bachelor','bachelors','masters','master','doctor','doctoral','doctorate','phd',
           'undergraduate','graduate','certificate','associate','psyd','mfa','edd','dnp','dpt','aud'}
def trig_has_level(t):
    tl=re.sub(r'[^a-z0-9\s]',' ',t.lower())
    s=set(tl.split())
    if s&LVLCODE or s&LVL_WORDS: return True
    return bool(re.search(r'\bph\s*d\b|\bed\s*d\b|professional science master', tl))

FILLER={'university','of','arizona','u','a','uofa','uarizona','degree','degrees','major','majors',
        'program','programs','online','best','near','me','the','in','at','for','and','s','&'}
def content(t):
    return [w for w in re.findall(r"[a-z0-9]+", t.lower()) if w not in FILLER]

rows=list(csv.DictReader(open('data.csv')))

# Confirmed base-major stems = clean field pages (no concentration, not spelled-out)
base_stems=set()
for r in rows:
    if '/degree-search/majors/' not in r['promote_url']: continue
    label,level,has_conc,spelled,core=analyze(slug_of(r['promote_url']))
    if not has_conc and not spelled and core:
        base_stems.add(tuple(core))

def parent_tokens(promote_url):
    """Parent-field token set, or None if it can't be confirmed (then treat as specific)."""
    if '/degree-search/majors/' not in promote_url: return None
    label,level,has_conc,spelled,core=analyze(slug_of(promote_url))
    if spelled: return None
    if not has_conc: return set(core)            # BASE / pure-level: whole core is the field
    for i in range(len(core),0,-1):              # concentration present: need confirmed parent prefix
        if tuple(core[:i]) in base_stems: return set(core[:i])
    return None

def is_generic(r):
    if trig_has_level(r['trigger']): return False
    ct=[norm(x) for x in content(r['trigger'])]
    if not ct: return False
    pf=parent_tokens(r['promote_url'])
    if pf is None: return False           # can't confirm parent -> keep specific (safe)
    return set(ct) <= pf                   # trigger names only the parent field -> generic

# overlap gate for BASE pages (distinguish field-name query vs informational)
def overlap(r):
    ct=[norm(x) for x in content(r['trigger'])]
    if not ct: return 0.0
    st=set(norm(x) for x in slug_of(r['promote_url']).split('-') if x not in STOP)
    return sum(1 for w in ct if w in st)/len(ct)

# find sibling level page in dataset for FLAG suggestions
slug_set={slug_of(r['promote_url']) for r in rows}
def suggest_level(base_slug, want):
    if want not in ('UG','GRAD','PHD'): return ''
    codes={'UG':UG,'GRAD':GRAD,'PHD':PHD}[want]
    for c in codes:
        if f"{base_slug}-{c}" in slug_set: return f"{base_slug}-{c}"
    return ''

def want_level(t):
    tl=t.lower()
    if re.search(r'\bph\s*d\b|phd|doctor|doctoral|doctorate', tl): return 'PHD'
    if re.search(r'master|masters|\bms\b|\bma\b|graduate|certificate|\bgc\b', tl): return 'GRAD'
    if re.search(r'bachelor|\bba\b|\bbs\b|undergrad', tl): return 'UG'
    return ''

out=[]; tally=Counter()
for r in rows:
    ul=url_level(r['promote_url'])
    prev=r['promote_url']
    new=prev; rule=''; note=''
    if ul=='NAV':
        rule='Unchanged — navigational/non-major'; new=prev
    elif is_generic(r):
        rule='Rule 1 — generic term → DS home'; new=HUB; note=f'was: {prev}'
    elif ul=='BASE':
        if trig_has_level(r['trigger']):
            rule='Rule 2 — REVIEW: specific term on base page'
            sug=suggest_level(slug_of(prev), want_level(r['trigger']))
            note=f'needs {want_level(r["trigger"]) or "level"} entity'+(f'; suggest: .../{sug}' if sug else '; no matching level page in dataset — verify')
        else:
            rule='REVIEW: base-page mapping (verify generic vs keep)'
            note='trigger not a clean field-name match; left unchanged'
    else:
        rule='Rule 2 — specific entity (kept)'
    tally[rule]+=1
    nr=dict(r); nr['previous_promote_url']=prev; nr['promote_url']=new
    nr['url_level_original']=ul; nr['rule_applied']=rule; nr['change_note']=note
    out.append(nr)

fields=list(rows[0].keys())+['previous_promote_url','url_level_original','rule_applied','change_note']
# reorder: put previous_promote_url right after promote_url
order=[]
for f in rows[0].keys():
    order.append(f)
    if f=='promote_url': order.append('previous_promote_url')
order+=['url_level_original','rule_applied','change_note']
with open('U_of_A_SearchStax_Promotion_Rules_v2.csv','w',newline='') as fh:
    w=csv.DictWriter(fh, fieldnames=order); w.writeheader()
    for r in out: w.writerow(r)

print("=== FINAL TALLY (",len(out),"rows ) ===")
for k,v in tally.most_common(): print(f"  {v:4d}  {k}")
print("\nGeneric→hub total:", tally['Rule 1 — generic term → DS home'])
print("base_stems learned:", len(base_stems))
