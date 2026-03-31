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
  ├── (doc: nombre, pinEncargado, color, creadoEn, scriptUrl?, sheetsUrl?,
  │         pinVidaMinisterio?, tieneAuxiliar?,
  │         ciudadPrincipal?, ciudadesExtras?)
  ├── grupos/{grupoId}         → id, label, color, pin
  ├── territorios/{terrId}     → id, nombre, tipo, grupoId, punto, poligonos, ciudad?, notas?
  │   └── historial/{entryId} → conductor, fechaInicio, fechaFin
  ├── salidas/{salidaId}       → grupoId, fechaReg, salidas[]
  ├── publicadores/{pubId}     → nombre, roles, activo
  ├── asignaciones/{docId}     → fecha, diaSemana, roles
  └── vidaministerio/{semanaId} → fecha, canciones, presidente, oraciones, tesoros, ministerio[], vidaCristiana[], tipoEspecial?

config/superadmin              → pin  ← PIN del panel de admin
```

### Campos opcionales del doc de congregación

| Campo | Descripción |
|-------|-------------|
| `color` | Hex del color de la card en index.html. Si no existe, se deriva por hash del ID. |
| `scriptUrl` | URL del Apps Script de asignaciones. Activa "Guardar también en planilla". |
| `sheetsUrl` | URL del Google Sheets. Activa "Ver planilla" en el panel del encargado. |
| `pinVidaMinisterio` | PIN del módulo VM (default `"1234"`). |
| `tieneAuxiliar` | `bool` — activa la sala auxiliar en el módulo VM. |
| `ciudadPrincipal` | Nombre de la ciudad principal (ej: `"Santa Rosa"`). |
| `ciudadesExtras` | Array `[{ nombre, offset }]` — ciudades extra con su offset de IDs (+1000, +2000…). |

### Navegación

1. `index.html` — elige congregación **y** módulo (dos vistas en la misma página)
   - Si hay `congreId` en `sessionStorage`, salta directo a la vista 2
2. `territorios/index.html`, `asignaciones/index.html` o `vida-ministerio/index.html`
3. Al volver ("← Volver al módulo") → `../index.html` → muestra vista 2 automáticamente

El ID de congregación es un slug legible (ej: `"sur"`, `"norte"`), elegido al crear.

---

## Estructura de archivos

```
/
├── index.html              # SPA: elegir congregación → elegir módulo
├── menu.html               # Redirect → index.html (compatibilidad)
├── admin.html              # Panel de superadmin (URL + PIN)
├── admin.js                # Lógica del panel de admin
├── firebase.js             # Inicialización compartida de Firebase (exporta `db`)
├── ui-utils.js             # Componentes UI: modales, pickers, loading, toast
├── favicon.svg
├── territorios/
│   ├── index.html          # App de territorios
│   ├── app.js              # Lógica principal (100% Firestore)
│   ├── styles.css
│   └── mapa.html           # Mapa Leaflet — polígonos desde Firestore
├── asignaciones/
│   ├── index.html          # App de asignaciones
│   ├── app.js              # Lógica de asignaciones (100% Firestore)
│   └── styles.css
├── vida-ministerio/
│   ├── index.html          # App de VM
│   ├── app.js              # Lógica principal
│   ├── programa.html       # Visor público solo lectura (sin PIN)
│   ├── programa.js         # Lógica del visor público
│   └── styles.css
└── tools/                  # Scripts de migración y sync (conservar como referencia)
    ├── kml_to_json.py
    ├── migrate_sheets.py
    ├── upload_territorios.py
    ├── sync_historial.py
    ├── import_vm_historial.py   # Importa historial VM desde Excel → Firestore
    ├── codigodeappscript        # Apps Script de asignaciones (Congregación Sur)
    ├── territorios_sur.json
    └── congregacionsur.kml
    # *.xlsx y serviceAccountKey.json → en .gitignore, nunca commitear
```

---

## Panel de Admin (`admin.html`)

Acceso: URL directa → PIN (desde `config/superadmin → { pin }` en Firestore).

**Funcionalidades:**
- Listar congregaciones existentes
- **Crear congregación** (wizard 3 pasos):
  1. Nombre + ID slug + PIN encargado + PIN VM + **color** (random de paleta, editable) + ciudad principal
  2. Configurar grupos: label, color, PIN
  3. KML ciudad principal (opcional) + **ciudades extra** (nombre + KML c/u, IDs con offset automático)
- **Editar** congregación (mismos campos)
- **Eliminar** congregación (borra todas las subcolecciones)
- **Asignar territorios a grupos** (📍): lista con filtros, batch update

**Paleta de colores** (`PALETA_COLORES`):
`#378ADD`, `#97C459`, `#7F77DD`, `#EF9F27`, `#1D9E75`, `#D85A30`

