#!/usr/bin/env python3
"""Offline vector transfer; not part of the application build.
Usage: python scripts/build-frankish-atlas.py /path/to/frankish-reference
Requires numpy, scipy, pyproj, svgpathtools, shapely, lxml.
No annual interpolation. Source curves, transforms, holes and sea masks retained.
"""
import argparse, hashlib, json, math, re, shutil
from pathlib import Path
import numpy as np
from lxml import etree as ET
from pyproj import Transformer
from svgpathtools import parse_path
from shapely.geometry import Polygon, MultiPolygon, GeometryCollection, box, mapping
from shapely.ops import unary_union, transform as geometry_transform
from shapely.validation import make_valid
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/atlas/franks'
SVG='{http://www.w3.org/2000/svg}'
PROJECTIONS={
 'equirectangular': '+proj=eqc +lat_ts=48 +datum=WGS84',
 'mercator': 'EPSG:3857',
 'lambert-conformal-conic': '+proj=lcc +lat_1=43 +lat_2=52 +lat_0=48 +lon_0=6 +datum=WGS84',
 'lambert-azimuthal-equal-area': '+proj=laea +lat_0=48 +lon_0=6 +datum=WGS84',
 'transverse-mercator': '+proj=tmerc +lat_0=48 +lon_0=6 +datum=WGS84',
}
def matrix(text):
 m=np.eye(3)
 for name,raw in re.findall(r'(\w+)\(([^)]+)\)',text or ''):
  a=[float(n) for n in re.findall(r'[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?',raw)];t=np.eye(3)
  if name=='translate': t[:2,2]=[a[0],a[1] if len(a)>1 else 0]
  elif name=='scale': t[0,0]=a[0];t[1,1]=a[1] if len(a)>1 else a[0]
  elif name=='matrix':t=np.array([[a[0],a[2],a[4]],[a[1],a[3],a[5]],[0,0,1]])
  elif name=='rotate':
   c,s=math.cos(math.radians(a[0])),math.sin(math.radians(a[0]));t=np.array([[c,-s,0],[s,c,0],[0,0,1]])
   if len(a)==3:
    t=matrix(f'translate({a[1]},{a[2]})')@t@matrix(f'translate({-a[1]},{-a[2]})')
  else: raise ValueError(f'Unsupported SVG transform: {name}')
  m=m@t
 return m

def element_matrix(e):
 chain=list(e.iterancestors())[::-1]+[e];m=np.eye(3)
 for node in chain:m=m@matrix(node.get('transform'))
 return m

def polygonal(g):
 g=make_valid(g)
 if isinstance(g,(Polygon,MultiPolygon)):return g
 return unary_union([x for x in getattr(g,'geoms',[]) if isinstance(x,(Polygon,MultiPolygon))])

def path_polygon(e):
 m=element_matrix(e);rings=[]
 for sub in parse_path(e.get('d')).continuous_subpaths():
  pts=[]
  for seg in sub:
   # Flatten each Bézier/arc at <=1 source-unit chord spacing, then simplify <=0.2px.
   n=max(1,math.ceil(seg.length(error=1e-3)))
   for j in range(n):
    z=seg.point(j/n);p=m@np.array([z.real,z.imag,1]);pts.append((p[0],p[1]))
  if len(pts)<3:continue
  z=sub[-1].end;p=m@np.array([z.real,z.imag,1]);pts.append((p[0],p[1]));pts.append(pts[0]);rings.append(Polygon(pts))
 # SVG even-odd or oppositely oriented nested rings: preserve holes; disjoint rings remain islands.
 result=GeometryCollection()
 for ring in sorted(rings,key=lambda p:p.area,reverse=True):
  r=polygonal(ring)
  if not r.is_empty:result=result.symmetric_difference(r) if result.covers(r.representative_point()) else result.union(r)
 return polygonal(result).simplify(.2,preserve_topology=True)

