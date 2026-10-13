#!/usr/bin/env python3
"""Source contours only. Rebuild: python scripts/build-mongol-atlas.py SOURCE_DIRECTORY.
Dependencies: scripts/atlas/rus-requirements.txt + cairosvg. Raw sources are pinned by SHA256.
Bundled WebP previews preserve the source legend; SVG vectors retain their original path geometry.
"""
import sys,json,hashlib,importlib.util
from pathlib import Path
import numpy as np,cv2,cairosvg
from PIL import Image
from lxml import etree as ET
from shapely.geometry import Polygon,mapping,shape
from shapely.ops import transform,unary_union
ROOT=Path(__file__).resolve().parents[1];SRC=Path(sys.argv[1]);OUT=ROOT/'public/atlas/mongols';OUT.mkdir(parents=True,exist_ok=True);(OUT/'originals').mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('svg',ROOT/'scripts/build-frankish-atlas.py');svg=importlib.util.module_from_spec(spec);spec.loader.exec_module(svg)
svg.PROJECTIONS={'equirectangular':'+proj=eqc +datum=WGS84','mercator':'EPSG:3857','asia-conic':'+proj=eqdc +lat_1=20 +lat_2=60 +lon_0=90 +datum=WGS84','asia-lambert':'+proj=lcc +lat_1=20 +lat_2=60 +lon_0=90 +datum=WGS84','robinson':'+proj=robin +lon_0=90 +datum=WGS84','winkel':'+proj=wintri +lon_0=90 +datum=WGS84','asia-equal-area':'+proj=laea +lat_0=40 +lon_0=85 +datum=WGS84'}
controls=json.loads((ROOT/'scripts/atlas/mongol-control-points.json').read_text());fits={k:svg.fit(v) for k,v in controls.items()};frames=[];originals=[]
sources={
'expansion.svg':('Expansion of the Mongol Empire.svg','Cattette','CC BY-SA 4.0','mongol-expansion'),
'divisions.png':('MongolEmpireDivisions1300.png','Gabagool; Ecthelion83 and Commons contributors','CC BY 3.0','mongol-divisions'),
'successors.svg':('Northern Yuan and Golden Horde.svg','Elvonudinium','CC BY-SA 4.0','mongol-successors'),
'mughal-1530.png':('Mughal Empire, 1530.png','Avantiputra7','CC BY-SA 4.0','mughal-1530'),
'mughal-akbar.png':('Mughal Empire, 1605.png','Avantiputra7','CC BY-SA 4.0','mughal-1605'),
'mughal-1707.png':('Mughal Empire, 1707.png','Avantiputra7','CC BY-SA 4.0','mughal-1707'),
}
pinned=json.loads((ROOT/'scripts/atlas/mongol-originals.json').read_text()) if (ROOT/'scripts/atlas/mongol-originals.json').exists() else []
for file,(title,author,license,id) in sources.items():
 p=SRC/file;known=next((s for s in pinned if s['file']==file),None)
 if known:assert hashlib.sha256(p.read_bytes()).hexdigest()==known['sha256'],file
 preview=OUT/'originals'/p.with_suffix('.webp').name
 if p.suffix=='.svg':
  png=cairosvg.svg2png(url=str(p),output_width=1800,background_color='white');import io;im=Image.open(io.BytesIO(png))
 else:im=Image.open(p)
 im.convert('RGB').save(preview,'WEBP',quality=90)
 originals.append(dict(file=file,title=title,author=author,license=license,sourceId=id,descriptionUrl='https://commons.wikimedia.org/wiki/File:'+title.replace(' ','_'),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),preview=str(preview.relative_to(ROOT/'public')),previewSha256=hashlib.sha256(preview.read_bytes()).hexdigest()))

def rnd(v):
 if isinstance(v,dict):return {k:rnd(x) for k,x in v.items()}
 if isinstance(v,(list,tuple)):return [rnd(x) for x in v]
 return round(float(v),5) if isinstance(v,(float,np.floating)) else v

