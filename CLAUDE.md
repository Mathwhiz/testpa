# CLAUDE.md — Territory App (repo: testpa)

Repo de desarrollo activo de la Territory App para **múltiples congregaciones**.
Fork del repo original (`mathwhiz.github.io/TerritoryAppJW`) donde se migró el backend
de Google Apps Script + Google Sheets a **Firebase Firestore**, y se agregó soporte
**multi-congregación**.

---

## Estado actual

La migración a Firestore está **completa**. No hay más llamadas a Apps Script.

**Lo único pendiente:**
- PINs de grupos (1111, 2222, etc.) hardcodeados en `territorios/app.js` — deberían venir de `congregaciones/{congreId}/grupos/{id}.pin`
- PIN del encargado (`1234`) hardcodeado en `asignaciones/app.js` — debería venir de `congregaciones/{congreId}.pinEncargado`

---

## Arquitectura (Firestore)

```
congregaciones/{congreId}/
  ├── (doc: nombre, pinEncargado, ...)
  ├── grupos/{grupoId}         → color, pin, conductor
  ├── territorios/{terrId}     → polígonos, punto, grupoId, tipo
  ├── historial/{entryId}      → conductor, fechaInicio, fechaFin, territorioId
  ├── salidas/{salidaId}       → salidas por semana
  ├── publicadores/{pubId}     → hermanos y sus roles
  └── asignaciones/{docId}     → programación de roles por reunión
```

Flujo de navegación:
1. `index.html` — elige congregación (lee de Firestore → guarda en `sessionStorage`)
2. `menu.html` — elige módulo (Territorios o Asignaciones)
3. `territorios/index.html` o `asignaciones/index.html`

---

## Estructura de archivos

```
/
├── index.html          # Selector de congregación
├── menu.html           # Selector de módulo
├── firebase.js         # Inicialización compartida de Firebase (exporta `db`)
├── ui-utils.js         # Componentes UI: modales, pickers, loading, toast
├── favicon.svg
├── territorios/
│   ├── index.html      # App de territorios
│   ├── app.js          # Lógica principal (100% Firestore)
│   ├── styles.css
│   └── mapa.html       # Mapa Leaflet — polígonos desde Firestore
├── asignaciones/
│   ├── index.html      # App de asignaciones
│   ├── app.js          # Lógica de asignaciones (100% Firestore)
│   └── styles.css
├── congres/
│   └── config.json     # Legacy, ya no se usa
└── tools/
    ├── kml_to_json.py          # KML → JSON (ya se usó)
    ├── migrate_sheets.py       # Excel → Firestore (ya se usó)
    ├── upload_territorios.py   # Sube territorios_sur.json a Firestore (ya se usó)
    ├── territorios_sur.json    # Datos de ~196 territorios (ya subidos)
    └── congregacionsur.kml     # KML fuente
```

---

## Stack

- **Frontend:** HTML + CSS + JS vanilla (sin frameworks, sin bundler)
- **Hosting:** GitHub Pages (repo testpa)
- **Base de datos:** Firebase Firestore (`appjw-3697e`)
- **Mapa:** Leaflet.js + OpenStreetMap
- **Imagen para compartir:** html2canvas (CDN)
- **Analytics:** PostHog
- **Auth:** ninguna — acceso por PIN por grupo

---

## Firebase

```js
// Importar así en cada módulo:
import { db } from '../firebase.js';
```

- Firebase SDK 11.6.0 (ES modules)
- Los scripts que usan firebase.js necesitan `type="module"` en el HTML
- `tools/serviceAccountKey.json` está en `.gitignore` — nunca commitear

---

## Módulo de Territorios

### Grupos

| Grupo | Color | PIN |
|-------|-------|-----|
| 1 | `#378ADD` | 1111 |
| 2 | `#EF9F27` | 2222 |
| 3 | `#97C459` | 3333 |
| 4 | `#D85A30` | 4444 |
| Congregación | `#7F77DD` | 5555 |