**KML parser** (`parseKML`):
- Soporta `"1"`, `"92a"`, `"Territorio 1"`, `"Territorio 1a"`
- Para ciudades extra: `id = parsedNum + offset` (ej: territorio 1 de ciudad extra 1 → ID 1001)
- El campo `ciudad` se setea al momento de guardar (no al parsear el KML)

---

## Stack

- **Frontend:** HTML + CSS + JS vanilla (sin frameworks, sin bundler)
- **Hosting:** GitHub Pages (repo AppJWCongSur), dominio `congsur.lat`
- **Base de datos:** Firebase Firestore (`appjw-3697e`)
- **Mapa:** Leaflet.js + OpenStreetMap
- **Imagen para compartir:** html2canvas (CDN)
- **Analytics:** PostHog
- **Auth:** ninguna — acceso por PIN por grupo / PIN superadmin

---

## Firebase

```js
import { db } from '../firebase.js';
```

- Firebase SDK 11.6.0 (ES modules via gstatic CDN)
- Scripts con firebase.js necesitan `type="module"` en el HTML

---

## Módulo de Territorios

### Grupos (vienen de Firestore en runtime)

| Grupo | Color | PIN (default) |
|-------|-------|---------------|
| 1 | `#378ADD` | 1111 |
| 2 | `#EF9F27` | 2222 |
| 3 | `#97C459` | 3333 |
| 4 | `#D85A30` | 4444 |
| Congregación | `#7F77DD` | 5555 |

### Territorios especiales
- Tipo `no_predica`: territorio 131
- Tipo `peligroso`: territorio 11

### Multi-ciudad (✅ implementado)

Algunas congregaciones predican en más de una ciudad. Soporte completo:
- Campo `ciudad` (string | null) en cada territorio: `null` = ciudad principal, `"Ataliva Roca"` = ciudad extra
- Territorios de ciudades extra siempre pertenecen al grupo `'C'` (Congregación)
- IDs con offset: ciudad extra 1 → +1000, ciudad extra 2 → +2000 (evita colisiones)
- `nombre` almacena el display (`"Territorio 1"`) independientemente del ID offset
- En `mapa.html` modo full: botones ciudad como filtro toggle con viewport dinámico (`maxBounds` + `minZoom` calculados desde polígonos reales de esa ciudad)
- En info grid ("ver mi grupo"): headers de ciudad cuando hay territorios de múltiples ciudades
- En picker de salidas: territorios de Congregación agrupados por ciudad

### Mapa (`mapa.html`)

Modos via URL params:
- `?modo=full` — mapa completo con filtros por grupo + botones de ciudad extra
- `?modo=info` — coloreado por días desde último uso
- `?modo=registrar&enprogreso=92,113,...` — solo territorios en progreso
- `?modo=picker&grupo=3&salidaid=2` — selector; devuelve resultado al padre via `postMessage`

Sub-polígonos usan sufijos letra (92a, 92b) que mapean al mismo territorio base.

### Formato de territorio en Firestore

```js
{
  id:        1,                        // número con offset para ciudades extra
  nombre:    "Territorio 1",           // display siempre sin offset
  tipo:      "normal" | "peligroso" | "no_predica",
  grupoId:   "3",                      // null si no asignado; siempre "C" para ciudades extra
  punto:     { lat, lng },
  poligonos: [{ coords: [{ lat, lng }, ...] }],
  ciudad:    null | "Ataliva Roca",    // null = ciudad principal
  notas:     null | "Edificio de dptos, timbre en entrada",  // opcional
}
```

---

## Módulo de Asignaciones

### Roles de reunión (tabla semanal)
`LECTOR`, `SONIDO_1`, `SONIDO_2`, `PLATAFORMA`, `MICROFONISTAS_1`, `MICROFONISTAS_2`,
`ACOMODADOR_AUDITORIO`, `ACOMODADOR_ENTRADA`, `PRESIDENTE`, `REVISTAS`, `PUBLICACIONES`

