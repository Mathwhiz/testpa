"""
fix_territorios_125_161_176.py
Actualiza SOLO los polígonos de los territorios 125, 161 y 176 en Firestore.
No toca grupoId, tipo ni ningún otro campo.

Cambios:
  - 125: quita el segundo polígono redundante (queda 1)
  - 161: quita el segundo polígono mal asignado (queda 1)
  - 176: agrega ese segundo polígono como 176B (queda 2)

Uso:
    cd tools
    pip install firebase-admin
    python fix_territorios_125_161_176.py
"""

import firebase_admin
from firebase_admin import credentials, firestore

CONGRE_ID = "sur"

# ── Solo actualizamos el campo poligonos de cada territorio ─────────────────

UPDATES = {
    "125": [
        {"coords": [
            {"lat": -36.6406852, "lng": -64.2905418},
            {"lat": -36.6419846, "lng": -64.2888631},
            {"lat": -36.6409135, "lng": -64.2875349},
            {"lat": -36.640397,  "lng": -64.2881585},
            {"lat": -36.6401646, "lng": -64.2881371},
            {"lat": -36.6399623, "lng": -64.2879064},
            {"lat": -36.6405895, "lng": -64.2871348},
            {"lat": -36.6394714, "lng": -64.2857785},
            {"lat": -36.6381458, "lng": -64.2873662},
            {"lat": -36.6406852, "lng": -64.2905418},
        ]}
    ],
    "161": [
        {"coords": [
            {"lat": -36.644576, "lng": -64.263009},
            {"lat": -36.647481, "lng": -64.262993},
            {"lat": -36.647507, "lng": -64.261829},
            {"lat": -36.644589, "lng": -64.261802},
            {"lat": -36.644576, "lng": -64.263009},
        ]}
    ],
    "176": [
        {"coords": [
            {"lat": -36.647115, "lng": -64.276909},
            {"lat": -36.649155, "lng": -64.277059},
            {"lat": -36.649168, "lng": -64.275986},
            {"lat": -36.650253, "lng": -64.275987},
            {"lat": -36.650257, "lng": -64.274892},
            {"lat": -36.647132, "lng": -64.27486},
            {"lat": -36.647115, "lng": -64.276909},
        ]},
        {"coords": [
            {"lat": -36.649272, "lng": -64.274742},
            {"lat": -36.650262, "lng": -64.27471},
            {"lat": -36.650398, "lng": -64.271574},
            {"lat": -36.649376, "lng": -64.271502},
            {"lat": -36.649272, "lng": -64.274742},
        ]},
    ],
}

# ── Firebase ────────────────────────────────────────────────────────────────

print("🔥 Conectando a Firebase...")
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

terr_col = db.collection("congregaciones").document(CONGRE_ID).collection("territorios")

print(f"\n📝 Actualizando polígonos (congregación: {CONGRE_ID})...")
for terr_id, poligonos in UPDATES.items():
    terr_col.document(terr_id).update({"poligonos": poligonos})
    print(f"  ✓ Territorio {terr_id} — {len(poligonos)} polígono{'s' if len(poligonos) > 1 else ''}")

print("\n🔍 Verificando...")
for terr_id in UPDATES:
    d = terr_col.document(terr_id).get().to_dict()
    print(f"  Territorio {d['id']}: grupo={d['grupoId']}, polígonos={len(d['poligonos'])}")

print("\n✅ Listo.")