def fit(group):
 points=group['points'];train=[p for p in points if p['role']=='fit'];held=[p for p in points if p['role']=='holdout'];models=[]
 for name,crs in PROJECTIONS.items():
  t=Transformer.from_crs('EPSG:4326',crs,always_xy=True)
  def pmat(ps):
   xy=np.array(t.transform([p['lon'] for p in ps],[p['lat'] for p in ps])).T/100000
   return np.c_[xy,np.ones(len(ps))]
  target=np.array([[p['x'],p['y']] for p in train]);A=np.linalg.lstsq(pmat(train),target,rcond=None)[0]
  errs=np.linalg.norm(pmat(train)@A-target,axis=1)
  models.append((float(np.sqrt(np.mean(errs**2))),name,crs,A,pmat(held)@A))
 rms,name,crs,A,pred=min(models,key=lambda x:x[0]);H=np.linalg.norm(pred-[[p['x'],p['y']] for p in held],axis=1)
 # Affine inverse in the fitted projected coordinate space.
 full=np.array([[A[0,0],A[1,0],A[2,0]],[A[0,1],A[1,1],A[2,1]],[0,0,1]])
 inv=np.linalg.inv(full);back=Transformer.from_crs(crs,'EPSG:4326',always_xy=True)
 def unproject(x,y,z=None):
  a=np.asarray(x);b=np.asarray(y);xx=inv[0,0]*a+inv[0,1]*b+inv[0,2];yy=inv[1,0]*a+inv[1,1]*b+inv[1,2]
  return back.transform(xx*100000,yy*100000)
 report={'model':name,'crs':crs,'affineProjected100kmToSvg':A.tolist(),'fitRmsSourceUnits':round(rms,3),'holdoutRmsSourceUnits':round(float(np.sqrt(np.mean(H**2))),3),'holdoutMaxSourceUnits':round(float(max(H)),3),'fittingPoints':len(train),'heldOutPoints':len(held),'holdouts':[{'name':p['name'],'residualSourceUnits':round(float(err),3)} for p,err in zip(held,H)],'warning':'Registration residual describes source alignment, not historical boundary accuracy. Modern city centres differ from medieval markers; shoreline references are approximate.'}
 return unproject,report