### Roles en lista de publicadores (Firestore)
Los publicadores se guardan con roles sin número: `SONIDO`, `MICROFONISTAS`.
El `ROL_LISTA_MAP` los mapea al cargar:
```js
const ROL_LISTA_MAP = {
  SONIDO:          'SONIDO_1',
  SONIDO_2:        'SONIDO_1',
  MICROFONISTAS:   'MICROFONISTAS_1',
  MICROFONISTAS_2: 'MICROFONISTAS_1',
};
```

### Roles extra (solo en lista de publicadores)
`CONDUCTOR_GRUPO_1..4`, `CONDUCTOR_CONGREGACION`

### Generar automático
- **`#auto-desde` / `#auto-hasta`**: rango. Pre-llenado: última fecha guardada + 1 semana → +3 meses.
- **"Tener en cuenta historial previo"**: busca el último asignado por rol y arranca desde el siguiente.
- **"Reemplazar semanas existentes"**: incluye fechas que ya tienen datos en el rango.
- **Algoritmo**: round-robin por rol; `SONIDO_2`/`MICROFONISTAS_2` con offset +1; `PRESIDENTE` omitido en miércoles; `Set enEstaReunion` detecta conflictos.
- **Semanas especiales**: ✅ implementado — respeta `tipoEspecial` en la semana (`asamblea` → saltear ambas reuniones, `conmemoracion` entre semana → saltear miércoles, `superintendente` → generar martes en lugar de miércoles, sábado sin lector).

### Integración con Google Sheets (opcional)
- Botón "Guardar también en planilla" si `scriptUrl` está en Firestore
- Envía de a una reunión por fetch (`no-cors`, `keepalive: true`)
- Respuesta opaca — no se puede confirmar éxito, se asume OK
- Botón "Ver planilla" si `sheetsUrl` está en Firestore

---

## Módulo de Vida y Ministerio

Módulo para el **presidente de la reunión VM**: importar programa de WOL, asignar partes,
gestionar publicadores por rol VM, sala auxiliar.

**Estado al 2026-03-28:** Fases 1, 2, sala auxiliar, historial Excel, semanas especiales (UI+generador),
PIN VM, navegación, vista mensual, editar títulos, duración visible, export/compartir, visor público,
menú Encargado centrado, filtros en vista Hermanos — todos ✅.
**Pendiente:** auto-asignación (Fase 4).

### Visor público (`programa.html`)
Página standalone sin PIN. URL: `vida-ministerio/programa.html?congre=sur&semana=2026-04-07`.
Sin `semana` muestra la semana actual. Navegación ← →, botón compartir copia URL al portapapeles.

`pubFecha` se normaliza siempre a `YYYY-MM-DD` via `parseFechaIso()` antes de cualquier operación
de fecha — evita el bug donde fechas en formato legacy `DD/MM/YYYY` rompían la navegación.

### `parseFechaIso(f)` — utilidad interna en `app.js`

Normaliza cualquier formato de fecha a `YYYY-MM-DD`. Si no puede parsear, retorna `lunesDeHoy()`.

```js
function parseFechaIso(f) {
  if (!f) return lunesDeHoy();
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(f)) {
    const [dd, mm, yyyy] = f.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return lunesDeHoy();
}
```

Usar siempre antes de aritmética de fechas o antes de guardar `pubFecha`.
`fmtDisplay(iso)` también llama `parseFechaIso` internamente como defensa.

### Encargado VM — menú post-PIN

Layout centrado full-height (igual a Asignaciones): título + subtítulo congregación, luego columna
de botones con **`min-width:320px` inline** (no en clase CSS — evita problemas de caché).

- Botón "Programa" → `goToTabsSemanas()` (tabs: Semanas / Generar Semanas)
- Botón "Hermanos" → `goToHermanos()` (lista con filtros de rol y búsqueda)
- Botón "Cerrar sesión" → `cerrarSesionVM()` (resetea `modoEncargado`, vuelve a cover)

**Importante:** el layout del enc-menu usa `style` inline en el HTML, **no clases CSS**,
porque los cambios de clase no siempre se reflejan si el CSS está cacheado en el browser.

### Vista Hermanos VM

Filtros en la parte superior:
1. **Select de rol** (`#vm-hermanos-rol`) — dropdown con los 11 roles VM
2. **Input de búsqueda** (`#vm-hermanos-search`) — filtra por nombre

Ambos llaman `filtrarHermanosVM()`. `goToHermanos()` los resetea al entrar (vacía el texto, select a "Todos").
La lista renderizada por `renderHermanosVM()` muestra chips de rol por publicador.

