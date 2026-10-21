"""Build one atlas from pinned world snapshots and the existing sourced regional maps.

Python 3 + shapely==2.1.2. Downloads are cached outside the published data.
Run: python scripts/build-world-atlas.py
No invented vertices, rectangular region masks, or temporal interpolation.
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

from shapely import make_valid, set_precision
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/atlas/world'
CACHE = ROOT / '.cache/atlas-world'
PIN = 'da7a4b735ecef70aebdc9c73e409d8a2500d50f3'
YEARS = [-500, -400, -323, -300, -200, -100, -1, 100, 200, 300, 400,
         500, 600, 700, 800, 900, 1000, 1100, 1200, 1279, 1300, 1400, 1492,
         1500, 1530, 1600, 1650, 1700, 1715, 1783, 1800, 1815, 1878, 1880,
         1900, 1914, 1920, 1930, 1938, 1945, 1960, 1994]
OUT.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)

def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n').encode()

def write(path, value):
    raw = encoded(value)
    (OUT / path).write_bytes(raw)
    return hashlib.sha256(raw).hexdigest()

def polygonal(g):
    if not g.is_valid:
        g = make_valid(g)
    if isinstance(g, (Polygon, MultiPolygon)):
        return g
    parts = [polygonal(x) for x in getattr(g, 'geoms', [])]
    return unary_union([x for x in parts if not x.is_empty]) if parts else Polygon()

def clean(g):
    return polygonal(set_precision(polygonal(g), 0.0001))

land = clean(unary_union([clean(shape(f['geometry'])) for f in json.loads(
    (ROOT / 'public/atlas/land.geojson').read_text())['features']]))

def download(year):
    filename = f'world_{year if year > 0 else "bc" + str(-year)}.geojson'
    path = CACHE / filename
    url = f'https://raw.githubusercontent.com/aourednik/historical-basemaps/{PIN}/geojson/{filename}'
    if not path.exists():
        with urllib.request.urlopen(url, timeout=60) as response:
            path.write_bytes(response.read())
    raw = path.read_bytes()
    features = []
    for index, source in enumerate(json.loads(raw)['features']):
        p = source['properties']
        name = str(p.get('NAME') or '').strip() or str(p.get('SUBJECTO') or '').strip()
        if not name or name.lower() == 'unspecified':
            continue
        g = clean(shape(source['geometry']))
        g = clean(g.intersection(land).simplify(0.012, preserve_topology=True))
        if g.is_empty:
            continue
        subject = str(p.get('SUBJECTO') or name)
        correction = {}
        if year == 1930 and name == 'White Russia':
            name, subject = 'USSR', 'USSR'
            correction = {'description': 'СРСР. Помилкову назву джерельного зрізу 1930 року виправлено за матеріалами Бібліотеки Конгресу США.',
                'correctionUrl': 'https://blogs.loc.gov/law/2013/01/treaty-on-the-creation-of-the-soviet-union-signed-sealed-and-delivered/'}
        features.append({'type': 'Feature', 'id': f'{year}-{index}', 'properties': {
            'name': name, 'subject': subject, **correction,
            'precision': int(p.get('BORDERPRECISION') or 1), 'sourceYear': year,
            'sourceId': 'basemaps', 'sourceUrl': url, 'layer': 'state',
        }, 'geometry': mapping(g)})
    collection = {'type': 'FeatureCollection', 'features': features}
    path = f'base-{year}.geojson'
    digest = write(path, collection)
    print('base', year, len(features), flush=True)
    return year, collection, {'year': year, 'path': path, 'sha256': digest,
        'sourceSha256': hashlib.sha256(raw).hexdigest(), 'features': len(features)}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    downloaded = list(pool.map(download, YEARS))
bases = {year: collection for year, collection, _ in downloaded}
base_geometries = {year: {f['id']: shape(f['geometry']) for f in c['features']} for year, c in bases.items()}

families = {name: json.loads((ROOT / f'public/atlas/{name}/frames.json').read_text())
    for name in ['byzantium', 'franks', 'rus', 'mongols', 'commonwealth', 'spain']}
transitions = {1772: '1772-08-05', 1793: '1793-01-23', 1795: '1795-10-24'}
def date_key(year, month=1, day=1):
    return (year, month, day)
def parse(value):
    return tuple(map(int, value.split('-')))
def frame_date(f):
    if f.get('date'):
        return parse(f['date'])
    return parse(transitions.get(f['year'], f"{f['year']}-01-01")) if f['year'] > 0 else date_key(f['year'])
def latest(frames, date):
    return next((f for f in reversed(frames) if frame_date(f) <= date), None)

dates = {date_key(y) for y in YEARS}
for name, data in families.items():
    for key in (['frames', 'reconquista', 'civil'] if name == 'spain' else ['frames']):
        for f in data[key]:
            dates.add(frame_date(f))
            if name == 'mongols' and f['to'] < 1994:
                dates.add(date_key(f['to'] + 1))
            for item in f['collection']['features']:
                p = item['properties']
                for attr in ['validTo']:
                    if p.get(attr) and p[attr] < 1994:
                        dates.add(date_key(p[attr] + 1))
                if p.get('validUntilDate'):
                    from datetime import date as civil_date, timedelta
                    d = civil_date.fromisoformat(p['validUntilDate']) + timedelta(days=1)
                    dates.add((d.year, d.month, d.day))
dates.update([(901, 1, 1), (1241, 1, 1), (1260, 1, 1), (1453, 5, 29), (1454, 1, 1),
              (1939, 1, 1), (1936, 7, 17), (1939, 4, 1)])

def active_features(frame, date):
    if not frame:
        return []
    year = date[0]
    key = f'{year:04}-{date[1]:02}-{date[2]:02}'
    return [f for f in frame['collection']['features'] if
        f['properties'].get('validFrom', -500) <= year <= f['properties'].get('validTo', 1994)
        and key <= f['properties'].get('validUntilDate', '9999-12-31')]

regional_geometry = {}
def geom(feature):
    identity = hashlib.sha256(encoded(feature['geometry'])).hexdigest()
    if identity not in regional_geometry:
        regional_geometry[identity] = clean(clean(shape(feature['geometry'])).intersection(land))
    return regional_geometry[identity]

def replace(features, geometries, incoming, predicate):
    states = [f for f in incoming if f['properties'].get('layer', 'state') == 'state'
              and f['properties'].get('control') != 'relative']
    if not states:
        return features, geometries
    mask = clean(unary_union([geom(f) for f in states]))
    next_features, next_geometries = [], {}
    for f in features:
        if predicate(f['properties']['name']):
            continue
        g = geometries[f['id']]
        if g.intersects(mask):
            clipped = clean(g.difference(mask))
            if clipped.is_empty:
                continue
            if not clipped.equals(g):
                f = {**f, 'geometry': mapping(clipped)}
                g = clipped
        next_features.append(f)
        next_geometries[f['id']] = g
    for f in states:
        g = geom(f)
        if not g.is_empty:
            next_features.append({**f, 'geometry': mapping(g)})
            next_geometries[f['id']] = g
    return next_features, next_geometries

def polity(name, names):
    return name in names
index = []
for date in sorted(dates):
    year = date[0]
    if year < -500 or year > 1994:
        continue
    base_year = max(y for y in YEARS if y <= year)
    base = bases[base_year]
    features = list(base['features'])
    geometries = dict(base_geometries[base_year])
    overlays, sources = [], [{'name': 'world', 'year': base_year}]
    definitions = [
        ('byzantium', 395 <= year <= 1453 and date < (1453, 5, 29),
         lambda n: n in ['Byzantine Empire', 'Eastern Roman Empire', 'Trebizond', 'Empire of Nicaea', 'Nicaea', 'Despotate of Epirus', 'Principality of Theodoro']),
        ('franks', 481 <= year <= 900, lambda n: n in ['Franks', 'Frankish Kingdom', 'Carolingian Empire']),
        ('rus', 882 <= year <= 1240, lambda n: n in ['Kyivan Rus', 'Kievan Rus', 'Other Rus Principalities', 'Principality of Galicia-Volhynia', 'Principality of Novgorod']),
        ('commonwealth', 1000 <= year <= 1994 and not 1939 <= year <= 1944,
         lambda n: n in ['Poland', 'Kingdom of Poland', 'Lithuania', 'Grand Duchy of Lithuania', 'Poland-Lithuania', 'Polish-Lithuanian Commonwealth', 'Polish–Lithuanian Commonwealth']),
        ('spain', 700 <= year <= 1994,
         lambda n: n in ['Spain', 'Visigothic Kingdom', 'Asturias', 'Emirate of Córdoba', 'Caliphate of Córdoba', 'Navarre', 'León', 'Castilla', 'Castile', 'Castille', 'Aragón', 'Granada', 'Almoravid dynasty', 'Almohad Caliphate']),
    ]
    for name, enabled, predicate in definitions:
        if not enabled:
            continue
        frame = latest(families[name]['frames'], date)
        incoming = active_features(frame, date)
        # An empty frame means this family intentionally falls back to the world.
        if not incoming:
            continue
        if name == 'spain' and any(f['properties']['name'] == 'Portugal' for f in incoming):
            original = predicate
            predicate = lambda n, p=original: p(n) or n == 'Portugal'
        # A source footprint replaces intersecting neighbouring polygons geometrically.
        # Context/occupation layers never erase sovereign states.
        features, geometries = replace(features, geometries, incoming, predicate)
        overlays += [f for f in incoming if f['properties'].get('layer', 'state') != 'state'
                     or f['properties'].get('control') == 'relative']
        sources.append({'name': name, 'year': frame.get('year', int(frame.get('date', '0000')[:4])),
                        'date': frame.get('date'), 'note': frame.get('note', '')})
    # Direct sourced Mongol/khanate/Mughal contours keep their documented lifetimes.
    # The 1259/1294 combined extent is not promoted to a single state after 1260.
    for f in families['mongols']['frames']:
        if not (f['year'] <= year <= f['to']) or (1260 <= year < 1300):
            continue
        incoming = active_features(f, date)
        names = {x['properties']['name'] for x in incoming}
        def mongol_target(n):
            return n in names or (f['branch'] == 'mongols' and n in [
                'Mongol Empire', 'Chagatai Khanate', 'Ilkhanate', 'Golden Horde',
                'Khanate of the Golden Horde', 'China (Yuan Dynasty)', 'Yuan dynasty'])
        features, geometries = replace(features, geometries, incoming, mongol_target)
        sources.append({'name': 'mongols', 'year': f['year'], 'note': f['note']})
    # Optional historical areas and monthly fronts sit over the political background.
    if 718 <= year < 1492:
        f = latest(families['spain']['reconquista'], date)
        for item in active_features(f, date):
            overlays.append({**item, 'properties': {**item['properties'], 'layer': 'land', 'worldOverlay': 'reconquista'}})
    if (1936, 7, 17) <= date <= (1939, 12, 31):
        f = latest(families['spain']['civil'], date)
        if f:
            overlays += [{**item, 'properties': {**item['properties'], 'worldOverlay': 'front'}}
                         for item in active_features(f, date)]
            sources.append({'name': 'front', 'year': year, 'date': f['date'], 'note': f['note']})
    if date >= (1453, 5, 29) and base_year < 1492:
        features = [f for f in features if f['properties']['name'] not in ['Byzantine Empire', 'Eastern Roman Empire']]
    # Regional areas are clipped to the same coast, but remain independently switchable.
    for f in overlays:
        g = geom(f)
        if not g.is_empty:
            features.append({**f, 'geometry': mapping(g)})
    if len({f['id'] for f in features}) != len(features):
        raise ValueError(f'Duplicate feature IDs at {date}')
    old = {f['id']: f for f in base['features']}
    current = {f['id']: f for f in features}
    changed = [f for f in features if f['id'] not in old or f != old[f['id']]]
    patch = {'baseYear': base_year, 'remove': [i for i in old if i not in current],
             'collection': {'type': 'FeatureCollection', 'features': changed}}
    key = f'{year}-{date[1]:02}-{date[2]:02}'
    path = f'patch-{key}.json'
    digest = write(path, patch)
    index.append({'year': year, 'month': date[1], 'day': date[2], 'baseYear': base_year,
                  'path': path, 'sha256': digest, 'sources': sources})
    print('patch', key, len(changed), flush=True)
manifest = {'version': 1, 'historicalCommit': PIN, 'precision': 'source snapshots; no interpolation',
            'coast': 'Natural Earth 5.1.2', 'baseFiles': [r for _, _, r in downloaded], 'frames': index}
write('manifest.json', manifest)
print('Complete:', len(index), 'dated frames', flush=True)
