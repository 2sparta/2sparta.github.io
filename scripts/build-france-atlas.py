"""Build France snapshots from pinned source polygons, preserving rings and islands.
Usage: python scripts/build-france-atlas.py /path/to/historical-basemaps
The source checkout must match PIN; no geometry interpolation or new boundaries.
"""
import copy, hashlib, json, pathlib, subprocess, sys
from shapely.geometry import shape, mapping
from shapely import make_valid, union_all, set_precision
ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = pathlib.Path(sys.argv[1])
PIN = subprocess.check_output(['git', '-C', str(SOURCE), 'rev-parse', 'HEAD'], text=True).strip()
EXPECTED = 'da7a4b735ecef70aebdc9c73e409d8a2500d50f3'
if PIN != EXPECTED:
    raise SystemExit(f'Expected {EXPECTED}, got {PIN}')
YEARS = [843, 870, 881, 888, 1000, 1100, 1200, 1279, 1300, 1400, 1492, 1500, 1530, 1600, 1650, 1700, 1715, 1783, 1800, 1815, 1878, 1880, 1900, 1914, 1920, 1930, 1938, 1945, 1960, 1994]
def clean_geometry(g):
    # Remove invalid zero-area rings and extra source ordinates before GEOS.
    raw_parts = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
    parts = []
    for part in raw_parts:
        rings = []
        for i, ring in enumerate(part):
            xy = [[round(p[0], 6), round(p[1], 6)] for p in ring]
            if len(set(tuple(p) for p in xy)) < 3:
                if i == 0: break
                continue
            if xy[-1] != xy[0]: xy.append(xy[0])
            rings.append(xy)
        if rings and len(set(tuple(p[:2]) for p in part[0])) >= 3: parts.append(rings)
    geom = make_valid(shape({'type': 'MultiPolygon', 'coordinates': parts}))
    def polygons(g):
        if g.geom_type == 'Polygon': return [g]
        return [p for c in getattr(g, 'geoms', []) for p in polygons(c)]
    result = set_precision(union_all(polygons(geom)), 0.000001)
    return mapping(result)
frames, records = [], []
for year in YEARS:
    if year < 1000:
        path = ROOT / 'public/atlas/franks/frames.json'
        raw = path.read_bytes()
        frame = next(f for f in json.loads(raw)['frames'] if f['year'] == year)
        features = [copy.deepcopy(f) for f in frame['collection']['features'] if f['properties']['name'].startswith('West Francia') or f['properties']['name'] == 'Disputed Aquitaine']
        source_url = frame['sourceUrl']
        source_id = frame['sourceId']
    else:
        path = SOURCE / f'geojson/world_{year}.geojson'
        raw = path.read_bytes()
        features = []
        for f in json.loads(raw)['features']:
            p = f['properties']
            if p.get('NAME') not in ['France', 'Kingdom of France']:
                continue
            g = f['geometry']
            parts = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
            # Select whole European components. Never cut coastlines or join remote colonies.
            parts = [part for part in parts if any(-7 <= xy[0] <= 18 and 40 <= xy[1] <= 53 for xy in part[0])]
            if not parts:
                continue
            features.append({'type': 'Feature', 'geometry': {'type': 'MultiPolygon', 'coordinates': parts}, 'properties': {'name': p['NAME'], 'subject': 'France', 'precision': int(p.get('BORDERPRECISION') or 1)}})
        source_url = f'https://github.com/aourednik/historical-basemaps/blob/{PIN}/geojson/world_{year}.geojson'
        source_id = 'france-basemaps'
    if not features:
        raise ValueError(f'No France geometry for {year}')
    # Merge multiple records of the same polity into one multipart country.
    grouped = {}
    for f in features:
        f['geometry'] = clean_geometry(f['geometry'])
        name = f['properties']['name']
        if name in grouped:
            grouped[name]['geometry'] = mapping(union_all([shape(grouped[name]['geometry']), shape(f['geometry'])]))
        else: grouped[name] = f
    features = list(grouped.values())
    for i, f in enumerate(features):
        f['id'] = f'france-{year}-{i}'
        f['properties'].update(region='france', sourceYear=year, sourceId=source_id, sourceUrl=source_url, color='#527ab7', description='Датований оглядовий зріз Франції в Європі. Показано останній доступний зріз, без інтерполяції. Королівський домен, васальні володіння та фактичний контроль у середньовічному джерелі можуть не розрізнятися. Колонії не включено.')
    frames.append({'year': year, 'sourceUrl': source_url, 'sourceId': source_id, 'collection': {'type': 'FeatureCollection', 'features': features}})
    records.append({'year': year, 'sourceSha256': hashlib.sha256(raw).hexdigest(), 'features': len(features)})
out = ROOT / 'public/atlas/france'
out.mkdir(parents=True, exist_ok=True)
text = json.dumps({'frames': frames}, ensure_ascii=False, separators=(',', ':')) + '\n'
(out / 'frames.json').write_text(text)
(out / 'manifest.json').write_text(json.dumps({'historicalCommit': PIN, 'years': YEARS, 'sha256': hashlib.sha256(text.encode()).hexdigest(), 'files': records, 'method': 'Whole European components, zero-area rings removed, extra ordinates dropped, invalid source linework repaired with GEOS make_valid and polygon union, rounded to 1e-6 degrees. Same-polity records merged. No interpolation; early frames reuse the licensed Frankish atlas.'}, ensure_ascii=False, indent=2) + '\n')
print(f'{len(frames)} frames, {len(text.encode())} bytes')
