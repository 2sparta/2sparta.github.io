#!/usr/bin/env python3
"""Offline, checksum-pinned Iberian/colonial and Civil War atlas.
Usage: python scripts/build-spain-atlas.py SOURCE_CACHE HISTORICAL_BASEMAPS
Dependencies: scripts/atlas/spain-requirements.txt. No runtime map services.
"""
import copy, hashlib, importlib.util, json, pathlib, re, subprocess, sys
import numpy as np
from lxml import etree as ET
from pyproj import Geod
from shapely import make_valid, set_precision, union_all
from shapely.geometry import shape, mapping, box, GeometryCollection, MultiPolygon, Polygon
from shapely.ops import transform

ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=pathlib.Path(sys.argv[1]); BASE=pathlib.Path(sys.argv[2])
PIN='da7a4b735ecef70aebdc9c73e409d8a2500d50f3'
assert subprocess.check_output(['git','-C',str(BASE),'rev-parse','HEAD'],text=True).strip()==PIN
sources=json.loads((ROOT/'scripts/atlas/spain-sources.json').read_text())
for s in sources: assert hashlib.sha256((CACHE/s['file']).read_bytes()).hexdigest()==s['sha256']
spec=importlib.util.spec_from_file_location('svg_transfer',ROOT/'scripts/build-frankish-atlas.py')
svg=importlib.util.module_from_spec(spec);spec.loader.exec_module(svg)
svg.PROJECTIONS={'eqc':'+proj=eqc +lat_ts=40 +datum=WGS84','mercator':'EPSG:3857','lcc':'+proj=lcc +lat_1=35 +lat_2=44 +lat_0=40 +lon_0=-4 +datum=WGS84','laea':'+proj=laea +lat_0=40 +lon_0=-4 +datum=WGS84'}
controls=json.loads((ROOT/'scripts/atlas/spain-control-points.json').read_text())
fits={k:svg.fit(v) for k,v in controls.items()}
for key,(fn,report) in fits.items():
 report['holdoutKm']=[]
 for p in controls[key]['points']:
  if p['role']=='holdout':
   lon,lat=fn(p['x'],p['y']);_,_,d=Geod(ellps='WGS84').inv(lon,lat,p['lon'],p['lat'])
   report['holdoutKm'].append({'name':p['name'],'km':round(d/1000,2)})
 assert max(p['km'] for p in report['holdoutKm'])<30,(key,report)
roots={str(i):ET.parse(str(CACHE/f'source-{i}.svg')) for i in [0,1]}
records={}
def poly(g):
 g=make_valid(g)
 if g.geom_type in ['Polygon','MultiPolygon']:return g
 return union_all([poly(p) for p in getattr(g,'geoms',[]) if p.geom_type in ['Polygon','MultiPolygon','GeometryCollection']])
def combine(items):return poly(union_all(list(items)))
def rounded(v):
 if isinstance(v,dict):return {k:rounded(x) for k,x in v.items()}
 if isinstance(v,(list,tuple)):return [rounded(x) for x in v]
 return round(float(v),5) if isinstance(v,(float,np.floating)) else v
def feature(g,id,name,subject,year,source='spain-basemaps',color='#dbb45e',layer='state',**kw):
 g=set_precision(poly(g),.00001)
 if g.is_empty or g.area<.00001:return None
 if g.geom_type=='MultiPolygon':g=MultiPolygon(sorted(g.geoms,key=lambda p:-p.area))
 s=next((s for s in sources if s['sourceId']==source),None)
 return {'type':'Feature','id':id,'properties':{'name':name,'subject':subject,'precision':2,'detailed':True,'region':'spain','layer':layer,'sourceId':source,'sourceYear':year,'sourceUrl':s['descriptionUrl'] if s else f'https://github.com/aourednik/historical-basemaps/blob/{PIN}/geojson/world_{year}.geojson','color':color,**kw},'geometry':rounded(mapping(g))}
