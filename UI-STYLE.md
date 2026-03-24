# UI Style Guide — Territory App

Este documento define el sistema visual del proyecto. Cualquier pantalla nueva o edición
de interfaz existente debe seguir estas guías. **No explorar otros estilos sin aprobar
primero en `test-ui.html`.**

---

## Estética general

Tema oscuro con profundidad sutil. No es flat puro — las cards tienen fondo ligeramente
distinto al body, bordes finos y sombra suave. El fondo tiene gradientes radiales
y textura noise casi imperceptible.

**Estilo de referencia:** la pantalla original del screenshot (menu.html con logo
hexagonal, cards Territorios/Asignaciones). NO usar el estilo shadcn/neutral flat
(oklch sin tono, cards idénticas al body) — fue explorado y descartado.

---

## Tokens de color

```css
/* Fondos */
--bg:         #1a1c1f    /* body background */
--surface:    #232628    /* cards, inputs */
--surface-2:  #2a2d30    /* hover de cards, modales */
--modal-bg:   #252525    /* modales y bottom sheets */

/* Bordes */
--border:     #2e3033    /* borde default de cards */
--border-2:   #3a3a3a    /* bordes de modales */
--border-3:   #444       /* bordes de inputs */

/* Texto */
--text:       #e8e8e8    /* texto principal */
--text-2:     #aaa       /* texto secundario */
--text-3:     #666       /* texto muted / subtítulos */
--text-4:     #555       /* texto muy sutil / footer */
--text-5:     #3a3a3a    /* footer casi invisible */

/* Acento */
--accent:     #7F77DD    /* violeta — botones primary, PIN dots, focus */
--accent-dim: rgba(127,119,221,0.15)  /* fondo de iconos con acento */

/* Semánticos */
--green:      #5DB85D    /* Territorios — ícono */
--green-bg:   #1a3a1a    /* Territorios — fondo de ícono */
--blue:       #5B8DDE    /* Asignaciones — ícono */
--blue-bg:    #1a2340    /* Asignaciones — fondo de ícono */

/* Estados */
--danger:     #A32D2D    /* fondo botón danger */
--danger-fg:  #F09595    /* texto botón danger */
--success:    #1D9E75    /* botón info/success */
--warn:       #EF9F27    /* botón warn */
```

---

## Fondo del body (pantallas de cover)

Las pantallas principales (index, menu, covers de módulos) usan la clase `.cs-home-body`
definida en `ui-utils.js`:

```css
.cs-home-body {
  background: #1a1c1f;
  background-image:
    radial-gradient(ellipse at 60% 20%, rgba(46,134,193,0.06) 0%, transparent 60%),
    radial-gradient(ellipse at 20% 80%, rgba(79,195,195,0.04) 0%, transparent 50%),
    /* noise SVG data:image/svg+xml ... */;
}
```

`ui-utils.js` aplica `.cs-home-body` automáticamente al body cuando se carga.
Las pantallas internas de módulos (listas, formularios) usan `background: #1e1e1e` sin gradiente.

---

## Logo hexagonal

SVG inline, 80×80px (o 64×64 en versiones compactas).
Gradiente violeta `#9B8FFF → #7061E0 → #4A3FB5` con sombra drop-shadow.
Ícono interior: silueta de dos personas con gradiente `#C4BEFF → #9B8FFF`.

**Inserción:** usar el placeholder `<div class="cs-logo-placeholder"></div>` —
`ui-utils.js` lo reemplaza automáticamente con el SVG via `window.insertLogos()`.

---

## Tipografía

- **Fuente:** `system-ui, sans-serif` — sin Google Fonts ni Inter
- **Título de cover:** `.cs-logo-title` → `34px, font-weight: 700, letter-spacing: -0.5px`
- **Subtítulo de cover:** `.cs-logo-sub` → `14px, color: #555`
- **Título de card:** `16–17px, font-weight: 600, color: #e8e8e8`
- **Descripción de card:** `13px, color: #666`
- **Labels de sección:** `11–12px, font-weight: 600–700, uppercase, letter-spacing: 0.05em`
- **Footer:** `.cs-footer` → `12px, color: #3a3a3a`

---

## Cards de navegación (`.cs-nav-card`)

```css
.cs-nav-card {
  background: #232628;
  border: 1px solid #2e3033;
  border-radius: 18px;
  padding: 1.1rem 1.25rem;
  display: flex; align-items: center; gap: 14px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.25);
  transition: border-color 0.18s, background 0.18s, transform 0.1s, box-shadow 0.18s;
}
.cs-nav-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(0,0,0,0.35);
}
.cs-nav-card:active { transform: scale(0.98); box-shadow: none; }
```

Variantes hover por módulo:
- Territorios: `border-color: #3a6b3a; background: #242826`
- Asignaciones: `border-color: #2e4070; background: #23252e`
- Congregación (selector): `border-color: #3a3a3a; background: #272a2d`