def feature(g,name,year,index,source,color):
 geo=geometry_transform(source['unproject'],polygonal(g));geo=polygonal(geo)
 if geo.is_empty:raise ValueError(f'Empty territory {name}')
 def rounded(value):
  if isinstance(value,(list,tuple)):return [rounded(x) for x in value]
  return round(value,5) if isinstance(value,float) else value
 return {'type':'Feature','id':f'franks-{year}-{index}','properties':{'name':name,'subject':name,'precision':2,'detailed':True,'region':'franks','sourceYear':year,'sourceId':source['sourceId'],'color':color},'geometry':rounded(dict(mapping(geo)))}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('source_directory',type=Path);args=ap.parse_args();src=args.source_directory
 controls=json.loads((ROOT/'scripts/atlas/frankish-control-points.json').read_text());catalog=json.loads((ROOT/'scripts/atlas/frankish-originals.json').read_text());OUT.mkdir(parents=True,exist_ok=True);(OUT/'originals').mkdir(exist_ok=True)
 fits={k:fit(v) for k,v in controls.items()};manifest={'generatedAt':'2026-10-13','method':'Direct SVG political paths; ancestor transforms; <=1 source-unit curve sampling, <=0.2 source-unit topology-preserving simplification; sea masks; projected affine registration. No interpolation.','registration':{k:v[1] for k,v in fits.items()},'frames':[],'originals':[]};frames=[]
 available={d['file']:d for d in catalog if d['available'] and d['file']!='Frankish_Empire_481_to_814-en.svg'}
 for file,d in available.items():
  b=(src/file).read_bytes();assert hashlib.sha256(b).hexdigest()==d['sha256'];shutil.copyfile(src/file,OUT/'originals'/file);manifest['originals'].append(d)
 def root(file):return ET.parse(str(src/file)).getroot()
 def item(r,id):return r.xpath('//*[@id=$id]',id=id)[0]
 def frame(file,year,features,sourceid):
  d=available[file];f={'year':year,'sourceFilename':file,'sourceUrl':d['descriptionUrl'],'originalPath':f'atlas/franks/originals/{file}','author':d['author'],'license':d['license'],'sourceId':sourceid,'collection':{'type':'FeatureCollection','features':features}};frames.append(f);manifest['frames'].append({'year':year,'file':file,'sourceId':sourceid,'features':len(features),'vertices':sum(len(re.findall(r'\d+\.\d+',json.dumps(x['geometry'])))//2 for x in features)})
 file='Frankish_Empire_481_to_814-fr.svg';r=root(file);growth=['layer27','layer8','layer6','layer5','layer4'];current=GeometryCollection()
 for year,layer in zip([481,511,614,768,814],growth):
  g=unary_union([path_polygon(e) for e in item(r,layer).iter(SVG+'path') if e.get('d')]);current=unary_union([current,g]);source={'unproject':fits['growth'][0],'sourceId':'fr-growth'};features=[feature(current,'Frankish realms' if year<800 else 'Carolingian Empire',year,0,source,'#d5e8c0')]
  if year==814:
   v=unary_union([path_polygon(e) for e in item(r,'layer3').iter(SVG+'path') if e.get('d')]).difference(current);features.append(feature(v,'Frankish dependent territories',year,1,source,'#eff4dc'))
  frame(file,year,features,'fr-growth')
 file='Le_royaume_des_Francs_en_561.svg';r=root(file);source={'unproject':fits['merovingian'][0],'sourceId':'fr-561'};features=[]
 for color,name,newcolor in [('#00ff00','Kingdom of Orleans','#d5e8c0'),('#ff55dd','Kingdom of Paris','#f3cbda'),('#0000ff','Kingdom of Reims','#d5d9f1'),('#ff7f00','Kingdom of Soissons','#f4dfbd')]:
  paths=[e for e in item(r,'layer5').iter(SVG+'path') if f'fill:{color};' in e.get('style','')];g=unary_union([path_polygon(e) for e in paths]);features.append(feature(g,name,561,len(features),source,newcolor))
 frame(file,561,features,'fr-561')
 late_names={843:{'#f1b6da':('Middle Francia','#f3cbda'),'#fee08b':('Papal States','#f3edbc'),'#d73027':('West Francia','#f4d5c0'),'#91cf60':('East Francia','#d5e8c0'),'#fc8d59':('Disputed Aquitaine','#f6e7c7')},870:{'#e9a3c9':('Kingdom of Italy','#f3cbda'),'#e9ddaf':('Papal States','#f3edbc'),'#fc8d59':('West Francia','#f4d5c0'),'#91cf60':('East Francia','#d5e8c0')},881:{'#e9a3c9':("Charles III's realms",'#f3cbda'),'#e9ddaf':('Papal States','#f3edbc'),'#d73027':('West Francia — Carloman II','#f4d5c0'),'#91cf60':('East Francia','#d5e8c0'),'#fc8d59':('Lower Burgundy','#f6e7c7'),'#af8dc3':('West Francia — Louis III','#e7d8f0')},888:{'#f1b6da':('Kingdom of Italy','#f3cbda'),'#fee08b':('Papal States','#f3edbc'),'#d73027':('West Francia','#f4d5c0'),'#91cf60':('East Francia','#d5e8c0'),'#fc8d59':('Lower Burgundy','#f6e7c7'),'#9970ab':('Upper Burgundy','#e7d8f0')}}
 for year in [843,870,881,888]:
  file=f'Carolingian_empire_{year}.svg';r=root(file);source={'unproject':fits['late'][0],'sourceId':f'fr-{year}'}
  sea_layer=next(e for e in r.iter(SVG+'g') if e.get('{http://www.inkscape.org/namespaces/inkscape}label')=='Mar');sea=unary_union([path_polygon(e) for e in sea_layer.iter(SVG+'path') if e.get('d')]);territory=next(e for e in r.iter(SVG+'g') if (e.get('{http://www.inkscape.org/namespaces/inkscape}label') or '') in ('Territorios 1','Territorios','Europa 1'));features=[]
  for e in territory.iter(SVG+'path'):
   if not re.search(r'fill:#[a-fA-F0-9]{6}',e.get('style','')):continue
   color=re.search(r'fill:(#[a-fA-F0-9]{6})',e.get('style','')).group(1).lower();assert color in late_names[year],(year,e.get('id'),color);name,newcolor=late_names[year][color];g=path_polygon(e)
   if year==843 and name=='Disputed Aquitaine':
    # Orange is the painted band surrounding disputed Aquitaine, not a tiny separate state.
    polys=[g] if isinstance(g,Polygon) else list(g.geoms);g=unary_union([Polygon(p.exterior) for p in polys])
   g=g.difference(sea).intersection(box(0,0,float(r.get('width')),float(r.get('height'))));features.append(feature(g,name,year,len(features),source,newcolor))
  # Painted dispute overlay: keep one selectable polity per position.
  if year==843:
   aq=next(f for f in features if f['properties']['name']=='Disputed Aquitaine')
   from shapely.geometry import shape
   west=next(f for f in features if f['properties']['name']=='West Francia');west['geometry']=dict(mapping(polygonal(shape(west['geometry']).difference(shape(aq['geometry'])))))
  # Respect SVG painting order (e.g. Papal States painted over imperial territory).
  from shapely.geometry import shape
  for i in range(len(features)-1,-1,-1):
   higher=unary_union([shape(f['geometry']) for f in features[i+1:]])
   features[i]['geometry']=dict(mapping(polygonal(shape(features[i]['geometry']).difference(higher))))
  frame(file,year,features,f'fr-{year}')
 frames.sort(key=lambda f:f['year']);text=json.dumps({'frames':frames},ensure_ascii=False,separators=(',',':'))+'\n';(OUT/'frames.json').write_text(text);manifest['data']={'path':'frames.json','bytes':len(text.encode()),'sha256':hashlib.sha256(text.encode()).hexdigest()};(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'frames':len(frames),'bytes':len(text.encode()),'registration':manifest['registration']},indent=2))
if __name__=='__main__':main()
