#!/usr/bin/env python3
"""Digitize user-supplied Lucius maps. NOT run during app build.
Usage: python scripts/build-byzantine-atlas.py /absolute/path/to/extracted/PNGs
Offline dependencies: Pillow, numpy, scipy, opencv-python-headless, shapely.
No invented borders: trace the raster's colored areas in its fitted conic CRS.
"""
import argparse
import hashlib
import json
import math
import re
from io import BytesIO
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from shapely.geometry import Polygon, MultiPolygon, mapping
from shapely.validation import make_valid
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / "scripts/atlas/byzantine-control-points.json").read_text())
ORIGINALS = json.loads((ROOT / "scripts/atlas/byzantine-originals.json").read_text())
OUT = ROOT / "public/atlas/byzantium"
YEARS = [395,450,476,565,592,622,630,641,668,717,775,813,842,867,927,959,969,975,1000,1025,1045,1059,1081,1118,1143,1155,1180,1203,1205,1230,1254,1262,1328,1340,1354,1400,1403,1445,1453]

def image(path):
    original = Image.open(path).convert("RGBA")
    return np.array(Image.alpha_composite(Image.new("RGBA", original.size, "white"), original).convert("RGB"))

def group(year):
    if year <= 592: return "byzantine-map-395-en.png"
    if year <= 668: return "byzantine-map-622-en.png"
    if year <= 775: return "byzantine-theme-map-717-en.png"
    if year == 813: return "byzantine-theme-map-813-en.png"
    if year <= 1203: return "byzantine-theme-map-1025-en.png"
    return "byzantine-map-1453-en.png"

ORB = cv2.ORB_create(nfeatures=14000, edgeThreshold=15, fastThreshold=5)
def river_keypoints(a):
    a = cv2.resize(a, None, fx=.5, fy=.5)
    r,g,b = cv2.split(a.astype(np.int16))
    mask = ((r < 150) & (g-r > 20) & (b-g > 20)).astype("uint8") * 255
    return ORB.detectAndCompute(mask, None)

def register(base, target):
    ka, da = base; kb, db = target
    matches = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(da, db, k=2)
    good = [m for m,n in matches if m.distance < .7*n.distance]
    a = np.float32([ka[m.queryIdx].pt for m in good]); b = np.float32([kb[m.trainIdx].pt for m in good])
    # Deterministic partition: independent check against withheld blue coast/river keypoints.
    train = np.arange(len(a)) % 5 != 0
    matrix, inliers = cv2.estimateAffinePartial2D(a[train], b[train], method=cv2.RANSAC, ransacReprojThreshold=1, maxIters=5000)
    if matrix is None or int(inliers.sum()) < 30: raise ValueError("Insufficient registration matches")
    errors = np.linalg.norm(a @ matrix[:,:2].T + matrix[:,2] - b, axis=1) * 2
    held = errors[~train]; consensus = held[held <= 2]
    if len(consensus) < 10: raise ValueError("Insufficient held-out coastline consensus")
    rms = float(np.sqrt(np.mean(consensus**2)))
    if rms > 1.8: raise ValueError(f"Registration residual too high: {rms}")
    matrix[:,2] *= 2
    return matrix, {"matches":len(good), "trainingInliers":int(inliers.sum()), "heldoutMatches":len(held), "heldoutConsensus":len(consensus), "heldoutConsensusRmsPixels":round(rms,4), "heldoutOutliers":int((held>2).sum()), "note":"ORB river/coast matches; RANSAC similarity transform. RMS covers consensus matches only, not all mismatches or historical border accuracy."}

