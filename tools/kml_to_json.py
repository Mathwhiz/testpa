"""
kml_to_json.py
Convierte un KML de MyMaps al formato territorios.json para la app.

Uso:
    pip install lxml
    python kml_to_json.py congregacionsur.kml territorios.json

Salida: territorios.json listo para subir a Firebase o usar desde el mapa Leaflet.

Formato de salida:
{
  "territorios": {
    "1": {
      "id": 1,
      "nombre": "Territorio 1",
      "punto": [lat, lng],          // centro para el label del mapa
      "poligonos": [                 // lista de sub-polígonos (casi siempre 1)
        [[lat, lng], [lat, lng], ...]
      ]
    },
    ...
  }
}
"""

import sys
import json
import re
import xml.etree.ElementTree as ET

# ─── CONFIG ───────────────────────────────────────────────────────────────────

# Capas de polígonos a procesar (nombres exactos del KML)
CAPAS_POLIGONOS = [
    "Territorios Santa Rosa",
    "Territorios de Congregación",
]

# Capa de puntos (centros de territorio para labels)
CAPA_PUNTOS = "Puntos Santa Rosa"

# ─── HELPERS ──────────────────────────────────────────────────────────────────

def base_num(nombre):
    """
    Extrae el número base del territorio.
    'Territorio 92A' → 92
    'Territorio 113'  → 113
    'Punto 5'         → 5
    """
    m = re.search(r"(\d+)[A-Za-z]?$", nombre.strip())
    return int(m.group(1)) if m else None

def parse_coords(coords_text):
    """
    Convierte string de coordenadas KML a lista de [lat, lng].
    KML usa 'lng,lat,alt' — invertimos a [lat, lng] para Leaflet.
    """
    puntos = []
    for pair in coords_text.strip().split():
        parts = pair.split(",")
        if len(parts) >= 2:
            try:
                lng = float(parts[0])
                lat = float(parts[1])
                puntos.append([lat, lng])
            except ValueError:
                continue
    return puntos

def parse_point(coords_text):
    """Convierte coordenada de punto KML a [lat, lng]."""
    parts = coords_text.strip().split(",")
    if len(parts) >= 2:
        try:
            return [float(parts[1]), float(parts[0])]
        except ValueError:
            return None
    return None

# ─── MAIN ─────────────────────────────────────────────────────────────────────

def convertir(kml_path, output_path):
    print(f"📂 Leyendo {kml_path}...")
    tree = ET.parse(kml_path)
    root = tree.getroot()
    ns   = {"kml": "http://www.opengis.net/kml/2.2"}

    territorios = {}  # { num: { id, nombre, punto, poligonos[] } }

    # ── Procesar polígonos ────────────────────────────────────────────────────
    folders = root.findall(".//kml:Folder", ns)

    for folder in folders:
        name_el = folder.find("kml:name", ns)
        fname   = name_el.text.strip() if name_el is not None else ""

        if fname not in CAPAS_POLIGONOS:
            continue

        placemarks = folder.findall("kml:Placemark", ns)
        print(f"   📁 '{fname}' — {len(placemarks)} polígonos")

        for pm in placemarks:
            nombre_el = pm.find("kml:name", ns)
            nombre    = nombre_el.text.strip() if nombre_el is not None else ""
            num       = base_num(nombre)

            if num is None:
                print(f"   ⚠️  No se pudo extraer número de: '{nombre}'")
                continue

            # Puede haber Polygon o MultiGeometry
            coords_list = []
            for coords_el in pm.findall(".//kml:coordinates", ns):
                puntos = parse_coords(coords_el.text)
                if puntos:
                    coords_list.append(puntos)

            if not coords_list:
                print(f"   ⚠️  Sin coordenadas: '{nombre}'")
                continue

            if num not in territorios:
                territorios[num] = {
                    "id":       num,
                    "nombre":   f"Territorio {num}",
                    "punto":    None,
                    "poligonos": [],
                }

            territorios[num]["poligonos"].extend(coords_list)

    # ── Procesar puntos (centros) ─────────────────────────────────────────────
    puntos_encontrados = 0
    for folder in folders:
        name_el = folder.find("kml:name", ns)
        fname   = name_el.text.strip() if name_el is not None else ""

        if fname != CAPA_PUNTOS:
            continue

        placemarks = folder.findall("kml:Placemark", ns)
        print(f"   📍 '{fname}' — {len(placemarks)} puntos")

        for pm in placemarks:
            nombre_el = pm.find("kml:name", ns)
            nombre    = nombre_el.text.strip() if nombre_el is not None else ""
            num       = base_num(nombre)

            if num is None:
                continue

            coords_el = pm.find(".//kml:coordinates", ns)
            if coords_el is None:
                continue

            punto = parse_point(coords_el.text)
            if punto and num in territorios:
                territorios[num]["punto"] = punto
                puntos_encontrados += 1

    # ── Calcular centroide para territorios sin punto ─────────────────────────
    sin_punto = 0
    for num, terr in territorios.items():
        if terr["punto"] is None and terr["poligonos"]:
            # Centroide simple del primer polígono
            coords = terr["poligonos"][0]
            lat = sum(c[0] for c in coords) / len(coords)
            lng = sum(c[1] for c in coords) / len(coords)
            terr["punto"] = [round(lat, 6), round(lng, 6)]
            sin_punto += 1

    # ── Escribir JSON ─────────────────────────────────────────────────────────
    output = {
        "territorios": {
            str(num): terr
            for num, terr in sorted(territorios.items())
        }
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # ── Resumen ───────────────────────────────────────────────────────────────
    con_multiples = sum(1 for t in territorios.values() if len(t["poligonos"]) > 1)

    print(f"\n{'=' * 50}")
    print(f"✅ Conversión completa → {output_path}")
    print(f"   Territorios únicos  : {len(territorios)}")
    print(f"   Con múltiples partes: {con_multiples}")
    print(f"   Con punto de centro : {puntos_encontrados}")
    print(f"   Centro calculado    : {sin_punto}")
    print(f"{'=' * 50}")

# ─── ENTRY POINT ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python kml_to_json.py <archivo.kml> <salida.json>")
        sys.exit(1)
    convertir(sys.argv[1], sys.argv[2])
