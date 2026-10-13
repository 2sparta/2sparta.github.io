#!/usr/bin/env python3
"""Rebuild the Rus-only atlas offline from the bundled, licensed originals.

Requires scripts/atlas/rus-requirements.txt. Political SVG paths are sampled
directly; raster colour contours are traced at original resolution. No annual
interpolation or modification of any other country's files.
"""
import hashlib
import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np
from lxml import etree as ET
from PIL import Image
from scipy.ndimage import binary_fill_holes
from scipy.interpolate import RBFInterpolator
from pyproj import Transformer
from shapely.geometry import Polygon, LineString, Point, mapping
from shapely.ops import unary_union, transform, split

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/atlas/rus"
spec = importlib.util.spec_from_file_location("svg_transfer", ROOT / "scripts/build-frankish-atlas.py")
svg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(svg)
svg.PROJECTIONS = {
    "equirectangular": "+proj=eqc +lat_ts=55 +datum=WGS84",
    "mercator": "EPSG:3857",
    "lambert-conformal-conic": "+proj=lcc +lat_1=45 +lat_2=65 +lat_0=55 +lon_0=35 +datum=WGS84",
    "lambert-azimuthal-equal-area": "+proj=laea +lat_0=55 +lon_0=35 +datum=WGS84",
    "polar-stereographic": "+proj=stere +lat_0=90 +lon_0=35 +datum=WGS84",
}


