#!/usr/bin/env python3
import json, pathlib, re, time, urllib.parse, urllib.request
from datetime import datetime, timezone, timedelta
ROOT=pathlib.Path(__file__).resolve().parents[1]
cfg=json.loads((ROOT/'config.json').read_text())
types={'A':1,'AAAA':28,'MX':15,'NS':2}
def query(endpoint,domain,kind):
    url=endpoint+('?' if '?' not in endpoint else '&')+urllib.parse.urlencode({'name':domain,'type':kind})
    req=urllib.request.Request(url,headers={'Accept':'application/dns-json','User-Agent':'dns-pulse/1.0'})
    start=time.perf_counter()
    try:
        with urllib.request.urlopen(req,timeout=12) as response: body=json.load(response)
        return {'ok':body.get('Status')==0,'ms':round((time.perf_counter()-start)*1000,1),'answers':sorted(str(a['data']) for a in body.get('Answer',[]) if a.get('type')==types[kind])}
    except (OSError,ValueError,KeyError) as e:
        return {'ok':False,'ms':None,'answers':[],'error':str(e)[:150]}
def main():
    domains=sorted(set(str(x).strip().lower().rstrip('.') for x in cfg['domains']))
    if not domains or any(not re.fullmatch(r'(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}',d) for d in domains):raise ValueError('Invalid domains')
    now=datetime.now(timezone.utc);stamp=now.isoformat(timespec='seconds').replace('+00:00','Z')
    path=ROOT/'data/history.json'
    try:history=json.loads(path.read_text()).get('samples',[])
    except (OSError,ValueError):history=[]
    fresh=[]
    for d in domains:
        for resolver,url in cfg['resolvers'].items():
            checks={t:query(url,d,t) for t in types}
            up=any(checks[t]['ok'] and checks[t]['answers'] for t in ('A','AAAA'))
            fresh.append({'at':stamp,'domain':d,'resolver':resolver,'up':up,'latency_ms':checks['A']['ms'],'records':{t:checks[t]['answers'] for t in types}})
            print(stamp,d,resolver,'UP' if up else 'DOWN')
    since=now-timedelta(hours=max(24,min(720,int(cfg.get('retention_hours',48)))))
    keep=[]
    for s in history:
        try:
            if datetime.fromisoformat(s['at'].replace('Z','+00:00'))>=since and s['domain'] in domains:keep.append(s)
        except (KeyError,ValueError,TypeError):pass
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps({'generated_at':stamp,'samples':(keep+fresh)[-50000:]},separators=(',',':'))+'\n')
if __name__=='__main__':main()
