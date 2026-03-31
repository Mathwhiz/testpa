import { db } from '../firebase.js';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, addDoc, updateDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// ─────────────────────────────────────────
//   CONSTANTES
// ─────────────────────────────────────────
const ROLES_VM = [
  { id: 'VM_PRESIDENTE',                label: 'Presidente' },
  { id: 'VM_ORACION',                   label: 'Oración' },
  { id: 'VM_TESOROS',                   label: 'Discurso Tesoros' },
  { id: 'VM_JOYAS',                     label: 'Perlas escondidas' },
  { id: 'VM_LECTURA',                   label: 'Lectura Bíblica' },
  { id: 'VM_MINISTERIO_CONVERSACION',   label: 'Min. Conversación' },
  { id: 'VM_MINISTERIO_REVISITA',       label: 'Min. Revisita' },
  { id: 'VM_MINISTERIO_ESCENIFICACION', label: 'Min. Escenificación' },
  { id: 'VM_MINISTERIO_DISCURSO',       label: 'Min. Discurso' },
  { id: 'VM_VIDA_CRISTIANA',            label: 'Vida Cristiana' },
  { id: 'VM_ESTUDIO_CONDUCTOR',         label: 'Conductor Estudio' },
];

// Tipo de parte ministerio → rol VM requerido
const TIPO_MIN_ROL = {
  'conversacion':   'VM_MINISTERIO_CONVERSACION',
  'revisita':       'VM_MINISTERIO_REVISITA',
  'escenificacion': 'VM_MINISTERIO_ESCENIFICACION',
  'discurso':       'VM_MINISTERIO_DISCURSO',
};

// Qué rol VM se requiere para cada tipo de slot (slots estáticos)
const SLOT_ROL = {
  'presidente':              'VM_PRESIDENTE',
  'oracionApertura':         'VM_ORACION',
  'oracionCierre':           'VM_ORACION',
  'tesoros.discurso':        'VM_TESOROS',
  'tesoros.joyas':           'VM_JOYAS',
  'tesoros.lecturaBiblica':  'VM_LECTURA',
  'tesoros.lecturaBiblica.ayudante': 'VM_LECTURA',
  'vidaCristiana':           'VM_VIDA_CRISTIANA',
  'estudio.conductor':       'VM_ESTUDIO_CONDUCTOR',
  // ministerio: dinámico por tipo (ver getRolParaSlot)
  // estudio.lector: lo gestiona el módulo Asignaciones
};

// ─────────────────────────────────────────
//   ESTADO
// ─────────────────────────────────────────
let congreId    = null;
let congreNombre = null;
let pinVM       = null;
let publicadores = [];
let semanaData  = null;  // programa de la semana actualmente cargada/editada
let modoEncargado = false;
let tieneAuxiliar = false;
let semanasLista      = [];  // cache para navegación encargado (orden desc)
let pubFecha          = null; // fecha activa en vista pública
let vmEspeciales      = {};   // { 'YYYY-MM-DD' (lunes) → { tipo, fechaEvento } }
let vmScriptUrl       = null; // Apps Script URL para exportar a Sheets

const VM_TIPO_LABELS = {
  conmemoracion:   'Conmemoración',
  superintendente: 'Visita superintendente',
  asamblea:        'Asamblea',
};
const VM_TIPO_COLORS = {
  conmemoracion:   '#E8C94A',
  superintendente: '#7F77DD',
  asamblea:        '#F09595',
};

// ─────────────────────────────────────────
//   UTILS
// ─────────────────────────────────────────
// fmtDateLocal disponible como global desde ui-utils.js
const fmtDate = fmtDateLocal;

// Normaliza cualquier formato de fecha a YYYY-MM-DD
function parseFechaIso(f) {
  if (!f) return lunesDeHoy();
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f;
  // Formato DD/MM/YYYY (legacy)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(f)) {
    const [dd, mm, yyyy] = f.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return lunesDeHoy();
}

