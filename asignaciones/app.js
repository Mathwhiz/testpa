import { db } from '../firebase.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const CONGRE_ID     = sessionStorage.getItem('congreId')     || 'sur';
const CONGRE_NOMBRE = sessionStorage.getItem('congreNombre') || CONGRE_ID;

const congreSubEl = document.getElementById('congre-sub');
if (congreSubEl) congreSubEl.textContent = CONGRE_NOMBRE;
const cardCongreEl = document.getElementById('card-congre-nombre');
if (cardCongreEl) cardCongreEl.textContent = CONGRE_NOMBRE;

function congreRef()  { return doc(db, 'congregaciones', CONGRE_ID); }
function asigCol()    { return collection(db, 'congregaciones', CONGRE_ID, 'asignaciones'); }
function pubCol()     { return collection(db, 'congregaciones', CONGRE_ID, 'publicadores'); }

// ── Roles que aparecen en la tabla semanal ──
const ROLES_LABELS = {
  LECTOR:               'Lector',
  SONIDO_1:             'Sonido 1',
  SONIDO_2:             'Sonido 2',
  PLATAFORMA:           'Plataforma',
  MICROFONISTAS_1:      'Micrófonos 1',
  MICROFONISTAS_2:      'Micrófonos 2',
  ACOMODADOR_AUDITORIO: 'Acod. Auditorio',
  ACOMODADOR_ENTRADA:   'Acod. Entrada',
  PRESIDENTE:           'Presidente',
  REVISTAS:             'Revistas',
  PUBLICACIONES:        'Publicaciones',
};
const ROLES = Object.keys(ROLES_LABELS);

const ROL_LISTA_MAP = {
  SONIDO:          'SONIDO_1',
  SONIDO_2:        'SONIDO_1',
  MICROFONISTAS:   'MICROFONISTAS_1',
  MICROFONISTAS_2: 'MICROFONISTAS_1',
};

// Roles que SOLO existen en la lista de hermanos (no en tabla semanal)
const ROLES_LISTA_EXTRA = {
  CONDUCTOR_GRUPO_1:     'Conductor Grupo 1',
  CONDUCTOR_GRUPO_2:     'Conductor Grupo 2',
  CONDUCTOR_GRUPO_3:     'Conductor Grupo 3',
  CONDUCTOR_GRUPO_4:     'Conductor Grupo 4',
  CONDUCTOR_CONGREGACION:'Conductor Congregación',
};

const ROLES_OPCIONES = [
  { key: 'LECTOR',                label: 'Lector' },
  { key: 'SONIDO',                label: 'Sonido' },
  { key: 'PLATAFORMA',            label: 'Plataforma' },
  { key: 'MICROFONISTAS',         label: 'Micrófonos' },
  { key: 'ACOMODADOR_AUDITORIO',  label: 'Acod. Auditorio' },
  { key: 'ACOMODADOR_ENTRADA',    label: 'Acod. Entrada' },
  { key: 'PRESIDENTE',            label: 'Presidente' },
  { key: 'REVISTAS',              label: 'Revistas' },
  { key: 'PUBLICACIONES',         label: 'Publicaciones' },
  { key: 'CONDUCTOR_GRUPO_1',     label: 'Conductor Grupo 1' },
  { key: 'CONDUCTOR_GRUPO_2',     label: 'Conductor Grupo 2' },
  { key: 'CONDUCTOR_GRUPO_3',     label: 'Conductor Grupo 3' },
  { key: 'CONDUCTOR_GRUPO_4',     label: 'Conductor Grupo 4' },
  { key: 'CONDUCTOR_CONGREGACION',label: 'Conductor Congregación' },
];

const DIA_COLORS = {
  'Lunes':'#85B7EB','Martes':'#85B7EB','Miércoles':'#C0DD97',
  'Jueves':'#FAC775','Viernes':'#C0DD97','Sábado':'#CDB4FF','Domingo':'#F09595',
};
const DIA_BG = {
  'Lunes':'#0c1e33','Martes':'#0c1e33','Miércoles':'#1a2e0a',
  'Jueves':'#2e1e00','Viernes':'#1a2e0a','Sábado':'#1e1a2e','Domingo':'#2e1a1a',
};

/* ─── PIN ─── */
let PIN_ENCARGADO = null;
let SCRIPT_URL    = null;
let SHEETS_URL    = null;

(async function cargarConfig() {
  try {
    const snap = await getDoc(congreRef());
    if (snap.exists()) {
      const data = snap.data();
      if (data.pinEncargado) {
        PIN_ENCARGADO = data.pinEncargado;
      } else {
        await uiAlert('No se encontró el PIN del encargado en la base de datos.', 'Error de configuración');
      }
      if (data.scriptUrl) {
        SCRIPT_URL = data.scriptUrl;
        const btn = document.getElementById('btn-guardar-planilla');
        if (btn) btn.style.display = '';
      }
      if (data.sheetsUrl) {
        SHEETS_URL = data.sheetsUrl;
        const btn = document.getElementById('btn-ver-planilla');
        if (btn) btn.style.display = '';
      }
    } else {
      await uiAlert('No se encontró el PIN del encargado en la base de datos.', 'Error de configuración');
    }
  } catch(e) {
    await uiAlert('Error al cargar la configuración: ' + e.message, 'Error');
  }
})();

/* ─── Estado global ─── */
// hermanos: { [rolKey]: [nombre, ...] } — igual al formato original para compatibilidad con renderEditar
let hermanos      = {};
// listaHermanos para gestionar: [{ id, nombre, roles }]
let listaHermanos = [];
let todasLasFilas = [];
let autoResult    = [];
let esEncargado   = false;
let pinBuffer     = '';
let semanaOffsetEdit = 0;
let semanaOffsetVer   = 0;
let semanaOffsetImagen = 0;
let suggIndex     = -1;

