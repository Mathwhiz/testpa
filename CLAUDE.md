# CLAUDE.md — AppJW (repo: testpa)

Repo de desarrollo activo de la Territory App para **múltiples congregaciones**.
Fork del repo original (`mathwhiz.github.io/TerritoryAppJW`) donde se migró el backend
de Google Apps Script + Google Sheets a **Firebase Firestore**, y se agregó soporte
**multi-congregación**.

La migración está **completa**. No hay más llamadas a Apps Script.

---

## Arquitectura (Firestore)

```
congregaciones/{congreId}/
  ├── (doc: nombre, pinEncargado, creadoEn)
  ├── grupos/{grupoId}         → id, label, color, pin
  ├── territorios/{terrId}     → id, nombre, tipo, grupoId, punto, poligonos
  ├── historial/{entryId}      → conductor, fechaInicio, fechaFin, territorioId
  ├── salidas/{salidaId}       → salidas por semana
  ├── publicadores/{pubId}     → nombre, roles, activo
  └── asignaciones/{docId}     → fecha, diaSemana, roles

config/superadmin              → pin  ← PIN del panel de admin
```

Flujo de navegación:
1. `index.html` — elige congregación **y** módulo (dos vistas en la misma página, sin navegar)
   - Vista 1: lista de congregaciones
   - Vista 2: selector de módulo (Territorios o Asignaciones) — aparece al hacer click
   - Si hay `congreId` en `sessionStorage`, salta directo a la vista 2
2. `territorios/index.html` o `asignaciones/index.html`
3. Al volver ("← Volver al módulo") → `../index.html` → muestra vista 2 automáticamente

El ID de congregación es un slug legible (ej: `"sur"`, `"norte"`), elegido al crear.

---

## Estructura de archivos

```
/
├── index.html          # SPA: vista 1 = elegir congregación · vista 2 = elegir módulo
│                       # Botón Admin (engranaje morado) fijo abajo a la derecha
├── menu.html           # Redirect → index.html (conservado por compatibilidad)
├── admin.html          # Panel de superadmin (acceso por URL + PIN)
├── admin.js            # Lógica del panel de admin
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
└── tools/              # Scripts de migración y sync (conservar como referencia)
    ├── kml_to_json.py
    ├── migrate_sheets.py
    ├── upload_territorios.py
    ├── sync_historial.py   # Sync incremental de historial desde Excel → Firestore
    ├── territorios_sur.json
    └── congregacionsur.kml
    # Registro de Asignación de Territorio.xlsx → fuente de datos (no commitear)
```

---

## Panel de Admin (`admin.html`)

Acceso: URL directa → PIN (desde `config/superadmin → { pin }` en Firestore).

**Funcionalidades:**
- Listar congregaciones existentes
- **Crear congregación** (wizard 3 pasos):
  1. Nombre + ID slug (auto-sugerido, ej: `"norte"`) + PIN encargado
  2. Configurar grupos: label, color, PIN — se pueden agregar/quitar grupos
  3. Subir KML de Google My Maps (opcional) → parsea polígonos client-side
- **Editar** congregación (nombre, PIN, grupos)
- **Eliminar** congregación (borra todas las subcolecciones + doc)
- **Asignar territorios a grupos** (📍): lista de territorios con botones de color,
  filtros por grupo, barra de guardado con batch update

**KML parser** (`parseKML` en `admin.js`):
- Soporta nombres `"1"`, `"92a"`, `"Territorio 1"`, `"Territorio 1a"`
- Usa `getElementsByTagName` (compatible con distintos formatos de Google My Maps)
- Coordenadas KML en formato `lng,lat,alt` → convierte a `{ lat, lng }`

---

## Stack

- **Frontend:** HTML + CSS + JS vanilla (sin frameworks, sin bundler)
- **Hosting:** GitHub Pages (repo testpa)
- **Base de datos:** Firebase Firestore (`appjw-3697e`)
- **Mapa:** Leaflet.js + OpenStreetMap
- **Imagen para compartir:** html2canvas (CDN)
- **Analytics:** PostHog
- **Auth:** ninguna — acceso por PIN por grupo / PIN superadmin

---