def rounded(v):
    if isinstance(v, dict):
        return {k: rounded(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [rounded(x) for x in v]
    return round(float(v), 5) if isinstance(v, (float, np.floating)) else v


def raster_regions(file, classes):
    """Select explicitly reviewed political fills; exclude sea, neighbouring
    countries, ethnic ranges, legends, arrows and small caption fragments.
    The 7-pixel closing repairs thin text/rivers; simplification is <=1.5px.
    Large lakes remain holes; this is a source contour, not a surveyed border.
    """
    a = np.array(Image.open(OUT / "originals" / file).convert("RGB"))
    result = []
    for color, names in classes:
        mask = (np.max(np.abs(a.astype("int16") - color), axis=2) < 8).astype("uint8")
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
        _, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
        indices = sorted(range(1, len(stats)), key=lambda i: stats[i, 4], reverse=True)
        for index, name in zip(indices, names):
            assert stats[index, 4] > 25000, (file, name, stats[index, 4])
            component = (labels == index).astype("uint8")
            # Fill only small holes left by caption glyphs, preserving lakes.
            holes = binary_fill_holes(component) & ~component.astype(bool)
            _, hl, hs, _ = cv2.connectedComponentsWithStats(holes.astype("uint8"))
            for i in range(1, len(hs)):
                if hs[i, 4] < 600:
                    component[hl == i] = 1
            contours, hierarchy = cv2.findContours(component, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
            polygons = []
            for i, contour in enumerate(contours):
                if hierarchy[0, i, 3] != -1 or len(contour) < 3:
                    continue
                rings = []
                child = hierarchy[0, i, 2]
                while child >= 0:
                    if len(contours[child]) >= 3:
                        rings.append(contours[child][:, 0, :])
                    child = hierarchy[0, child, 0]
                polygons.append(Polygon(contour[:, 0, :], rings))
            g = svg.polygonal(unary_union(polygons)).simplify(1.5, preserve_topology=True)
            result.append((g, name, "#%02x%02x%02x" % tuple(color)))
    return result


def main():
    controls = json.loads((ROOT / "scripts/atlas/rus-control-points.json").read_text())
    sources = json.loads((ROOT / "scripts/atlas/rus-originals.json").read_text())
    fits = {k: svg.fit(v) for k, v in controls.items()}
    # This schematic's eastern city spacing is not described well by a single
    # affine projection. Correct its local residuals using fitted city markers,
    # keeping Pereiaslav and Suzdal wholly outside this correction's training.
    group = controls["1054-1132"]
    base, report = fits["1054-1132"]
    training = [p for p in group["points"] if p["role"] == "fit"]
    merc = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    back = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
    source_xy = np.array([[p["x"], p["y"]] for p in training])
    base_lonlat = base(source_xy[:, 0], source_xy[:, 1])
    predicted = np.array(merc.transform(*base_lonlat)).T
    actual = np.array(merc.transform([p["lon"] for p in training], [p["lat"] for p in training])).T
    correction = RBFInterpolator(source_xy / 100, actual - predicted, kernel="thin_plate_spline")

    def local_registration(x, y, z=None):
        xx, yy = np.broadcast_arrays(np.asarray(x), np.asarray(y))
        lon, lat = base(xx, yy)
        px, py = merc.transform(lon, lat)
        delta = correction(np.c_[xx.ravel(), yy.ravel()] / 100)
        return back.transform(np.asarray(px) + delta[:, 0].reshape(xx.shape),
                              np.asarray(py) + delta[:, 1].reshape(yy.shape))

    report["localCorrection"] = {
        "method": "Thin-plate spline of projected registration residuals at fitted city markers; not a historical-border interpolation.",
        "trainingPoints": len(training),
        "holdouts": [],
    }
    for p in group["points"]:
        if p["role"] == "holdout":
            lon, lat = local_registration(np.array([p["x"]]), np.array([p["y"]]))
            from pyproj import Geod
            _, _, distance = Geod(ellps="WGS84").inv(p["lon"], p["lat"], float(lon[0]), float(lat[0]))
            report["localCorrection"]["holdouts"].append({"name": p["name"], "residualKm": round(distance / 1000, 2)})
    fits["1054-1132"] = local_registration, report
    manifest = {
        "generatedAt": "2026-10-13",
        "method": "Direct SVG political contours and original-resolution raster colour tracing; projected affine city-marker registration; no annual interpolation.",
        "registration": {k: v[1] for k, v in fits.items()},
        "originals": sources,
        "frames": [],
    }
    for source in sources:
        data = (OUT / "originals" / source["file"]).read_bytes()
        assert hashlib.sha256(data).hexdigest() == source["sha256"], source["file"]
    frames = []

    def frame(year, group, areas, note, source_year=None):
        source = next(s for s in sources if s["file"] == controls[group]["file"])
        features = []
        for i, (g, name, color) in enumerate(areas):
            geo = svg.polygonal(transform(fits[group][0], svg.polygonal(g)))
            assert not geo.is_empty and geo.is_valid, name
            features.append({
                "type": "Feature", "id": f"rus-{year}-{i}",
                "properties": {"name": name, "subject": name, "precision": 2,
                               "detailed": True, "region": "rus", "sourceYear": source_year or year,
                               "sourceId": source["sourceId"], "color": color},
                "geometry": rounded(dict(mapping(geo))),
            })
        frames.append({
            "year": year, "sourceYear": source_year or year, "sourceFilename": source["file"],
            "sourceUrl": source["descriptionUrl"], "originalPath": f"atlas/rus/originals/{source['file']}",
            "author": source["author"], "license": source["license"], "sourceId": source["sourceId"],
            "note": note, "collection": {"type": "FeatureCollection", "features": features},
        })
        manifest["frames"].append({"year": year, "sourceYear": source_year or year,
                                   "file": source["file"], "features": len(features)})

    r = ET.parse(str(OUT / "originals/growth.svg"))

    def path(id):
        return svg.path_polygon(r.xpath("//*[@id=$id]", id=id)[0])

    early = path("path3698")
    frame(882, "growth", [(early, "Kyivan Rus", "#b11515")],
          "882 — літописна дата утвердження Олега в Києві. Контур — реконструкція автора, а не встановлений кордон; Русь існувала до цієї дати. Темно-жовтий ареал VIII ст. не перенесено як територію держави.")
    core = unary_union([early] + [path(id) for id in ["path4164", "path4203", "path4205", "path4207", "path5649"]])
    dependent = unary_union([path(id) for id in ["path1117", "path4197", "path4199", "path4201", "path4213"]]).difference(core)
    frame(1054, "growth", [(core, "Kyivan Rus", "#e73c3c"), (dependent, "Rus dependent territories", "#ff7272")],
          "Кінець правління Ярослава: основні володіння й світлі залежні території показано окремо. Внутрішні лінії джерела узагальнюють пізніші князівства й не перенесені як поділ точно на 1054 рік.")
    classes_11c = [
        ([248, 217, 230], ["Novgorod core lands"]),
        ([204, 184, 218], ["Principality of Rostov-Suzdal", "Principality of Pereiaslav"]),
        ([228, 245, 120], ["Principality of Chernihiv"]),
        ([248, 213, 173], ["Kyiv and western Rus lands"]),
        ([254, 254, 94], ["Principality of Smolensk"]),
        ([247, 215, 114], ["Principality of Polotsk"]),
        ([224, 242, 201], ["Volhynian appanages"]),
    ]
    frame(1113, "11c", raster_regions("11c.png", classes_11c),
          "Карта XI ст. завершується кордонами 1113 року. Кольорові землі оцифровані; зелений поділ 1054 року й пізніші удільні лінії не означають одночасної незалежності всіх земель. Північне штрихування залежності / заселення доступне в оригіналі й не зафарбоване як прямі володіння.")
    r = ET.parse(str(OUT / "originals/1054-1132.svg"))
    parts = [
        ("path3845", "Murom and Ryazan lands", "#f9f96d"),
        ("path3855", "Principality of Pereiaslav", "#facc8d"),
        ("path3857", "Principality of Chernihiv", "#d6b0fc"),
        ("path3859", "Principality of Smolensk", "#8ddefa"),
        ("path3863", "Principality of Kyiv", "#f9fa8d"),
        ("path4157-7", "Galician appanages", "#faaecc"),
        ("path3865", "Principality of Volhynia", "#a0fa8d"),
        ("path3871", "Principality of Polotsk", "#faae8d"),
        ("path3873", "Principality of Rostov-Suzdal", "#fae08d"),
        ("path3875", "Principality of Novgorod", "#d5fa8d"),
    ]
    # The label "Principality of Halych" in this period map is retrospective:
    # the united Halych principality dates to 1141. Use a collective label.
    frame(1132, "1054-1132", [(path(id), name, color) for id, name, color in parts],
          "Схема земель за період 1054–1132, а не одночасний поділ одного дня. 1132 — кінцева дата схеми та смерть Мстислава. Галицькі володіння ще не названо об’єднаним князівством. Ретроспективні анклави Тмуторокані й Білої Вежі не перенесено на 1132 рік.")
    classes_1194 = [
        ([252, 224, 236], ["Novgorod Republic", "Principality of Kyiv"]),
        ([216, 198, 224], ["Vladimir-Suzdal lands"]),
        ([234, 243, 137], ["Principality of Chernihiv"]),
        ([249, 223, 132], ["Polotsk and Minsk lands"]),
        ([253, 251, 114], ["Smolensk and Toropets lands"]),
        ([237, 227, 188], ["Principality of Halych"]),
        ([217, 211, 233], ["Principality of Pereiaslav"]),
        ([216, 234, 74], ["Murom and Ryazan lands"]),
        ([249, 198, 219], ["Principality of Turiv-Pinsk"]),
        ([215, 236, 224], ["Volhynian appanages"]),
        ([215, 234, 102], ["Principality of Novhorod-Siverskyi"]),
    ]
    frame(1194, "1194", raster_regions("1194.png", classes_1194),
          "Карта XII ст. з зовнішнім контуром 1194 року. Основні кольорові області інтерактивні; дрібні уділи з пунктирними межами збережені в оригіналі. Ростово-Суздальські / Владимирські, Полоцько-Мінські, Смоленсько-Торопецькі та Муромо-Рязанські області тут узагальнені за кольорами джерела.")
    r = ET.parse(str(OUT / "originals/1237.svg"))
    late = [
        ("path17033", "Novgorod Republic", "#bfffbf"),
        ("path18006", "Principality of Vladimir-Suzdal", "#ffbfff"),
        ("path18977", "Principality of Smolensk", "#ffffbf"),
        ("path18979", "Principality of Polotsk", "#ffbfbf"),
        ("path18985", "Principality of Chernihiv", "#bfbfff"),
        ("path18989", "Principality of Pereiaslav", "#ffbfbf"),
        ("path18991", "Principality of Kyiv", "#bfffff"),
        ("path18993", "Principality of Turiv-Pinsk", "#bfffbf"),
        ("path18995", "Principality of Galicia-Volhynia", "#ffdfbf"),
    ]
    areas = [(path(id), name, color) for id, name, color in late]
    # Torzhok is the small green Novgorodian enclave, not Murom.
    areas[0] = (areas[0][0].union(path("path18004")), areas[0][1], areas[0][2])
    # Murom and Ryazan share one fill; split at the actual dotted source border.
    border = r.xpath("//*[@id='path39458']")[0]
    p = svg.parse_path(border.get("d"))
    m = svg.element_matrix(border)
    points = []
    for segment in p:
        for t in np.linspace(0, 1, max(2, int(segment.length()) + 1)):
            z = segment.point(t)
            points.append((m @ np.array([z.real, z.imag, 1]))[:2])
    # Extend beyond the fill to compensate for independent source strokes.
    points[0] += (points[0] - points[1]) / np.linalg.norm(points[0] - points[1]) * 20
    points[-1] += (points[-1] - points[-2]) / np.linalg.norm(points[-1] - points[-2]) * 20
    pieces = list(split(path("path18981"), LineString(points)).geoms)
    assert len(pieces) == 2, "Murom/Ryazan source border must divide the fill"
    for piece in pieces:
        name = "Principality of Murom" if piece.contains(Point(2671.85, 2580.35)) else "Principality of Ryazan"
        areas.append((piece, name, "#bfffbf"))
    frame(1237, "1237", areas,
          "Окремі князівства напередодні навали Батия. Північні штриховані зони впливу не включено до суцільних кордонів. На оригіналі є ретроспективний підпис Сарая; його не додано як місто 1237 року.")
    frame(1240, "1237", areas,
          "Завершення часової лінії: падіння Києва 1240 року. Показано останню доступну передмонгольську карту 1237, а не нову карту 1240 чи стан після навали. Руські князівства та Галицько-Волинська держава продовжили існування.", source_year=1237)
    raw = (json.dumps({"frames": frames}, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    (OUT / "frames.json").write_bytes(raw)
    manifest["data"] = {"path": "frames.json", "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"frames": len(frames), "bytes": len(raw), "registration": manifest["registration"]}, indent=2))


if __name__ == "__main__":
    main()
