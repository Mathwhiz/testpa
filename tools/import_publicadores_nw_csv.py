"""
Importador de publicadores/roles desde CSV (NW Scheduler) a Firestore.

Objetivo:
- Leer un CSV exportado desde NW Scheduler (o similar).
- Normalizar nombres y roles.
- Crear/actualizar docs en:
    congregaciones/{congreId}/publicadores/{pubId}

Campos escritos:
- nombre: str
- roles: list[str]  (sin duplicados)
- activo: bool      (default true)

Uso:
  pip install firebase-admin
  python tools/import_publicadores_nw_csv.py \
    --csv /ruta/publicadores.csv \
    --congre sur \
    --service-account /ruta/serviceAccountKey.json \
    --dry-run

  # Ejecutar cambios reales:
  python tools/import_publicadores_nw_csv.py \
    --csv /ruta/publicadores.csv \
    --congre sur \
    --service-account /ruta/serviceAccountKey.json

Notas:
- El script intenta detectar automáticamente columnas de nombre y roles.
- Si no detecta bien, se puede forzar con:
    --name-column "Publisher Name" --roles-column "Privileges"
"""

from __future__ import annotations

import argparse
import csv
import io
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import firebase_admin
from firebase_admin import credentials, firestore

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


# Alias (normalizado) -> rol canónico del sistema
ROLE_ALIAS = {
    # Asignaciones
    "lector": "LECTOR",
    "reading": "LECTOR",
    "sonido": "SONIDO",
    "sound": "SONIDO",
    "audio": "SONIDO",
    "plataforma": "PLATAFORMA",
    "platform": "PLATAFORMA",
    "microfonos": "MICROFONISTAS",
    "microfonistas": "MICROFONISTAS",
    "microphones": "MICROFONISTAS",
    "acomodador auditorio": "ACOMODADOR_AUDITORIO",
    "acomodador entrada": "ACOMODADOR_ENTRADA",
    "presidente": "PRESIDENTE",
    "chairman": "PRESIDENTE",
    "revistas": "REVISTAS",
    "publicaciones": "PUBLICACIONES",
    "conductor grupo 1": "CONDUCTOR_GRUPO_1",
    "conductor grupo 2": "CONDUCTOR_GRUPO_2",
    "conductor grupo 3": "CONDUCTOR_GRUPO_3",
    "conductor grupo 4": "CONDUCTOR_GRUPO_4",
    "conductor congregacion": "CONDUCTOR_CONGREGACION",
    # VM
    "vm presidente": "VM_PRESIDENTE",
    "presidente vm": "VM_PRESIDENTE",
    "vm oracion": "VM_ORACION",
    "oracion": "VM_ORACION",
    "vm tesoros": "VM_TESOROS",
    "discurso tesoros": "VM_TESOROS",
    "vm joyas": "VM_JOYAS",
    "perlas escondidas": "VM_JOYAS",
    "vm lectura": "VM_LECTURA",
    "lectura biblica": "VM_LECTURA",
    "vm ministerio conversacion": "VM_MINISTERIO_CONVERSACION",
    "conversacion": "VM_MINISTERIO_CONVERSACION",
    "vm ministerio revisita": "VM_MINISTERIO_REVISITA",
    "revisita": "VM_MINISTERIO_REVISITA",
    "vm ministerio escenificacion": "VM_MINISTERIO_ESCENIFICACION",
    "escenificacion": "VM_MINISTERIO_ESCENIFICACION",
    "vm ministerio discurso": "VM_MINISTERIO_DISCURSO",
    "discurso": "VM_MINISTERIO_DISCURSO",
    "vm vida cristiana": "VM_VIDA_CRISTIANA",
    "vida cristiana": "VM_VIDA_CRISTIANA",
    "vm estudio conductor": "VM_ESTUDIO_CONDUCTOR",
    "conductor estudio": "VM_ESTUDIO_CONDUCTOR",
}


NAME_CANDIDATES = (
    "nombre",
    "name",
    "publisher",
    "publicador",
    "hermano",
    "persona",
)

ROLES_CANDIDATES = (
    "roles",
    "role",
    "privilege",
    "privileges",
    "asignacion",
    "assignment",
)


@dataclass
class CsvRow:
    nombre: str
    roles: list[str]


def normalize(s: str) -> str:
    s = (s or "").strip().lower()
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s)


def canonical_role(raw_role: str) -> str | None:
    raw = normalize(raw_role)
    if not raw:
        return None

    if raw in ROLE_ALIAS:
        return ROLE_ALIAS[raw]

    upper = re.sub(r"[^A-Z0-9_]", "_", raw.upper())
    upper = re.sub(r"_+", "_", upper).strip("_")
    if upper in set(ROLE_ALIAS.values()):
        return upper
    return None