## Firebase

```js
// Importar así en cada módulo:
import { db } from '../firebase.js';
```

- Firebase SDK 11.6.0 (ES modules via gstatic CDN)
- Scripts que usan firebase.js necesitan `type="module"` en el HTML
- `tools/serviceAccountKey.json` está en `.gitignore` — nunca commitear

---

## Módulo de Territorios

### Grupos (defaults — vienen de Firestore en runtime)

| Grupo | Color | PIN |
|-------|-------|-----|
| 1 | `#378ADD` | 1111 |
| 2 | `#EF9F27` | 2222 |
| 3 | `#97C459` | 3333 |
| 4 | `#D85A30` | 4444 |
| Congregación | `#7F77DD` | 5555 |

Los PINs se cargan desde `congregaciones/{congreId}/grupos` al iniciar `territorios/app.js`.

### Territorios especiales
- Tipo `no_predica`: territorio 131
- Tipo `peligroso`: territorio 11

### Mapa (`mapa.html`)

Modos via URL params:
- `?modo=full` — mapa completo con filtros por grupo
- `?modo=info` — coloreado por días desde último uso
- `?modo=registrar&enprogreso=92,113,...` — solo territorios en progreso
- `?modo=picker&grupo=3&salidaid=2` — selector; devuelve resultado al padre via `postMessage`

Sub-polígonos usan sufijos letra (92a, 92b) que mapean al mismo territorio base.

### Formato de territorio en Firestore

```js
{
  id:       1,
  nombre:   "Territorio 1",
  tipo:     "normal" | "peligroso" | "no_predica",
  grupoId:  "3",           // null si no asignado
  punto:    { lat, lng },  // centro para label (puede ser null)
  poligonos: [{ coords: [{ lat, lng }, ...] }]
}
```

---

## Módulo de Asignaciones

### Roles de reunión
`LECTOR`, `SONIDO`, `PLATAFORMA`, `MICROFONISTAS`,
`ACOMODADOR_AUDITORIO`, `ACOMODADOR_ENTRADA`, `PRESIDENTE`, `REVISTAS`, `PUBLICACIONES`

### Roles extra (solo en lista de publicadores)
`CONDUCTOR_GRUPO_1..4`, `CONDUCTOR_CONGREGACION`

### Gestionar hermanos
- Lista ordenada alfabéticamente al cargar (`norm().localeCompare`)
- Filtro por rol: `<select id="gestionar-rol">` vacío por defecto, combina con buscador por nombre

### Generar automático
- Inputs `#auto-desde` / `#auto-hasta` **funcionales**: se pre-llenan con hoy/+3 meses al entrar a la vista y el botón ⚡ Generar los respeta
- Checkboxes "Tener en cuenta historial previo" y "Reemplazar semanas existentes": **visibles pero sin lógica** — pendiente implementar

### Datos relevantes
- PIN encargado: viene de `congregaciones/{congreId}.pinEncargado`
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
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
```

Formato de almacenamiento: `YYYY-MM-DD`. Display: `DD/MM/YY`.

---

## Estilos

> El sistema visual completo está documentado en **[UI-STYLE.md](./UI-STYLE.md)**.
> Leerlo antes de crear o editar cualquier interfaz.

- Tema oscuro con gradiente sutil: `#1a1c1f` bg · `#e8e8e8` texto · `#232628` cards · `#252525` modales
- Max-width: apps `480px`, covers `320–340px`
- Fuente: `system-ui, sans-serif` — sin Google Fonts
- Vistas con clase `.view` tienen `fadeIn` 0.2s
- Versionado de assets: `styles.css?v=X.X` — incrementar al hacer cambios
- El estilo flat shadcn/oklch fue explorado y **descartado** — no usar

---

## Lo que NO hacer

- No crear llamadas a Google Apps Script (`SCRIPT_URL`) — ya no existe
- No hardcodear polígonos de territorios en HTML/JS
- No usar `toISOString()` para fechas (bug UTC-3)
- No commitear `tools/serviceAccountKey.json`
- No fetchear el KML de Google My Maps en runtime (CORS)
- No usar `confirm()`, `alert()`, `prompt()` nativos