function fmtDisplay(iso) {
  iso = parseFechaIso(iso);
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtDisplaySemana(iso) {
  const dias = ['dom','lun','mar','mié','jue','vie','sáb'];
  const d = new Date(iso + 'T12:00:00');
  return `${dias[d.getDay()]} ${fmtDisplay(iso)}`;
}

// Muestra el día de la reunión (miércoles +2 días desde el lunes, martes +1 para superintendente)
function fmtDisplayReunion(iso, esSuper) {
  const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + (esSuper ? 1 : 2));
  return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

function lunesDeDate(input) {
  const d = input instanceof Date ? new Date(input) : new Date(input + 'T12:00:00');
  const day = d.getDay(); // 0=dom, 1=lun, ..., 6=sáb
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return fmtDate(d);
}

function lunesDeHoy() {
  return lunesDeDate(new Date());
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────
//   PUBLICADORES
// ─────────────────────────────────────────
function pubsConRol(rol) {
  const filtrados = publicadores.filter(p => p.activo !== false && (p.roles || []).includes(rol));
  // Fallback a todos los activos si nadie tiene ese rol VM todavía
  if (filtrados.length === 0) return publicadores.filter(p => p.activo !== false);
  return filtrados;
}

function pubNombresConRol(rol) {
  return pubsConRol(rol).map(p => p.nombre);
}

function nombreDePub(pubId) {
  if (!pubId) return null;
  const p = publicadores.find(x => x.id === pubId);
  return p ? p.nombre : null;
}

function pubIdDeNombre(nombre) {
  if (!nombre) return null;
  const p = publicadores.find(x => x.nombre === nombre);
  return p ? p.id : null;
}

// ─────────────────────────────────────────
//   DATOS DEL SLOT (getters/setters)
// ─────────────────────────────────────────
function getSlotPubId(key) {
  if (!semanaData) return null;
  const parts = key.split('.');
  switch (parts[0]) {
    case 'presidente':      return semanaData.presidente;
    case 'oracionApertura': return semanaData.oracionApertura;
    case 'oracionCierre':   return semanaData.oracionCierre;
    case 'tesoros':
      if (parts[2] === 'ayudante') return semanaData.tesoros?.[parts[1]]?.ayudante;
      return semanaData.tesoros?.[parts[1]]?.pubId;
    case 'ministerio': {
      const idx = parseInt(parts[1]);
      if (parts[2] === 'salaAux') {
        return parts[3] === 'ayudante'
          ? semanaData.ministerio?.[idx]?.salaAux?.ayudante
          : semanaData.ministerio?.[idx]?.salaAux?.pubId;
      }
      if (parts[2] === 'ayudante') return semanaData.ministerio?.[idx]?.ayudante;
      return semanaData.ministerio?.[idx]?.pubId;
    }
    case 'vidaCristiana': {
      const idx = parseInt(parts[1]);
      return semanaData.vidaCristiana?.[idx]?.pubId;
    }
    case 'estudio':
      return parts[1] === 'conductor'
        ? semanaData.estudioBiblico?.conductor
        : semanaData.estudioBiblico?.lector;
    default: return null;
  }
}

function setSlotPubId(key, pubId) {
  if (!semanaData) return;
  const parts = key.split('.');
  switch (parts[0]) {
    case 'presidente':      semanaData.presidente = pubId; break;
    case 'oracionApertura': semanaData.oracionApertura = pubId; break;
    case 'oracionCierre':   semanaData.oracionCierre   = pubId; break;
    case 'tesoros':
      if (!semanaData.tesoros[parts[1]]) break;
      if (parts[2] === 'ayudante') semanaData.tesoros[parts[1]].ayudante = pubId;
      else semanaData.tesoros[parts[1]].pubId = pubId;
      break;
    case 'ministerio': {
      const idx = parseInt(parts[1]);
      if (!semanaData.ministerio[idx]) break;
      if (parts[2] === 'salaAux') {
        if (!semanaData.ministerio[idx].salaAux) semanaData.ministerio[idx].salaAux = {};
        if (parts[3] === 'ayudante') semanaData.ministerio[idx].salaAux.ayudante = pubId;
        else semanaData.ministerio[idx].salaAux.pubId = pubId;
      } else if (parts[2] === 'ayudante') {
        semanaData.ministerio[idx].ayudante = pubId;
      } else {
        semanaData.ministerio[idx].pubId = pubId;
      }
      break;
    }
    case 'vidaCristiana': {
      const idx = parseInt(parts[1]);
      if (!semanaData.vidaCristiana[idx]) break;
      semanaData.vidaCristiana[idx].pubId = pubId;
      break;
    }
    case 'estudio':
      if (!semanaData.estudioBiblico) semanaData.estudioBiblico = {};
      if (parts[1] === 'conductor') semanaData.estudioBiblico.conductor = pubId;
      else semanaData.estudioBiblico.lector = pubId;
      break;
  }
}

function getRolParaSlot(key) {
  const parts = key.split('.');
  if (parts[0] === 'ministerio') {
    const idx = parseInt(parts[1]);
    const tipo = semanaData?.ministerio?.[idx]?.tipo || 'conversacion';
    return TIPO_MIN_ROL[tipo] || 'VM_MINISTERIO_CONVERSACION';
  }
  if (parts[0] === 'vidaCristiana') return SLOT_ROL['vidaCristiana'];
  return SLOT_ROL[key] || null;
}

function keyToId(key) {
  return key.replace(/\./g, '-');
}

// ─────────────────────────────────────────
//   NAVEGACIÓN
// ─────────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  document.getElementById('btn-home').classList.toggle('visible', id !== 'view-cover');
}

window.goToCover = function() {
  showView('view-cover');
};

window.goToPin = function() {
  pinBuffer = '';
  updatePinDots();
  document.getElementById('pin-error').textContent = '';
  document.getElementById('pin-modal-vm').style.display = 'flex';
};

window.pinCancel = function() {
  document.getElementById('pin-modal-vm').style.display = 'none';
  pinBuffer = '';
  updatePinDots();
};

window.goToVerPrograma = async function() {
  pubFecha = lunesDeHoy();
  showView('view-programa-pub');
  await cargarProgramaPublico();
};

window.navSemanaPublico = async function(dir) {
  const base = parseFechaIso(pubFecha);
  pubFecha = base; // normalizar antes de navegar
  const d = new Date(base + 'T12:00:00');
  d.setDate(d.getDate() + dir * 7);
  pubFecha = isNaN(d.getTime()) ? lunesDeHoy() : fmtDate(d);
  await cargarProgramaPublico();
};

window.navSemana = async function(dir) {
  if (!semanasLista.length || !semanaData) return;
  // semanasLista está en orden desc: dir=+1 (siguiente/más nueva) → índice menor
  const idx = semanasLista.findIndex(s => s.fecha === semanaData.fecha);
  if (idx === -1) return;
  const nextIdx = idx + (-dir);
  if (nextIdx >= 0 && nextIdx < semanasLista.length) {
    await goToSemana(semanasLista[nextIdx].fecha);
  }
};

function updateNavBtnsSemana() {
  const idx = semanasLista.findIndex(s => s.fecha === semanaData?.fecha);
  const btnPrev = document.getElementById('btn-sem-prev');
  const btnNext = document.getElementById('btn-sem-next');
  if (btnPrev) btnPrev.disabled = idx === -1 || idx >= semanasLista.length - 1;
  if (btnNext) btnNext.disabled = idx === -1 || idx <= 0;
}

window.goToMenuEnc = function() {
  const sub = document.getElementById('menu-enc-congre-sub');
  if (sub) sub.textContent = congreNombre || '—';
  showView('view-menu-enc');
};

window.cerrarSesionVM = function() {
  modoEncargado = false;
  goToCover();
};

window.goToSemanas = async function() {
  document.getElementById('semanas-congre-sub').textContent = congreNombre || '—';
  const btnCfg = document.getElementById('btn-config-vm');
  if (btnCfg) btnCfg.style.display = modoEncargado ? '' : 'none';
  const exportSec = document.getElementById('vm-export-section');
  if (exportSec) {
    exportSec.style.display = (modoEncargado && vmScriptUrl) ? '' : 'none';
    const mesInput = document.getElementById('vm-export-mes');
    if (mesInput && !mesInput.value) {
      const hoy = new Date();
      mesInput.value = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
    }
  }
  showView('view-semanas');
  await cargarSemanas();
};

window.goToConfig = function() {
  document.getElementById('config-aux').checked = tieneAuxiliar;
  showView('view-config');
};

window.guardarConfig = async function() {
  const nuevo = document.getElementById('config-aux').checked;
  uiLoading.show('Guardando…');
  try {
    await setDoc(doc(db, 'congregaciones', congreId), { tieneAuxiliar: nuevo }, { merge: true });
    tieneAuxiliar = nuevo;
    uiLoading.hide();
    uiToast('Configuración guardada', 'success');
    goToSemanas();
  } catch(e) {
    uiLoading.hide();
    await uiAlert('Error al guardar: ' + e.message);
  }
};

window.goToSemana = async function(fecha) {
  // Si ya está cargada esa semana, no recargamos
  if (!semanaData || semanaData.fecha !== fecha) {
    uiLoading.show('Cargando…');
    try {
      const snap = await getDoc(doc(db, 'congregaciones', congreId, 'vidaministerio', fecha));
      if (snap.exists()) {
        semanaData = snap.data();
      } else if (!semanaData) {
        uiLoading.hide();
        uiToast('No se encontró el programa para esta semana', 'error');
        return;
      }
      uiLoading.hide();
    } catch(e) {
      uiLoading.hide();
      await uiAlert('Error al cargar: ' + e.message);
      return;
    }
  }
  document.getElementById('semana-titulo-display').textContent = 'Semana del ' + fmtDisplay(semanaData.fecha);
  renderSemanaEdit();
  showView('view-semana');
  updateNavBtnsSemana();
};

window.switchVmTab = function(tabName) {
  document.querySelectorAll('.vm-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.vm-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tab === tabName));
};

function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

window.goToNueva = function() {
  // Fecha sugerida: semana siguiente a la última cargada, o semana actual si no hay ninguna
  let fecha;
  if (semanasLista.length > 0) {
    const ultima = semanasLista[0].fecha; // orden desc → [0] es la más reciente
    const d = new Date(ultima + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    fecha = fmtDate(d);
  } else {
    fecha = lunesDeHoy();
  }
  const fechaEl = document.getElementById('nueva-fecha');
  fechaEl.value = fecha;
  fechaEl.dispatchEvent(new Event('change', { bubbles: true }));
  switchVmTab('generar');
};

// ─────────────────────────────────────────
//   PIN
// ─────────────────────────────────────────
let pinBuffer = '';

window.pinPress = function(d) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += d;
  updatePinDots();
  if (pinBuffer.length === 4) setTimeout(checkPin, 150);
};

window.pinDelete = function() {
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();
  document.getElementById('pin-error').textContent = '';
};

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    document.getElementById('vp' + i).classList.toggle('filled', i < pinBuffer.length);
  }
}

function checkPin() {
  if (pinBuffer === pinVM) {
    modoEncargado = true;
    pinBuffer = '';
    updatePinDots();
    document.getElementById('pin-modal-vm').style.display = 'none';
    goToMenuEnc();
  } else {
    document.getElementById('pin-error').textContent = 'PIN incorrecto';
    pinBuffer = '';
    updatePinDots();
  }
}

// ─────────────────────────────────────────
//   CARGA DE DATOS
// ─────────────────────────────────────────
async function cargarPublicadores() {
  try {
    const snap = await getDocs(collection(db, 'congregaciones', congreId, 'publicadores'));
    publicadores = [];
    snap.forEach(d => publicadores.push({ id: d.id, ...d.data() }));
    publicadores.sort((a, b) =>
      (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })
    );
  } catch(e) {
    console.error('Error al cargar publicadores:', e);
  }
}

