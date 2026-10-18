#!/usr/bin/env python3
"""Rebuild the Poland/Lithuania atlas from reviewed, checksum-pinned references.
Usage: python scripts/build-commonwealth-atlas.py SOURCE_CACHE HISTORICAL_BASEMAPS
The cache filenames and source URLs are in scripts/atlas/commonwealth-sources.json.
Requires commonwealth-requirements.txt; originals are never downloaded at app runtime.
"""
import copy, hashlib, importlib.util, json, math, pathlib, sys, subprocess
import cv2
import numpy as np
from PIL import Image
from lxml import etree as ET
from shapely import make_valid, set_precision, union_all
from shapely.geometry import Polygon, MultiPolygon, Point, GeometryCollection, shape, mapping
from shapely.ops import transform
from scipy.ndimage import binary_fill_holes
from pyproj import Geod
ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=pathlib.Path(sys.argv[1]); BASE=pathlib.Path(sys.argv[2])
PIN='da7a4b735ecef70aebdc9c73e409d8a2500d50f3'
assert subprocess.check_output(['git','-C',str(BASE),'rev-parse','HEAD'],text=True).strip()==PIN,'Unexpected Historical Basemaps checkout'
base_records={}
spec=importlib.util.spec_from_file_location('svg_transfer',ROOT/'scripts/build-frankish-atlas.py')
svg=importlib.util.module_from_spec(spec);spec.loader.exec_module(svg)
svg.PROJECTIONS={'eqc':'+proj=eqc +lat_ts=52 +datum=WGS84','mercator':'EPSG:3857','lcc':'+proj=lcc +lat_1=45 +lat_2=60 +lat_0=52 +lon_0=25 +datum=WGS84','laea':'+proj=laea +lat_0=52 +lon_0=25 +datum=WGS84'}
controls=json.loads((ROOT/'scripts/atlas/commonwealth-control-points.json').read_text())
sources=json.loads((ROOT/'scripts/atlas/commonwealth-sources.json').read_text())
fits={k:svg.fit(v) for k,v in controls.items()}
for key,(fn,report) in fits.items():
 report['holdoutKm']=[]
 for p in controls[key]['points']:
  if p['role']=='holdout':
   lon,lat=fn(p['x'],p['y']);_,_,d=Geod(ellps='WGS84').inv(lon,lat,p['lon'],p['lat']);report['holdoutKm'].append({'name':p['name'],'km':round(d/1000,2)})
 assert max(p['km'] for p in report['holdoutKm'])<45,(key,report)
for s in sources:
 assert hashlib.sha256((CACHE/s['file']).read_bytes()).hexdigest()==s['sha256'],s['file']
roots={str(i):ET.parse(str(CACHE/f'source-{i}.svg')) for i in [2,3,4,5,6]}
def polygon(g):
 g=make_valid(g)
 if g.geom_type in ['Polygon','MultiPolygon']:return g
 return union_all([polygon(p) for p in getattr(g,'geoms',[]) if p.geom_type in ['Polygon','MultiPolygon','GeometryCollection']])
def item(i,id):return roots[str(i)].xpath('//*[@id=$id]',id=id)[0]
def path(i,id):return polygon(transform(fits[str(i)][0],svg.path_polygon(item(i,id))))
def combine(*geoms):return polygon(union_all([g for g in geoms if not g.is_empty]))
def rounded(v):
 if isinstance(v,dict):return {k:rounded(x) for k,x in v.items()}
 if isinstance(v,(list,tuple)):return [rounded(x) for x in v]
 return round(float(v),5) if isinstance(v,(float,np.floating)) else v
