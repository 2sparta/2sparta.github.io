#!/usr/bin/env python3
"""Fetch only the reviewed map originals; fail if a source has changed."""
import hashlib,json,pathlib,sys,urllib.request
root=pathlib.Path(__file__).resolve().parents[1]
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
for source in json.loads((root/'scripts/atlas/spain-sources.json').read_text()):
 target=out/source['file']
 if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()==source['sha256']:continue
 request=urllib.request.Request(source['url'],headers={'User-Agent':'SchoolHistoricalAtlas/1.0 (https://github.com/2sparta/2sparta.github.io; educational map attribution)'})
 with urllib.request.urlopen(request,timeout=60) as response:data=response.read()
 if hashlib.sha256(data).hexdigest()!=source['sha256']:raise SystemExit('Source changed: '+source['file'])
 target.write_bytes(data);print(source['file'])
