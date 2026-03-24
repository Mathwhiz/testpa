"""
upload_territorios.py
Sube los territorios de territorios_sur.json a Firestore,
cruzando con el array TERRITORIOS de mapa.html para obtener grupoId.

Uso:
    pip install firebase-admin
    python upload_territorios.py

Archivos necesarios en la misma carpeta:
    - serviceAccountKey.json
    - territorios_sur.json
    - mapa.html  (para extraer los grupoId del array hardcodeado)

Destino en Firestore:
    congregaciones/sur/territorios/{id}
"""

import json
import re
import firebase_admin
from firebase_admin import credentials, firestore

# ─── CONFIG ───────────────────────────────────────────────────────────────────

CONGRE_ID = "sur"

TERRITORIOS_ESPECIALES = {
    "131": "no_predica",
    "11":  "peligroso",
}

# ─── HELPERS ──────────────────────────────────────────────────────────────────

def base_num(s):
    """Quita sufijos de letra: '92a' → '92', '99A' → '99'"""
    return re.sub(r'[A-Za-z]+$', '', str(s))

# ─── LEER DATOS ───────────────────────────────────────────────────────────────

print("📂 Leyendo territorios_sur.json...")
with open("territorios_sur.json") as f:
    raw = json.load(f)
terrs_json = raw["territorios"]  # dict: "1" -> {id, nombre, punto, poligonos}

print("📂 Extrayendo grupos desde mapa.html...")
with open("mapa.html", encoding="utf-8") as f:
    html = f.read()

match = re.search(r'const TERRITORIOS = (\[.*?\]);', html, re.DOTALL)
if not match:
    raise RuntimeError("No se encontró el array TERRITORIOS en mapa.html")

terrs_mapa = json.loads(match.group(1))

# Mapa base_num -> grupoId
grupo_map = {}
for t in terrs_mapa:
    n = base_num(t["num"])
    grupo_map[n] = str(t["grupo"])

print(f"   ✓ {len(grupo_map)} entradas de grupo extraídas del mapa")

# ─── FIREBASE ─────────────────────────────────────────────────────────────────

print("\n🔥 Conectando a Firebase...")
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

congre_ref = db.collection("congregaciones").document(CONGRE_ID)
terr_col   = congre_ref.collection("territorios")

# ─── SUBIR ────────────────────────────────────────────────────────────────────

print(f"\n🗺️  Subiendo {len(terrs_json)} territorios a congregaciones/{CONGRE_ID}/territorios...")

# Usar batches para eficiencia (Firestore permite 500 ops por batch)
BATCH_SIZE = 400
items = list(terrs_json.items())
total = 0

for batch_start in range(0, len(items), BATCH_SIZE):
    batch = db.batch()
    chunk = items[batch_start:batch_start + BATCH_SIZE]

    for key, t in chunk:
        terr_id = str(t["id"])
        grupo_id = grupo_map.get(terr_id, "1")  # fallback grupo 1 si no se encuentra
        tipo = TERRITORIOS_ESPECIALES.get(terr_id, "normal")

        doc = {
    "id":       t["id"],
    "nombre":   t.get("nombre", f"Territorio {terr_id}"),
    "grupoId":  grupo_id,
    "tipo":     tipo,
    "punto": {
        "lat": t.get("punto", [None, None])[0],
        "lng": t.get("punto", [None, None])[1],
    },
    "poligonos": [
        {
            "coords": [
                { "lat": p[0], "lng": p[1] }
                for p in poly
            ]
        }
        for poly in t.get("poligonos", [])
    ],
}

        doc_ref = terr_col.document(terr_id)
        batch.set(doc_ref, doc)
        total += 1

    batch.commit()
    print(f"   ✓ Batch {batch_start // BATCH_SIZE + 1}: {len(chunk)} territorios subidos")

print(f"\n{'='*50}")
print(f"✅ ¡Listo! {total} territorios subidos a Firestore.")
print(f"   Congregación : {CONGRE_ID}")
print(f"   Colección    : congregaciones/{CONGRE_ID}/territorios")
print(f"{'='*50}")

# Verificar algunos
print("\n🔍 Verificando primeros 3 docs subidos...")
for key, t in items[:3]:
    doc = terr_col.document(str(t["id"])).get()
    d = doc.to_dict()
    print(f"   Territorio {d['id']}: grupo={d['grupoId']}, tipo={d['tipo']}, poligonos={len(d['poligonos'])}")