def frame(year,file,areas,group,note,to=None,branch='mongols'):
 s=next(x for x in originals if x['file']==file);features=[]
 for g,name,color,end in areas:
  geo=svg.polygonal(transform(fits[group][0],svg.polygonal(g))) if group else svg.polygonal(g)
  assert geo.is_valid and not geo.is_empty,name
  features.append(dict(type='Feature',id=f'mongol-{year}-{len(features)}',properties=dict(name=name,subject=name,precision=1,detailed=True,region='mongols',sourceYear=year,sourceId=s['sourceId'],color=color,validTo=end),geometry=rnd(mapping(geo))))
 frames.append(dict(year=year,to=to or year,branch=branch,sourceYear=year,sourceFilename=s['title'],sourceUrl=s['descriptionUrl'],originalPath=s['preview'],author=s['author'],license=s['license'],sourceId=s['sourceId'],note=note,collection=dict(type='FeatureCollection',features=features)))
r=ET.parse(str(SRC/'expansion.svg'));source_land=unary_union([svg.path_polygon(e) for e in r.xpath('//*[@id="Land_1_"]//*[local-name()="path"]')]);paths=r.xpath('//*[@id="Stages"]/*');byyear={int(e.get('id').replace('_x31_','1').replace('_2_','')):e for e in paths}
for y,nexty in zip([1206,1219,1223,1227,1237,1259,1294],[1219,1223,1227,1237,1259,1294,1300]):
 g=svg.path_polygon(byyear[y]).intersection(source_land);frame(y,'expansion.svg',[(g,'Mongol Empire' if y<1260 else 'Mongol successor realms — combined extent','#efbd82',nexty-1)],'expansion','Контур джерела; між зрізами немає інтерполяції. Походи не тотожні прямому управлінню. Після 1260 сукупний контур не означає єдину державу.',nexty-1)
# Four directly traced source fills; internal seas retained as holes.
a=np.array(Image.open(SRC/'divisions.png').convert('RGB'))
from scipy.ndimage import binary_fill_holes
areas=[]
for rgb,name,color,end in [([255,242,42],'Golden Horde','#f2df91',1358),([192,192,192],'Chagatai Khanate','#cbd7d9',1346),([25,175,75],'Yuan dynasty','#b6dcb3',1367),([177,161,204],'Ilkhanate','#d0b9da',1334)]:
 # Exact reviewed palette from original; inspect histogram if upstream changes.
 from collections import Counter
 palette=Counter(map(tuple,a.reshape(-1,3))).most_common(10)
 target=min([np.array(c) for c,n in palette],key=lambda c:np.linalg.norm(c-np.array(rgb)))
 mask=(np.max(np.abs(a.astype('int16')-target),axis=2)<5).astype('uint8');cs,h=cv2.findContours(mask,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE);polys=[]
 for i,c in enumerate(cs):
  if h[0,i,3]!=-1 or cv2.contourArea(c)<150:continue
  holes=[];child=h[0,i,2]
  while child>=0:
   if len(cs[child])>=3:holes.append(cs[child][:,0,:])
   child=h[0,child,0]
  polys.append(Polygon(c[:,0,:],holes))
 areas.append((svg.polygonal(unary_union(polys)).simplify(1),name,color,end))