### Firestore — doc semana

```js
// vidaministerio/{semanaId}   semanaId = "YYYY-MM-DD" (lunes)
{
  fecha: "2026-03-23",
  cancionApertura: 123, cancionIntermedia: 456, cancionCierre: 789,
  presidente: "pubId", oracionApertura: "pubId", oracionCierre: "pubId",

  tesoros: {
    discurso:       { titulo: "...", duracion: 10, pubId: null },
    joyas:          { titulo: "Perlas escondidas", duracion: 10, pubId: null },
    lecturaBiblica: { titulo: "Lea Hechos 7:1-16 (N min.)", duracion: 4, pubId: null, ayudante: null,
                      salaAux: { pubId: null, ayudante: null } }  // si tieneAuxiliar
  },

  ministerio: [
    { titulo: "...", tipo: "video"|"discurso"|"demostracion", duracion: N,
      pubId: null, ayudante: null,
      salaAux: { pubId: null, ayudante: null } },  // si tieneAuxiliar y tipo != discurso
  ],

  vidaCristiana: [
    { titulo: "...", tipo: "parte"|"estudio_biblico", duracion: N, pubId: null, ayudante: null },
  ],

  tipoEspecial: null | "conmemoracion" | "superintendente" | "asamblea",
  importadoDeWOL: true,
  creadoEn: timestamp
}
```

### Roles VM en publicadores
`VM_PRESIDENTE`, `VM_ORACION`, `VM_TESOROS`, `VM_JOYAS`, `VM_LECTURA`,
`VM_MINISTERIO_CONVERSACION`, `VM_MINISTERIO_REVISITA`, `VM_MINISTERIO_ESCENIFICACION`,
`VM_MINISTERIO_DISCURSO`, `VM_VIDA_CRISTIANA`, `VM_ESTUDIO_CONDUCTOR`

Solo hermanos: `VM_PRESIDENTE`, `VM_ORACION`, `VM_TESOROS`, `VM_JOYAS`, `VM_LECTURA`, `VM_VIDA_CRISTIANA`, `VM_ESTUDIO_CONDUCTOR`.
Hermanos y hermanas: `VM_MINISTERIO_*`.

### Importación WOL (✅)
URL: `https://wol.jw.org/es/wol/dt/r4/lp-s/{año}/{mes}/{día}` via Cloudflare Worker propio.
Parser usa `h3/h4` numerados — **no usar IDs `#pN`** (varían cada semana).
- Títulos en `h3/h4` con texto `"N. Título..."`. Tesoros: siempre los primeros 3 `h3` numerados.
- Frontera Ministerio/VC: `h3` con texto exactamente `"Canción N"`.
- Duración: primer `"(X mins.)"` después del `h3` correspondiente.

### Detección de tipo de parte ministerio

```js
function tipoMinisterioDesdeWOL(titulo) {
  const t = titulo.toLowerCase();
  if (t.includes('conversación'))  return 'conversacion';
  if (t.includes('revisita'))      return 'revisita';
  if (t.includes('escenificación') || t.includes('escenificacion')) return 'escenificacion';
  if (t.includes('discurso'))      return 'discurso'; // varón, sin ayudante
  return 'conversacion';
}
// tipo === 'discurso' → sin ayudante. Los demás → tienen ayudante.
```

### Semanas especiales (`tipoEspecial`)

| Valor | Efecto |
|-------|--------|
| `"conmemoracion"` | Entre semana: no hay reunión VM. No generar roles VM/entre semana. |
| `"superintendente"` | Reunión pasa de miércoles a martes. Estudio reemplazado por discurso del sup. Finde sin lector. |
| `"asamblea"` | No hay ninguna reunión esa semana. No generar nada. |

### Fase 4 — Auto-asignación VM (pendiente)

Round-robin por rol con índice persistente, igual que Asignaciones:

```js
// Por semana:
const enEstaSemana = new Set();
for (const slot of slotsOrdenados) {
  const lista = publicadoresConRol(slot.rolRequerido);
  let i = indices[slot.rolRequerido];
  while (enEstaSemana.has(lista[i % lista.length]?.id)) i++;
  slot.pubId = lista[i % lista.length]?.id;
  enEstaSemana.add(slot.pubId);
  indices[slot.rolRequerido] = (i + 1) % lista.length;
}
```