def frame(date,items,note,precision='year'):
 return {'date':date,'precision':precision,'note':note,'collection':{'type':'FeatureCollection','features':[f for f in items if f]}}
def base(year):
 b=(BASE/f'geojson/world_{year}.geojson').read_bytes();records[year]=hashlib.sha256(b).hexdigest();return json.loads(b)['features']
def geom(f):
 g=f['geometry'];parts=[g['coordinates']] if g['type']=='Polygon' else g['coordinates'];clean=[]
 for part in parts:
  rings=[]
  for ring in part:
   xy=[p[:2] for p in ring]
   if len(set(tuple(p) for p in xy))>=3:rings.append(xy)
  if rings:clean.append(rings)
 return poly(shape({'type':'MultiPolygon','coordinates':clean}))
IBERIAN={'Visigothic Kingdom','Asturias','Emirate of Córdoba','Caliphate of Córdoba','Navarre','León','Castilla','Castile','Castille','Aragón','Portugal','Granada','Almoravid dynasty','Almohad Caliphate'}
COLONIES={'Cuba (Spain)','Hispaniola (Spain)','Santo Domingo (Spain)','Florida (Spain)','Spanish Guinea','Spanish Sahara'}
frames=[]
for year in [700,800,900,1000,1100,1200,1279,1300,1400,1492,1500,1530,1600,1650,1700,1715,1783,1800,1815,1878,1900,1914,1920,1930,1945,1960,1994]:
 items=[]
 for i,f in enumerate(base(year)):
  p=f['properties'];n=p.get('NAME') or '';s=p.get('SUBJECTO') or ''
  early=year<=1500 and n in IBERIAN
  imperial=n=='Spain' or n in COLONIES or n.startswith('Viceroyalty of ') and 'Brazil' not in n or s in ['Spanish Habsburg','Spain'] and not n.startswith('United Provinces')
  philippines=n=='Philippines' and 1565<=year<1899
  african=n in ['Equatorial Guinea','Western Sahara'] and 1900<=year<1968
  if not (early or imperial or philippines or african or year==1600 and n=='Portugal'):continue
  g=geom(f)
  # Keep whole Iberian/island components of medieval states; not the entire Maghreb empire.
  if early:
   g=combine(part for part in getattr(g,'geoms',[g]) if -10<part.representative_point().x<4.5 and 36<part.representative_point().y<44)
   g=poly(g.intersection(box(-10,35.7,4.5,44)))
  if g.is_empty:continue
  pieces=list(getattr(g,'geoms',[g])); core=[];overseas=[]
  for part in pieces:
   c=part.representative_point()
   
   # Several later source records retain obsolete Caribbean components; never revive them after 1898.
   if year>=1900 and (c.x < -20 or c.x > 100):continue
   (core if -20<c.x<5 and 25<c.y<44 and n=='Spain' or early else overseas).append(part)
  for kind,parts in [('state',core),('colony',overseas)]:
   if not parts:continue
   name=n;kw={};color='#d8b262'
   if kind=='colony':
    if n=='Spain':name='Spanish overseas possessions'
    if n=='Philippines':name='Spanish Philippines'
    if n in ['Equatorial Guinea','Western Sahara']:name='Spanish Guinea' if n=='Equatorial Guinea' else 'Spanish Sahara'
    kw={'control':'relative','relation':'Колоніальні володіння або імперські претензії; місцевий фактичний контроль був нерівномірним. Це не карта щоденних фронтів.'};color='#c48452'
   if n in ['Sardinia','Naples','Sicily','Milan','Franche-Comté','Habsburg Netherlands']:
    kind='dependency';kw={'control':'relative','relation':'Європейське володіння складеної Габсбурзької монархії, не колонія Америки.'}
   if n=='Portugal' and year==1600:
    name='Portugal — Iberian Union';kw={'control':'relative','relation':'Спільний монарх, окремі португальські інституції та колоніальна імперія; не приєднання Португалії до Іспанії.','validUntilDate':'1640-11-30'};kind='dependency';color='#8fae7a'
   if year==1530 and n=='Viceroyalty of New Spain':name='New Spain — early conquests'
   items.append(feature(combine(parts),f'es-{year}-{i}-{kind}',name,'Spain' if not early else n,year,layer=kind,color=color,**kw))
 date=f'{year:04}-01-01'
 if year==1492:date='1492-01-02'
 frames.append(frame(date,items,'Датований оглядовий політичний зріз. Колоніальні ареали та претензії не означають суцільного фактичного контролю. Португалія та її імперія не зливаються з іспанськими. Межі між зрізами не інтерполюються.','day' if year==1492 else 'year'))