/* ─── Utilidades DOM ─── */
function show(id) { const el = document.getElementById(id); if (el) el.style.display = ''; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

const VISTAS_ENCARGADO = ["view-editar","view-automatico","view-imagen","view-gestionar"];

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  show(id);
  const btn = document.getElementById('btn-home');
  if (btn) {
    btn.classList.toggle("visible", id !== "view-cover");
    btn.onclick = VISTAS_ENCARGADO.includes(id) ? goToEncargado : goToCover;
  }
}

/* ─── Utilidades fecha ─── */
const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function fmtDateLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function parseFecha(str) {
  if (!str) return null;
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? '20' + m[3] : m[3];
  return new Date(`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T00:00:00`);
}

function getNombreDia(fechaStr) {
  const d = parseFecha(fechaStr);
  if (!d) return '';
  return ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][d.getDay()];
}

function fmtFecha(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
}

// Fecha YYYY-MM-DD → objeto Date local
function isoToDate(iso) {
  if (!iso) return null;
  return new Date(iso + 'T00:00:00');
}

function getLunesDeHoy() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0,0,0,0);
  return monday;
}

function getLunesDeOffset(offset) {
  const monday = getLunesDeHoy();
  monday.setDate(monday.getDate() + offset * 7);
  return monday;
}

// Convierte fecha DD/MM/YY a número para comparar
function fechaToNum(str) {
  if (!str) return 0;
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return 0;
  const y = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
  return y * 10000 + parseInt(m[2]) * 100 + parseInt(m[1]);
}

function getFilasDeSemana(rows, offset) {
  const lunes = getLunesDeOffset(offset);
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
  const lunesNum  = fechaToNum(fmtFecha(lunes));
  const domNum    = fechaToNum(fmtFecha(domingo));
  return rows
    .filter(r => {
      const n = fechaToNum(r.fecha);
      return n >= lunesNum && n <= domNum;
    })
    .sort((a, b) => fechaToNum(a.fecha) - fechaToNum(b.fecha));
}

function getLabelSemana(rows) {
  if (!rows || rows.length === 0) return '—';
  const fechas = rows.map(r => parseFecha(r.fecha)).filter(Boolean).sort((a,b) => a-b);
  if (!fechas.length) return '—';
  const lunes = new Date(fechas[0]);
  const dl = lunes.getDay();
  lunes.setDate(lunes.getDate() - (dl === 0 ? 6 : dl - 1));
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
  return `${fmtFecha(lunes)} al ${fmtFecha(domingo)}`;
}

// ─────────────────────────────────────────
//   FETCH DESDE FIRESTORE
// ─────────────────────────────────────────

/**
 * Carga programación desde Firestore.
 * Retorna array de rows con el mismo formato que usaba el Apps Script:
 * [{ fecha: 'DD/MM/YY', dia, LECTOR, SONIDO_1, ... }]
 */
async function getProgramacion() {
  const snap = await getDocs(query(asigCol(), orderBy('fecha')));
  const seenFechas = new Set();
  const rows = [];
  snap.docs.forEach(d => {
    const data = d.data();
    const row = { _docId: d.id, fecha: '', dia: data.diaSemana || '' };
    if (data.fecha) {
      const parts = data.fecha.split('-');
      if (parts.length === 3) {
        row.fecha = `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
      }
    }
    // Deduplicar: si ya existe una fila para esta fecha, mergear (conservar el más reciente)
    if (seenFechas.has(row.fecha)) {
      const existing = rows.find(r => r.fecha === row.fecha);
      if (existing) {
        // Copiar roles que falten en el existente
        ROLES.forEach(r => { if (!existing[r] && data.roles?.[r]) existing[r] = data.roles[r]; });
      }
      return;
    }
    seenFechas.add(row.fecha);
    ROLES.forEach(r => { row[r] = (data.roles || {})[r] || ''; });
    rows.push(row);
  });
  return rows;
}

/**
 * Guarda (upsert) filas de programación en Firestore.
 * data: [{ fecha: 'DD/MM/YY', dia, LECTOR, ... }]
 */
async function saveProgramacion(data) {
  for (const row of data) {
    const m = row.fecha.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) continue;
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    const isoFecha = `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;

    const roles = {};
    ROLES.forEach(r => { if (row[r]) roles[r] = row[r]; });

    // Buscar en Firestore si ya existe doc para esa fecha (evita duplicados sin depender del cache)
    const existingSnap = await getDocs(query(asigCol(), where('fecha', '==', isoFecha)));
    if (!existingSnap.empty) {
      // Si hay varios docs para la misma fecha (bug previo), actualizar el primero y borrar el resto
      await updateDoc(doc(asigCol(), existingSnap.docs[0].id), { diaSemana: row.dia, roles });
      for (let i = 1; i < existingSnap.docs.length; i++) {
        await deleteDoc(doc(asigCol(), existingSnap.docs[i].id));
      }
    } else {
      await addDoc(asigCol(), { fecha: isoFecha, diaSemana: row.dia, roles });
    }
  }
  todasLasFilas = []; // invalidar cache
}

/**
 * Carga lista de hermanos desde Firestore.
 * Retorna hermanos en formato compatible con el original:
 * { LECTOR: ['nombre1', ...], SONIDO_1: [...], ... }
 */
async function getHermanos() {
  const snap = await getDocs(pubCol());
  // Deduplicar por nombre normalizado (por si hay docs duplicados en Firestore)
  const seenNombres = new Map(); // nombreNorm → índice en listaHermanos
  listaHermanos = [];
  snap.docs.forEach(d => {
    const data = d.data();
    const nombreNorm = norm(data.nombre || '');
    if (!nombreNorm) return;
    if (seenNombres.has(nombreNorm)) {
      // Mergear roles si hay duplicado
      const idx = seenNombres.get(nombreNorm);
      const existing = listaHermanos[idx];
      const rolesExtra = (data.roles || []).filter(r => !existing.roles.includes(r));
      if (rolesExtra.length) existing.roles = [...existing.roles, ...rolesExtra];
      return;
    }
    seenNombres.set(nombreNorm, listaHermanos.length);
    listaHermanos.push({ id: d.id, ...data, roles: data.roles || [] });
  });

  const result = {};
  ROLES.forEach(r => { result[r] = []; });
  listaHermanos.forEach(h => {
    (h.roles || []).forEach(rol => {
      const rolKey = ROL_LISTA_MAP[rol] || rol;
      if (result[rolKey] && !result[rolKey].includes(h.nombre)) result[rolKey].push(h.nombre);
    });
  });
  return result;
}

// ─────────────────────────────────────────
//   PIN
// ─────────────────────────────────────────
function openPin() {
  pinBuffer = '';
  updatePinDots();
  setText('pin-error', '');
  show('pin-modal');
}
function pinPress(d) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += d;
  updatePinDots();
  if (pinBuffer.length === 4) setTimeout(checkPin, 150);
}
function pinDelete() {
  pinBuffer = pinBuffer.slice(0,-1);
  updatePinDots();
  setText('pin-error', '');
}
function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('pd' + i);
    if (!dot) continue;
    dot.style.borderColor = i < pinBuffer.length ? '#7F77DD' : '#555';
    dot.style.background  = i < pinBuffer.length ? '#7F77DD' : 'transparent';
  }
}
function checkPin() {
  if (PIN_ENCARGADO === null) {
    setText('pin-error', 'Error: configuración no cargada');
    pinBuffer = '';
    updatePinDots();
    return;
  }
  if (pinBuffer === PIN_ENCARGADO) {
    hide('pin-modal');
    esEncargado = true;
    pinBuffer = '';
    goToEncargado();
  } else {
    setText('pin-error', 'PIN incorrecto, intentá de nuevo');
    pinBuffer = '';
    updatePinDots();
  }
}
function pinCancel() { hide('pin-modal'); pinBuffer = ''; }