Reglas especiales: `VM_ORACION` apertura ≠ cierre · Presidente ≠ oración · Conductor ≠ lector ·
`tipo === 'discurso'` en Ministerio sin ayudante · Sala auxiliar: asignar pares para ambas salas.

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
| `upgradeInputs(container)` | Reemplaza inputs date/time/select por pickers custom. **Al setear `.value` programáticamente hay que disparar `dispatchEvent(new Event('change', { bubbles: true }))`** |

**Nunca usar `confirm()`, `alert()`, `prompt()` nativos.**

---

## Manzanas por territorio (pendiente — no implementado)

Sub-polígonos numerados dentro de cada territorio.

```
congregaciones/{congreId}/territorios/{terrId}/manzanas/{manzanaId}
  ├── numero: 1
  └── coords: [{lat, lng}, ...]
```

**Plan de implementación:**
1. **Importar de OSM** (Overpass API + `turf.polygonize()`) en `admin.html` — query por polígono del territorio, revisión visual antes de guardar.
2. **Editor manual** con Leaflet.Draw para corregir/dibujar desde cero.
3. **Visualización** en `mapa.html` al zoom ≥ 15, label con número, color diferenciado.

`territorios/app.js` y la estructura del doc de territorio no necesitan cambios — subcolección independiente.

---

## Convenciones de fechas

Siempre hora local — **nunca `toISOString()`** (bug UTC-3).

```js
// Global en ui-utils.js:
window.fmtDateLocal = function(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
// En módulos: usar fmtDateLocal() directamente (global) o: const fmtDate = fmtDateLocal;
```

Almacenamiento: `YYYY-MM-DD`. Display: `DD/MM/YY`.

---

## Estilos

> El sistema visual completo está en **[UI-STYLE.md](./UI-STYLE.md)**. Leerlo antes de tocar UI.

- Tema oscuro: `#1a1c1f` bg · `#e8e8e8` texto · `#232628` cards · `#252525` modales
- Max-width: apps `480px`, covers `320–340px`
- Fuente: `system-ui, sans-serif` — sin Google Fonts
- Vistas con clase `.view` tienen `fadeIn` 0.2s
- Versionado de assets: `styles.css?v=X.X` — incrementar al hacer cambios

---

## Ideas pendientes (futuro)

### Módulo de Chat/Notas compartidas
- Canal de comunicación entre todos los grupos de la congregación
- Notas del encargado de territorios al grupo
- Observaciones sobre territorios (ej: "Familia interesada en Terr. 45")
- Recordatorios compartidos
- Cada publicador futuro podría registrarse con email (Gmail) y tener su menú personal

### Dashboard de estadísticas (más adelante)
- Territorios trabajados por mes/gráfico
- Publicadores más activos
- Tiempo promedio entre usos de territorio
- Asistencias y participaciones en reuniones

### Reportes PDF (más adelante)
- Informe mensual de territorios
- Historial completo de un territorio
- Resumen de asignaciones del mes

### Exportar historial a Excel/CSV (más adelante)
- Exportar todo el historial a Excel/CSV
- Backup completo de la congregación

### Widgets en pantalla principal (ANOTAR)
- Mostrar resumen rápido (próximas salidas, esta semana en reunión)
- Requiere que cada publicador pueda elegir ver su congregación

### Responsive mejorado (ANOTAR)
- Optimizar para tablets (actualmente mobile-first)

### Seguridad (pronto, pero no ahora)
- Firebase Auth: reemplazar PINs por auth real con email/Google
- Roles de usuario: Admin, Encargado, Publicador (con permisos diferenciados)
- Auditoría: log de cambios importantes (quién modificó qué y cuándo)

### Renombrar módulo "Hermanos" a "Administrador"
- Mover gestión de semanas especiales de Asignaciones → Administrador
- Centralizar configuración de la congregación

---

## Lo que NO hacer

- No eliminar la integración con Apps Script del módulo de asignaciones
- No hardcodear polígonos de territorios en HTML/JS
- No usar `toISOString()` para fechas (bug UTC-3)
- No commitear `tools/serviceAccountKey.json` ni archivos `.xlsx`
- No fetchear el KML de Google My Maps en runtime (CORS)
- No usar `confirm()`, `alert()`, `prompt()` nativos
- No setear `.value` en inputs upgradeados sin disparar el evento `change`
- **No usar IDs de párrafo WOL (`#p6`, `#p7`, etc.)** — varían cada semana