def inverse_conic(x,y,config):
    p = config["parameters"]
    if config["model"] == "conic6":
        xc,yc,n,rot,A,B = p
        u=x-xc; v=y-yc; rho=np.hypot(u,v)
        lat=np.degrees((A-rho)/B); lon=config["centralMeridian"]+np.degrees((np.arctan2(u,v)-rot)/n)
    else:
        a,b,n,A,B,C,D,ox,oy = p
        det=A*D-B*C; u=(D*(x-ox)-B*(y-oy))/det; v=(-C*(x-ox)+A*(y-oy))/det+a
        lat=40+np.degrees((a-np.hypot(u,v))/b); lon=28+np.degrees(np.arctan2(u,v)/n)
    return lon,lat

def forward_conic(lon,lat,config):
    p = config["parameters"]
    if config["model"] == "conic6":
        xc,yc,n,rot,A,B=p; theta=rot+n*np.radians(lon-config["centralMeridian"]);rho=A-B*np.radians(lat)
        return xc+rho*np.sin(theta),yc+rho*np.cos(theta)
    a,b,n,A,B,C,D,ox,oy=p;theta=np.radians(lon-28)*n;rho=a-b*np.radians(lat-40)
    u=rho*np.sin(theta);v=rho*np.cos(theta)-a
    return ox+A*u+B*v,oy+C*u+D*v