### Territorios especiales
- Tipo `no_predica`: territorio 131
- Tipo `peligroso`: territorio 11

### Mapa (`mapa.html`)

Modos via URL params:
- `?modo=full` — mapa completo con filtros por grupo
- `?modo=info` — coloreado por días desde último uso
- `?modo=registrar&enprogreso=92,113,...` — solo territorios en progreso
- `?modo=picker&grupo=3&salidaid=2` — selector; devuelve resultado al padre via `postMessage`

Sub-polígonos usan sufijos letra (92a, 92b, 92c) que mapean al mismo territorio.

### Formato de territorio en Firestore

```js
{
  id: 1,
  nombre: "Territorio 1",
  grupoId: "3",
  tipo: "normal" | "peligroso" | "no_predica",
  punto: { lat: -36.626487, lng: -64.279078 },
  poligonos: [{ coords: [{ lat, lng }, ...] }]
}
```

---

## Módulo de Asignaciones

### Roles de reunión
`LECTOR`, `SONIDO_1`, `SONIDO_2`, `PLATAFORMA`, `MICROFONISTAS_1`, `MICROFONISTAS_2`,
`ACOMODADOR_AUDITORIO`, `ACOMODADOR_ENTRADA`, `PRESIDENTE`, `REVISTAS`, `PUBLICACIONES`

### Roles extra (solo en lista de publicadores)
`CONDUCTOR_GRUPO_1`, `CONDUCTOR_GRUPO_2`, `CONDUCTOR_GRUPO_3`, `CONDUCTOR_GRUPO_4`,
`CONDUCTOR_CONGREGACION`

### Datos relevantes
- PIN encargado: `1234` (hardcodeado en `asignaciones/app.js`, pendiente mover a Firestore)
- Telefónica fija: ID `844 0225 6636` / Contraseña `479104`

---

## ui-utils.js

| Función | Descripción |
|---------|-------------|
| `uiConfirm({ title, msg, confirmText, cancelText, type })` | Modal confirm. `type`: `warn`/`danger`/`info`/`purple` |
| `uiAlert(msg, title)` | Modal informativo |
| `uiDatePicker({ value, min, label })` | Picker de fecha |
| `uiTimePicker({ value, label })` | Picker de hora (teclado numérico) |
| `uiConductorPicker({ conductores, value, label, color })` | Selector con búsqueda |
| `uiTerritorioPicker({ territoriosData, allData, grupo, configData, label, color })` | Selector de territorio |
| `uiLoading.show(text)` / `uiLoading.hide()` | Overlay de carga |
| `uiToast(msg, type, duration)` | Toast. `type`: `success`/`error` |
| `upgradeInputs(container)` | Reemplaza inputs date/time/select por pickers custom |

**Nunca usar `confirm()`, `alert()`, `prompt()` nativos.**

---

## Convenciones de fechas

Siempre formatear con hora local — nunca `toISOString()` (bug UTC-3).

```js
// Correcto:
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
```

Formato de almacenamiento: `YYYY-MM-DD`. Display: `DD/MM/YY`.

---

## Estilos

- Tema oscuro: `#1e1e1e` bg · `#eee` texto · `#2a2a2a` cards · `#252525` modales
- Max-width: apps `480px`, covers `320–340px`
- Fuente: `system-ui, sans-serif`
- Vistas con clase `.view` tienen `fadeIn` 0.2s
- Versionado de assets: `styles.css?v=X.X` — incrementar al hacer cambios

---

## Lo que NO hacer

- No crear llamadas a Google Apps Script (`SCRIPT_URL`) — ya no existe
- No hardcodear polígonos de territorios en HTML/JS
- No usar `toISOString()` para fechas (bug UTC-3)
- No commitear `tools/serviceAccountKey.json`
- No fetchear el KML de Google My Maps en runtime (CORS)
- No usar `confirm()`, `alert()`, `prompt()` nativos