/* ─── Navegación ─── */
function goToCover() { showView('view-cover'); }
function goToPin()   { openPin(); }
async function cerrarSesionEncargado() {
  const ok = await uiConfirm({
    title: '¿Cerrar sesión?',
    msg: 'Vas a volver a la pantalla de inicio.',
    confirmText: 'Cerrar sesión',
    cancelText: 'Cancelar',
    type: 'purple'
  });
  if (!ok) return;
  esEncargado = false;
  goToCover();
}
function goToEncargado() { showView('view-encargado'); }

async function goToVerSemana() {
  semanaOffsetVer = 0;
  showView('view-semana');
  await cargarVerSemana();
}

function updateSemanaVerInfo() {
  const lunes = getLunesDeOffset(semanaOffsetVer);
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
  setText('semana-label', `Semana del ${fmtFecha(lunes)} al ${fmtFecha(domingo)}`);
}

async function cambiarSemanaVer(dir) {
  semanaOffsetVer += dir;
  await cargarVerSemana();
}

async function cargarVerSemana() {
  updateSemanaVerInfo();
  show('semana-loading'); hide('semana-content'); hide('semana-error');
  try {
    if (todasLasFilas.length === 0) {
      todasLasFilas = await getProgramacion();
    }
    const filas = getFilasDeSemana(todasLasFilas, semanaOffsetVer);
    hide('semana-loading');
    renderSemana(filas, 'semana-reuniones');
    show('semana-content');
  } catch(err) {
    hide('semana-loading');
    const errEl = document.getElementById('semana-error');
    if (errEl) errEl.innerHTML = `<div class="error-wrap">Error: ${err.message}. <button class="btn-secondary" style="font-size:12px;padding:4px 10px;margin-left:8px;" onclick="cargarVerSemana()">Reintentar</button></div>`;
    show('semana-error');
  }
}

async function goToBuscarHermano() {
  showView('view-buscar');
  const inp = document.getElementById('search-input');
  if (inp) inp.value = '';
  hide('search-suggestions'); hide('buscar-result'); hide('buscar-empty'); hide('buscar-loading');
  const promises = [];
  if (Object.keys(hermanos).length === 0)
    promises.push(getHermanos().then(d => { hermanos = d; }).catch(()=>{}));
  if (todasLasFilas.length === 0)
    promises.push(getProgramacion().then(d => { todasLasFilas = d; }).catch(()=>{}));
  await Promise.all(promises);
}

async function goToEditar() {
  showView('view-editar');
  semanaOffsetEdit = 0;
  await cargarEditar();
}

function toISOLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getDesdeUltimaGuardada() {
  if (todasLasFilas.length === 0) return new Date();
  // Buscar la fecha más reciente en el historial
  let maxNum = 0, maxFecha = null;
  todasLasFilas.forEach(r => {
    const n = fechaToNum(r.fecha);
    if (n > maxNum) { maxNum = n; maxFecha = parseFecha(r.fecha); }
  });
  if (!maxFecha) return new Date();
  // Lunes de la semana SIGUIENTE a esa fecha
  const dow = maxFecha.getDay();
  const lunes = new Date(maxFecha);
  lunes.setDate(maxFecha.getDate() - (dow === 0 ? 6 : dow - 1) + 7);
  lunes.setHours(0,0,0,0);
  return lunes;
}