# The 711 conquest is represented by dated campaign centres, not an invented instantaneous front.
frames.append(frame('0711-01-01',[],'711–749: завоювання показане осередками кампаній. Достовірного щоденного політичного контуру немає; перший оглядовий ареал після завоювання — 750 р.'))
# Decline of the mainland empire: retain only documented Caribbean/Pacific possessions, not old viceroyalties.
f1815=next(f for f in frames if f['date']=='1815-01-01'); f1878=next(f for f in frames if f['date']=='1878-01-01')
remaining=[copy.deepcopy(f) for f in f1878['collection']['features'] if f['properties']['layer']=='colony' and f['properties']['name']!='Spanish Guinea']
for f in remaining:f['properties']['description']='Береги й острови з датованого оглядового контуру 1878 р. використані як географічна основа збережених після незалежності материкової Америки володінь; не реконструкція фронту 1825 р.'
frames.append(frame('1825-01-01',[*[copy.deepcopy(f) for f in f1815['collection']['features'] if f['properties']['layer']=='state'],*remaining],'Після основної хвилі незалежності материкової Америки показано збережені Карибські й тихоокеанські колонії. Каллао та інші залишкові гарнізони не перетворені на контроль усього материка. Географія островів — опорний контур 1878 р.'))
f1900=next(f for f in frames if f['date']=='1900-01-01')
frames.append(frame('1899-04-11',copy.deepcopy(f1900['collection']['features']),'Набуття чинності Паризьким договором: попередні карибські й філіппінські володіння вилучено. Оглядова географія решти володінь — зріз 1900 р.; це не точна карта місцевих передач влади 1898–1899 рр.','day'))
f1960=next(f for f in frames if f['date']=='1960-01-01')
post1968=[copy.deepcopy(f) for f in f1960['collection']['features'] if f['properties']['name']!='Spanish Guinea']
frames.append(frame('1968-10-12',post1968,'Незалежність Екваторіальної Гвінеї. Інші контури — остання наявна оглядова географія; Іфні окремо не реконструйовано.','day'))
frames.append(frame('1976-02-26',[copy.deepcopy(f) for f in post1968 if f['properties']['name']!='Spanish Sahara'],'Іспанія повідомила ООН про припинення своєї присутності в Західній Сахарі. Територія вилучена з іспанського шару; це не твердження про завершення її деколонізації або визнання іншого суверенітету.','day'))
def path(key,id):return poly(transform(fits[key][0],svg.path_polygon(roots[key].xpath('//*[@id=$id]',id=id)[0])))
# The bands are a retrospective survey of Christian expansion, not a single Christian state.
bands=[path('0',id) for id in ['Territory_718','Territory_750','Territory_1050','Territory_1090','Territory_1220','Territory_XIII','Granada']]
def survey(g):
 # Fill sub-resolution SVG seam/lake holes (<~1 km²); these are not political enclaves.
 return combine(Polygon(p.exterior,[r for r in p.interiors if Polygon(r).area>=.0001]) for p in getattr(g,'geoms',[g]))