Íconos (`.cs-nav-icon`): `46×46px, border-radius: 13px`.

---

## Botones

```css
/* Primary (acción principal) */
background: #7F77DD; color: #fff; border-radius: 10px; padding: 12px 20px;
font-size: 15px; font-weight: 600;

/* Secondary */
background: transparent; color: #aaa;
border: 1px solid #444; border-radius: 10px;

/* Danger */
background: #A32D2D; color: #F09595;

/* Disabled */
opacity: 0.4; cursor: default;
```

---

## Modales y bottom sheets

Definidos completamente en `ui-utils.js`. No reinventar — usar las funciones:

| Función | Cuándo |
|---------|--------|
| `uiConfirm({ title, msg, type })` | Confirmaciones destructivas o importantes |
| `uiAlert(msg, title)` | Avisos informativos |
| `uiDatePicker(...)` | Selección de fecha |
| `uiTimePicker(...)` | Selección de hora |
| `uiConductorPicker(...)` | Selección de conductor |
| `uiTerritorioPicker(...)` | Selección de territorio |
| `uiLoading.show(text)` / `.hide()` | Overlay de carga |
| `uiToast(msg, type)` | Notificaciones temporales |

**Nunca usar `confirm()`, `alert()`, `prompt()` nativos.**

Bottom sheets: `background: #252525, border-radius: 24px 24px 0 0` (mobile),
`border-radius: 24px` (desktop, `min-height: 600px`).

---

## PIN pad

```css
.pin-dot  { 14×14px; border-radius: 50%; border: 2px solid #555; }
.pin-dot.filled { background: #7F77DD; border-color: #7F77DD; }
.pin-btn  { 64×64px; background: #2a2a2a; border-radius: 12px; font-size: 22px; }
.pin-grid { grid-template-columns: repeat(3, 64px); gap: 10px; }
```

---

## Inputs y campos de formulario

```css
input {
  background: #1e1e1e;
  border: 1px solid #444; border-radius: 8px;
  padding: 10px 12px; color: #eee; font-size: 15px;
}
input:focus { border-color: #7F77DD; outline: none; }

label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
```

Los inputs `date`, `time` y `select` de conductor/territorio se reemplazan
con pickers custom via `upgradeInputs(container)` de `ui-utils.js`.

---

## Animaciones

- **fadeIn de vistas:** `opacity 0→1 + translateY(6px→0)`, 0.2s ease
- **modales:** `uiSlideUp` 0.18s — translateY(12px) → 0
- **bottom sheets:** `bsSlideUp` 0.22s cubic-bezier(.22,.68,0,1.2)
- **toast in/out:** translateY(16px→0) / translateY(0→8px)

No agregar animaciones nuevas sin razón — el sistema ya tiene las necesarias.

---

## Layout general

- **Pantallas de cover / selector:** centrado, `max-width: 340px`, `padding: 2rem 1rem`
- **Pantallas de módulo (app):** `max-width: 480px`, `margin: 0 auto`, `padding: 1.5rem 1rem`
- **Vistas internas con clase `.view`:** tienen `fadeIn` 0.2s automático
- **Versionado de assets:** incrementar `?v=X.X` en `<link rel="stylesheet">` al modificar CSS

---

## Clases utilitarias de `ui-utils.js`

| Clase | Uso |
|-------|-----|
| `.cs-home-body` | Body de pantallas principales (auto-aplicado) |
| `.cs-logo-placeholder` | Donde se inserta el logo SVG |
| `.cs-logo-title` | Título grande bajo el logo |
| `.cs-logo-sub` | Subtítulo bajo el título |
| `.cs-logo-svg` | El SVG del logo en sí |
| `.cs-nav-card` | Card de navegación principal |
| `.cs-nav-card-terr` | Variante Territorios |
| `.cs-nav-card-asign` | Variante Asignaciones |
| `.cs-nav-icon` | Ícono dentro de nav card |
| `.cs-nav-icon-terr` | Fondo verde oscuro |
| `.cs-nav-icon-asign` | Fondo azul oscuro |
| `.cs-nav-title` | Título dentro de nav card |
| `.cs-nav-sub` | Descripción dentro de nav card |
| `.cs-footer` | Footer pequeño al pie |
| `.cs-back-btn` | Botón "volver" estilizado |
| `.cs-module-cover` | Contenedor de cover de módulo |
| `.cs-module-card` | Card dentro de módulo |

---

## Lo que NO hacer

- No usar Inter, Geist ni Google Fonts — el proyecto usa `system-ui`
- No usar el estilo flat shadcn/oklch (explorado en `test-ui.html` y descartado)
- No usar `confirm()`, `alert()`, `prompt()` nativos
- No agregar sombras grandes ni efectos glassmorphism
- No reinventar modales — usar los de `ui-utils.js`
- No usar `toISOString()` para fechas (bug UTC-3)
- No hardcodear colores distintos a los tokens definidos arriba