async function cargarSemanas() {
  const list = document.getElementById('semanas-list');
  list.innerHTML = '<div class="loading-wrap"><div class="spinner"></div><div class="loading-txt">Cargando…</div></div>';
  try {
    const q = query(
      collection(db, 'congregaciones', congreId, 'vidaministerio'),
      orderBy('fecha', 'desc')
    );
    const snap = await getDocs(q);
    const semanas = [];
    snap.forEach(d => {
      const data = d.data();
      // Filtrar docs con fecha inválida (formato esperado: YYYY-MM-DD)
      if (data.fecha && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) {
        semanas.push(data);
      }
    });
    semanasLista = semanas;
    renderSemanas(semanas);
  } catch(e) {
    list.innerHTML = `<div class="error-wrap">Error al cargar: ${e.message}</div>`;
  }
}

async function cargarProgramaPublico() {
  let fecha = parseFechaIso(pubFecha);
  pubFecha = fecha; // siempre normalizar
  const el = document.getElementById('pub-contenido');
  document.getElementById('pub-semana-titulo').textContent = 'Semana del ' + fmtDisplay(fecha);
  el.innerHTML = '<div class="loading-wrap"><div class="spinner"></div><div class="loading-txt">Cargando…</div></div>';
  try {
    const snap = await getDoc(doc(db, 'congregaciones', congreId, 'vidaministerio', fecha));
    const banner = vmBannerHtml(fecha);
    if (!snap.exists()) {
      el.innerHTML = banner + '<div class="empty-state">No hay programa cargado para esta semana.<br><span style="color:#3a3a3a;">El encargado todavía no lo subió.</span></div>';
      return;
    }
    el.innerHTML = banner + renderSemanaPublico(snap.data());
  } catch(e) {
    el.innerHTML = `<div class="error-wrap">Error: ${e.message}</div>`;
  }
}

// ─────────────────────────────────────────
//   RENDER — LISTA DE SEMANAS
// ─────────────────────────────────────────
function calcCompletitud(s) {
  let total = 0, filled = 0;
  const check = id => { total++; if (id) filled++; };

  check(s.presidente);
  check(s.oracionApertura);
  check(s.oracionCierre);
  check(s.tesoros?.discurso?.pubId);
  check(s.tesoros?.joyas?.pubId);
  check(s.tesoros?.lecturaBiblica?.pubId);
  (s.ministerio || []).forEach(p => check(p.pubId));
  (s.vidaCristiana || []).forEach(p => check(p.pubId));
  check(s.estudioBiblico?.conductor);
  // lector del estudio lo asigna el módulo de Asignaciones, no cuenta aquí

  if (filled === 0) return { clase: 'vacia', texto: 'Sin asignaciones' };
  if (filled === total) return { clase: 'completa', texto: `Completa ✓` };
  return { clase: 'parcial', texto: `${filled}/${total} asignados` };
}

async function cargarVmEspeciales() {
  try {
    const snap = await getDocs(collection(db, 'congregaciones', congreId, 'semanasEspeciales'));
    vmEspeciales = {};
    snap.forEach(d => { vmEspeciales[d.id] = d.data(); });
  } catch(e) {
    console.error('Error cargando especiales VM:', e);
  }
}

function vmBannerHtml(fecha) {
  const esp = vmEspeciales[fecha];
  if (!esp) return '';
  const color = VM_TIPO_COLORS[esp.tipo] || '#eee';
  const label = VM_TIPO_LABELS[esp.tipo] || esp.tipo;
  let msg = label;
  if (esp.tipo === 'asamblea')         msg += ' — no hay reuniones esta semana';
  if (esp.tipo === 'superintendente')  msg += ' — reunión el martes · sábado sin lector';
  if (esp.tipo === 'conmemoracion') {
    const dow = new Date(esp.fechaEvento + 'T12:00:00').getDay();
    msg += (dow === 6 || dow === 0) ? ' — sin reunión de fin de semana' : ' — sin reunión de entre semana';
  }
  return `<div class="vm-especial-banner" style="border-left-color:${color};background:${color}18;">
    <span style="color:${color};font-weight:700;">⚠ ${msg}</span>
  </div>`;
}

function renderSemanaCard(s, lunes) {
  const c        = calcCompletitud(s);
  const esp      = vmEspeciales[s.fecha];
  const esActual = s.fecha === lunes;
  const esSuper  = esp?.tipo === 'superintendente';

  // Conmemoración / Asamblea: card simplificada
  if (esp?.tipo === 'conmemoracion' || esp?.tipo === 'asamblea') {
    const labelEsp = esp.tipo === 'asamblea' ? 'Asamblea' : 'Conmemoración';
    return `
    <div class="semana-card semana-card-conmem${esActual ? ' semana-actual' : ''}" onclick="goToSemana('${s.fecha}')">
      <div class="semana-card-top">
        <div class="semana-fecha">${fmtDisplayReunion(s.fecha, false)}</div>
        <button class="btn-del-semana" onclick="event.stopPropagation(); eliminarSemana('${s.fecha}')" title="Eliminar semana">×</button>
      </div>
      <div class="semana-conmem-label">${labelEsp}</div>
    </div>`;
  }

  const espColor = esp ? (VM_TIPO_COLORS[esp.tipo] || '#eee') : null;
  const espBadge = esp
    ? `<span class="badge-especial" style="background:${espColor}22;color:${espColor};">${VM_TIPO_LABELS[esp.tipo] || esp.tipo}</span>`
    : '';
  const actualBadge = esActual ? '<span class="badge-actual">esta semana</span>' : '';
  const pNombre = nombreDePub(s.presidente);
  const pRow = pNombre
    ? `<div class="semana-mini-row has-data">👤 ${esc(pNombre)}</div>`
    : `<div class="semana-mini-row">👤 Sin presidente</div>`;

  const estadoHtml = c.clase === 'completa'
    ? `<span class="estado-asignado">✓ Asignado</span>`
    : `<div class="estado-${c.clase}">${c.texto}</div>`;

  return `
    <div class="semana-card${esActual ? ' semana-actual' : ''}" onclick="goToSemana('${s.fecha}')">
      <div class="semana-card-top">
        <div class="semana-fecha">${fmtDisplayReunion(s.fecha, esSuper)}</div>
        <button class="btn-del-semana" onclick="event.stopPropagation(); eliminarSemana('${s.fecha}')" title="Eliminar semana">×</button>
      </div>
      <div class="semana-card-badges">${actualBadge}${espBadge}</div>
      <div class="semana-card-meta">${pRow}</div>
      ${estadoHtml}
    </div>`;
}

function renderSemanas(semanas) {
  const list = document.getElementById('semanas-list');
  if (!semanas.length) {
    list.innerHTML = '<div class="empty-state">No hay semanas todavía.<br>Tocá <strong>+ Nueva semana</strong> para empezar.</div>';
    return;
  }
  const hoy = lunesDeHoy();

  // Agrupar por mes (desc)
  const grupos = {};
  semanas.forEach(s => {
    const key = s.fecha.substring(0, 7); // "YYYY-MM"
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(s);
  });
  const mesesDesc = Object.keys(grupos).sort().reverse();

  list.innerHTML = mesesDesc.map(key => {
    const [y, m] = key.split('-');
    const label  = `${MESES_ES[parseInt(m) - 1]} ${y}`;
    const cards  = grupos[key].map(s => renderSemanaCard(s, hoy)).join('');
    return `<div class="semanas-mes-hdr">${label}</div><div class="semanas-mes-grid">${cards}</div>`;
  }).join('');
}