def split_roles(raw: str) -> list[str]:
    if not raw:
        return []
    parts = re.split(r"[;,/|]+", str(raw))
    out: list[str] = []
    for p in parts:
        role = canonical_role(p)
        if role and role not in out:
            out.append(role)
    return out


def detect_column(headers: Iterable[str], candidates: tuple[str, ...]) -> str | None:
    norm_to_raw = {normalize(h): h for h in headers if h is not None}
    keys = list(norm_to_raw.keys())

    for c in candidates:
        for k in keys:
            if c == k or c in k:
                return norm_to_raw[k]
    return None


def read_rows(csv_path: Path, name_column: str | None, roles_column: str | None) -> tuple[list[CsvRow], list[str]]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        sample = f.read(4096)
        f.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        reader = csv.DictReader(f, dialect=dialect)

        if not reader.fieldnames:
            raise ValueError("CSV sin cabeceras.")

        headers = [h.strip() for h in reader.fieldnames if h]
        name_col = name_column or detect_column(headers, NAME_CANDIDATES)
        roles_col = roles_column or detect_column(headers, ROLES_CANDIDATES)

        if not name_col:
            raise ValueError(
                f"No se pudo detectar columna de nombres. Headers detectados: {headers}. "
                "Usá --name-column para especificarla."
            )

        unknown_roles: list[str] = []
        rows: list[CsvRow] = []

        for row in reader:
            raw_name = (row.get(name_col) or "").strip()
            if not raw_name:
                continue
            raw_roles = (row.get(roles_col) or "") if roles_col else ""

            roles = split_roles(raw_roles)
            if raw_roles:
                for token in re.split(r"[;,/|]+", raw_roles):
                    t = token.strip()
                    if t and canonical_role(t) is None and t not in unknown_roles:
                        unknown_roles.append(t)

            rows.append(CsvRow(nombre=raw_name, roles=roles))

        return rows, unknown_roles


def main() -> int:
    parser = argparse.ArgumentParser(description="Importa publicadores desde CSV a Firestore.")
    parser.add_argument("--csv", required=True, help="Ruta al archivo CSV exportado.")
    parser.add_argument("--congre", required=True, help="ID de congregación (ej: sur).")
    parser.add_argument("--service-account", default="serviceAccountKey.json", help="Ruta al JSON de credenciales Firebase Admin.")
    parser.add_argument("--name-column", default=None, help="Nombre exacto de columna con el nombre del publicador.")
    parser.add_argument("--roles-column", default=None, help="Nombre exacto de columna con roles.")
    parser.add_argument("--dry-run", action="store_true", help="No escribe cambios, solo muestra plan.")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise FileNotFoundError(f"No existe CSV: {csv_path}")

    cred_path = Path(args.service_account)
    if not cred_path.exists():
        raise FileNotFoundError(f"No existe service account: {cred_path}")

    rows, unknown_roles = read_rows(csv_path, args.name_column, args.roles_column)
    if not rows:
        print("No se encontraron filas válidas en el CSV.")
        return 0

    print(f"Filas leídas: {len(rows)}")
    if unknown_roles:
        print("Roles no reconocidos (se ignoran):")
        for r in unknown_roles:
            print(f"  - {r}")

    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(str(cred_path)))
    db = firestore.client()

    pub_col = db.collection("congregaciones").document(args.congre).collection("publicadores")
    existentes: dict[str, tuple[str, dict]] = {}
    for snap in pub_col.stream():
        data = snap.to_dict() or {}
        nombre = data.get("nombre", "")
        if nombre:
            existentes[normalize(nombre)] = (snap.id, data)

    creates = 0
    updates = 0
    unchanged = 0

    for row in rows:
        key = normalize(row.nombre)
        if not key:
            continue

        if key in existentes:
            doc_id, actual = existentes[key]
            actuales_roles = list(actual.get("roles", []))
            merged_roles = sorted(set(actuales_roles) | set(row.roles))
            payload = {
                "nombre": row.nombre.strip(),
                "roles": merged_roles,
                "activo": bool(actual.get("activo", True)),
            }
            if payload["nombre"] != actual.get("nombre") or payload["roles"] != actuales_roles:
                updates += 1
                print(f"[UPDATE] {payload['nombre']} -> roles={payload['roles']}")
                if not args.dry_run:
                    pub_col.document(doc_id).set(payload, merge=True)
            else:
                unchanged += 1
        else:
            payload = {
                "nombre": row.nombre.strip(),
                "roles": sorted(set(row.roles)),
                "activo": True,
            }
            creates += 1
            print(f"[CREATE] {payload['nombre']} -> roles={payload['roles']}")
            if not args.dry_run:
                pub_col.add(payload)

    print("\nResumen:")
    print(f"  Crear:     {creates}")
    print(f"  Actualizar:{updates}")
    print(f"  Sin cambio:{unchanged}")
    print(f"  Modo:      {'DRY RUN' if args.dry_run else 'EJECUTADO'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

