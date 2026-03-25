# CLAUDE.md — AppJW (repo: AppJWCongSur)

Repo **oficial** de la Territory App para **múltiples congregaciones**, hosteada en `congsur.lat`.
Migrado desde el fork de desarrollo (`testpa`) donde se migró el backend
de Google Apps Script + Google Sheets a **Firebase Firestore**, y se agregó soporte
**multi-congregación**.

La migración está **completa**. No hay más llamadas a Apps Script (salvo el botón
opcional "Guardar también en planilla" del módulo de asignaciones).

---

## Arquitectura (Firestore)

```
congregaciones/{congreId}/
  ├── (doc: nombre, pinEncargado, color, creadoEn, scriptUrl?, sheetsUrl?)
  ├── grupos/{grupoId}         → id, label, color, pin
  ├── territorios/{terrId}     → id, nombre, tipo, grupoId, punto, poligonos
  ├── historial/{entryId}      → conductor, fechaInicio, fechaFin, territorioId
  ├── salidas/{salidaId}       → salidas por semana
  ├── publicadores/{pubId}     → nombre, roles, activo
  └── asignaciones/{docId}     → fecha, diaSemana, roles

config/superadmin              → pin  ← PIN del panel de admin
```

### Campos opcionales del doc de congregación
| Campo | Descripción |
|-------|-------------|
| `color` | Hex del color de la card en index.html (ej: `"#1D9E75"`). Si no existe, se deriva por hash del ID. |
| `scriptUrl` | URL del Apps Script de la hoja de asignaciones. Activa el botón "Guardar también en planilla". |
| `sheetsUrl` | URL del Google Sheets. Activa el botón "Ver planilla" en el panel del encargado. |

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
    ├── sync_historial.py       # Sync incremental de historial desde Excel → Firestore
    ├── codigodeappscript       # Apps Script de la hoja de asignaciones (Congregación Sur)
    ├── territorios_sur.json
    └── congregacionsur.kml
    # *.xlsx → fuente de datos (no commitear)
```

---

## Panel de Admin (`admin.html`)

Acceso: URL directa → PIN (desde `config/superadmin → { pin }` en Firestore).

**Funcionalidades:**
- Listar congregaciones existentes
- **Crear congregación** (wizard 3 pasos):
  1. Nombre + ID slug (auto-sugerido) + PIN encargado + **color** (random de paleta, editable con swatches)
  2. Configurar grupos: label, color, PIN — se pueden agregar/quitar grupos
  3. Subir KML de Google My Maps (opcional) → parsea polígonos client-side
- **Editar** congregación (nombre, PIN, color, grupos)
- **Eliminar** congregación (borra todas las subcolecciones + doc)
- **Asignar territorios a grupos** (📍): lista de territorios con botones de color,
  filtros por grupo, barra de guardado con batch update

**Paleta de colores** (`PALETA_COLORES` en `admin.js`):
`#378ADD`, `#97C459`, `#7F77DD`, `#EF9F27`, `#1D9E75`, `#D85A30`

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

### Roles de reunión (tabla semanal)
`LECTOR`, `SONIDO_1`, `SONIDO_2`, `PLATAFORMA`, `MICROFONISTAS_1`, `MICROFONISTAS_2`,
`ACOMODADOR_AUDITORIO`, `ACOMODADOR_ENTRADA`, `PRESIDENTE`, `REVISTAS`, `PUBLICACIONES`

### Roles en lista de publicadores (Firestore)
Los publicadores se guardan con roles sin número: `SONIDO`, `MICROFONISTAS` (sin `_1`/`_2`).
El `ROL_LISTA_MAP` los mapea al cargar:
```js
const ROL_LISTA_MAP = {
  SONIDO:          'SONIDO_1',
  SONIDO_2:        'SONIDO_1',   // ambos slots usan la misma lista
  MICROFONISTAS:   'MICROFONISTAS_1',
  MICROFONISTAS_2: 'MICROFONISTAS_1',
};
```

### Roles extra (solo en lista de publicadores)
`CONDUCTOR_GRUPO_1..4`, `CONDUCTOR_CONGREGACION`

### Gestionar hermanos
- Lista ordenada alfabéticamente al cargar (`norm().localeCompare`)
- Filtro por rol: `<select id="gestionar-rol">` vacío por defecto, combina con buscador por nombre

### Generar automático
Todos los inputs y checkboxes son funcionales:

- **`#auto-desde` / `#auto-hasta`**: rango de generación. Se pre-llenan al entrar con la semana siguiente a la última fecha guardada en Firestore → +3 meses.
- **Chips rápidos**: "Desde última guardada" y "Desde hoy" → dispatcha `change` event para actualizar el picker custom de `upgradeInputs`.
- **"Tener en cuenta historial previo"** (`#auto-usar-historial`): cuando activo, busca el último asignado por rol en el historial y arranca la rotación desde el siguiente. Sin él, usa `filasOrd.length % lista.length`.
- **"Reemplazar semanas existentes"** (`#auto-reemplazar`): cuando activo, incluye en la generación fechas que ya tienen datos en el rango (no las saltea).

**Algoritmo de generación:**
- Round-robin por rol con `indices[r]`
- `SONIDO_2` y `MICROFONISTAS_2` se inicializan con offset +1 respecto a `_1` para no coincidir en la misma reunión
- `PRESIDENTE` se omite en Miércoles (igual que en el editor manual)
- Por reunión: `Set enEstaReunion` detecta conflictos — si una persona ya tiene un rol en esa reunión, se salta al siguiente disponible en la lista

### Integración con Google Sheets (opcional por congregación)
Si `congregaciones/{congreId}.scriptUrl` está en Firestore:
- Aparece botón **"Guardar también en planilla"** en el generador automático
- Envía cada reunión de a una (fetch `no-cors`) para evitar el límite de URL de Apps Script (~2KB)
- La respuesta es opaca (`no-cors`) — no se puede confirmar éxito, se asume OK

Si `congregaciones/{congreId}.sheetsUrl` está en Firestore:
- Aparece botón **"Ver planilla"** en el panel del encargado → abre la URL en nueva pestaña

El Apps Script de referencia está en `tools/codigodeappscript` (SHEET_ID de Congregación Sur).

### Datos relevantes
- PIN encargado: viene de `congregaciones/{congreId}.pinEncargado`

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
| `upgradeInputs(container)` | Reemplaza inputs date/time/select por pickers custom. Se ejecuta en DOMContentLoaded y en MutationObserver. **Al setear `.value` programáticamente hay que disparar `dispatchEvent(new Event('change', { bubbles: true }))` para que el picker actualice su display.** |

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

- No eliminar la integración con Apps Script del módulo de asignaciones — es opcional pero funcional
- No hardcodear polígonos de territorios en HTML/JS
- No usar `toISOString()` para fechas (bug UTC-3)
- No commitear `tools/serviceAccountKey.json` ni archivos `.xlsx`
- No fetchear el KML de Google My Maps en runtime (CORS)
- No usar `confirm()`, `alert()`, `prompt()` nativos
- No setear `.value` en inputs upgradeados sin disparar el evento `change`