function setAutoDesde(tipo) {
  const el = document.getElementById('auto-desde');
  if (!el) return;
  if (tipo === 'hoy') {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    el.value = toISOLocal(hoy);
  } else if (tipo === 'ultima') {
    el.value = toISOLocal(getDesdeUltimaGuardada());
  }
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

async function goToAutomatico() {
  showView('view-automatico');
  hide('auto-loading'); hide('auto-preview'); hide('auto-guardar-wrap');
  setText('auto-status', '');
  autoResult = [];
  if (Object.keys(hermanos).length === 0)
    try { hermanos = await getHermanos(); } catch(e) {}
  if (todasLasFilas.length === 0)
    try { todasLasFilas = await getProgramacion(); } catch(e) {}
  // Pre-llenar: desde semana siguiente a la última guardada, hasta +3 meses
  const desdeEl = document.getElementById('auto-desde');
  const hastaEl = document.getElementById('auto-hasta');
  const desdeD = getDesdeUltimaGuardada();
  const hastaD = new Date(desdeD); hastaD.setMonth(desdeD.getMonth() + 3);
  if (desdeEl) desdeEl.value = toISOLocal(desdeD);
  if (hastaEl) hastaEl.value = toISOLocal(hastaD);
}

async function goToGenerarImagen() {
  semanaOffsetImagen = 0;
  showView('view-imagen');
  await cargarImagen();
}

function updateSemanaImagenInfo() {
  const lunes = getLunesDeOffset(semanaOffsetImagen);
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
  const label = `${fmtFecha(lunes)} al ${fmtFecha(domingo)}`;
  setText('imagen-semana-label', `Semana del ${label}`);
  setText('imagen-titulo', `Asignaciones — Semana del ${label}`);
}

async function cambiarSemanaImagen(dir) {
  semanaOffsetImagen += dir;
  await cargarImagen();
}

async function cargarImagen() {
  updateSemanaImagenInfo();
  show('imagen-loading'); hide('imagen-content');
  try {
    if (todasLasFilas.length === 0) {
      todasLasFilas = await getProgramacion();
    }
    const filas = getFilasDeSemana(todasLasFilas, semanaOffsetImagen);
    hide('imagen-loading');
    renderTablaImagen(filas);
    show('imagen-content');
  } catch(err) { hide('imagen-loading'); }
}

/* ─── Render semana ─── */
function renderSemana(rows, containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = '';
  if (!rows || rows.length === 0) {
    c.innerHTML = '<div class="empty-state"><p>No hay programación cargada para esta semana.</p></div>';
    return;
  }
  rows.forEach(row => {
    const dia = row.dia || getNombreDia(row.fecha);
    const diaColor = DIA_COLORS[dia] || '#eee';
    const diaBg    = DIA_BG[dia] || '#1e1e1e';
    const rolesHTML = ROLES.map(r => {
      const val = row[r] || '';
      if (!val) return '';
      return `<div class="rol-row"><span class="rol-label">${ROLES_LABELS[r]}</span><span class="rol-valor">${val}</span></div>`;
    }).filter(Boolean).join('');
    const card = document.createElement('div');
    card.className = 'reunion-card';
    card.innerHTML = `
      <div class="reunion-header" style="background:${diaBg};border-left:3px solid ${diaColor};">
        <span class="reunion-dia" style="color:${diaColor};">${dia}</span>
        <span class="reunion-fecha">${row.fecha || ''}</span>
      </div>
      <div class="roles-list">${rolesHTML || '<div style="color:#666;font-size:13px;padding:8px 0;">Sin datos</div>'}</div>`;
    c.appendChild(card);
  });
}

/* ─── Buscar hermano ─── */
function getAllHermanos() {
  const set = new Set();
  Object.values(hermanos).forEach(lista => {
    if (Array.isArray(lista)) lista.forEach(h => { if (h) set.add(h); });
  });
  return [...set].sort();
}

function mostrarSugerencias(lista) {
  const sugg = document.getElementById('search-suggestions');
  if (!sugg) return;
  if (lista.length === 0) { hide('search-suggestions'); return; }
  suggIndex = -1;
  sugg.innerHTML = lista.slice(0,10).map((h,i) =>
    `<button class="sugg-item" id="sugg-${i}" onclick="buscarHermano('${h.replace(/'/g, "\\'")}')">${h}</button>`
  ).join('');
  show('search-suggestions');
}

function filtrarHermanos() {
  const q = document.getElementById('search-input')?.value.trim() || '';
  hide('buscar-result'); hide('buscar-empty');
  const todos = getAllHermanos();
  if (q.length === 0) { mostrarSugerencias(todos.slice(0,10)); return; }
  if (q.length < 2)   { hide('search-suggestions'); return; }
  mostrarSugerencias(todos.filter(h => norm(h).includes(norm(q))));
}

function inputFocus() {
  const q = document.getElementById('search-input')?.value.trim() || '';
  if (q.length < 2) mostrarSugerencias(getAllHermanos().slice(0,10));
  else filtrarHermanos();
}

function inputKeydown(e) {
  const sugg = document.getElementById('search-suggestions');
  const items = sugg ? [...sugg.querySelectorAll('.sugg-item')] : [];
  if (!items.length) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    suggIndex = Math.min(suggIndex + 1, items.length - 1);
    items.forEach((el,i) => el.classList.toggle('sugg-active', i === suggIndex));
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    suggIndex = Math.max(suggIndex - 1, 0);
    items.forEach((el,i) => el.classList.toggle('sugg-active', i === suggIndex));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (suggIndex >= 0 && items[suggIndex]) items[suggIndex].click();
    else if (items[0]) items[0].click();
  } else if (e.key === 'Escape') {
    hide('search-suggestions');
  }
}