window.eliminarSemana = async function(fecha) {
  const ok = await uiConfirm({
    title: 'Eliminar semana',
    msg: `¿Eliminar el programa de la semana del ${fmtDisplay(fecha)}? Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger',
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'congregaciones', congreId, 'vidaministerio', fecha));
    semanasLista = semanasLista.filter(s => s.fecha !== fecha);
    renderSemanas(semanasLista);
    uiToast('Semana eliminada', 'success');
  } catch(e) {
    uiToast('Error al eliminar: ' + e.message, 'error');
  }
};

// ─────────────────────────────────────────
//   RENDER — PROGRAMA PÚBLICO (solo lectura)
// ─────────────────────────────────────────
function renderSemanaPublico(s) {
  const row = (titulo, pubId, extra) => {
    const nombre = nombreDePub(pubId);
    return `<div class="pub-parte-row">
      <div class="pub-parte-titulo">${esc(titulo)}</div>
      <div class="pub-parte-nombre">${nombre ? esc(nombre) : '<span class="pub-parte-sin">—</span>'}${extra || ''}</div>
    </div>`;
  };

  let html = '';

  // Presidencia
  html += `<div class="pub-seccion">
    <div class="pub-seccion-hdr">Presidencia</div>
    ${row('Presidente', s.presidente)}
    ${row('Oración apertura', s.oracionApertura)}
    ${row('Oración cierre', s.oracionCierre)}
  </div>`;

  // Canciones
  const cancionStr = [s.cancionApertura, s.cancionIntermedia, s.cancionCierre]
    .map((c, i) => c ? `${['Ap.','Int.','Cie.'][i]} ${c}` : null).filter(Boolean).join(' · ');
  if (cancionStr) {
    html += `<div style="font-size:12px;color:#555;margin-bottom:14px;padding-left:1px;">${cancionStr}</div>`;
  }

  // Tesoros
  const lect = s.tesoros?.lecturaBiblica;
  let lectRow;
  if (tieneAuxiliar && lect?.ayudante) {
    const lNombre    = nombreDePub(lect.pubId);
    const lAuxNombre = nombreDePub(lect.ayudante);
    lectRow = `<div class="pub-parte-row">
      <div class="pub-parte-titulo">${esc(lect.titulo || 'Lectura Bíblica')}</div>
      <div class="pub-parte-nombre" style="text-align:right;">
        ${lNombre   ? `<div>${esc(lNombre)}</div>`   : '<div><span class="pub-parte-sin">—</span></div>'}
        ${lAuxNombre ? `<div style="font-size:11px;color:#888;">${esc(lAuxNombre)}</div>` : ''}
      </div>
    </div>`;
  } else {
    lectRow = row(lect?.titulo || 'Lectura Bíblica', lect?.pubId);
  }
  html += `<div class="pub-seccion">
    <div class="pub-seccion-hdr">1. Tesoros de la Palabra de Dios</div>
    ${row(s.tesoros?.discurso?.titulo || 'Discurso', s.tesoros?.discurso?.pubId)}
    ${row(s.tesoros?.joyas?.titulo || 'Perlas escondidas', s.tesoros?.joyas?.pubId)}
    ${lectRow}
  </div>`;

  // Ministerio
  if (s.ministerio?.length) {
    const minRows = s.ministerio.map(p => {
      const nombre   = nombreDePub(p.pubId);
      const ayNombre = nombreDePub(p.ayudante);
      const mainStr  = nombre
        ? esc(nombre) + (ayNombre ? ` / ${esc(ayNombre)}` : '')
        : (ayNombre ? esc(ayNombre) : null);
      let auxStr = null;
      if (tieneAuxiliar && p.salaAux?.pubId) {
        const auxN   = nombreDePub(p.salaAux.pubId);
        const auxAyN = nombreDePub(p.salaAux.ayudante);
        if (auxN) auxStr = esc(auxN) + (auxAyN ? ` / ${esc(auxAyN)}` : '');
      }
      return `<div class="pub-parte-row">
        <div class="pub-parte-titulo">${esc(p.titulo || 'Parte')}</div>
        <div class="pub-parte-nombre" style="text-align:right;">
          ${mainStr ? `<div>${mainStr}</div>` : '<div><span class="pub-parte-sin">—</span></div>'}
          ${auxStr  ? `<div style="font-size:11px;color:#888;">${auxStr}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    html += `<div class="pub-seccion">
      <div class="pub-seccion-hdr">2. Seamos Mejores Maestros</div>
      ${minRows}
    </div>`;
  }

  // Vida Cristiana
  const vcPartes = (s.vidaCristiana || []).map(p => row(p.titulo || 'Parte', p.pubId)).join('');
  const estudio = s.estudioBiblico;
  const estudioHtml = estudio ? `<div class="pub-parte-row">
    <div class="pub-parte-titulo">${esc(estudio.titulo || 'Estudio Bíblico')}</div>
    <div class="pub-parte-nombre" style="text-align:right;">
      ${estudio.conductor ? `<div>${esc(nombreDePub(estudio.conductor) || '—')}</div>` : '<div class="pub-parte-sin">—</div>'}
      ${estudio.lector ? `<div style="font-size:11px;color:#888;">Lec. ${esc(nombreDePub(estudio.lector) || '')}</div>` : ''}
    </div>
  </div>` : '';
  html += `<div class="pub-seccion">
    <div class="pub-seccion-hdr">3. Nuestra Vida Cristiana</div>
    ${vcPartes}${estudioHtml}
  </div>`;

  return html;
}

// ─────────────────────────────────────────
//   RENDER — PROGRAMA EDITABLE
// ─────────────────────────────────────────
function renderAsigRow(label, key, pubId) {
  const nombre = nombreDePub(pubId);
  return `<div class="asig-row">
    <span class="asig-label">${label}</span>
    <button class="asignar-btn${nombre ? '' : ' empty'}" onclick="asignarSlot('${key}')">
      <span class="asig-icon">👤</span>
      <span id="asig-${keyToId(key)}">${nombre ? esc(nombre) : 'Asignar'}</span>
    </button>
  </div>`;
}

function renderAsigBtn(key, pubId, defaultLabel) {
  const nombre = nombreDePub(pubId);
  return `<button class="asignar-btn${nombre ? '' : ' empty'}" onclick="asignarSlot('${key}')">
    <span class="asig-icon">👤</span>
    <span id="asig-${keyToId(key)}">${nombre ? esc(nombre) : defaultLabel}</span>
  </button>`;
}

function renderParteItem(key, label, parte, opts = {}) {
  const quitar = opts.onRemove
    ? `<button class="btn-quitar-parte" onclick="${opts.onRemove}" title="Quitar">×</button>`
    : '';
  const dur = parte?.duracion ? `<span class="parte-dur-badge">${parte.duracion} min</span>` : '';
  return `<div class="parte-item">
    <div class="parte-meta-row">
      <span class="parte-label-text">${label}</span>${dur}${quitar}
    </div>
    ${renderTipoInstruccionHtml(key, parte)}
    <input class="parte-titulo-input" type="text"
           placeholder="Título de la parte…"
           value="${esc(parte?.titulo || '')}"
           oninput="onTituloChange('${key}', this.value)">
    ${renderAsigBtn(key, parte?.pubId, 'Asignar hermano')}
  </div>`;
}

function renderParteItemConAyudante(key, label, parte, opts = {}) {
  const ayKey       = key + '.ayudante';
  const quitar      = opts.onRemove
    ? `<button class="btn-quitar-parte" onclick="${opts.onRemove}" title="Quitar">×</button>`
    : '';
  const dur         = parte?.duracion ? `<span class="parte-dur-badge">${parte.duracion} min</span>` : '';
  const isMinisterio = key.startsWith('ministerio.');

  // Cuando hay sala auxiliar, etiquetar la sala principal explícitamente
  const spLabel  = tieneAuxiliar ? `<div class="sala-divider"><span>Sala Principal</span></div>` : '';
  // Para lectura bíblica: el botón "ayudante" se convierte en "Sala Auxiliar"
  const ayLabel  = (tieneAuxiliar && !isMinisterio) ? 'Sala Auxiliar' : '+ Ayudante';

  // Para ministerio: bloque extra con dos pickers para la sala auxiliar
  let auxHtml = '';
  if (tieneAuxiliar && isMinisterio) {
    const auxKey   = key + '.salaAux';
    const auxAyKey = auxKey + '.ayudante';
    auxHtml = `
      <div class="sala-divider"><span>Sala Auxiliar</span></div>
      <div class="asig-double-row">
        ${renderAsigBtn(auxKey, parte?.salaAux?.pubId, 'Asignar hermano')}
        ${renderAsigBtn(auxAyKey, parte?.salaAux?.ayudante, '+ Ayudante')}
      </div>`;
  }

  return `<div class="parte-item">
    <div class="parte-meta-row">
      <span class="parte-label-text">${label}</span>${dur}${quitar}
    </div>
    ${renderTipoInstruccionHtml(key, parte)}
    <input class="parte-titulo-input" type="text"
           placeholder="Título de la parte…"
           value="${esc(parte?.titulo || '')}"
           oninput="onTituloChange('${key}', this.value)">
    ${spLabel}
    <div class="asig-double-row">
      ${renderAsigBtn(key, parte?.pubId, 'Asignar hermano')}
      ${renderAsigBtn(ayKey, parte?.ayudante, ayLabel)}
    </div>
    ${auxHtml}
  </div>`;
}

function renderSemanaEdit() {
  if (!semanaData) return;
  const s = semanaData;
  let html = vmBannerHtml(s.fecha);

  // ── Canciones y Presidencia
  html += `<div class="seccion-bloque">
    <div class="seccion-hdr hdr-general">
      <span class="seccion-hdr-icon">♪</span> Canciones y Presidencia
    </div>
    <div class="canciones-row">
      <div class="cancion-item">
        <label>Apertura</label>
        <input type="number" min="1" max="150" class="cancion-input"
               value="${s.cancionApertura || ''}"
               placeholder="Nro"
               oninput="onTituloChange('cancion.apertura', this.value)">
      </div>
      <div class="cancion-item">
        <label>Intermedia</label>
        <input type="number" min="1" max="150" class="cancion-input"
               value="${s.cancionIntermedia || ''}"
               placeholder="Nro"
               oninput="onTituloChange('cancion.intermedia', this.value)">
      </div>
      <div class="cancion-item">
        <label>Cierre</label>
        <input type="number" min="1" max="150" class="cancion-input"
               value="${s.cancionCierre || ''}"
               placeholder="Nro"
               oninput="onTituloChange('cancion.cierre', this.value)">
      </div>
    </div>
    ${renderAsigRow('Presidente', 'presidente', s.presidente)}
    ${renderAsigRow('Oración apertura', 'oracionApertura', s.oracionApertura)}
    ${renderAsigRow('Oración cierre', 'oracionCierre', s.oracionCierre)}
  </div>`;

  // ── Tesoros
  html += `<div class="seccion-bloque">
    <div class="seccion-hdr hdr-tesoros">
      <span class="seccion-hdr-num">1</span> Tesoros de la Palabra de Dios
    </div>
    ${renderParteItem('tesoros.discurso', 'Discurso', s.tesoros?.discurso)}
    ${renderParteItem('tesoros.joyas', 'Perlas escondidas', s.tesoros?.joyas)}
    ${renderParteItemConAyudante('tesoros.lecturaBiblica', 'Lectura Bíblica', s.tesoros?.lecturaBiblica)}
  </div>`;

  // ── Ministerio
  // tipo === 'discurso' → 1 participante (sin ayudante)
  const minPartes = (s.ministerio || []).map((p, i) => {
    const key  = `ministerio.${i}`;
    const opts = { onRemove: `quitarParte('ministerio',${i})` };
    return p.tipo === 'discurso'
      ? renderParteItem(key, `Parte ${i + 1}`, p, opts)
      : renderParteItemConAyudante(key, `Parte ${i + 1}`, p, opts);
  }).join('');
  const btnAddMin = s.ministerio?.length < 4
    ? `<button class="btn-agregar-parte" onclick="agregarParte('ministerio')">+ Agregar parte</button>` : '';
  html += `<div class="seccion-bloque">
    <div class="seccion-hdr hdr-ministerio">
      <span class="seccion-hdr-num">2</span> Seamos Mejores Maestros
    </div>
    ${minPartes}${btnAddMin}
  </div>`;

  // ── Vida Cristiana
  const vcPartes = (s.vidaCristiana || []).map((p, i) =>
    renderParteItem(
      `vidaCristiana.${i}`, `Parte ${i + 1}`, p,
      { onRemove: `quitarParte('vidaCristiana',${i})` }
    )
  ).join('');
  const btnAddVC = (s.vidaCristiana?.length || 0) < 3
    ? `<button class="btn-agregar-parte" onclick="agregarParte('vidaCristiana')">+ Agregar parte</button>` : '';

  const est = s.estudioBiblico || {};
  const estudioHtml = `<div class="parte-item estudio-item">
    <div class="parte-meta-row">
      <span class="parte-label-text">Estudio Bíblico Congregacional</span>
      <span class="parte-dur-badge">30 min</span>
    </div>
    <input class="parte-titulo-input" type="text"
           placeholder="Libro/capítulo o tema…"
           value="${esc(est.titulo || '')}"
           oninput="onTituloChange('estudio', this.value)">
    <div class="asig-double-row">
      ${renderAsigBtn('estudio.conductor', est.conductor, 'Conductor')}
      ${renderAsigBtn('estudio.lector', est.lector, 'Lector')}
    </div>
  </div>`;

  html += `<div class="seccion-bloque">
    <div class="seccion-hdr hdr-vida">
      <span class="seccion-hdr-num">3</span> Nuestra Vida Cristiana
    </div>
    ${vcPartes}${btnAddVC}${estudioHtml}
  </div>`;

  html += `<div style="height:2rem;"></div>`;

  document.getElementById('semana-content').innerHTML = html;
}

// ─────────────────────────────────────────
//   EDICIÓN — HANDLERS
// ─────────────────────────────────────────
window.onTituloChange = function(key, value) {
  if (!semanaData) return;
  const parts = key.split('.');
  if (parts[0] === 'cancion') {
    const campo = { apertura: 'cancionApertura', intermedia: 'cancionIntermedia', cierre: 'cancionCierre' }[parts[1]];
    if (campo) semanaData[campo] = parseInt(value) || null;
  } else if (parts[0] === 'tesoros') {
    if (semanaData.tesoros?.[parts[1]]) semanaData.tesoros[parts[1]].titulo = value;
  } else if (parts[0] === 'ministerio') {
    const idx = parseInt(parts[1]);
    if (semanaData.ministerio?.[idx]) semanaData.ministerio[idx].titulo = value;
  } else if (parts[0] === 'vidaCristiana') {
    const idx = parseInt(parts[1]);
    if (semanaData.vidaCristiana?.[idx]) semanaData.vidaCristiana[idx].titulo = value;
  } else if (parts[0] === 'estudio') {
    if (!semanaData.estudioBiblico) semanaData.estudioBiblico = {};
    semanaData.estudioBiblico.titulo = value;
  }
};

window.asignarSlot = async function(key) {
  const rol = getRolParaSlot(key);
  const conductores = rol ? pubNombresConRol(rol) : publicadores.filter(p => p.activo !== false).map(p => p.nombre);
  const currentId = getSlotPubId(key);
  const currentNombre = nombreDePub(currentId) || '';

  const result = await uiConductorPicker({ conductores, value: currentNombre, label: 'Asignar hermano' });
  if (result === null) return;

  const pubId = result ? pubIdDeNombre(result) : null;
  setSlotPubId(key, pubId);

  // Actualizar solo el texto del botón (sin re-render completo)
  const el = document.getElementById('asig-' + keyToId(key));
  if (el) {
    el.textContent = result || (key.includes('ayudante') ? '+ Ayudante' : (key === 'estudio.lector' ? 'Lector' : key === 'estudio.conductor' ? 'Conductor' : 'Asignar hermano'));
    el.closest('.asignar-btn')?.classList.toggle('empty', !result);
  }
};

window.agregarParte = function(seccion) {
  if (!semanaData) return;
  if (seccion === 'ministerio') {
    if ((semanaData.ministerio?.length || 0) >= 4) { uiToast('Máximo 4 partes en esta sección', 'error'); return; }
    semanaData.ministerio = semanaData.ministerio || [];
    semanaData.ministerio.push({ titulo: '', tipo: 'conversacion', duracion: null, pubId: null, ayudante: null });
  } else if (seccion === 'vidaCristiana') {
    if ((semanaData.vidaCristiana?.length || 0) >= 3) { uiToast('Máximo 3 partes en esta sección', 'error'); return; }
    semanaData.vidaCristiana = semanaData.vidaCristiana || [];
    semanaData.vidaCristiana.push({ titulo: '', tipo: 'parte', duracion: null, pubId: null });
  }
  renderSemanaEdit();
};

window.quitarParte = function(seccion, idx) {
  if (!semanaData) return;
  if (seccion === 'ministerio') {
    if ((semanaData.ministerio?.length || 0) <= 1) { uiToast('Debe haber al menos una parte', 'error'); return; }
    semanaData.ministerio.splice(idx, 1);
  } else if (seccion === 'vidaCristiana') {
    semanaData.vidaCristiana = semanaData.vidaCristiana || [];
    semanaData.vidaCristiana.splice(idx, 1);
  }
  renderSemanaEdit();
};

window.guardarSemana = async function() {
  if (!semanaData) return;
  uiLoading.show('Guardando…');
  try {
    const ref = doc(db, 'congregaciones', congreId, 'vidaministerio', semanaData.fecha);
    await setDoc(ref, semanaData);
    uiLoading.hide();
    uiToast('Programa guardado', 'success');
  } catch(e) {
    uiLoading.hide();
    await uiAlert('Error al guardar: ' + e.message);
  }
};

// ─────────────────────────────────────────
//   IMPORTACIÓN WOL
// ─────────────────────────────────────────
// Proxies en orden de preferencia — si uno falla se prueba el siguiente
const WOL_PROXIES = [
  { build: url => `https://super-math-a40f.mnsmys12.workers.dev/?url=${encodeURIComponent(url)}`, text: r => r.text() },
  { build: url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,           text: r => r.text() },
  { build: url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,                text: async r => { const j = await r.json(); return j.contents; } },
];

function wolUrl(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return `https://wol.jw.org/es/wol/dt/r4/lp-s/${y}/${m}/${d}`;
}


const TIPO_MIN_LABELS = { conversacion: 'De casa en casa', revisita: 'Revisita', escenificacion: 'Escenificación', discurso: 'Discurso' };
const TIPO_MIN_COLORS = { conversacion: '#5BA3D9', revisita: '#EF9F27', escenificacion: '#97C459', discurso: '#7F77DD' };

function renderTipoInstruccionHtml(key, parte) {
  if (!key.startsWith('ministerio.')) return '';
  const tipo  = parte?.tipo;
  const color = TIPO_MIN_COLORS[tipo] || '#888';
  const chip  = tipo
    ? `<span class="tipo-chip" style="background:${color}22;color:${color};border:1px solid ${color}44;">${TIPO_MIN_LABELS[tipo] || tipo}</span>`
    : '';
  const inst = parte?.instruccion
    ? `<div class="parte-instruccion">${esc(parte.instruccion)}</div>`
    : '';
  return (chip || inst) ? `<div class="parte-tipo-row">${chip}${inst}</div>` : '';
}

function parseDur(text) {
  const m = text?.match(/\((\d+)\s*min/);
  return m ? parseInt(m[1]) : null;
}

function limpiaTitulo(text) {
  if (!text) return '';
  // Quita el número de párrafo tipo "1. " al inicio si lo hay
  return text.replace(/^\d+\.\s*/, '').trim();
}

// Detecta el tipo de parte de "Seamos mejores maestros" desde el título
// tipo === 'discurso' → solo 1 participante (sin ayudante)
// los demás → estudiante principal + ayudante
function tipoMinisterioDesdeWOL(titulo) {
  const t = titulo.toLowerCase();
  if (t.includes('conversación') || t.includes('conversacion')) return 'conversacion';
  if (t.includes('revisita'))                                    return 'revisita';
  if (t.includes('escenificación') || t.includes('escenificacion')) return 'escenificacion';
  if (t.includes('discurso'))                                    return 'discurso';
  return 'conversacion'; // fallback — la mayoría son conversaciones
}

function parseWOL(html) {
  const doc     = new DOMParser().parseFromString(html, 'text/html');
  const root    = doc.querySelector('article#article') || doc;
  const allH3   = Array.from(root.querySelectorAll('h3, h4'));
  const allFlat = Array.from(root.querySelectorAll('*'));

  // Partes numeradas: h3/h4 cuyo texto empieza con "N. "
  const numbered = allH3
    .filter(h => /^\d+\.\s/.test(h.textContent.trim()))
    .map(h => {
      const m = h.textContent.trim().match(/^(\d+)\.\s+(.+)/);
      return { num: parseInt(m[1]), titulo: m[2].trim(), el: h, duracion: null };
    });

  if (numbered.length < 3) return null;

  // Duración: primer elemento con "(X mins.)" entre este h3 y el siguiente
  // No filtramos solo hojas porque párrafos de ministerio tienen links adentro
  numbered.forEach((part, i) => {
    const startIdx = allFlat.indexOf(part.el) + 1;
    const endIdx   = numbered[i + 1] ? allFlat.indexOf(numbered[i + 1].el) : allFlat.length;
    for (let j = startIdx; j < endIdx; j++) {
      const d = parseDur(allFlat[j].textContent);
      if (d) {
        part.duracion = d;
        // Capturar instruccion: texto del mismo elemento, sin el prefijo "(X mins.) "
        const raw = allFlat[j].textContent.trim();
        const stripped = raw.replace(/^\(\d+\s*mins?\.\)\s*/i, '').trim();
        part.instruccion = stripped || null;
        break;
      }
    }
  });

  // Canciones: WOL puede usar "Cántico" o "Canción" según la versión
  const songRe  = /[CcÁá](?:á|a)ntico|Canci[oó]n/i;
  const songNum = h => h.textContent.match(/\d+/)?.[0] || '';
  // Apertura: h3 con canción Y oración juntas (antes de las partes numeradas)
  const openH3     = allH3.find(h => songRe.test(h.textContent) && /oraci[oó]n/i.test(h.textContent));
  // Intermedia: h3 con solo número de canción (sin "oración"), entre Tesoros y Vida Cristiana
  const midSongH3  = allH3.find(h => songRe.test(h.textContent) && !/oraci[oó]n/i.test(h.textContent));
  // Cierre: último h3 con canción (con o sin oración)
  const closeH3    = [...allH3].reverse().find(h => songRe.test(h.textContent));
  const midSongPos = midSongH3 ? allH3.indexOf(midSongH3) : -1;

  // Tesoros: siempre las primeras 3 partes numeradas
  const tesorosParts = numbered.slice(0, 3);
  const restParts    = numbered.slice(3);

  let ministrioParts, vidaParts;
  if (midSongPos !== -1) {
    ministrioParts = restParts.filter(p => allH3.indexOf(p.el) < midSongPos);
    vidaParts      = restParts.filter(p => allH3.indexOf(p.el) > midSongPos);
  } else {
    // Fallback sin canción intermedia: última parte = estudio, las demás van a ministerio
    ministrioParts = restParts.slice(0, -1);
    vidaParts      = restParts.slice(-1);
  }

  // Última parte de vida cristiana = estudio bíblico
  const estudioH3      = vidaParts.length ? vidaParts[vidaParts.length - 1] : null;
  const vidaSinEstudio = vidaParts.slice(0, -1);

  const ministerio = ministrioParts.length
    ? ministrioParts.map(p => {
        const tipo = tipoMinisterioDesdeWOL(p.titulo);
        const base = { titulo: p.titulo, tipo, duracion: p.duracion, instruccion: p.instruccion ?? null, pubId: null };
        return tipo === 'discurso' ? base : { ...base, ayudante: null };
      })
    : [
        { titulo: '', tipo: 'conversacion', duracion: null, instruccion: null, pubId: null, ayudante: null },
        { titulo: '', tipo: 'conversacion', duracion: null, instruccion: null, pubId: null, ayudante: null },
        { titulo: '', tipo: 'conversacion', duracion: null, instruccion: null, pubId: null, ayudante: null },
      ];

  const vidaCristiana = vidaSinEstudio.length
    ? vidaSinEstudio.map(p => ({ titulo: p.titulo, tipo: 'parte', duracion: p.duracion, pubId: null }))
    : [{ titulo: '', tipo: 'parte', duracion: null, pubId: null }];

  return {
    canciones: {
      apertura:    songNum(openH3  || {}),
      intermedia:  songNum(midSongH3 || {}),
      cierre:      songNum(closeH3 || {}),
    },
    tesoros: {
      discurso:       { titulo: tesorosParts[0]?.titulo || '',                  duracion: tesorosParts[0]?.duracion || 10, pubId: null },
      joyas:          { titulo: tesorosParts[1]?.titulo || 'Perlas escondidas', duracion: tesorosParts[1]?.duracion || 10, pubId: null },
      lecturaBiblica: { titulo: tesorosParts[2]?.titulo || '',                  duracion: tesorosParts[2]?.duracion || 4,  pubId: null, ayudante: null },
    },
    ministerio,
    vidaCristiana,
    estudioBiblico: { titulo: estudioH3?.titulo || '', duracion: estudioH3?.duracion || 30, conductor: null, lector: null },
  };
}

async function fetchWOL(fecha) {
  const target = wolUrl(fecha);
  let lastErr;
  for (const proxy of WOL_PROXIES) {
    const ctrl = new AbortController();
    const id   = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(proxy.build(target), { signal: ctrl.signal });
      clearTimeout(id);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await proxy.text(res);
    } catch(e) {
      clearTimeout(id);
      console.warn(`WOL proxy falló (${e.message}), probando siguiente…`);
      lastErr = e;
    }
  }
  throw lastErr || new Error('Todos los proxies fallaron');
}

// Aplica títulos/duraciones importados sin pisar las asignaciones ya hechas
function aplicarWOLaSemana(importado) {
  if (!importado || !semanaData) return;

  const merge = (destParte, srcParte) => {
    if (!destParte || !srcParte) return;
    if (srcParte.titulo) destParte.titulo = srcParte.titulo;
    if (srcParte.duracion) destParte.duracion = srcParte.duracion;
  };

  // Canciones
  if (importado.canciones) {
    if (importado.canciones.apertura)   semanaData.cancionApertura   = parseInt(importado.canciones.apertura);
    if (importado.canciones.intermedia) semanaData.cancionIntermedia = parseInt(importado.canciones.intermedia);
    if (importado.canciones.cierre)     semanaData.cancionCierre     = parseInt(importado.canciones.cierre);
  }

  merge(semanaData.tesoros.discurso,       importado.tesoros.discurso);
  merge(semanaData.tesoros.joyas,          importado.tesoros.joyas);
  merge(semanaData.tesoros.lecturaBiblica, importado.tesoros.lecturaBiblica);

  // Ministerio: reemplaza la lista completa de títulos/duraciones, conserva pubIds
  const minOld = semanaData.ministerio || [];
  semanaData.ministerio = importado.ministerio.map((p, i) => ({
    ...p,
    instruccion: p.instruccion ?? null,
    pubId:    minOld[i]?.pubId    ?? null,
    ayudante: minOld[i]?.ayudante ?? null,
    ...(tieneAuxiliar ? { salaAux: minOld[i]?.salaAux ?? { pubId: null, ayudante: null } } : {}),
  }));

  // Vida Cristiana: ídem
  const vcOld = semanaData.vidaCristiana || [];
  semanaData.vidaCristiana = importado.vidaCristiana.map((p, i) => ({
    ...p,
    pubId: vcOld[i]?.pubId ?? null,
  }));

  // Estudio Bíblico: solo título
  if (importado.estudioBiblico.titulo) {
    semanaData.estudioBiblico = semanaData.estudioBiblico || {};
    semanaData.estudioBiblico.titulo = importado.estudioBiblico.titulo;
  }
}

window.autocompletarHermanos = function() {
  uiToast('Próximamente: auto-asignación', 'success');
};

window.reimportarDeWOL = async function() {
  if (!semanaData) return;
  const ok = await uiConfirm({
    title: 'Reimportar de WOL',
    msg: 'Se van a actualizar los títulos y duraciones desde wol.jw.org. Las asignaciones de hermanos no se tocan.',
    confirmText: 'Importar',
    cancelText: 'Cancelar',
    type: 'info',
  });
  if (!ok) return;
  uiLoading.show('Importando de WOL…');
  try {
    const html = await fetchWOL(semanaData.fecha);
    const importado = parseWOL(html);
    if (!importado) throw new Error('No se reconoció el formato de la página.');
    aplicarWOLaSemana(importado);
    uiLoading.hide();
    renderSemanaEdit();
    uiToast('Programa importado de WOL', 'success');
  } catch(e) {
    uiLoading.hide();
    await uiAlert(`No se pudo importar: ${e.message}\n\nPodés cargar los títulos manualmente.`);
  }
};

// ─────────────────────────────────────────
//   CREAR SEMANA NUEVA
// ─────────────────────────────────────────
window.crearSemana = async function() {
  const fechaInput = document.getElementById('nueva-fecha').value;
  if (!fechaInput) { uiToast('Seleccioná una fecha', 'error'); return; }

  const fechaBase  = lunesDeDate(fechaInput);
  const nSemanas   = parseInt(document.getElementById('nueva-n-semanas').value) || 1;
  const reemplazar = document.getElementById('nueva-reemplazar').checked;

  let primeraFecha = null;

  for (let i = 0; i < nSemanas; i++) {
    const d = new Date(fechaBase + 'T12:00:00');
    d.setDate(d.getDate() + i * 7);
    const fecha = fmtDate(d);

    uiLoading.show(nSemanas > 1 ? `Generando semana ${i + 1} de ${nSemanas}…` : 'Verificando…');

    // Verificar si ya existe
    let yaExiste = false;
    try {
      const snap = await getDoc(doc(db, 'congregaciones', congreId, 'vidaministerio', fecha));
      yaExiste = snap.exists();
    } catch(e) {
      uiLoading.hide();
      uiToast(`Error verificando ${fmtDisplay(fecha)}: ${e.message}`, 'error');
      continue;
    }

    if (yaExiste && !reemplazar) continue; // saltar sin preguntar

    // Estructura base — fallback nMin=3, nVC=1 si WOL falla
    semanaData = {
      fecha,
      cancionApertura:   null,
      cancionIntermedia: null,
      cancionCierre:     null,
      presidente:        null,
      oracionApertura:   null,
      oracionCierre:     null,
      tesoros: {
        discurso:       { titulo: '', duracion: 10, pubId: null },
        joyas:          { titulo: 'Perlas escondidas', duracion: 10, pubId: null },
        lecturaBiblica: { titulo: '', duracion: 4, pubId: null, ayudante: null },
      },
      ministerio:    Array.from({ length: 3 }, () => ({
        titulo: '', tipo: 'conversacion', duracion: null, pubId: null, ayudante: null,
        ...(tieneAuxiliar ? { salaAux: { pubId: null, ayudante: null } } : {}),
      })),
      vidaCristiana: [{ titulo: '', tipo: 'parte', duracion: null, pubId: null }],
      estudioBiblico: { titulo: '', duracion: 30, conductor: null, lector: null },
    };

    // Siempre intentar importar de WOL
    uiLoading.show(nSemanas > 1 ? `Importando WOL semana ${i + 1}…` : 'Importando programa de WOL…');
    try {
      const html = await fetchWOL(fecha);
      const importado = parseWOL(html);
      if (importado) {
        aplicarWOLaSemana(importado);
      } else {
        uiToast(`${fmtDisplay(fecha)}: no se pudo parsear WOL — se creó con estructura base`, 'error');
      }
    } catch(e) {
      uiToast(`${fmtDisplay(fecha)}: WOL no disponible — se creó con estructura base`, 'error');
    }

    // Guardar en Firestore
    try {
      await setDoc(doc(db, 'congregaciones', congreId, 'vidaministerio', fecha), semanaData);
    } catch(e) {
      uiLoading.hide();
      uiToast(`Error guardando ${fmtDisplay(fecha)}: ${e.message}`, 'error');
      continue;
    }

    // Actualizar semanasLista
    const idxExistente = semanasLista.findIndex(s => s.fecha === fecha);
    if (idxExistente >= 0) semanasLista[idxExistente] = semanaData;
    else semanasLista.push(semanaData);

    if (!primeraFecha) primeraFecha = fecha;
  }

  semanasLista.sort((a, b) => b.fecha.localeCompare(a.fecha));
  uiLoading.hide();

  if (!primeraFecha) {
    uiToast('No se generó ninguna semana (todas ya existían)', 'error');
    return;
  }

  uiToast(nSemanas === 1 ? 'Semana creada' : `${nSemanas} semanas generadas`, 'success');

  if (nSemanas > 1) {
    renderSemanas(semanasLista);
    switchVmTab('semanas');
    showView('view-semanas');
  } else {
    semanaData = semanasLista.find(s => s.fecha === primeraFecha);
    document.getElementById('semana-titulo-display').textContent = 'Semana del ' + fmtDisplay(primeraFecha);
    renderSemanaEdit();
    showView('view-semana');
    updateNavBtnsSemana();
  }
};

// ─────────────────────────────────────────
//   COMPARTIR FOTO (html2canvas)
// ─────────────────────────────────────────
window.compartirSemanaFoto = function() {
  const el = document.getElementById('pub-contenido');
  if (!el) return;
  uiLoading.show('Generando imagen…');
  const prevBg  = el.style.background;
  const prevPad = el.style.padding;
  el.style.background = '#1e1e1e';
  el.style.padding    = '16px';
  html2canvas(el, {
    backgroundColor: '#1e1e1e',
    scale: 2,
    useCORS: true,
    logging: false,
  }).then(canvas => {
    el.style.background = prevBg;
    el.style.padding    = prevPad;
    uiLoading.hide();
    const link = document.createElement('a');
    const semStr = (pubFecha || lunesDeHoy()).replace(/-/g, '');
    link.download = `vm-semana-${semStr}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
  }).catch(e => {
    el.style.background = prevBg;
    el.style.padding    = prevPad;
    uiLoading.hide();
    uiToast('Error al generar imagen: ' + e.message, 'error');
  });
};

// ─────────────────────────────────────────
//   EXPORTAR A SHEETS
// ─────────────────────────────────────────
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

async function apiFetchVM(params) {
  const qs = Object.entries(params).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  await fetch(`${vmScriptUrl}?${qs}`, { mode: 'no-cors' });
}

function formatSemanaParaSheets(s) {
  const rows = [];
  const n = id => (id && nombreDePub(id)) || '—';
  const add = (parte, titulo, persona, ayudante) =>
    rows.push([parte, titulo || '', persona || '—', ayudante || '']);

  rows.push([`=== Semana del ${fmtDisplay(s.fecha)} ===`, '', '', '']);
  const cStr = [
    s.cancionApertura   ? `Ap: ${s.cancionApertura}`   : null,
    s.cancionIntermedia ? `Int: ${s.cancionIntermedia}` : null,
    s.cancionCierre     ? `Cie: ${s.cancionCierre}`     : null,
  ].filter(Boolean).join('  ·  ');
  rows.push(['Canciones', cStr || '—', '', '']);
  rows.push(['', '', '', '']);

  rows.push(['— PRESIDENCIA —', '', '', '']);
  add('Presidente',      '',  n(s.presidente));
  add('Oración apertura','',  n(s.oracionApertura));
  add('Oración cierre',  '',  n(s.oracionCierre));
  rows.push(['', '', '', '']);

  rows.push(['— TESOROS DE LA PALABRA DE DIOS —', '', '', '']);
  add('1. Discurso',       s.tesoros?.discurso?.titulo,       n(s.tesoros?.discurso?.pubId));
  add('2. Perlas escondidas', s.tesoros?.joyas?.titulo,      n(s.tesoros?.joyas?.pubId));
  const lb = s.tesoros?.lecturaBiblica;
  add('3. Lectura Bíblica', lb?.titulo, n(lb?.pubId), n(lb?.ayudante));
  rows.push(['', '', '', '']);

  rows.push(['— SEAMOS MEJORES MAESTROS —', '', '', '']);
  (s.ministerio || []).forEach((p, i) =>
    add(`Parte ${i+1}`, p.titulo, n(p.pubId), n(p.ayudante))
  );
  rows.push(['', '', '', '']);

  rows.push(['— NUESTRA VIDA CRISTIANA —', '', '', '']);
  (s.vidaCristiana || []).forEach((p, i) =>
    add(`Parte ${i+1}`, p.titulo, n(p.pubId))
  );
  const est = s.estudioBiblico || {};
  add('Estudio Bíblico', est.titulo, n(est.conductor), n(est.lector));
  rows.push(['', '', '', '']); // separador entre semanas
  return rows;
}

window.exportarMesASheets = async function() {
  if (!vmScriptUrl) return;
  const mesInput = document.getElementById('vm-export-mes');
  const [anio, mes] = (mesInput?.value || '').split('-').map(Number);
  if (!anio || !mes) { uiToast('Seleccioná un mes', 'error'); return; }

  const hojaName = `${MESES_ES[mes-1]} ${anio}`;
  const semanasDelMes = semanasLista.filter(s => {
    const d = new Date(s.fecha + 'T12:00:00');
    return d.getFullYear() === anio && d.getMonth() + 1 === mes;
  });

  if (!semanasDelMes.length) {
    await uiAlert(`No hay semanas cargadas para ${hojaName}.`, 'Sin datos');
    return;
  }

  // Cargar datos completos de Firestore para cada semana (semanasLista puede tener datos parciales)
  const statusEl = document.getElementById('vm-export-status');
  const setBtnDis = d => { const b = document.querySelector('.btn-sheets-vm'); if (b) b.disabled = d; };

  setBtnDis(true);
  try {
    for (let i = 0; i < semanasDelMes.length; i++) {
      const fecha = semanasDelMes[i].fecha;
      if (statusEl) statusEl.textContent = `Enviando ${i+1}/${semanasDelMes.length}…`;

      // Cargar doc completo para tener todos los pubId
      const snap = await getDoc(doc(db, 'congregaciones', congreId, 'vidaministerio', fecha));
      if (!snap.exists()) continue;
      const filas = formatSemanaParaSheets(snap.data());

      await apiFetchVM({
        action: 'saveVMSemana',
        hoja: hojaName,
        semana: fecha,
        clearFirst: i === 0 ? 'true' : 'false',
        filas: JSON.stringify(filas),
      });
    }
    if (statusEl) {
      statusEl.style.color = '#5DCAA5';
      statusEl.textContent = `✓ Exportado a hoja "${hojaName}"`;
    }
  } catch(e) {
    if (statusEl) { statusEl.style.color = '#e05050'; statusEl.textContent = 'Error: ' + e.message; }
  }
  setBtnDis(false);
};

// ─────────────────────────────────────────
//   INIT
// ─────────────────────────────────────────
(async function init() {
  const savedId     = sessionStorage.getItem('congreId');
  const savedNombre = sessionStorage.getItem('congreNombre');

  if (!savedId) {
    window.location.href = '../index.html';
    return;
  }

  congreId     = savedId;
  congreNombre = savedNombre;
  document.getElementById('cover-congre').textContent = congreNombre || '—';

  try {
    const snap = await getDoc(doc(db, 'congregaciones', congreId));
    if (!snap.exists()) { window.location.href = '../index.html'; return; }
    const data = snap.data();
    pinVM = data.pinVidaMinisterio || '1234';
    tieneAuxiliar = data.tieneAuxiliar === true;
    vmScriptUrl = data.scriptUrl || null;
    await cargarPublicadores();
    await cargarVmEspeciales();
  } catch(e) {
    console.error('Error al inicializar:', e);
  }

  showView('view-cover');
})();
