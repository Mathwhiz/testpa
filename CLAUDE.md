# CLAUDE.md — Territory App (repo: testpa)

Este es el repo de **desarrollo activo** de la Territory App para Congregación Sur,
Santa Rosa, La Pampa, Argentina. Es un fork de pruebas del repo original
(`mathwhiz.github.io/TerritoryAppJW`) donde se están haciendo cambios grandes,
principalmente la migración del backend de Google Apps Script + Google Sheets
a **Firebase (Firestore)**, y la re-arquitectura para soporte **multi-congregación**.

---

## Estado actual del proyecto

La app está en transición. El backend original era Google Apps Script + Google Sheets.
Ese sistema **está siendo reemplazado por Firestore** y ya no debe usarse como referencia
para nuevas funcionalidades. Los archivos `tools/migrate_sheets.py` y
`tools/territorios_sur.json` son artefactos de esa migración.

**Lo que ya se migró:**
- Datos de territorios exportados a `territorios_sur.json`
- Script de migración a Firestore disponible en `tools/migrate_sheets.py`

**Lo que falta:**
- Subir `territorios_sur.json` a Firestore con el formato correcto
- Reemplazar las llamadas a `SCRIPT_URL` (Google Apps Script) en `territorios/app.js`
  por llamadas a Firestore
- Hacer que `territorios/mapa.html` cargue los polígonos desde Firestore en lugar del
  array hardcodeado `TERRITORIOS`
- Migrar el módulo de asignaciones (`asignaciones/app.js`) de su propio Apps Script
  a Firestore
- Todo el historial de territorios y salidas a Firestore

---

## Arquitectura objetivo (multi-congregación con Firestore)

```
congregaciones/{congreId}/
  ├── (doc de config: nombre, pinEncargado, etc.)
  ├── grupos/{grupoId}         → colores, PINs, conductores
  ├── territorios/{terrId}     → polígonos, punto central, grupo, tipo
  ├── historial/{entryId}      → conductor, fechaInicio, fechaFin, territorioId
  ├── salidas/{salidaId}       → salidas registradas por semana
  ├── publicadores/{pubId}     → hermanos y sus roles
  └── asignaciones/{docId}     → programación de roles por reunión
```

El flujo de navegación:
1. `index.html` — el usuario elige su congregación (leída de Firestore)
2. `menu.html` — elige el módulo (Territorios o Asignaciones)
3. `territorios/index.html` o `asignaciones/index.html` — funcionalidad específica

La congregación seleccionada se guarda en `sessionStorage` (`congreId`, `congreNombre`)
y se usa en todas las pantallas siguientes.

---

## Estructura de archivos

```
/
├── index.html          # Selector de congregación (lee de Firestore)
├── menu.html           # Selector de módulo
├── firebase.js         # Inicialización compartida de Firebase
├── ui-utils.js         # Componentes UI: modales, pickers, loading, toast, etc.
├── favicon.svg
├── territorios/
│   ├── index.html      # App de territorios (cover, planificador, registrar, info, historial)
│   ├── app.js          # Lógica principal de territorios
│   ├── styles.css
│   └── mapa.html       # Mapa Leaflet con polígonos de territorios
├── asignaciones/
│   ├── index.html      # App de asignaciones de reunión
│   ├── app.js          # Lógica de asignaciones
│   └── styles.css
├── congres/
│   └── config.json     # Config local de congregación (legacy, reemplazar con Firestore)
└── tools/
    ├── kml_to_json.py          # Convierte KML de Google My Maps a JSON
    ├── migrate_sheets.py       # Migra Excel a Firestore
    ├── territorios_sur.json    # Datos de territorios de Sur (listos para subir)
    └── congregacionsur.kml     # KML fuente de los polígonos
```

---

## Stack técnico

- **Frontend:** HTML + CSS + JS vanilla (sin frameworks)
- **Hosting:** GitHub Pages (repo testpa)
- **Base de datos:** Firebase Firestore
- **Autenticación:** ninguna (acceso por PIN por grupo, hardcodeado en el cliente)
- **Mapa:** Leaflet.js + OpenStreetMap tiles
- **Imagen para compartir:** html2canvas (CDN)
- **Analytics:** PostHog (snippet en los HTML)
- **CORS:** las llamadas a Firestore no tienen problemas de CORS a diferencia del Apps Script

---

## Firebase

Proyecto: `appjw-3697e`

```js
// firebase.js — importar así en cada módulo:
import { db } from '../firebase.js';
```

El archivo `firebase.js` en la raíz inicializa la app y exporta `db` (Firestore).
Usa módulos ES (`import/export`), por eso los scripts que lo usan necesitan
`type="module"` en el HTML.

**Importante:** `tools/serviceAccountKey.json` está en `.gitignore` y nunca debe
commitearse.

---

## Módulo de Territorios

### Configuración de grupos