async function buscarHermano(nombre) {
  hide('search-suggestions');
  const inp = document.getElementById('search-input');
  if (inp) inp.value = nombre;
  hide('buscar-empty'); hide('buscar-result');
  show('buscar-loading');
  try {
    if (todasLasFilas.length === 0) {
      todasLasFilas = await getProgramacion();
    }
    hide('buscar-loading');

    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const desde = new Date(hoy); desde.setDate(hoy.getDate() - 7);
    const filasProximas = todasLasFilas
      .filter(r => { const d = parseFecha(r.fecha); return d && d >= desde; })
      .sort((a,b) => parseFecha(a.fecha) - parseFecha(b.fecha));

    const semanas = {}, ordenSemanas = [];
    filasProximas.forEach(row => {
      const d = parseFecha(row.fecha);
      if (!d) return;
      const dl = d.getDay();
      const lunes = new Date(d); lunes.setDate(d.getDate() - (dl === 0 ? 6 : dl - 1));
      const key = fmtFecha(lunes);
      if (!semanas[key]) { semanas[key] = []; ordenSemanas.push(key); }
      semanas[key].push(row);
    });

    const res = document.getElementById('buscar-result');
    let html = `<div class="buscar-nombre">${nombre}</div>`;
    let tieneAlgo = false;

    ordenSemanas.slice(0,8).forEach(semKey => {
      const filas = semanas[semKey].sort((a,b) => parseFecha(a.fecha) - parseFecha(b.fecha));
      const label = getLabelSemana(filas);
      html += `<div class="semana-bloque"><div class="semana-bloque-title">Semana del ${label}</div>`;

      filas.forEach(row => {
        const dia = row.dia || getNombreDia(row.fecha);
        const diaColor = DIA_COLORS[dia] || '#eee';
        const diaBg    = DIA_BG[dia] || '#1e1e1e';
        let rolEncontrado = null;
        ROLES.forEach(r => {
          if (norm(row[r] || '') === norm(nombre)) rolEncontrado = ROLES_LABELS[r];
        });
        if (rolEncontrado) {
          tieneAlgo = true;
          html += `<div class="asig-card asig-tiene" style="border-left:3px solid ${diaColor};background:${diaBg}33;">
            <span class="asig-dia" style="color:${diaColor};">${dia}</span>
            <span class="asig-fecha">${row.fecha}</span>
            <span class="asig-rol">${rolEncontrado}</span>
          </div>`;
        } else {
          html += `<div class="asig-card asig-libre" style="border-left:3px solid #333;">
            <span class="asig-dia" style="color:#555;">${dia}</span>
            <span class="asig-fecha" style="color:#555;">${row.fecha}</span>
            <span class="asig-rol asig-rol-libre">Sin asignación</span>
          </div>`;
        }
      });
      html += `</div>`;
    });

    if (ordenSemanas.length === 0) { show('buscar-empty'); return; }
    res.innerHTML = html;
    show('buscar-result');
  } catch(e) {
    hide('buscar-loading');
    show('buscar-empty');
  }
}

/* ─── Editar programación ─── */
function updateSemanaEditInfo() {
  const lunes = getLunesDeOffset(semanaOffsetEdit);
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
  setText('editar-semana-info', `Semana del ${fmtFecha(lunes)} al ${fmtFecha(domingo)}`);
}

async function cambiarSemanaEdit(dir) {
  semanaOffsetEdit += dir;
  await cargarEditar();
}

async function cargarEditar() {
  updateSemanaEditInfo();
  show('editar-loading');
  const cont = document.getElementById('editar-content');
  if (cont) cont.innerHTML = '';
  setText('editar-status', '');
  try {
    if (Object.keys(hermanos).length === 0)
      hermanos = await getHermanos();
    if (todasLasFilas.length === 0)
      todasLasFilas = await getProgramacion();

    const lunes = getLunesDeOffset(semanaOffsetEdit);
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
    const rows = todasLasFilas.filter(r => {
      const d = parseFecha(r.fecha);
      return d && d >= lunes && d <= domingo;
    });
    hide('editar-loading');
    renderEditar(rows, lunes);
  } catch(err) {
    hide('editar-loading');
    const cont = document.getElementById('editar-content');
    if (cont) cont.innerHTML = `<div class="error-wrap">Error: ${err.message}</div>`;
  }
}

function renderEditar(rows, lunesDate) {
  const c = document.getElementById('editar-content');
  if (!c) return;
  c.innerHTML = '';
  const diasSemana = [
    { dia: 'Miércoles', offset: 2 },
    { dia: 'Sábado',    offset: 5 },
  ];
  diasSemana.forEach(({ dia, offset }) => {
    const d = new Date(lunesDate); d.setDate(lunesDate.getDate() + offset);
    const fecha = fmtFecha(d);
    const existing = rows.find(r => r.fecha === fecha) || {};
    const diaColor = DIA_COLORS[dia] || '#eee';
    const diaBg    = DIA_BG[dia] || '#1e1e1e';
    const div = document.createElement('div');
    div.className = 'edit-card';
    div.dataset.fecha = fecha;
    div.dataset.dia = dia;
    const rolesHTML = ROLES.map(r => {
      if (r === 'PRESIDENTE' && dia === 'Miércoles') return '';
      const listaKey = ROL_LISTA_MAP[r] || r;
      const lista = hermanos[listaKey] || [];
      const valActual = existing[r] || '';
      const opts = `<option value="">— Sin asignar —</option>` +
        lista.map(h => `<option value="${h}" ${norm(h)===norm(valActual)?'selected':''}>${h}</option>`).join('');
      return `<div class="edit-rol-row">
        <label class="edit-rol-label">${ROLES_LABELS[r]}</label>
        <select class="edit-rol-select" data-rol="${r}">${opts}</select>
      </div>`;
    }).filter(Boolean).join('');
    div.innerHTML = `
      <div class="reunion-header" style="background:${diaBg};border-left:3px solid ${diaColor};margin-bottom:12px;">
        <span class="reunion-dia" style="color:${diaColor};">${dia}</span>
        <span class="reunion-fecha">${fecha}</span>
      </div>${rolesHTML}`;
    c.appendChild(div);
  });
}