def geometries(mask, matrix, config, classified):
    contours, hierarchy=cv2.findContours(mask,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None: return None,0
    hierarchy=hierarchy[0];polygons=[];vertices=0
    def ring(c):
        nonlocal vertices
        pts=cv2.approxPolyDP(c,1.25,True).reshape(-1,2).astype(float)
        if len(pts)<3: return None
        base=(pts-matrix[:,2])@np.linalg.inv(matrix[:,:2]).T
        lon,lat=inverse_conic(base[:,0],base[:,1],config)
        coords=np.round(np.column_stack((lon,lat)),5).tolist();coords.append(coords[0]);vertices+=len(coords)
        return coords
    def polygon_parts(shape):
        if isinstance(shape, Polygon): return [shape]
        if hasattr(shape, "geoms"): return [p for part in shape.geoms for p in polygon_parts(part)]
        return []
    for i,c in enumerate(contours):
        parent=hierarchy[i][3];depth=0
        while parent>=0:depth+=1;parent=hierarchy[parent][3]
        # 12 px^2 removes text-color specks; this is a raster threshold, not a claim that all tiny islands are present.
        if depth%2 or cv2.contourArea(c)<12:continue
        exterior=ring(c)
        if not exterior:continue
        holes=[];child=hierarchy[i][2]
        while child>=0:
            # Remove typography voids; retain larger uncolored enclaves and water bodies.
            area=cv2.contourArea(contours[child])
            preserve=area>=5000
            if 240<=area<5000:
                x,y,w,h=cv2.boundingRect(contours[child]);local=np.zeros((h,w),dtype=np.uint8)
                cv2.drawContours(local,[contours[child]-[x,y]],-1,255,-1)
                colors=classified[y:y+h,x:x+w][local>0].astype(int)
                # A source-water color is evidence of a lake; white label halos are not.
                water=(colors[:,2]-colors[:,0]>20)&(colors[:,1]-colors[:,0]>8)
                preserve=float(water.mean())>.4
            if preserve:
                hole=ring(contours[child])
                if hole:holes.append(hole)
            child=hierarchy[child][0]
        shape=make_valid(Polygon(exterior,holes))
        polygons.extend(polygon_parts(shape))
    # Filled text voids can contain nested colored islands; union same-polity parts
    # so duplicate shells cannot cut false holes when rendered with SVG even-odd fill.
    result=unary_union(polygons) if polygons else None
    if result is not None and not result.is_valid: raise ValueError("Invalid output topology")
    return (mapping(result) if result is not None else None),vertices

def sha(data):return hashlib.sha256(data).hexdigest()
def write(path,data):
    raw=(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n").encode()
    path.write_bytes(raw);return {"path":str(path.relative_to(ROOT/"public")),"sha256":sha(raw),"bytes":len(raw)}

def raster(a,matrix,config,path):
    h,w=a.shape[:2];edge=[]
    # Bounds include curved edges; using only 4 corners would crop source content.
    for t in np.linspace(24,w-25,120):edge.extend([[t,24],[t,h-25]])
    for t in np.linspace(24,h-25,80):edge.extend([[24,t],[w-25,t]])
    edge=(np.array(edge)-matrix[:,2])@np.linalg.inv(matrix[:,:2]).T
    lo,la=inverse_conic(edge[:,0],edge[:,1],config);west,east=float(lo.min()),float(lo.max());south,north=float(la.min()),float(la.max())
    merc=lambda lat:np.log(np.tan(np.pi/4+np.radians(lat)/2))
    top,bottom=merc(north),merc(south);width=3200;height=round(width*(top-bottom)/np.radians(east-west))
    xs=np.linspace(west,east,width,dtype=np.float32);ys=np.degrees(2*np.arctan(np.exp(np.linspace(top,bottom,height,dtype=np.float32)))-np.pi/2)
    gridlon,gridlat=np.meshgrid(xs,ys);bx,by=forward_conic(gridlon,gridlat,config)
    sx=matrix[0,0]*bx+matrix[0,1]*by+matrix[0,2];sy=matrix[1,0]*bx+matrix[1,1]*by+matrix[1,2]
    rgba=np.dstack((a,np.full((h,w),255,dtype=np.uint8)))
    rgba[:25,:,3]=0;rgba[-25:,:,3]=0;rgba[:,:25,3]=0;rgba[:,-25:,3]=0
    # The source legend is shown in the unwarped original, not mistaken for geographic color swatches.
    rgba[:int(h*.27),int(w*.79):,3]=0
    result=cv2.remap(rgba,sx.astype('float32'),sy.astype('float32'),cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=(0,0,0,0))
    buffer=BytesIO();Image.fromarray(result).save(buffer,"WEBP",quality=88,method=5)
    raw=buffer.getvalue()
    temporary=path.with_suffix(".webp.tmp");temporary.write_bytes(raw);temporary.replace(path)
    return {"path":str(path.relative_to(ROOT/"public")),"bounds":[[round(south,6),round(west,6)],[round(north,6),round(east,6)]],"width":width,"height":height,"sha256":sha(raw),"bytes":len(raw)}

def main():
    parser=argparse.ArgumentParser();parser.add_argument("source",type=Path);parser.add_argument("--no-raster",action="store_true");parser.add_argument("--reuse-raster",action="store_true");args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True);refs={};frames=[];manifest=[]
    old_frames={};old_records={}
    if args.reuse_raster and (OUT/"frames.json").exists():
        old_frames={f['year']:f for f in json.loads((OUT/"frames.json").read_text())['frames']}
        old_records={f['year']:f for f in json.loads((OUT/"manifest.json").read_text())['frames']}
    for year in YEARS:
        matches=list(args.source.glob(f"byzantine*-{year}-en.png"))
        if len(matches)!=1:raise ValueError(f"Expected exactly one source for {year}")
        path=matches[0];a=image(path);base=group(year)
        if base not in CONFIG:raise ValueError(f"Missing grid reference: {base}")
        if base not in refs:refs[base]=river_keypoints(image(args.source/base))
        if year in old_records:matrix=np.array(old_records[year]['similarityMatrix']);registration=old_records[year]['registration']
        elif path.name==base:matrix=np.array([[1.,0,0],[0,1.,0]]);registration={"reference":True}
        else:matrix,registration=register(refs[base],river_keypoints(a))
        config=CONFIG[base];h,w=a.shape[:2];features=[];previous=np.zeros((h,w),dtype=bool)
        # Suppress typography and grey grid lines only in the classification image.
        # Blue rivers/coastlines are kept. The displayed raster remains unaltered.
        lo=a.min(axis=2);hi=a.max(axis=2);r,g,b=cv2.split(a)
        ink=(hi<180)|((hi.astype(int)-lo.astype(int)<12)&(lo<242))|((r>70)&(g<100)&(b<140))
        classified=cv2.inpaint(a,ink.astype('uint8')*255,3,cv2.INPAINT_TELEA)
        main="Empire of Nicaea" if 1205<=year<=1254 else "Eastern Roman Empire" if year<476 else "Byzantine Empire"
        classes=[(main,[243,203,218],26)]
        if 717<=year<=813:classes.append(("Byzantine-Arab condominium",[248,224,233],13))
        if year>=1205:
            classes.extend([("Empire of Trebizond",[210,243,190],22)])
            if year<=1328:classes.append(("Empire of Thessalonica" if year==1230 else "Despotate of Epirus",[243,242,140],24))
            if year>=1328:classes.append(("Principality of Theodoro",[197,193,255],24))
        total=0
        for name,color,tolerance in classes:
            dist=np.sqrt(np.sum((classified.astype(np.float32)-color)**2,axis=2));mask=(dist<tolerance)&~previous
            mask[:25]=False;mask[-25:]=False;mask[:,:25]=False;mask[:,-25:]=False
            mask[:int(h*.27),int(w*.79):]=False
            mask=cv2.morphologyEx(mask.astype('uint8')*255,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8));mask[previous]=0;previous|=mask>0
            geometry,count=geometries(mask,matrix,config,classified)
            if not geometry:continue
            features.append({"type":"Feature","id":f"lucius-{year}-{len(features)}","properties":{"name":name,"subject":name,"precision":2,"detailed":True,"sourceYear":year},"geometry":geometry});total+=count
        if not features:raise ValueError(f"No territories for {year}")
        source_url=ORIGINALS[path.name]
        # Exact downloadable originals are linked via the author's index; filenames/hash pin our uploaded copy.
        frame={"year":year,"sourceFilename":path.name,"sourceUrl":source_url,"collection":{"type":"FeatureCollection","features":features}}
        if not args.no_raster:
            old=old_frames.get(year,{}).get('raster');raster_path=OUT/f"detail-{year}.webp"
            if old and raster_path.exists() and sha(raster_path.read_bytes())==old['sha256']:frame['raster']=old
            else:frame["raster"]=raster(a,matrix,config,raster_path)
        frames.append(frame)
        manifest.append({"year":year,"sourceFilename":path.name,"sourceSha256":sha(path.read_bytes()),"sourceSize":[w,h],"gridReference":base,"similarityMatrix":matrix.tolist(),"registration":registration,"vertices":total,"polities":[f["properties"]["name"]for f in features],"raster":frame.get("raster")})
        print(year,len(features),total,frame.get('raster',{}).get('bytes',0),flush=True)
    vector=write(OUT/"frames.json",{"source":"User-supplied Lucius PNG archive; ©Lucius, All Rights Reserved","frames":frames})
    write(OUT/"manifest.json",{"generatedAt":"2026-10-12","source":"https://lucius-note.net/byzantium/","copyright":"©Lucius; no open license asserted. These are adaptations of user-supplied maps, separate from the GPL overview data.","method":"Printed graticule conic fit → independent blue-river/coast similarity registration → typography suppression in classification copy only → colored-area contour tracing → inverse conic transform → GeoJSON WGS84. Original annotations also remapped to Web Mercator.","contourTolerancePixels":1.25,"typographyInpaintRadiusPixels":3,"closingKernelPixels":3,"minimumIslandAreaPixels":12,"minimumWaterHoleAreaPixels":240,"minimumNonWaterHoleAreaPixels":5000,"waterHoleColorFraction":0.4,"limitations":"Raster color segmentation can miss small islands, cut-outs and labels at narrow borders. Geographic fitting residual is NOT historical accuracy. Original dated sources remain available. No interpolation between years.","references":CONFIG,"vector":vector,"frames":manifest})

if __name__=="__main__":main()