frame(1300,'divisions.png',areas,'divisions','Карта близько 1300 р. поєднує прямі володіння та васальну залежність. Не переноситься назад на 1260. Після розпаду/втрати територій старі полігони прибираються, а хронологія продовжується позначками й подіями.',1367)
traces=json.loads((ROOT/'scripts/atlas/mongol-mughal-traces.json').read_text())
frame(1530,'mughal-1530.png',[(Polygon(traces['1530']),'Mughal Empire','#b3d4a6',1539)],'mughals','Контур вручну оцифрований із карти Avantiputra7 за Schwartzberg. Територія кінця правління Бабура; не переноситься на 1526. Дрібні вигини приблизні.',1539,'mughals')
frame(1605,'mughal-akbar.png',[(Polygon(traces['1605']['outer'],traces['1605']['holes']),'Mughal Empire','#b3d4a6',1699)],'mughals','Кінець правління Акбара; контур вручну оцифровано за Avantiputra7 / Schwartzberg, зі збереженням непідкорених областей. Між картами не відтворює всіх пізніших завоювань.',1699,'mughals')
frame(1707,'mughal-1707.png',[(Polygon(traces['1707']),'Mughal Empire','#b3d4a6',1707)],'mughals','Найбільше розширення за Аурангзеба; вручну оцифрований контур джерела. Після 1707 ця максимальна територія не продовжується як незмінна імперія.',1707,'mughals')
# Later overview geometries are imported ONLY for the requested successor states.
# All other countries and the original overview files remain byte-for-byte unchanged.
previous=json.loads((OUT/'manifest.json').read_text()) if (OUT/'manifest.json').exists() else {}
for y in [1500,1600,1700]:
 known=next((x for x in previous.get('basemapInputs',[]) if x['year']==y),None)
 if known:assert hashlib.sha256((SRC/f'world-{y}.json').read_bytes()).hexdigest()==known['sha256'],y
 raw=json.loads((SRC/f'world-{y}.json').read_text());areas=[]
 allowed={1500:{'Crimean Khanate':('Crimean Khanate',1599),'Golden Horde':('Great Horde',1501),'Khanate of Sibir':('Sibir Khanate',1597),'Chagatai Khanate':('Eastern Chagatai realms',1513)},1600:{'Crimean Khanate':('Crimean Khanate',1699),'Nogai Horde':('Nogai Horde',1633)},1700:{'Mughal Empire':('Mughal Empire',1706)}}[y]
 for f in raw['features']:
  name=f['properties'].get('NAME')
  if name in allowed:
   name,end=allowed[name];areas.append((shape(f['geometry']),name,'#edcf88' if y<1700 else '#b3d4a6',end))
 if areas:
  frame(y,'successors.svg' if y<1700 else 'mughal-1707.png',areas,None,'Оглядові межі Historical Basemaps, не щорічні точні кордони. Зображення-оригінал подане лише для порівняння і має іншу дату/період; геометрія походить із зазначеного зрізу Basemaps.',max(x[3] for x in areas),'hordes' if y<1700 else 'mughals')
  frames[-1]['sourceId']='basemaps';frames[-1]['sourceUrl']='https://github.com/aourednik/historical-basemaps/tree/da7a4b735ecef70aebdc9c73e409d8a2500d50f3'
  frames[-1]['originalPath']='';frames[-1]['license']='GPL-3.0';frames[-1]['author']='André Ourednik and Historical Basemaps contributors'
  for f in frames[-1]['collection']['features']:f['properties']['sourceId']='basemaps';f['properties']['detailed']=False
text=json.dumps(dict(frames=sorted(frames,key=lambda f:f['year'])),ensure_ascii=False,separators=(',',':'))+'\n';(OUT/'frames.json').write_text(text)
(ROOT/'scripts/atlas/mongol-originals.json').write_text(json.dumps(originals,ensure_ascii=False,indent=2)+'\n')
(OUT/'manifest.json').write_text(json.dumps(dict(method='Direct SVG and raster colour contours; manual Mughal raster boundary tracing, no invented annual interpolation.',registration={k:v[1] for k,v in fits.items()},basemapInputs=[dict(year=y,commit='da7a4b735ecef70aebdc9c73e409d8a2500d50f3',sha256=hashlib.sha256((SRC/f'world-{y}.json').read_bytes()).hexdigest()) for y in [1500,1600,1700]],originals=originals),ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v[1] for k,v in fits.items()},indent=2))