async function guardarEdicion() {
  const btn    = document.getElementById('btn-guardar-edicion');
  const status = document.getElementById('editar-status');
  if (btn) btn.disabled = true;
  if (status) { status.style.color = '#888'; status.textContent = 'Guardando...'; }
  const cards = document.querySelectorAll('#editar-content .edit-card');
  const data  = [];
  cards.forEach(card => {
    const entry = { fecha: card.dataset.fecha, dia: card.dataset.dia };
    card.querySelectorAll('select[data-rol]').forEach(sel => { entry[sel.dataset.rol] = sel.value; });
    data.push(entry);
  });
  try {
    await saveProgramacion(data);
    if (status) { status.style.color = '#5DCAA5'; status.textContent = '✓ Guardado correctamente'; }
  } catch(err) {
    if (status) { status.style.color = '#F09595'; status.textContent = 'Error: ' + err.message; }
  }
  if (btn) btn.disabled = false;
}

/* ─── Generar automático ─── */
function generarAutomatico() {
  if (Object.keys(hermanos).length === 0) {
    setText('auto-status', 'Cargando hermanos...');
    return;
  }
  show('auto-loading'); hide('auto-preview'); hide('auto-guardar-wrap');
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const desdeVal = document.getElementById('auto-desde')?.value;
  const hastaVal = document.getElementById('auto-hasta')?.value;
  const usarHistorial = document.getElementById('auto-usar-historial')?.checked ?? false;
  const reemplazar    = document.getElementById('auto-reemplazar')?.checked ?? false;

  const fechaDesde = desdeVal ? new Date(desdeVal + 'T00:00:00') : new Date(hoy);
  const finRango   = hastaVal ? new Date(hastaVal + 'T00:00:00') : (() => { const d = new Date(hoy); d.setMonth(d.getMonth()+3); return d; })();
  const fechasExistentes = new Set(todasLasFilas.map(r => r.fecha));
  const fechasAGenerar = [];
  const cursor = new Date(fechaDesde);
  while (cursor <= finRango) {
    const dow = cursor.getDay();
    if (dow === 3 || dow === 6) {
      const f = fmtFecha(cursor);
      if (reemplazar || !fechasExistentes.has(f))
        fechasAGenerar.push({ fecha: f, dia: dow === 3 ? 'Miércoles' : 'Sábado' });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (fechasAGenerar.length === 0) {
    hide('auto-loading');
    setText('auto-status', reemplazar
      ? 'No hay reuniones en el rango elegido.'
      : 'Ya existe programación para ese rango.');
    show('auto-guardar-wrap');
    autoResult = [];
    return;
  }

  // Calcular punto de inicio de la rotación por rol
  const indices = {};
  const filasOrd = [...todasLasFilas].sort((a, b) => fechaToNum(a.fecha) - fechaToNum(b.fecha));
  ROLES.forEach(r => {
    const listaKey = ROL_LISTA_MAP[r] || r;
    const lista = hermanos[listaKey] || [];
    if (lista.length === 0) { indices[r] = 0; return; }
    if (!usarHistorial) {
      // Sin historial: arrancar desde donde dejó el total de filas (comportamiento original)
      indices[r] = filasOrd.length % lista.length;
      return;
    }
    // Con historial: buscar el último asignado a este rol y arrancar desde el siguiente
    let ultimoAsignado = null;
    for (let i = filasOrd.length - 1; i >= 0; i--) {
      if (filasOrd[i][r]) { ultimoAsignado = filasOrd[i][r]; break; }
    }
    if (!ultimoAsignado) { indices[r] = 0; return; }
    const idx = lista.findIndex(h => norm(h) === norm(ultimoAsignado));
    indices[r] = idx >= 0 ? (idx + 1) % lista.length : 0;
  });

  // Offsetear _2 para que no coincidan con _1 en la misma reunión
  if ((hermanos['SONIDO_1']||[]).length > 1)
    indices['SONIDO_2'] = (indices['SONIDO_1'] + 1) % hermanos['SONIDO_1'].length;
  if ((hermanos['MICROFONISTAS_1']||[]).length > 1)
    indices['MICROFONISTAS_2'] = (indices['MICROFONISTAS_1'] + 1) % hermanos['MICROFONISTAS_1'].length;

  autoResult = fechasAGenerar.map(({ fecha, dia }) => {
    const entry = { fecha, dia };
    const enEstaReunion = new Set(); // evitar duplicados dentro de la misma reunión
    ROLES.forEach(r => {
      if (r === 'PRESIDENTE' && dia === 'Miércoles') { entry[r] = ''; return; }
      const listaKey = ROL_LISTA_MAP[r] || r;
      const lista = hermanos[listaKey] || [];
      if (lista.length === 0) { entry[r] = ''; return; }
      // Buscar el próximo disponible que no esté ya en esta reunión
      let persona = '';
      for (let i = 0; i < lista.length; i++) {
        const candidato = lista[(indices[r] + i) % lista.length];
        if (!enEstaReunion.has(norm(candidato))) {
          persona = candidato;
          indices[r] += i + 1;
          enEstaReunion.add(norm(candidato));
          break;
        }
      }
      if (!persona) indices[r]++; // lista muy corta, dejar vacío y avanzar
      entry[r] = persona;
    });
    return entry;
  });
  hide('auto-loading');
  renderAutoPreview(autoResult);
  show('auto-preview');
  show('auto-guardar-wrap');
}

function renderAutoPreview(rows) {
  const c = document.getElementById('auto-preview');
  if (!c) return;
  c.innerHTML = `<div style="font-size:12px;color:#888;margin-bottom:10px;">${rows.length} reuniones a generar — revisá antes de guardar</div>`;
  rows.forEach(row => {
    const diaColor = DIA_COLORS[row.dia] || '#eee';
    const diaBg    = DIA_BG[row.dia] || '#1e1e1e';
    const rolesHTML = ROLES.map(r => row[r] ?
      `<div class="rol-row"><span class="rol-label">${ROLES_LABELS[r]}</span><span class="rol-valor">${row[r]}</span></div>` : ''
    ).filter(Boolean).join('');
    c.innerHTML += `
      <div class="reunion-card">
        <div class="reunion-header" style="background:${diaBg};border-left:3px solid ${diaColor};">
          <span class="reunion-dia" style="color:${diaColor};">${row.dia}</span>
          <span class="reunion-fecha">${row.fecha}</span>
        </div>
        <div class="roles-list">${rolesHTML}</div>
      </div>`;
  });
}

async function guardarAutomatico() {
  const status = document.getElementById('auto-status');
  if (!autoResult.length) { if(status){status.style.color='#888';status.textContent='Nada que guardar.';} return; }
  if (status){status.style.color='#888';status.textContent='Guardando...';}
  try {
    await saveProgramacion(autoResult);
    if (status){status.style.color='#5DCAA5';status.textContent=`✓ ${autoResult.length} reuniones guardadas`;}
  } catch(err) {
    if (status){status.style.color='#F09595';status.textContent='Error: '+err.message;}
  }
}

/* ─── Fetch helper (para Apps Script) ─── */
async function apiFetch(params) {
  const qs = Object.entries(params).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  // no-cors: evita errores de CORS; la respuesta es opaca pero la request llega al servidor
  await fetch(`${SCRIPT_URL}?${qs}`, { mode: 'no-cors' });
  return { ok: true };
}

async function guardarEnPlanilla() {
  const status = document.getElementById('auto-status');
  if (!autoResult.length) { if(status){status.style.color='#888';status.textContent='Nada que guardar.';} return; }
  if (!SCRIPT_URL) { if(status){status.style.color='#F09595';status.textContent='No hay planilla configurada.';} return; }
  const btn = document.getElementById('btn-guardar-planilla');
  if (btn) btn.disabled = true;
  // Enviar de a una entrada para no exceder el límite de URL de Apps Script
  for (let i = 0; i < autoResult.length; i++) {
    if (status){ status.style.color='#888'; status.textContent=`Enviando a planilla... (${i+1}/${autoResult.length})`; }
    await apiFetch({ action: 'saveProgramacion', data: JSON.stringify([autoResult[i]]) });
  }
  if (status){status.style.color='#5DCAA5';status.textContent=`✓ Planilla actualizada (${autoResult.length} reuniones)`;}
  if (btn) btn.disabled = false;
}

/* ─── Tabla imagen ─── */
function renderTablaImagen(rows) {
  const c = document.getElementById('tabla-reuniones');
  if (!c) return;
  c.innerHTML = '';
  if (!rows || rows.length === 0) {
    c.innerHTML = '<div style="color:#888;text-align:center;padding:20px;font-size:13px;">Sin programación esta semana</div>';
    return;
  }
  rows.forEach(row => {
    const dia = row.dia || getNombreDia(row.fecha);
    const diaColor = DIA_COLORS[dia] || '#eee';
    const rolesHTML = ROLES.map(r => {
      const val = row[r] || '';
      if (!val) return '';
      return `<tr><td class="tabla-rol">${ROLES_LABELS[r]}</td><td class="tabla-val">${val}</td></tr>`;
    }).filter(Boolean).join('');
    c.innerHTML += `
      <div class="tabla-reunion-wrap">
        <div class="tabla-dia-header" style="color:${diaColor};border-bottom:1px solid ${diaColor}30;">
          ${dia} <span style="font-size:11px;font-weight:400;color:#888;margin-left:8px;">${row.fecha}</span>
        </div>
        <table class="tabla-roles"><tbody>${rolesHTML}</tbody></table>
      </div>`;
  });
}

function guardarImagen() {
  const el = document.getElementById('card-tabla');
  if (!el) return;
  const orig = el.style.width;
  el.style.width = '700px';
  html2canvas(el, { backgroundColor: '#1e1e1e', scale: 1.5, width: 700 }).then(canvas => {
    el.style.width = orig;
    const link = document.createElement('a');
    link.download = 'asignaciones-semana.jpg';
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
  });
}

/* ─── Gestionar hermanos ─── */
let hermanoEditando = null;

async function goToGestionar() {
  showView('view-gestionar');
  show('gestionar-loading'); hide('gestionar-content');
  setText('gestionar-search', '');
  const selRol = document.getElementById('gestionar-rol');
  if (selRol) selRol.value = '';
  try {
    await getHermanos(); // recarga listaHermanos
    listaHermanos.sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)));
    hide('gestionar-loading');
    renderLista(listaHermanos);
    show('gestionar-content');
  } catch(err) {
    hide('gestionar-loading');
    const c = document.getElementById('gestionar-lista');
    if (c) c.innerHTML = `<div class="error-wrap">Error: ${err.message}</div>`;
    show('gestionar-content');
  }
}