whole=survey(combine(bands));reconquista=[]
for i,year in enumerate([718,750,1050,1090,1220,1300]):
 christian=poly(survey(combine(bands[:i+1])).intersection(whole));muslim=poly(whole.difference(christian))
 reconquista.append(frame(f'{year:04}-01-01',[feature(christian,f'es-recon-{year}-christian','Christian Iberian lands','Кілька християнських держав',year,'spain-reconquista','#d9a044','land'),feature(muslim,f'es-recon-{year}-andalus','Al-Andalus — survey','Мусульманські держави Аль-Андалусу',year,'spain-reconquista','#68a086','land')],'Ретроспективні оглядові ареали християнського просування. Це не єдине королівство і не точний фронт конкретного дня. 718 — умовне датування вихідного осередку; 1300 — завершення XIII ст. за легендою джерела.'))
# Civil War coloured zones. The Canary inset is excluded before geographic transfer.
colors=['#decd87','#e9ddaf','#f4eed7','#e68fac','#f4c2c2','#ffd5d5']
zones={}
for color in colors:
 es=roots['1'].xpath('//*[local-name()="path"]');gs=[]
 for e in es:
  style=e.get('style','')
  if f'fill:{color};' in style or color=='#f4c2c2' and 'fill:#f4e3d7;' in style:
   g=svg.path_polygon(e).difference(box(535,650,1000,900))
   gs.append(poly(transform(fits['1'][0],g)).intersection(box(-10,36,4.5,44)))
 zones[color]=combine(gs)
warland=combine(zones.values());civil=[]
canaries=combine(geom(f).intersection(box(-19,27,-12,30)) for f in base(1930) if f['properties'].get('NAME')=='Spain')
dates=['1936-07-31','1936-09-30','1937-10-31','1938-11-30','1939-02-28']
for i,date in enumerate(dates):
 national=combine(zones[c] for c in colors[:i+1]);republic=poly(warland.difference(national))
 civil.append(frame(date,[feature(combine([national,canaries]),'es-civil-nationalist','Nationalist-held Spain','Війська заколотників / Франко',int(date[:4]),'spain-civil-map','#c49c53','front'),feature(republic,'es-civil-republic','Republican-held Spain','Іспанська Республіка',int(date[:4]),'spain-civil-map','#bc7694','front')],'Місячний огляд фронту з легенди джерела, доступний від кінця зазначеного місяця. Межі не інтерполюються між днями. Показані півострів, Балеарські й Канарські острови; африканський театр не має повного територіального контуру.','month'))
core1930=[f for f in next(f for f in frames if f['date']=='1930-01-01')['collection']['features'] if f['properties']['layer']=='state']
civil.append(frame('1939-04-01',[feature(combine([warland,canaries,*[shape(f['geometry']).difference(box(-10,36,4.5,44)) for f in core1930]]),'es-civil-victory','Spain — Franco regime','Іспанія',1939,'spain-civil-map','#c49c53','front')],'Оголошення завершення війни 1 квітня 1939 р. Післявоєнний державний контур — географічна основа 1930 р.; подальший опір не є окремим суцільним державним фронтом.','day'))
frames.sort(key=lambda f:f['date'])
out=ROOT/'public/atlas/spain';out.mkdir(parents=True,exist_ok=True)
data={'frames':frames,'reconquista':reconquista,'civil':civil};text=json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n';(out/'frames.json').write_text(text)
manifest={'sha256':hashlib.sha256(text.encode()).hexdigest(),'basemapCommit':PIN,'basemapSha256':records,'sources':sources,'registration':{k:v[1] for k,v in fits.items()},'dates':[f['date'] for f in frames],'method':'Dated Historical Basemaps components; directly sampled SVG Reconquista bands and Civil War colour zones. Projected affine registration with held-out city controls. No daily front interpolation. Month-only fronts become available at month end. 1825/1899 reconstructions use explicitly identified island/geographic support contours, not future territorial expansion.'}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(len(frames),'political,',len(reconquista),'Reconquista,',len(civil),'Civil War frames;',len(text.encode()),'bytes')