features=[];frames=[]
def feature(g,id,name,subject,source_id,source_year,color,**extra):
 g=set_precision(polygon(g),.00001)
 if g.is_empty or g.area<.0001:return None
 if g.geom_type=='MultiPolygon':g=MultiPolygon(sorted(g.geoms,key=lambda p:-p.area))
 s=next((s for s in sources if s['sourceId']==source_id),None)
 return {'type':'Feature','id':id,'properties':{'name':name,'subject':subject,'precision':2,'detailed':True,'region':'commonwealth','sourceId':source_id,'sourceYear':source_year,'sourceUrl':s['descriptionUrl'] if s else ('https://ekmair.ukma.edu.ua/items/034b5e89-32c0-455f-ab27-e2bab5184ab3' if source_id=='pllt-zboriv' else f'https://github.com/aourednik/historical-basemaps/blob/{PIN}/geojson/world_{source_year}.geojson'),'color':color,**extra},'geometry':rounded(mapping(g))}
def frame(year,items,note):
 frames.append({'year':year,'note':note,'collection':{'type':'FeatureCollection','features':[f for f in items if f]}})
def base_geoms(year):
 source_bytes=(BASE/f'geojson/world_{year}.geojson').read_bytes();base_records[year]=hashlib.sha256(source_bytes).hexdigest();raw=json.loads(source_bytes);out={}
 for f in raw['features']:
  n=f['properties'].get('NAME','')
  if n not in ['Poland','Kingdom of Poland','Lithuania','Grand Duchy of Lithuania','Poland-Lithuania','Polish–Lithuanian Commonwealth']:continue
  g=f['geometry'];parts=[g['coordinates']] if g['type']=='Polygon' else g['coordinates'];clean=[]
  for part in parts:
   rings=[]
   for ring in part:
    xy=[p[:2] for p in ring]
    if len(set(tuple(p) for p in xy))>=3:rings.append(xy)
   if rings:clean.append(rings)
  out[n]=combine(out.get(n,GeometryCollection()),polygon(shape({'type':'MultiPolygon','coordinates':clean})))
 return out
# Reviewed geographic envelopes digitized against the 1569 map (1400px render).
# These are historical-land AREAS, not a claim to exact voivodeship boundaries.
# Their portions are clipped to each dated political geometry and made disjoint.
traces={
 'volhynia':[(521,754),(560,725),(598,710),(642,687),(702,683),(735,714),(779,741),(791,788),(816,821),(794,853),(760,874),(719,895),(690,916),(651,906),(615,917),(586,887),(553,873),(533,832),(522,792)],
 'belz':[(478,789),(521,754),(522,792),(533,832),(553,873),(527,887),(498,884),(474,865),(457,850)],
 'ruthenia':[(411,799),(457,850),(474,865),(498,884),(527,887),(553,873),(586,887),(615,917),(604,945),(619,975),(602,1008),(553,1013),(526,988),(492,981),(464,956),(425,938),(388,922),(378,888),(355,866),(373,840)],
 'podolia':[(615,917),(651,906),(690,916),(719,895),(760,910),(747,946),(755,979),(735,1005),(695,1005),(663,1018),(631,1006),(619,975),(604,945)],
 'bratslav':[(760,910),(793,894),(838,901),(883,906),(921,930),(913,973),(928,1007),(906,1040),(868,1042),(852,1078),(813,1062),(789,1039),(755,1018),(735,1005),(755,979),(747,946)],
 'kyiv':[(702,683),(760,674),(807,695),(849,720),(886,736),(922,734),(955,754),(1007,786),(1068,818),(1135,824),(1204,839),(1231,876),(1261,928),(1273,975),(1254,1020),(1215,1050),(1174,1055),(1130,1076),(1124,1100),(1061,1104),(1013,1067),(960,1060),(928,1007),(913,973),(921,930),(883,906),(838,901),(793,894),(760,910),(719,895),(760,874),(794,853),(816,821),(791,788),(779,741),(735,714)],
}
region_names={'volhynia':'Volhynia lands','belz':'Belz lands','ruthenia':'Ruthenian lands','podolia':'Podolian lands','bratslav':'Bratslav lands','kyiv':'Kyiv lands'}
region_geoms={k:polygon(transform(fits['2'][0],Polygon([(x*397.42371/1400,y*397.42371/1400) for x,y in p]))) for k,p in traces.items()}
# A common boundary is reused: the historical-land masks never create holes between states.
colors=['#d7b65d','#c29d6e','#d28565','#e7a864','#c7b36a','#a9c881']
def lands(year,states):
 result=[];used=GeometryCollection()
 for (key,mask),color in zip(region_geoms.items(),colors):
  for owner,g in states.items():
   part=polygon(mask.difference(used).intersection(g))
   if part.area<.025:continue
   result.append(feature(part,f'pllt-land-{year}-{key}-{owner}',region_names[key]+' — '+owner,owner,'pllt-1569',1569,color,layer='land',description='Оглядовий ареал історичної землі, оцифрований за картою 1569 р. та обрізаний датованим політичним контуром. Це не точний адміністративний кордон і не карта етнічних меж.',relation=owner))
  used=combine(used,mask)
 return result