function renderLista(lista) {
  const c = document.getElementById('gestionar-lista');
  if (!c) return;
  if (lista.length === 0) {
    c.innerHTML = '<div class="empty-state">No hay hermanos cargados</div>';
    return;
  }
  c.innerHTML = lista.map(h => `
    <div class="hermano-row">
      <div class="hermano-info">
        <div class="hermano-nombre">${h.nombre}</div>
        <div class="hermano-roles">${(h.roles || []).map(r => {
          const found = ROLES_OPCIONES.find(o => o.key === r);
          return `<span class="rol-chip">${found ? found.label : r}</span>`;
        }).join('')}</div>
      </div>
      <div class="hermano-actions">
        <button class="btn-edit-hermano" onclick="abrirEditarHermano('${h.id}')">✏️</button>
        <button class="btn-del-hermano" onclick="confirmarEliminar('${h.id}', '${h.nombre.replace(/'/g,"\\'")}')">✕</button>
      </div>
    </div>`).join('');
}

function filtrarLista() {
  const q   = norm(document.getElementById('gestionar-search')?.value || '');
  const rol = document.getElementById('gestionar-rol')?.value || '';
  const filtrada = listaHermanos.filter(h =>
    norm(h.nombre).includes(q) &&
    (!rol || (h.roles || []).includes(rol))
  );
  renderLista(filtrada);
}