| Grupo | Color | PIN |
|-------|-------|-----|
| 1 | `#378ADD` | 1111 |
| 2 | `#EF9F27` | 2222 |
| 3 | `#97C459` | 3333 |
| 4 | `#D85A30` | 4444 |
| Congregación | `#7F77DD` | 5555 |

### Territorios especiales (Config en Firestore)
- `131` → no se predica
- `11` → peligroso

### El mapa (`mapa.html`)

Usa Leaflet.js con tiles de OpenStreetMap. Actualmente tiene el array `TERRITORIOS`
hardcodeado con ~196 polígonos extraídos del KML. **El objetivo es reemplazar ese array
por una carga desde Firestore** usando el `congreId` de `sessionStorage`.

Modos de operación del mapa (via URL params):
- `?modo=full` — mapa completo con filtros por grupo
- `?modo=info` — coloreado por días desde último uso
- `?modo=registrar&enprogreso=92,113,...` — muestra solo territorios en progreso
- `?modo=picker&grupo=3&salidaid=2` — selector de territorio para el planificador;
  devuelve resultado al padre via `postMessage`

Los polígonos tienen sub-polígonos con sufijos a/b/c (ej: 92a, 92b, 92c) que mapean
al mismo número de territorio.

### Datos de territorios en Firestore

Formato del documento `territorios/{terrId}`:
```js
{
  id: 1,
  nombre: "Territorio 1",
  grupoId: "3",
  tipo: "normal" | "peligroso" | "no_predica",
  punto: [-36.626487, -64.279078],   // centro para label del mapa
  poligonos: [                        // lista de sub-polígonos
    [[-36.625657, -64.281306], ...]
  ]
}
```

---

## Módulo de Asignaciones

Gestiona la programación de roles para las reuniones (Miércoles y Sábado).

### Roles de reunión
`LECTOR`, `SONIDO_1`, `SONIDO_2`, `PLATAFORMA`, `MICROFONISTAS_1`, `MICROFONISTAS_2`,
`ACOMODADOR_AUDITORIO`, `ACOMODADOR_ENTRADA`, `PRESIDENTE`, `REVISTAS`, `PUBLICACIONES`

### Roles extra (solo para lista de hermanos)
`CONDUCTOR_GRUPO_1..4`, `CONDUCTOR_CONGREGACION`

### Telefónica fija de Congregación
- ID: `844 0225 6636`
- Contraseña: `479104`
- PIN encargado de asignaciones: `1234` (hardcodeado en `asignaciones/app.js`)

### Comunicación entre módulos
`territorios/app.js` consulta el módulo de asignaciones para obtener los conductores
por grupo. Actualmente lo hace via fetch al Apps Script de asignaciones. Con Firestore
leerá directamente de `congregaciones/{congreId}/publicadores` filtrando por rol.

---

## ui-utils.js

Librería de componentes UI compartida. Inyecta CSS global y expone:

- `uiConfirm({ title, msg, confirmText, cancelText, type })` → `Promise<boolean>`
- `uiAlert(msg, title)` → `Promise<void>`
- `uiDatePicker({ value, min, label })` → `Promise<string|null>` (ISO date)
- `uiTimePicker({ value, label })` → `Promise<string|null>` (HH:MM)
- `uiConductorPicker({ conductores, value, label, color })` → `Promise<string|null>`
- `uiTerritorioPicker({ territoriosData, allData, grupo, configData, label, color })` → `Promise<string|null>`
- `uiLoading.show(text)` / `uiLoading.hide()`
- `uiToast(msg, type, duration)`
- `upgradeInputs(container)` — reemplaza inputs `date`/`time`/`select` nativos por los pickers custom

---

## Convenciones de fechas

- **Siempre** formatear fechas con hora local, nunca `toISOString()` (causa bugs UTC-3)
- Formato de almacenamiento: `YYYY-MM-DD` como string
- Formato de display: `DD/MM/YY`

```js
// Correcto:
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
```

---

## Decisiones de arquitectura

- **Sin CORS con Firestore:** a diferencia del Google Apps Script que requería JSONP,
  Firestore SDK funciona directamente desde el browser sin problemas de CORS
- **KML no se fetchea en runtime:** los polígonos del mapa no se cargan del KML de
  Google My Maps porque tiene CORS. Se procesan offline con `kml_to_json.py` y se
  suben a Firestore
- **sessionStorage para navegación:** `congreId` y `congreNombre` persisten entre
  pantallas via `sessionStorage`
- **Sin build system:** todo JS vanilla, sin bundler, sin transpilación

---

## Lo que NO hacer

- No crear nuevas funcionalidades que consuman el Google Apps Script (`SCRIPT_URL`)
- No hardcodear datos de territorios en el HTML/JS (eso es lo que se está migrando)
- No usar `toISOString()` para fechas (timezone bug)
- No commitear `tools/serviceAccountKey.json`
- No fetchear el KML de Google My Maps en runtime (CORS)