# Early snapshots retain the original geographic coverage; no modern borders are backdated.
for year in [1000,1100,1200,1279,1300]:
 items=[]
 for n,g in base_geoms(year).items():items.append(feature(g,f'pllt-{year}-{n}','Kingdom of Poland' if 'Poland' in n else 'Grand Duchy of Lithuania','Poland' if 'Poland' in n else 'Lithuania','pllt-basemaps',year,'#cf8b8e' if 'Poland' in n else '#82af91',layer='state',description='Датований оглядовий зріз. У період роздробленості не відокремлено всі князівства.'))
 frame(year,items,'Датований оглядовий контур; уділи й зміни між зрізами не інтерполюються.')
# Raster 1387: texture-tolerant color classes, excluding the legend and adjacent states.
a=np.array(Image.open(CACHE/'source-0.png').convert('RGB')).astype('int16');r,g,b=a[:,:,0],a[:,:,1],a[:,:,2]
def raster(mask):
 mask[:550]=False;mask[:,700:]=False;mask[1100:]=False
 mask=cv2.morphologyEx(mask.astype('uint8'),cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
 n,labels,stats,_=cv2.connectedComponentsWithStats(mask)
 parts=[]
 for i in range(1,n):
  if stats[i,4]<1500:continue
  m=binary_fill_holes(labels==i).astype('uint8');cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
  parts.extend(Polygon(c[:,0,:]).simplify(1.2,preserve_topology=True) for c in cs if len(c)>3)
 return polygon(transform(fits['0'][0],combine(*parts)))
pl=raster((r>175)&(g<95)&(r-g>90)&(b<140))
pl_fief=raster((r>175)&(g<100)&(r-g>90)&(b>=140)).difference(pl)
lt=raster((r>180)&(g>90)&(g<190)&(r-g>45)&(g-b>4)).difference(pl).difference(pl_fief)
lt_relative=raster((r>180)&(g>90)&(g<175)&(r-g>60)&(abs(g-b)<9)).difference(lt)
frame(1387,[feature(pl,'pllt-1387-poland','Kingdom of Poland','Poland','pllt-1387',1387,'#cf8b8e',layer='state'),feature(lt,'pllt-1387-lithuania','Grand Duchy of Lithuania','Lithuania','pllt-1387',1387,'#82af91',layer='state'),feature(pl_fief,'pllt-1387-pl-fiefs','Polish Crown fiefs','Poland','pllt-1387',1387,'#b57e9e',layer='dependency',control='relative',relation='Ленні та залежні володіння за картою 1387 р.; не пряме управління Корони.'),feature(lt_relative,'pllt-1387-lt-fiefs','Lithuanian dependent lands','Lithuania','pllt-1387',1387,'#72a393',layer='dependency',control='relative',relation='Залежні землі за картою 1387 р.; ступінь контролю неоднаковий.'),*lands(1387,{'Poland':pl,'Lithuania':lt})],'Польща і ВКЛ — окремі держави в династичній унії. Зріз 1387 р.; геоприв’язка оглядова, не точні кордони 1430 р.')
whole1569=path(2,'path187993-4-9-3-3-0');duchy=path(2,'path187993-4-9-3-3-5');vassals=combine(path(2,'path13026-4'),path(2,'path16170'),path(2,'path12347-9'))
crown=polygon(whole1569.difference(duchy).difference(vassals))
livonia=combine(*[p for p in getattr(crown,'geoms',[crown]) if p.centroid.y>55.5])
crown=polygon(crown.difference(livonia))
# Before Lublin, Volhynia, Kyiv, Bratslav and Podlachia are assigned to Lithuania.
transferred=combine(region_geoms['volhynia'],region_geoms['kyiv'],region_geoms['bratslav'],polygon(transform(fits['2'][0],svg.path_polygon(item(2,'path48454-1')))))
pre_duchy=combine(duchy,transferred,Polygon([(29,51.15),(40,51.15),(40,60),(29,60)]))
for year in [1492,1500,1530]:
 total=combine(*base_geoms(year).values()).difference(livonia.buffer(.12)).difference(vassals)
 if year==1530:total=polygon(total.difference(path(5,'path187993-4-9-9').intersection(Polygon([(30.1,51.25),(38,51.25),(38,56),(30.1,56)]))))
 lg=polygon(total.intersection(pre_duchy));pg=polygon(total.difference(lg))
 frame(year,[feature(pg,f'pllt-{year}-poland','Kingdom of Poland','Poland','pllt-basemaps',year,'#cf8b8e',layer='state'),feature(lg,f'pllt-{year}-lithuania','Grand Duchy of Lithuania','Lithuania','pllt-basemaps',year,'#82af91',layer='state'),*lands(year,{'Poland':pg,'Lithuania':lg})],'Зовнішній датований контур Historical Basemaps; внутрішній поділ реконструйовано за картою 1569 р. з поверненням переданих у Любліні земель ВКЛ. Ареали українських земель оглядові.')
frame(1569,[feature(livonia,'pllt-1569-livonia','Livonia — joint Crown and Lithuania','Commonwealth','pllt-1569',1569,'#b2a0bd',layer='state'),feature(crown,'pllt-1569-crown','Crown of the Kingdom of Poland','Commonwealth','pllt-1569',1569,'#cf8b8e',layer='state'),feature(duchy,'pllt-1569-duchy','Grand Duchy of Lithuania in the Commonwealth','Commonwealth','pllt-1569',1569,'#82af91',layer='state'),feature(vassals,'pllt-1569-fiefs','Commonwealth fiefs','Commonwealth','pllt-1569',1569,'#a794c6',layer='dependency',control='relative',relation='Ленні володіння; не пряме управління Корони або ВКЛ.'),*lands(1569,{'Crown':crown})],'Люблінська унія: Корона й ВКЛ — складові Речі Посполитої; Волинь, Київщина та Брацлавщина належать Короні. Берестейщина й Пінщина залишилися у ВКЛ.')
frame(1600,[feature(combine(*base_geoms(1600).values()),'pllt-1600-commonwealth','Polish-Lithuanian Commonwealth','Commonwealth','pllt-basemaps',1600,'#c3a2b6',layer='state'),*lands(1600,{'Crown':combine(*base_geoms(1600).values())})],'Оглядовий зріз 1600 р.; українські землі позначено окремими ареалами.')
plc1618=path(3,'path2999');fiefs1618=combine(path(3,'rect3271'),path(3,'path4095'));plc1618=polygon(plc1618.difference(fiefs1618))
plc1655=path(4,'path187993');plc1667=polygon(path(5,'path187993-4-9').difference(path(5,'path187993-4-9-9')).difference(path(5,'path187993-4-9-9-2')))
plc1672=path(6,'path187993-4-9-2-2')
# The 1655 map's orange occupation contour is clipped to Commonwealth territory,
# removing pre-existing Swedish Livonia and the independent Duchy of Prussia.
swedish=polygon(path(4,'path22451').intersection(plc1655))
# Strongholds not captured by Sweden remain holes rather than being painted as occupied.
for lon,lat in [(18.6466,54.352),(19.036,50.812),(24.0316,49.8429),(23.251,50.723)]:
 swedish=polygon(swedish.difference(Point(lon,lat).buffer(.12)))
# Reviewed Ukrainian historical areas are excluded: the western military reach on this
# summary source must not imply Swedish administration of Lviv or all Ruthenia.
swedish=polygon(swedish.difference(combine(region_geoms['ruthenia'],region_geoms['belz'],region_geoms['volhynia'],region_geoms['podolia'],region_geoms['bratslav'],region_geoms['kyiv'])))
# Chernihiv is reconstructed from the 1667 source's northern ceded area, below the
# Lithuanian frontier and above the Kyiv land envelope. It is an approximate land area.
ceded=path(5,'path187993-4-9-9');cher=polygon(ceded.intersection(Polygon([(30.3,51.25),(34.7,50.8),(35.1,53.5),(31.0,53.6)])).difference(region_geoms['kyiv']))
region_geoms['chernihiv']=cher;region_names['chernihiv']='Chernihiv-Siverian lands';colors.append('#adbd7c')
hetman=combine(region_geoms['kyiv'],region_geoms['bratslav'],cher).intersection(plc1655)
moscow_occupation=polygon(path(4,'path32802').intersection(plc1655).difference(hetman).difference(combine(*region_geoms.values())))
leftbank=polygon(hetman.intersection(ceded).difference(Point(30.523,50.45).buffer(.12)))
def leftbank_feature(year):
 return feature(leftbank,f'pllt-{year}-leftbank','Left-Bank Hetmanate','Muscovy / Russian Empire','pllt-andrusovo',1667,'#72aeb3',layer='cossack',control='relative',validFrom=1667,validTo=1764,relation='Козацька автономія Лівобережжя під верховенством московського царя, з 1721 р. Російської імперії. Гетьманство скасовано 1764 р.; не пряме управління всіма українськими землями.')
for year,total,source,sourceyear in [(1618,plc1618,'pllt-1618',1618),(1629,plc1655,'pllt-deluge',1629),(1649,plc1655,'pllt-deluge',1629),(1651,plc1655,'pllt-deluge',1629),(1652,plc1655,'pllt-deluge',1629),(1654,plc1655,'pllt-deluge',1629),(1655,plc1655,'pllt-deluge',1629),(1658,plc1655,'pllt-deluge',1629),(1660,plc1655,'pllt-deluge',1629),(1667,plc1667,'pllt-andrusovo',1667),(1672,plc1672,'pllt-podolia',1672)]:
 items=[feature(total,f'pllt-{year}-commonwealth','Polish-Lithuanian Commonwealth','Commonwealth',source,sourceyear,'#c3a2b6',layer='state'),*lands(year,{'Crown':total})]
 if year in [1649,1651,1652,1654,1655,1658,1660]:items.append(feature(region_geoms['kyiv'].intersection(plc1655) if year==1651 else hetman,f'pllt-{year}-hetmanate','Cossack Hetmanate','Cossack Hetmanate','pllt-zboriv',1649,'#72aeb3',layer='cossack',control='relative',relation='Оглядова територія козацької автономії за Зборівською угодою 1649 р.; не щорічний фронт. У 1651–1652 її договірний обсяг змінювався.',description='Київське, Брацлавське й Чернігівське воєводства. З 1654 р. — протекція московського царя, зі збереженням козацьких установ; це не пряме московське управління всією територією.'))
 if year==1655:items.append(feature(swedish,'pllt-deluge-occupation','Swedish occupation — Deluge','Sweden','pllt-deluge',1655,'#417ac0',layer='occupation',control='relative',validFrom=1655,validTo=1657,relation='Основний сукупний ареал шведської окупації 1655–1657 рр., не одночасний контроль і не фронт кожного року. Незахоплені Гданськ, Ясна Гора, Замостя та Львів виключені.',description='Контур адаптовано з оглядової карти Потопу: обрізано юридичними межами Речі Посполитої та вилучено українські ареали, щоб не підміняти просування військ тривалим управлінням.'))
 if year in [1655,1658,1660]:items.append(feature(moscow_occupation,f'pllt-{year}-moscow-occupation','Muscovite wartime occupation','Muscovy','pllt-deluge',1655,'#9867b9',layer='occupation',control='relative',validFrom=1655,validTo=1661,relation='Основний сукупний ареал московського військового зайняття на північному сході Речі Посполитої, 1655–1661; не одночасний щорічний фронт. Козацьку автономію вилучено з цього ареалу.'))
 if year in [1667,1672]:items.append(leftbank_feature(year))
 if year==1667:items.append(feature(path(5,'path187993-4-9-9-2'),'pllt-1667-zaporizhia','Zaporizhia — joint suzerainty','Zaporizhia','pllt-andrusovo',1667,'#c29553',layer='dependency',control='relative',validFrom=1667,validTo=1685,relation='Спільне польсько-московське підпорядкування Запорожжя за Андрусівським перемир’ям; до 1686 р.'))
 if year==1672:
  pod=polygon(region_geoms['podolia'].difference(total));items.append(feature(pod,'pllt-1672-ottoman-podolia','Ottoman Podolia','Ottoman Empire','pllt-podolia',1672,'#ad9063',layer='occupation',control='relative',validFrom=1672,validTo=1699,relation='Поділля під османським управлінням 1672–1699 рр.; схематичний ареал, не вся Річ Посполита.'))
 frame(year,items,'Датований політичний контур та окремі історичні ареали. Козацька автономія й окупація позначені штрихом і не змінюють юридичний контур держави. У 1629 р. тло реконструйоване за довоєнними межами карти Потопу; після 1667 р. східні втрати враховано за картою Андрусівського перемир’я.')
for year in [1700,1715,1783]:
 total=combine(*base_geoms(year).values());frame(year,[feature(total,f'pllt-{year}-commonwealth','Polish-Lithuanian Commonwealth','Commonwealth','pllt-basemaps',year,'#c3a2b6',layer='state'),*lands(year,{'Crown':total}),*([] if year>1764 else [leftbank_feature(year)])],'Датований оглядовий зріз. Зріз 1783 р. уже враховує Перший поділ 1772 р.; зміни між зрізами не інтерполюються.')
frame(1795,[],'Після Третього поділу 1795 р. Річ Посполита припинила існування. Її попередній контур приховано; це не карта держав XIX ст.')
# The interwar Polish/Lithuanian states are separate again; no medieval GDL label.
for year in [1920,1930,1938,1945,1960,1994]:
 items=[]
 for n,g in base_geoms(year).items():
  modern='Republic of Poland' if 'Poland' in n else 'Republic of Lithuania'
  items.append(feature(g,f'pllt-{year}-{n}',modern,n,'pllt-basemaps',year,'#cf8b8e' if 'Poland' in n else '#82af91',layer='state',description='Датований оглядовий зріз XX ст.; не середньовічна держава. Зрізи 1945 і 1960 можуть не виділяти Литовську РСР у складі СРСР.'))
 frame(year,items,'Датований зріз XX ст. Карта 1938 р. не є картою окупації 1939–1944 рр.; у воєнні роки цей шар приховується.')
out=ROOT/'public/atlas/commonwealth';out.mkdir(parents=True,exist_ok=True)
text=json.dumps({'frames':frames},ensure_ascii=False,separators=(',',':'))+'\n';(out/'frames.json').write_text(text)
manifest={'method':'Pinned source political SVG contours; projected affine city-marker registration; 1387 color-mask tracing. Historical-land envelopes are manually reviewed source-image traces, not precise administrative/ethnic borders. No annual interpolation. Occupation is a clipped cumulative 1655–1657 footprint, not a daily/annual front.','sha256':hashlib.sha256(text.encode()).hexdigest(),'basemapCommit':PIN,'basemapSha256':base_records,'sources':sources,'registration':{k:v[1] for k,v in fits.items()},'years':[f['year'] for f in frames]}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(len(frames),'frames',len(text.encode()),'bytes')