function abrirNuevoHermano() {
  hermanoEditando = null;
  document.getElementById('modal-hermano-titulo').textContent = 'Nuevo hermano';
  document.getElementById('modal-hermano-nombre').value = '';
  ROLES_OPCIONES.forEach(o => {
    const cb = document.getElementById('cb-' + o.key);
    if (cb) cb.checked = false;
  });
  setText('modal-hermano-status', '');
  show('modal-hermano');
}

function abrirEditarHermano(docId) {
  const h = listaHermanos.find(x => x.id === docId);
  if (!h) return;
  hermanoEditando = docId;
  document.getElementById('modal-hermano-titulo').textContent = 'Editar hermano';
  document.getElementById('modal-hermano-nombre').value = h.nombre;
  ROLES_OPCIONES.forEach(o => {
    const cb = document.getElementById('cb-' + o.key);
    if (cb) cb.checked = (h.roles || []).includes(o.key);
  });
  setText('modal-hermano-status', '');
  show('modal-hermano');
}

function cerrarModalHermano() { hide('modal-hermano'); hermanoEditando = null; }

async function guardarHermano() {
  const nombre = document.getElementById('modal-hermano-nombre')?.value.trim();
  if (!nombre) { setText('modal-hermano-status', 'Escribí un nombre'); return; }
  const roles = ROLES_OPCIONES.filter(o => document.getElementById('cb-' + o.key)?.checked).map(o => o.key);
  const status = document.getElementById('modal-hermano-status');
  if (status) { status.style.color = '#888'; status.textContent = 'Guardando...'; }
  try {
    if (hermanoEditando) {
      await updateDoc(doc(pubCol(), hermanoEditando), { nombre, roles });
      const idx = listaHermanos.findIndex(h => h.id === hermanoEditando);
      if (idx >= 0) listaHermanos[idx] = { ...listaHermanos[idx], nombre, roles };
    } else {
      const ref = await addDoc(pubCol(), { nombre, roles, activo: true });
      listaHermanos.push({ id: ref.id, nombre, roles, activo: true });
      listaHermanos.sort((a,b) => norm(a.nombre).localeCompare(norm(b.nombre)));
    }
    hermanos = {};  // invalidar cache
    hide('modal-hermano');
    hermanoEditando = null;
    renderLista(listaHermanos);
    if (status) { status.style.color = '#5DCAA5'; status.textContent = '✓ Guardado'; }
  } catch(err) {
    if (status) { status.style.color = '#F09595'; status.textContent = 'Error: ' + err.message; }
  }
}

async function confirmarEliminar(docId, nombre) {
  const ok = await uiConfirm({
    title: `¿Eliminar a ${nombre}?`,
    msg: 'Se quitará de la lista de hermanos. Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(pubCol(), docId));
    listaHermanos = listaHermanos.filter(h => h.id !== docId);
    hermanos = {};
    renderLista(listaHermanos);
  } catch(err) {
    await uiAlert('Error al eliminar: ' + err.message, 'Error');
  }
}

window.guardarImagen = guardarImagen;
window.openPin = openPin;
window.pinPress = pinPress;
window.pinDelete = pinDelete;
window.pinCancel = pinCancel;
window.goToCover = goToCover;
window.goToPin = goToPin;
window.cerrarSesionEncargado = cerrarSesionEncargado;
window.goToEncargado = goToEncargado;
window.goToVerSemana = goToVerSemana;
window.cambiarSemanaVer = cambiarSemanaVer;
window.goToBuscarHermano = goToBuscarHermano;
window.inputFocus = inputFocus;
window.inputKeydown = inputKeydown;
window.buscarHermano = buscarHermano;
window.goToEditar = goToEditar;
window.cambiarSemanaEdit = cambiarSemanaEdit;
window.guardarEdicion = guardarEdicion;
window.goToAutomatico = goToAutomatico;
window.generarAutomatico = generarAutomatico;
window.setAutoDesde = setAutoDesde;
window.abrirPlanilla = () => { if (SHEETS_URL) window.open(SHEETS_URL, '_blank'); };
window.guardarAutomatico = guardarAutomatico;
window.guardarEnPlanilla = guardarEnPlanilla;
window.goToGenerarImagen = goToGenerarImagen;
window.cambiarSemanaImagen = cambiarSemanaImagen;
window.guardarImagen = guardarImagen;
window.goToGestionar = goToGestionar;
window.filtrarLista = filtrarLista;
window.abrirNuevoHermano = abrirNuevoHermano;
window.abrirEditarHermano = abrirEditarHermano;
window.cerrarModalHermano = cerrarModalHermano;
window.guardarHermano = guardarHermano;
window.confirmarEliminar = confirmarEliminar;   
window.showView = showView;
