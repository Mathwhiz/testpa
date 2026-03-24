# CLAUDE.md — Territory App (congsur.lat)

## Visión general

App web interna para **Congregación Sur** (Santa Rosa, La Pampa, Argentina).
Dos módulos: **Territorios** y **Asignaciones**, accesibles desde `index.html`.
Hosteada en GitHub Pages (`mathwhiz.github.io/TerritoryAppJW`), dominio custom `congsur.lat`.
Backend: Google Apps Script + Google Sheets. Control de versiones con GitHub Desktop.

---

## Estructura de archivos
```
/
├── index.html              # Pantalla principal (selección de módulo)
├── ui-utils.js             # Utilidades UI compartidas
├── favicon.svg
├── CNAME                   # congsur.lat
├── congregacionsur.kml     # KML de territorios (no se fetchea — CORS)
├── territorios/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── mapa.html           # Mapa Leaflet + OSM
└── asignaciones/
    ├── index.html
    ├── styles.css
    └── app.js
```

---

## Backend

Google Sheet ID: `1YzCipjiHfQ6MZxfL2HI655E7bGP5xCPLJ_1-6hgjg_0`

**CORS crítico:** Todas las llamadas al Apps Script usan GET simple sin headers.
- Territorios: `fetch()` directo
- Asignaciones: JSONP via `apiFetch()`

No agregar headers ni cambiar a POST.

---

## Grupos

| Grupo | Color | PIN |
|-------|-------|-----|
| 1 | `#378ADD` | `1111` |
| 2 | `#EF9F27` | `2222` |
| 3 | `#97C459` | `3333` |
| 4 | `#D85A30` | `4444` |
| C | `#7F77DD` | `5555` |

Territorios especiales: `131` → `no_predica`, `11` → `peligroso` (en Config sheet)

---

## Módulo Territorios

### Flujo
```
Cover → PIN → Menú → Planificar / Registrar / Ver grupo / Historial / Mapa
```

### Plantillas de salidas
- **Grupos 1–4:** 1 tel (mar 17:30) + 3 campo (mar/jue/vie 18:30)
- **Congregación:** 7 campo (lun-dom) + bloque tel fija (ID `844 0225 6636` / clave `479104`)

### Regla crítica de fechas
```js
// ✅ Correcto
`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

// ❌ Nunca — bug UTC-3
d.toISOString().split('T')[0]
```
Sheets: fechas con prefijo apóstrofe `'DD/MM/YY` para evitar conversión serial.

### Mapa (`mapa.html`)
- Polígonos embebidos en array `TERRITORIOS` (no se fetchean del KML)
- Sub-polígonos con sufijo letra → `baseNum()` los agrupa
- Modos via query string: `full`, `picker&salidaid=N`, `registrar`, `info`
- Picker devuelve: `postMessage({ type: 'picker-result', salidaId, territorios })`
- Navegación entre módulo y mapa via `sessionStorage.setItem('selectedGrupo', grupo)`

---

## Módulo Asignaciones

### Roles en tabla
`LECTOR`, `SONIDO_1/2`, `PLATAFORMA`, `MICROFONISTAS_1/2`, `ACOMODADOR_AUDITORIO`,
`ACOMODADOR_ENTRADA`, `PRESIDENTE` (omitido Miércoles), `REVISTAS`, `PUBLICACIONES`

### PIN encargado
`PIN_ENCARGADO = '1234'` (hardcodeado en `asignaciones/app.js`)

---

## ui-utils.js — API pública

| Función | Descripción |
|---------|-------------|
| `uiConfirm({title, msg, confirmText, cancelText, type})` | Modal confirm. `type`: `warn`/`danger`/`info`/`purple` |
| `uiAlert(msg, title)` | Modal informativo |
| `uiDatePicker({value, min, label})` | Bottom sheet fecha |
| `uiTimePicker({value, label})` | Bottom sheet hora (teclado numérico) |
| `uiConductorPicker({conductores, value, label})` | Bottom sheet con búsqueda |
| `uiTerritorioPicker({territoriosData, allData, grupo, configData, label})` | Bottom sheet territorios |
| `uiLoading.show(text)` / `.hide()` | Overlay de carga |
| `uiToast(msg, type)` | Toast. `type`: `success`/`error` |
| `upgradeInputs(container)` | Reemplaza inputs date/time/select por botones con pickers |

**Nunca usar `confirm()`, `alert()`, `prompt()` nativos.**

`upgradeInputs()` se auto-ejecuta via `MutationObserver`. Llamarlo manualmente en nodos dinámicos si es necesario.

---

## Estilos

- Tema oscuro: `#1e1e1e` bg · `#eee` texto · `#2a2a2a` cards · `#252525` modales
- Max-width: apps `480px`, covers `320–340px`
- Fuente: `system-ui, sans-serif`
- Vistas con clase `.view` tienen `fadeIn` 0.2s
- `.btn-home`: `fixed top-right`, oculto por defecto, visible con `.visible`
- `.offline-banner`: `fixed top`, oculto por defecto, visible con `.visible`
- Los inputs de fecha/hora se reemplazan visualmente por `.ui-fake-input` via `upgradeInputs()`

Versionado de assets: `styles.css?v=1.1` — incrementar al hacer cambios.

---

## Pendiente

- Confirmar conductores de Grupos 1, 2, 4 con sus líderes
- Compartir app con otros líderes una vez completa

## Fuera de scope

- Modo offline / Service Worker
- Validación en Sheets
- Compartir tabla por WhatsApp como texto (solo imagen via `html2canvas`)
