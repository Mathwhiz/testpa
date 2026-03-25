import { db } from '../firebase.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// ── congreId viene de sessionStorage (seteado en index.html al elegir congregación) ──
const CONGRE_ID     = sessionStorage.getItem('congreId')     || 'sur';
const CONGRE_NOMBRE = sessionStorage.getItem('congreNombre') || CONGRE_ID;

const congreSubEl = document.getElementById('congre-sub');
if (congreSubEl) congreSubEl.textContent = CONGRE_NOMBRE;

function congreRef()  { return doc(db, 'congregaciones', CONGRE_ID); }
function terrCol()    { return collection(db, 'congregaciones', CONGRE_ID, 'territorios'); }
function histCol(id)  { return collection(db, 'congregaciones', CONGRE_ID, 'territorios', String(id), 'historial'); }
function salidaCol()  { return collection(db, 'congregaciones', CONGRE_ID, 'salidas'); }
function pubCol()     { return collection(db, 'congregaciones', CONGRE_ID, 'publicadores'); }
function gruposCol()  { return collection(db, 'congregaciones', CONGRE_ID, 'grupos'); }

// ─────────────────────────────────────────
//  CONDUCTORES
// ─────────────────────────────────────────
const CONDUCTORES_BY_GROUP = { 1: [], 2: [], 3: [], 4: [], C: [] };

let _conductoresListos = false;
let _conductoresResolvers = [];

function conductoresListos() {
  if (_conductoresListos) return Promise.resolve();
  return new Promise(res => _conductoresResolvers.push(res));
}

async function cargarConductores() {
  try {
    const snap = await getDocs(pubCol());
    [1,2,3,4,'C'].forEach(g => { CONDUCTORES_BY_GROUP[g] = []; });
    const MAP = {
      'CONDUCTOR_GRUPO_1': 1,
      'CONDUCTOR_GRUPO_2': 2,
      'CONDUCTOR_GRUPO_3': 3,
      'CONDUCTOR_GRUPO_4': 4,
      'CONDUCTOR_CONGREGACION': 'C',
    };
    snap.forEach(d => {
      const h = d.data();
      (h.roles || []).forEach(rol => {
        const grupo = MAP[rol.trim().toUpperCase()];
        if (grupo !== undefined) {
          if (!CONDUCTORES_BY_GROUP[grupo].includes(h.nombre)) {
            CONDUCTORES_BY_GROUP[grupo].push(h.nombre);
          }
        }
      });
    });
  } catch(e) {
    console.warn('No se pudo cargar conductores:', e);
  } finally {
    _conductoresListos = true;
    _conductoresResolvers.forEach(r => r());
    _conductoresResolvers = [];
  }
}

// ─────────────────────────────────────────
//  HELPERS FECHA
// ─────────────────────────────────────────
function fmtDateLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const SPECIAL_TERR = { '11': true, '131': true };
const DIAS_SEMANA = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const DIAS_ES    = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

let selectedGrupo = null;
let selected      = [];
let territoriosData = {};
let allTerritoriosData = {};
let configData    = {};
let modalTerr     = null;
let editingRow    = null;   // doc ID en Firestore
let historialRows = [];
let salidas       = [];
let salidaCounter = 0;
let semanaOffset  = 0;

// ─────────────────────────────────────────
//   COLORES
// ─────────────────────────────────────────
const GCOLORS = { 1:'#378ADD', 2:'#EF9F27', 3:'#97C459', 4:'#D85A30', C:'#7F77DD' };
const GBGS    = { 1:'rgba(55,138,221,0.18)', 2:'rgba(239,159,39,0.18)', 3:'rgba(151,196,89,0.18)', 4:'rgba(216,90,48,0.18)', C:'rgba(127,119,221,0.18)' };
const GROUP_COLORS = { 1:'#378ADD', 2:'#EF9F27', 3:'#97C459', 4:'#D85A30', 'C':'#7F77DD' };
const GROUP_BG     = { 1:'rgba(55,138,221,0.15)', 2:'rgba(239,159,39,0.15)', 3:'rgba(151,196,89,0.15)', 4:'rgba(216,90,48,0.15)', C:'rgba(127,119,221,0.15)' };

const DIA_COLORS = {
  'Lunes':    '#85B7EB',
  'Martes':   '#85B7EB',
  'Miércoles':'#C0DD97',
  'Jueves':   '#FAC775',
  'Viernes':  '#C0DD97',
  'Sábado':   '#CDB4FF',
  'Domingo':  '#F09595',
};

// ─────────────────────────────────────────
//   UTILIDADES DOM
// ─────────────────────────────────────────
function show(id) {
  document.getElementById(id).style.display = '';
  if (!id.startsWith('view-')) return;
  const homeBtn = document.getElementById('btn-home');
  const mapaBtn = document.getElementById('btn-mapa-float');
  if (homeBtn) {
    const showHome = ['view-config','view-preview','view-registrar','view-info','view-historial'].includes(id);
    if (showHome) homeBtn.classList.add('visible');
    homeBtn.classList.remove('hidden-in-plan');
  }
  if (mapaBtn) {
    if (id === 'view-info') {
      mapaBtn.classList.add('visible');
      mapaBtn.onclick = () => openMapaPopup('info');
    } else if (id === 'view-registrar') {
      mapaBtn.classList.add('visible');
      mapaBtn.onclick = () => openMapaPopup('registrar');
    } else if (id === 'view-config') {
      mapaBtn.classList.add('visible');
      mapaBtn.onclick = () => openMapaPopup('info');
    } else {
      mapaBtn.classList.remove('visible');
    }
  }
}
function hide(id) { document.getElementById(id).style.display = 'none'; }
function setStep(n) {
  document.getElementById('step-bar').style.display = 'flex';
  for (let i = 1; i <= 3; i++)
    document.getElementById('s' + i).className = 'step' + (i < n ? ' done' : i === n ? ' active' : '');
}

function formatShort(ds) {
  if (!ds) return '—';
  const d = new Date(ds + 'T00:00:00');
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}
function formatShortFull(ds) {
  if (!ds) return '—';
  const d = new Date(ds + 'T00:00:00');
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
}
function daysSince(ds) {
  if (!ds) return 9999;
  return Math.floor((new Date() - new Date(ds + 'T00:00:00')) / 86400000);
}
function dayClass(d) { return d > 90 ? 'days-old' : d > 45 ? 'days-mid' : 'days-new'; }

function getWeekDates(offset = 0) {
  const now = new Date(); const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0,0,0,0);
  function d(o) {
    const x = new Date(monday);
    x.setDate(monday.getDate() + o);
    return fmtDateLocal(x);
  }
  return { mon:d(0), tue:d(1), wed:d(2), thu:d(3), fri:d(4), sat:d(5), sun:d(6) };
}

function getNombreDia(fecha) {
  if (!fecha) return '—';
  return DIAS_ES[new Date(fecha + 'T00:00:00').getDay()];
}

function fmtDate(ds) {
  if (!ds) return '';
  const m = ds.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1].slice(-2)}`;
  return ds;
}

function fmtHistDate(val) {
  if (!val) return '—';
  if (typeof val === 'string' && val.includes('T')) {
    const d = new Date(val);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
  }
  return String(val);
}

function getDiaFromFecha(fecha) {
  if (!fecha) return '';
  const m = fecha.toString().match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    const d = new Date(`${y}-${m[2]}-${m[1]}T00:00:00`);
    return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()];
  }
  return '';
}

// ─────────────────────────────────────────
//   FETCH DATOS DESDE FIRESTORE
// ─────────────────────────────────────────

/**
 * Carga todos los territorios de un grupo y su último historial.
 * Retorna objeto: { [terrId]: { lastFin, lastIni, enProgreso, tipo } }
 */
async function fetchGrupo(grupo) {
  const grupoStr = String(grupo);
  const q = query(terrCol(), where('grupoId', '==', grupoStr));
  const snap = await getDocs(q);

  const result = {};
  // Para cada territorio, buscar su última entrada de historial
  await Promise.all(snap.docs.map(async terrDoc => {
    const terr = terrDoc.data();
    const id   = String(terr.id);

    // Ordenar historial por fechaInicio desc, tomar el último
    const histSnap = await getDocs(
      query(histCol(id), orderBy('fechaInicio', 'desc'), limit(1))
    );

    let lastFin = null, lastIni = null, enProgreso = false;
    if (!histSnap.empty) {
      const h = histSnap.docs[0].data();
      lastIni    = h.fechaInicio || null;
      lastFin    = h.fechaFin   || null;
      enProgreso = !h.fechaFin;
    }

    result[id] = { lastFin, lastIni, enProgreso, tipo: terr.tipo || 'normal' };
  }));

  return result;
}

/**
 * Carga config de territorios especiales del grupo (no_predica, peligroso).
 * Retorna objeto: { [terrId]: 'no_predica' | 'peligroso' | 'normal' }
 */
async function fetchConfig(grupo) {
  const grupoStr = String(grupo);
  const q = query(terrCol(), where('grupoId', '==', grupoStr));
  const snap = await getDocs(q);
  const cfg = {};
  snap.forEach(d => {
    const t = d.data();
    if (t.tipo && t.tipo !== 'normal') cfg[String(t.id)] = t.tipo;
  });
  return cfg;
}

// ─────────────────────────────────────────
//   COVER / NAVEGACIÓN
// ─────────────────────────────────────────
(function() {
  const grupoGuardado = sessionStorage.getItem('selectedGrupo');
  if (grupoGuardado) {
    sessionStorage.removeItem('selectedGrupo');
    window.addEventListener('DOMContentLoaded', () => {
      selectedGrupo = isNaN(grupoGuardado) ? grupoGuardado : parseInt(grupoGuardado);
      document.querySelectorAll('.grupo-btn').forEach(btn => {
        if (String(btn.dataset.grupo) === String(grupoGuardado)) {
          selectGrupo(btn, isNaN(grupoGuardado) ? grupoGuardado : parseInt(grupoGuardado));
        }
      });
      goToModo();
    });
  }
})();

const WEEK = getWeekDates();

function applyGrupoColors() {
  document.querySelectorAll('.grupo-btn').forEach(btn => {
    const g = btn.dataset.grupo;
    const c = GCOLORS[g] || '#888';
    const bg = GBGS[g] || 'rgba(100,100,100,0.18)';
    btn.style.borderColor = c;
    btn.style.color = c;
    btn.onmouseenter = () => { if (!btn.classList.contains('selected')) btn.style.background = bg; };
    btn.onmouseleave = () => { if (!btn.classList.contains('selected')) btn.style.background = '#2a2a2a'; };
  });
}
applyGrupoColors();

function selectGrupo(el, n) {
  document.querySelectorAll('.grupo-btn').forEach(b => {
    b.classList.remove('selected');
    b.style.background = '#2a2a2a';
  });
  el.classList.add('selected');
  el.style.background = GBGS[n] || 'rgba(100,100,100,0.18)';
  selectedGrupo = n;
  document.getElementById('btn-start').classList.add('enabled');
}

function goToCover() {
  selected = [];
  hide('view-config'); hide('view-preview');
  hide('view-modo');   hide('view-registrar'); hide('view-info');
  show('view-cover');
  document.getElementById('step-bar').style.display = 'none';
}

function goToModo() {
  selected = [];
  document.getElementById('btn-home').classList.remove('visible');
  document.getElementById('btn-mapa-float')?.classList.remove('visible');
  hide('view-cover'); hide('view-config'); hide('view-preview');
  hide('view-registrar'); hide('view-info'); hide('view-historial');
  const label = document.getElementById('modo-grupo-label');
  label.textContent = selectedGrupo === 'C' ? 'Congregación' : selectedGrupo;
  label.style.color = GROUP_COLORS[selectedGrupo] || '#97C459';

  const cardColors = [
    { border: '#378ADD', bg: 'rgba(55,138,221,0.15)'  },
    { border: '#1D9E75', bg: 'rgba(29,158,117,0.15)'  },
    { border: '#7F77DD', bg: 'rgba(127,119,221,0.15)' },
    { border: '#FAC775', bg: 'rgba(250,199,117,0.15)' },
    { border: '#5DCAA5', bg: 'rgba(93,202,165,0.15)'  },
  ];
  document.querySelectorAll('.modo-card').forEach((card, i) => {
    const cc = cardColors[i] ?? cardColors[cardColors.length - 1];
    card.style.borderColor = cc.border;
    card.onmouseenter = function() { this.style.background = cc.bg; this.style.transform = 'scale(1.02)'; };
    card.onmouseleave = function() { this.style.background = '#2a2a2a'; this.style.transform = ''; };
  });
  document.querySelectorAll('.modo-icon').forEach((icon, i) => {
    const cc = cardColors[i] ?? cardColors[cardColors.length - 1];
    icon.style.background = cc.bg;
  });

  show('view-modo');
  document.getElementById('step-bar').style.display = 'none';
}

function goToMapa() {
  sessionStorage.setItem('selectedGrupo', selectedGrupo);
  window.location.href = 'mapa.html';
}

async function cerrarSesion() {
  const ok = await uiConfirm({
    title: '¿Cerrar sesión?',
    msg: 'Vas a volver a la pantalla de grupos.',
    confirmText: 'Cerrar sesión',
    cancelText: 'Cancelar',
    type: 'purple'
  });
  if (!ok) return;
  selectedGrupo = null;
  _conductoresListos = false;
  _conductoresResolvers = [];
  document.querySelectorAll('.grupo-btn').forEach(b => {
    b.classList.remove('selected');
    b.style.background = '#2a2a2a';
  });
  document.getElementById('btn-start').classList.remove('enabled');
  document.getElementById('btn-home').classList.remove('visible');
  document.getElementById('btn-mapa-float')?.classList.remove('visible');
  goToCover();
}

// ─────────────────────────────────────────
//   PIN
// ─────────────────────────────────────────
let PINS = null;
let pinBuffer = '';
let pinGrupo  = null;

async function cargarPins() {
  try {
    const snap = await getDocs(gruposCol());
    PINS = {};
    snap.forEach(d => {
      const { id, pin } = d.data();
      if (id && pin) PINS[id] = pin;
    });
    if (Object.keys(PINS).length === 0) {
      await uiAlert('No se encontraron grupos configurados en la base de datos.', 'Error de configuración');
      PINS = null;
    }
  } catch(e) {
    await uiAlert('Error al cargar la configuración de grupos: ' + e.message, 'Error');
    PINS = null;
  }
}
cargarPins();

function openPin() {
  pinGrupo = selectedGrupo;
  pinBuffer = '';
  updatePinDots();
  document.getElementById('pin-error').textContent = '';
  const label = pinGrupo === 'C' ? 'Congregación' : 'Grupo ' + pinGrupo;
  document.getElementById('pin-title').textContent = label;
  const color = GCOLORS[pinGrupo] || '#97C459';
  document.getElementById('pin-title').style.color = color;
  document.getElementById('pin-card').style.borderColor = color;
  document.getElementById('pin-modal').style.display = 'flex';
}

function pinPress(digit) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += digit;
  updatePinDots();
  if (pinBuffer.length === 4) setTimeout(checkPin, 150);
}

function pinDelete() {
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();
  document.getElementById('pin-error').textContent = '';
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('pd' + i);
    dot.classList.toggle('filled', i < pinBuffer.length);
    const color = GCOLORS[pinGrupo] || '#97C459';
    dot.style.borderColor = i < pinBuffer.length ? color : '#555';
    dot.style.background  = i < pinBuffer.length ? color : 'transparent';
  }
}

function checkPin() {
  if (PINS === null) {
    document.getElementById('pin-error').textContent = 'Error: configuración no cargada';
    pinBuffer = '';
    updatePinDots();
    return;
  }
  const correct = PINS[String(pinGrupo)];
  if (pinBuffer === correct) {
    document.getElementById('pin-modal').style.display = 'none';
    pinBuffer = '';
    goToModo();
    cargarConductores();
  } else {
    document.getElementById('pin-error').textContent = 'PIN incorrecto, intentá de nuevo';
    pinBuffer = '';
    updatePinDots();
  }
}

function pinCancel() {
  document.getElementById('pin-modal').style.display = 'none';
  pinBuffer = '';
}

// ─────────────────────────────────────────
//   PLANIFICADOR
// ─────────────────────────────────────────
function getPlantilla(grupo) {
  const week = getWeekDates(semanaOffset);
  if (grupo === 'C') {
    return [
      { tipo:'campo', fecha: week.mon, hora:'18:30', conductor:'', encuentro:'', territorio:'' },
      { tipo:'campo', fecha: week.tue, hora:'09:30', conductor:'', encuentro:'', territorio:'' },
      { tipo:'campo', fecha: week.wed, hora:'09:30', conductor:'', encuentro:'', territorio:'' },
      { tipo:'campo', fecha: week.thu, hora:'09:30', conductor:'', encuentro:'', territorio:'' },
      { tipo:'campo', fecha: week.fri, hora:'09:30', conductor:'', encuentro:'', territorio:'' },
      { tipo:'campo', fecha: week.sat, hora:'09:30', conductor:'', encuentro:'', territorio:'' },
      { tipo:'campo', fecha: week.sun, hora:'09:30', conductor:'', encuentro:'', territorio:'' },
    ];
  }
  return [
    { tipo:'tel',   fecha: week.tue, hora:'17:30', conductor:'', encuentro:'', territorio:'' },
    { tipo:'campo', fecha: week.tue, hora:'18:30', conductor:'', encuentro:'', territorio:'' },
    { tipo:'campo', fecha: week.thu, hora:'18:30', conductor:'', encuentro:'', territorio:'' },
    { tipo:'campo', fecha: week.fri, hora:'18:30', conductor:'', encuentro:'', territorio:'' },
  ];
}

async function goToStep1() {
  hide('view-cover'); hide('view-preview');
  hide('view-modo');  hide('view-registrar'); hide('view-info');
  show('view-config'); setStep(1);
  semanaOffset = 0;
  updateWeekInfo();
  hide('terr-error');

  if (window.uiLoading) uiLoading.show('Cargando territorios...');
  else show('terr-loading');

  try {
    territoriosData = {};
    allTerritoriosData = {};
    const fetchPromises = [fetchGrupo(selectedGrupo), conductoresListos()];
    const extraGrupos = selectedGrupo === 'C' ? [1, 2, 3, 4] : [];
    const extraPromises = extraGrupos.map(g => fetchGrupo(g));

    const [raw] = await Promise.all([
      ...fetchPromises,
      ...extraPromises.map((p, i) =>
        p.then(data => { allTerritoriosData[extraGrupos[i]] = data; })
      )
    ]);

    territoriosData = raw;
    configData = await fetchConfig(selectedGrupo);

    if (window.uiLoading) uiLoading.hide(); else hide('terr-loading');
    renderSalidas();
  } catch(err) {
    if (window.uiLoading) uiLoading.hide(); else hide('terr-loading');
    const errEl = document.getElementById('terr-error');
    errEl.innerHTML = `<div class="error-wrap">Error al cargar: ${err.message}. <button class="btn-secondary" style="font-size:12px;padding:4px 10px;margin-left:8px;" onclick="goToStep1()">Reintentar</button></div>`;
    show('terr-error');
  }
}

function updateWeekInfo() {
  const w = getWeekDates(semanaOffset);
  document.getElementById('week-info').textContent = `Semana del ${formatShort(w.mon)} al ${formatShort(w.sun)}`;
  const prevBtn = document.getElementById('btn-semana-prev');
  if (prevBtn) {
    prevBtn.style.opacity = semanaOffset <= 0 ? '0.3' : '1';
    prevBtn.style.pointerEvents = semanaOffset <= 0 ? 'none' : 'auto';
  }
}

function cambiarSemana(dir) {
  if (dir < 0 && semanaOffset <= 0) return;
  semanaOffset += dir;
  updateWeekInfo();
  renderSalidas();
}

function renderSalidas() {
  const c = document.getElementById('salidas-container');
  c.innerHTML = '';
  salidas = [];
  salidaCounter = 0;

  if (selectedGrupo === 'C') {
    const telBlock = document.createElement('div');
    telBlock.className = 'salida-card-new tipo-tel';
    telBlock.style.marginBottom = '14px';
    telBlock.innerHTML = `
      <div class="salida-card-top" style="margin-bottom:8px;">
        <span style="font-size:16px;font-weight:500;color:#5DCAA5;">Telefónica fija — Lunes a Sábado</span>
      </div>
      <div style="font-size:13px;color:#888;margin-bottom:10px;">
        ID: 844 0225 6636 &nbsp;·&nbsp; Contraseña: 479104
      </div>
      <div class="form-row">
        <div><label>Hora mañana</label><input type="time" id="tel-fija-manana" value="10:00"></div>
        <div><label>Hora tarde</label><input type="time" id="tel-fija-tarde" value="17:00"></div>
      </div>`;
    c.appendChild(telBlock);
    if (window.upgradeInputs) upgradeInputs(telBlock);
  }

  const plantilla = getPlantilla(selectedGrupo);
  plantilla.forEach(p => addSalida(p.tipo, p));
}

function getTerritoryOptions() {
  if (!territoriosData || Object.keys(territoriosData).length === 0)
    return '<option value="">— Sin datos —</option>';
  const lista = Object.keys(territoriosData)
    .filter(n => (configData[n] || 'normal') !== 'no_predica')
    .map(n => {
      const d = territoriosData[n];
      const lastDate = d.lastFin || d.lastIni;
      return { n, days: daysSince(lastDate) };
    })
    .sort((a, b) => b.days - a.days);
  return '<option value="">— Elegir territorio —</option>' +
    lista.map(t => `<option value="${t.n}">Terr. ${t.n} (${t.days}d)</option>`).join('');
}

function getConductorOptions(grupo, sel = '') {
  const conductores = CONDUCTORES_BY_GROUP[grupo] || [];
  return '<option value="">— Elegir conductor —</option>' +
    conductores.map(c => `<option value="${c}" ${c===sel?'selected':''}>${c}</option>`).join('');
}

function updateDiaLabel(id) {
  const fecha = document.getElementById('sal-fecha-' + id)?.value;
  const label = document.getElementById('sal-dia-label-' + id);
  if (!label) return;
  const nombre = getNombreDia(fecha);
  label.textContent = nombre;
  label.style.color = DIA_COLORS[nombre] || '#eee';
}

function reordenarSalidas() {
  const container = document.getElementById('salidas-container');
  const fixedBlock = container.querySelector('.tipo-tel:not([id^="salida-card-"])');
  const cards = [...container.querySelectorAll('[id^="salida-card-"]')];
  cards.sort((a, b) => {
    const idA = parseInt(a.id.replace('salida-card-', ''));
    const idB = parseInt(b.id.replace('salida-card-', ''));
    const fechaA = document.getElementById('sal-fecha-' + idA)?.value || '';
    const fechaB = document.getElementById('sal-fecha-' + idB)?.value || '';
    if (fechaA !== fechaB) return fechaA.localeCompare(fechaB);
    const horaA  = document.getElementById('sal-hora-'  + idA)?.value || '';
    const horaB  = document.getElementById('sal-hora-'  + idB)?.value || '';
    return horaA.localeCompare(horaB);
  });
  if (fixedBlock) container.appendChild(fixedBlock);
  cards.forEach(card => container.appendChild(card));
}

function addSalida(tipo, data = {}) {
  if (salidas.length >= 20) return;
  const id = ++salidaCounter;
  const week = getWeekDates(semanaOffset);
  const s = {
    id, tipo,
    fecha: data.fecha || week.tue,
    hora:  data.hora  || (tipo === 'tel' ? '17:30' : '18:30'),
    conductor: data.conductor || '',
    encuentro: data.encuentro || '',
    territorio: data.territorio || ''
  };
  salidas.push(s);
  renderSalidaCard(s);
}

function removeSalida(id) {
  salidas = salidas.filter(s => s.id !== id);
  const el = document.getElementById('salida-card-' + id);
  if (el) el.remove();
}

function renderSalidaCard(s) {
  const c = document.getElementById('salidas-container');
  const esTel = s.tipo === 'tel';
  const div = document.createElement('div');
  div.className = 'salida-card-new ' + (esTel ? 'tipo-tel' : 'tipo-campo');
  div.id = 'salida-card-' + s.id;
  const nombreDia = getNombreDia(s.fecha);
  const diaColor  = DIA_COLORS[nombreDia] || '#eee';
  div.innerHTML = `
    <div class="salida-card-top">
      <div style="display:flex;align-items:center;gap:10px;">
        <span id="sal-dia-label-${s.id}" style="font-size:22px;font-weight:500;color:${diaColor};">${nombreDia}</span>
        <span class="salida-card-label" style="font-size:13px;color:#888;">${esTel ? 'Telefónica' : 'Campo'}</span>
      </div>
      <button class="salida-remove-btn" onclick="removeSalida(${s.id})">✕</button>
    </div>
    <div class="form-row">
      <div><label>Día</label><input type="date" id="sal-fecha-${s.id}" value="${s.fecha}" onchange="updateDiaLabel(${s.id})"></div>
      <div><label>Hora</label><input type="time" id="sal-hora-${s.id}" value="${s.hora}"></div>
    </div>
    <div class="form-row">
      <div>
        <label>Conductor</label>
        <div style="display:flex;align-items:center;gap:6px;">
          <select id="sal-cond-${s.id}" style="flex:1;">${getConductorOptions(selectedGrupo, s.conductor)}</select>
          <button type="button" onclick="openConductorPicker('sal-cond-${s.id}', selectedGrupo, this)"
            style="padding:6px 10px;background:#1a1a2e;color:#7F77DD;border:0.5px solid #4A44A5;border-radius:8px;cursor:pointer;font-size:13px;flex-shrink:0;font-weight:500;">
            👤
          </button>
        </div>
      </div>
      ${esTel ? '' : `
      <div>
        <div style="display:flex;align-items:flex-end;gap:6px;">
          <div style="flex:1;">
            <label>Territorio</label>
            <input type="hidden" id="sal-terr-${s.id}" value="">
            <button type="button" id="sal-terr-btn-${s.id}" class="ui-fake-input empty"
              onclick="openTerritorioPicker(${s.id}, 'sal-terr-${s.id}', 'sal-terr-btn-${s.id}')">
              <span class="ui-fake-input-icon">🗺</span><span>Elegir territorio</span>
            </button>
          </div>
          <button type="button" onclick="openMapaPicker(${s.id})" title="Elegir del mapa"
            style="margin-bottom:1px;padding:6px 10px;background:#1a1a2e;color:#7F77DD;border:0.5px solid #4A44A5;border-radius:8px;cursor:pointer;font-size:13px;line-height:1;flex-shrink:0;font-weight:500;">
            🗺
          </button>
          <button type="button" onclick="addExtraTerritory(${s.id})"
            style="margin-bottom:1px;padding:6px 9px;background:#1a2e0a;color:#97C459;border:0.5px solid #3B6D11;border-radius:8px;cursor:pointer;font-size:16px;line-height:1;flex-shrink:0;">+</button>
        </div>
        <div id="extra-terrs-${s.id}"></div>
      </div>`}
    </div>
    <div>
      <label>Encuentro / Familia</label>
      <input type="text" id="sal-enc-${s.id}" value="${s.encuentro}" placeholder="Ej: Flia. García / esq. X y Y">
    </div>`;
  c.appendChild(div);
  if (window.upgradeInputs) upgradeInputs(div);
  const fechaInput = div.querySelector(`#sal-fecha-${s.id}`);
  if (fechaInput) {
    fechaInput.addEventListener('change', () => { updateDiaLabel(s.id); reordenarSalidas(); });
  }
  const horaInput = div.querySelector(`#sal-hora-${s.id}`);
  if (horaInput) {
    horaInput.addEventListener('change', () => reordenarSalidas());
  }
}

function addExtraTerritory(salidaId) {
  const container = document.getElementById('extra-terrs-' + salidaId);
  if (!container) return;
  const idx = container.children.length + 2;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:6px;';
  const hiddenId = `sal-terr-${salidaId}-x${idx}`;
  const btnId    = `sal-terr-btn-${salidaId}-x${idx}`;
  wrap.innerHTML = `
    <input type="hidden" id="${hiddenId}" value="">
    <button type="button" id="${btnId}" class="ui-fake-input empty" style="flex:1;font-size:13px;"
      onclick="openTerritorioPicker('${salidaId}', '${hiddenId}', '${btnId}')">
      <span class="ui-fake-input-icon">🗺</span><span>Elegir territorio</span>
    </button>
    <button type="button" onclick="this.parentElement.remove()" style="padding:6px 9px;background:#2e1a1a;color:#F09595;border:0.5px solid #A32D2D;border-radius:8px;cursor:pointer;font-size:16px;line-height:1;flex-shrink:0;">−</button>`;
  container.appendChild(wrap);
}

// ─────────────────────────────────────────
//   CONDUCTOR PICKER
// ─────────────────────────────────────────
function openConductorPicker(selectId, grupo, btn) {
  const conductores = CONDUCTORES_BY_GROUP[grupo] || [];
  if (!window.uiConductorPicker || conductores.length === 0) return;
  const sel = document.getElementById(selectId);
  uiConductorPicker({
    conductores,
    value: sel ? sel.value : '',
    label: 'Elegí el conductor',
    color: GCOLORS[grupo] || '#97C459',
  }).then(resultado => {
    if (resultado === null) return;
    if (sel) sel.value = resultado;
  });
}

// ─────────────────────────────────────────
//   TERRITORIO PICKER
// ─────────────────────────────────────────
function openTerritorioPicker(salidaId, hiddenId, btnId) {
  if (!window.uiTerritorioPicker) return;
  const hidden = document.getElementById(hiddenId);
  const btn    = document.getElementById(btnId);
  uiTerritorioPicker({
    territoriosData,
    allData: allTerritoriosData,
    grupo: selectedGrupo,
    configData,
    label: 'Elegir territorio',
    color: GCOLORS[selectedGrupo] || '#97C459',
  }).then(resultado => {
    if (resultado === null) return;
    if (hidden) hidden.value = resultado;
    if (btn) {
      if (resultado) {
        btn.innerHTML = `<span class="ui-fake-input-icon">🗺</span><span style="color:#eee;">Territorio ${resultado}</span>`;
        btn.classList.remove('empty');
      } else {
        btn.innerHTML = `<span class="ui-fake-input-icon">🗺</span><span>Elegir territorio</span>`;
        btn.classList.add('empty');
      }
    }
  });
}

// ─────────────────────────────────────────
//   PICKER DE MAPA
// ─────────────────────────────────────────
function openMapaPicker(salidaId) {
  const popup  = document.getElementById('mapa-popup');
  const iframe = document.getElementById('mapa-iframe');
  const title  = document.getElementById('mapa-popup-title');
  const grupoLabel = selectedGrupo === 'C' ? 'Congregación' : 'Grupo ' + selectedGrupo;
  title.textContent = `Elegir territorio — ${grupoLabel}`;
  iframe.src = `mapa.html?grupo=${selectedGrupo}&modo=picker&salidaid=${salidaId}&picker=1`;
  popup.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

window.addEventListener('message', function(event) {
  const data = event.data;
  if (!data || !data.type) return;

  if (data.type === 'picker-result') {
    const { salidaId, territorios } = data;
    closeMapaPopup();
    if (!territorios || territorios.length === 0) return;

    const mainHidden = document.getElementById('sal-terr-' + salidaId);
    const mainBtn    = document.getElementById('sal-terr-btn-' + salidaId);
    if (mainHidden && territorios[0]) {
      mainHidden.value = territorios[0];
      if (mainBtn) {
        mainBtn.innerHTML = `<span class="ui-fake-input-icon">🗺</span><span style="color:#eee;">Territorio ${territorios[0]}</span>`;
        mainBtn.classList.remove('empty');
      }
    }

    const extraContainer = document.getElementById('extra-terrs-' + salidaId);
    if (extraContainer && territorios.length > 1) {
      territorios.slice(1).forEach(num => {
        const idx = extraContainer.children.length + 2;
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:6px;';
        const hiddenId = `sal-terr-${salidaId}-x${idx}`;
        const btnId    = `sal-terr-btn-${salidaId}-x${idx}`;
        wrap.innerHTML = `
          <input type="hidden" id="${hiddenId}" value="${num}">
          <button type="button" id="${btnId}" class="ui-fake-input" style="flex:1;font-size:13px;"
            onclick="openTerritorioPicker('${salidaId}', '${hiddenId}', '${btnId}')">
            <span class="ui-fake-input-icon">🗺</span><span style="color:#eee;">Territorio ${num}</span>
          </button>
          <button type="button" onclick="this.parentElement.remove()" style="padding:6px 9px;background:#2e1a1a;color:#F09595;border:0.5px solid #A32D2D;border-radius:8px;cursor:pointer;font-size:16px;line-height:1;flex-shrink:0;">−</button>`;
        extraContainer.appendChild(wrap);
      });
    }
  }

  if (data.type === 'picker-cancel') {
    closeMapaPopup();
  }
});

// ─────────────────────────────────────────
//   VISTA PREVIA
// ─────────────────────────────────────────
function getDiaBadge(fecha) {
  if (!fecha) return '';
  const d = new Date(fecha + 'T00:00:00');
  const nombre = DIAS_SEMANA[d.getDay()];
  const colores = {
    'Lunes':    'background:#1a1a2e;color:#85B7EB;',
    'Martes':   'background:#0c2a45;color:#85B7EB;',
    'Miércoles':'background:#1a2000;color:#C0DD97;',
    'Jueves':   'background:#2e1e00;color:#FAC775;',
    'Viernes':  'background:#1a2e0a;color:#C0DD97;',
    'Sábado':   'background:#2e1a2e;color:#CDB4FF;',
    'Domingo':  'background:#2e1a1a;color:#F09595;',
  };
  return `<div class="dia-badge" style="${colores[nombre] || ''}">${nombre}</div>`;
}

function generatePreview() {
  const grupoLabel = selectedGrupo === 'C' ? 'Congregación' : 'Grupo ' + selectedGrupo;
  const color = GROUP_COLORS[selectedGrupo] || '#eee';
  document.getElementById('preview-grupo-title').textContent = `${grupoLabel} — Salidas de la semana`;
  document.getElementById('preview-grupo-color').innerHTML  = `<span style="color:${color}">${grupoLabel}</span>`;
  document.getElementById('preview-congre-color').innerHTML = `<span style="color:#7F77DD">${CONGRE_NOMBRE}</span>`;
  document.querySelector('.card-preview').style.borderColor = color;
  document.querySelector('.card-preview-header').style.borderBottomColor = color;
  const colorOscuro = { '1':'#0c2a45', '2':'#2e1e00', '3':'#1a2e0a', '4':'#2e1000', 'C':'#1e1a3a' };
  document.querySelectorAll('table.preview th').forEach(th => {
    th.style.background = colorOscuro[selectedGrupo] || '#111';
    th.style.color = color;
  });
  const rows = [];
  if (selectedGrupo === 'C') {
    const horaMan = document.getElementById('tel-fija-manana')?.value || '10:00';
    const horaTar = document.getElementById('tel-fija-tarde')?.value  || '17:00';
    rows.push({ enc:'ID: 844 0225 6636 · Clave: 479104', terr:'TELEFÓNICA', tel:true, badge:'<div class="dia-badge" style="background:#0a2e24;color:#5DCAA5;">Lun a Sáb</div>', fecha:'', cond:'—', hora:horaMan.replace(':','.') });
    rows.push({ enc:'ID: 844 0225 6636 · Clave: 479104', terr:'TELEFÓNICA', tel:true, badge:'<div class="dia-badge" style="background:#0a2e24;color:#5DCAA5;">Lun a Sáb</div>', fecha:'', cond:'—', hora:horaTar.replace(':','.') });
  }
  salidas.forEach(s => {
    const fecha = document.getElementById('sal-fecha-' + s.id)?.value || '';
    const hora  = document.getElementById('sal-hora-'  + s.id)?.value || '';
    const cond  = document.getElementById('sal-cond-'  + s.id)?.value || '—';
    const enc   = document.getElementById('sal-enc-'   + s.id)?.value || '—';
    if (s.tipo === 'tel') {
      rows.push({ enc, terr:'TELEFÓNICA', tel:true, badge:getDiaBadge(fecha), fecha:formatShortFull(fecha).replace(/\//g,'-'), cond, hora:hora.replace(':','.') });
    } else {
      const mainTerr = document.getElementById('sal-terr-' + s.id)?.value || '—';
      const extraContainer = document.getElementById('extra-terrs-' + s.id);
      const extraSelects = extraContainer ? extraContainer.querySelectorAll('input[type="hidden"]') : [];
      const extraTerrs = [...extraSelects].map(inp => inp.value).filter(v => v && v !== '—');
      const allTerrs = [mainTerr, ...extraTerrs].filter(v => v && v !== '—');
      rows.push({ enc, terr: allTerrs.join(', ') || '—', tel:false, badge:getDiaBadge(fecha), fecha:formatShortFull(fecha).replace(/\//g,'-'), cond, hora:hora.replace(':','.') });
    }
  });

  rows.sort((a, b) => {
    if (a.tel && !a.fecha) return -1;
    if (b.tel && !b.fecha) return 1;
    const fechaA = a.fecha || '';
    const fechaB = b.fecha || '';
    if (fechaA !== fechaB) return fechaA.localeCompare(fechaB);
    return (a.hora||'').replace('.', ':').localeCompare((b.hora||'').replace('.', ':'));
  });

  document.getElementById('preview-body').innerHTML = rows.map(r => `
    <tr${r.tel ? ' class="tel-row"' : ''}>
      <td>${r.enc}</td>
      <td>${r.tel ? '<div class="tel-terr">Telefónica</div>' : `<div class="terr-num-big">${r.terr}</div>`}</td>
      <td>${r.badge}<div class="fecha-num">${r.fecha}</div></td>
      <td><div class="cond-txt">${r.cond}</div></td>
      <td><div class="hora-txt">${r.hora}</div></td>
    </tr>`).join('');
  hide('view-config'); show('view-preview'); setStep(3);
}

function goBackToConfig() {
  hide('view-preview'); show('view-config'); setStep(1);
  const btn    = document.getElementById('btn-reg-prog');
  const status = document.getElementById('reg-prog-status');
  if (btn)    { btn.disabled = false; btn.textContent = 'Registrar territorios como en progreso'; }
  if (status) status.textContent = '';
}

function guardarImagen() {
  const el = document.querySelector('.card-preview');
  const originalWidth = el.style.width;
  el.style.width = '900px';
  html2canvas(el, { backgroundColor: '#1e1e1e', scale: 1, width: 900 }).then(canvas => {
    el.style.width = originalWidth;
    const link = document.createElement('a');
    link.download = `salidas-grupo-${selectedGrupo}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
  });
}

// ─────────────────────────────────────────
//   REGISTRAR EN PROGRESO
// ─────────────────────────────────────────
async function registrarEnProgreso() {
  const btn    = document.getElementById('btn-reg-prog');
  const status = document.getElementById('reg-prog-status');
  const territoriosARegistrar = [];
  salidas.forEach(s => {
    if (s.tipo !== 'campo') return;
    const cond  = document.getElementById('sal-cond-'  + s.id)?.value;
    const fecha = document.getElementById('sal-fecha-' + s.id)?.value;
    const mainTerrR = document.getElementById('sal-terr-' + s.id)?.value;
    const extraContR = document.getElementById('extra-terrs-' + s.id);
    const allTerrsR = [mainTerrR, ...(extraContR ? [...extraContR.querySelectorAll('input[type="hidden"]')].map(inp => inp.value) : [])].filter(v => v && v !== '—');
    allTerrsR.forEach(terr => territoriosARegistrar.push({ terr, cond: cond || '—', fecha }));
  });
  if (territoriosARegistrar.length === 0) {
    status.style.color = '#F09595';
    status.textContent = 'No hay territorios de campo asignados.';
    return;
  }
  btn.disabled = true;
  if (window.uiLoading) uiLoading.show(`Registrando ${territoriosARegistrar.length} territorio(s)...`);
  else { status.style.color = '#888'; status.textContent = `Registrando ${territoriosARegistrar.length} territorio(s)...`; }

  try {
    for (const t of territoriosARegistrar) {
      await addDoc(histCol(t.terr), {
        conductor:   t.cond,
        fechaInicio: t.fecha,
        fechaFin:    null,
      });
    }

    // Guardar salida en historial
    const salidasParaHistorial = salidas.map(s => ({
      enc:   document.getElementById('sal-enc-'   + s.id)?.value || '—',
      terr:  s.tipo === 'tel' ? 'TELEFÓNICA' : (document.getElementById('sal-terr-' + s.id)?.value || '—'),
      fecha: document.getElementById('sal-fecha-' + s.id)?.value || '',
      cond:  document.getElementById('sal-cond-'  + s.id)?.value || '—',
      hora:  (document.getElementById('sal-hora-' + s.id)?.value || '').replace(':','.'),
      tipo:  s.tipo,
    }));
    await addDoc(salidaCol(), {
      grupoId:   String(selectedGrupo),
      fechaReg:  fmtDateLocal(new Date()),
      salidas:   salidasParaHistorial,
    });

    territoriosData = {};
    if (window.uiLoading) uiLoading.hide();
    status.style.color = '#5DCAA5';
    status.textContent = `✓ ${territoriosARegistrar.length} territorio(s) registrado(s) como en progreso`;
    btn.disabled = true;
    btn.textContent = 'Ya registrado ✓';
  } catch(err) {
    if (window.uiLoading) uiLoading.hide();
    status.style.color = '#F09595';
    status.textContent = 'Error: ' + err.message;
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────
//   REGISTRAR TERRITORIOS (completar)
// ─────────────────────────────────────────
async function goToRegistrar() {
  hide('view-modo');
  show('view-registrar');
  document.getElementById('reg-grupo-label').textContent = selectedGrupo;
  show('reg-loading'); hide('reg-container'); hide('reg-error'); hide('reg-footer');
  try {
    territoriosData = await fetchGrupo(selectedGrupo);
    hide('reg-loading');
    renderRegistrar();
  } catch(err) {
    hide('reg-loading');
    const errEl = document.getElementById('reg-error');
    errEl.innerHTML = `<div class="error-wrap">Error: ${err.message}. <button class="btn-secondary" style="font-size:12px;padding:4px 10px;margin-left:8px;" onclick="goToRegistrar()">Reintentar</button></div>`;
    show('reg-error');
  }
}

function renderRegistrar() {
  const enProgreso = Object.keys(territoriosData).filter(n => territoriosData[n].enProgreso);
  const c = document.getElementById('reg-container');
  c.innerHTML = '';
  if (enProgreso.length === 0) {
    c.innerHTML = '<div class="reg-empty">No hay territorios en progreso para este grupo.</div>';
    show('reg-container'); show('reg-footer');
    return;
  }
  enProgreso.forEach(n => {
    const t = territoriosData[n];
    const ini = t.lastIni || '';
    const div = document.createElement('div');
    div.className  = 'reg-card';
    div.id         = 'reg-card-' + n;
    div.dataset.estado = 'completado';
    div.dataset.terr   = n;
    div.innerHTML = `
      <div class="reg-header">
        <span class="reg-terr">Territorio ${n}</span>
        <span class="reg-ini">Inicio: ${ini ? formatShortFull(ini) : '—'}</span>
      </div>
      <div class="toggle-wrap">
        <button class="toggle-btn active-comp" id="tog-comp-${n}" onclick="setEstado('${n}','completado')">Completado</button>
        <button class="toggle-btn" id="tog-prog-${n}" onclick="setEstado('${n}','progreso')">Sigue en progreso</button>
      </div>
      <div id="reg-fields-${n}">
        <div class="form-row">
          <div>
            <label>Conductor</label>
            <div style="display:flex;align-items:center;gap:6px;">
              <select id="reg-cond-${n}" style="flex:1;">${getConductorOptions(selectedGrupo)}</select>
              <button type="button" onclick="openConductorPicker('reg-cond-${n}', selectedGrupo, this)"
                style="padding:6px 10px;background:#1a1a2e;color:#7F77DD;border:0.5px solid #4A44A5;border-radius:8px;cursor:pointer;font-size:13px;flex-shrink:0;font-weight:500;">
                👤
              </button>
            </div>
          </div>
          <div><label>Fecha inicio</label><input type="date" id="reg-ini-${n}" value="${ini}"></div>
        </div>
        <div><label>Fecha fin</label><input type="date" id="reg-fin-${n}" value="${ini}" style="width:100%;font-size:13px;padding:6px 8px;border:0.5px solid #555;border-radius:8px;background:#1e1e1e;color:#eee;margin-top:3px;"></div>
      </div>`;
    c.appendChild(div);
  });
  show('reg-container'); show('reg-footer');
  if (window.upgradeInputs) upgradeInputs(c);
}

function setEstado(n, estado) {
  const card    = document.getElementById('reg-card-' + n);
  const fields  = document.getElementById('reg-fields-' + n);
  const btnComp = document.getElementById('tog-comp-' + n);
  const btnProg = document.getElementById('tog-prog-' + n);
  card.dataset.estado = estado;
  if (estado === 'completado') {
    btnComp.className = 'toggle-btn active-comp';
    btnProg.className = 'toggle-btn';
    card.classList.remove('completado');
    fields.style.display = '';
  } else {
    btnComp.className = 'toggle-btn';
    btnProg.className = 'toggle-btn active-prog';
    card.classList.add('completado');
    fields.style.display = 'none';
  }
}

async function guardarRegistros() {
  const btn    = document.getElementById('btn-guardar');
  const status = document.getElementById('save-status');
  btn.disabled = true;

  const cards = document.querySelectorAll('[id^="reg-card-"]');
  const saves = [];
  cards.forEach(card => {
    const n = card.dataset.terr;
    const estado = card.dataset.estado;
    const conductor = document.getElementById('reg-cond-' + n)?.value || '';
    const ini = document.getElementById('reg-ini-' + n)?.value || '';
    const fin = estado === 'completado' ? (document.getElementById('reg-fin-' + n)?.value || '') : null;
    saves.push({ territorio: n, conductor, fechaInicio: ini, fechaFin: fin, estado });
  });

  const sinConductor = saves.some(s => s.estado === 'completado' && !s.conductor);
  if (sinConductor) {
    status.style.color = '#F09595';
    status.textContent = 'Elegí el conductor de cada territorio antes de guardar.';
    btn.disabled = false;
    return;
  }

  if (window.uiLoading) uiLoading.show('Guardando registros...');
  else { status.style.color = '#888'; status.textContent = 'Guardando...'; }

  try {
    for (const s of saves) {
      // Buscar la entrada en progreso más reciente para este territorio
      const histSnap = await getDocs(
        query(histCol(s.territorio), orderBy('fechaInicio', 'desc'), limit(1))
      );
      if (!histSnap.empty) {
        const histDocRef = histSnap.docs[0].ref;
        await updateDoc(histDocRef, {
          conductor:   s.conductor,
          fechaInicio: s.fechaInicio,
          fechaFin:    s.fechaFin,
        });
      } else {
        // No existía — crear nueva entrada
        await addDoc(histCol(s.territorio), {
          conductor:   s.conductor,
          fechaInicio: s.fechaInicio,
          fechaFin:    s.fechaFin,
        });
      }
    }
    territoriosData = {};
    if (window.uiLoading) uiLoading.hide();
    status.style.color = '#5DCAA5';
    status.textContent = 'Guardado correctamente';
    btn.disabled = false;
  } catch(err) {
    if (window.uiLoading) uiLoading.hide();
    status.style.color = '#F09595';
    status.textContent = 'Error al guardar: ' + err.message;
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────
//   INFO GRUPO / MODAL
// ─────────────────────────────────────────
async function goToInfoGrupo() {
  hide('view-modo'); show('view-info');
  const infoTitulo = document.getElementById('info-titulo');
  infoTitulo.textContent = selectedGrupo === 'C' ? 'Congregación' : 'Grupo ' + selectedGrupo;
  infoTitulo.style.color = GCOLORS[selectedGrupo] || '#97C459';
  show('info-loading'); hide('info-content'); hide('info-error');
  try {
    territoriosData = await fetchGrupo(selectedGrupo);
    configData      = await fetchConfig(selectedGrupo);
    hide('info-loading'); show('info-content');
    renderInfoGrid();
  } catch(err) {
    hide('info-loading');
    document.getElementById('info-error').innerHTML = `<div class="error-wrap">Error: ${err.message}.</div>`;
    show('info-error');
  }
}

function daysColor(dias) {
  if (dias === null || dias === undefined) return '#555';
  if (dias <= 30)  return '#4CAF50';
  if (dias <= 45)  return '#8BC34A';
  if (dias <= 60)  return '#FFC107';
  if (dias <= 90)  return '#FF9800';
  if (dias <= 120) return '#FF5722';
  return '#F44336';
}

function renderInfoGrid() {
  const g = document.getElementById('info-grid');
  g.innerHTML = '';
  Object.keys(territoriosData).sort((a,b) => parseInt(a)-parseInt(b)).forEach(n => {
    const t = territoriosData[n];
    const estado = configData[n] || 'normal';
    const lastDate = t.lastFin || t.lastIni;
    const btn = document.createElement('button');
    btn.className = `info-btn estado-${estado}`;
    const estadoLabel = estado === 'normal' ? '' : estado === 'peligroso' ? '⚠ peligroso' : '✕ no predica';
    const dias    = lastDate ? daysSince(lastDate) : null;
    const col     = daysColor(dias);
    const diasTxt = dias !== null ? `${dias}d` : '—';
    btn.innerHTML = `<div class="info-btn-num">${n}</div><div class="info-btn-date">${lastDate ? formatShortFull(lastDate) : 'Sin reg.'}</div><div class="info-btn-days" style="color:${col};">${diasTxt}</div><div class="info-btn-estado">${estadoLabel}</div>`;
    btn.onclick = () => openModal(n);
    g.appendChild(btn);
  });
}

function handleModalBg(e) {
  if (e.target.id === 'estado-modal') closeModal();
}

async function openModal(n) {
  modalTerr = n;
  document.getElementById('modal-terr-title').textContent = 'Territorio ' + n;
  document.getElementById('modal-hist-loading').style.display = '';
  document.getElementById('modal-hist-content').style.display = 'none';
  document.getElementById('modal-edit-form').style.display = 'none';
  document.getElementById('estado-modal').style.display = 'flex';
  editingRow = null;

  try {
    const histSnap = await getDocs(
      query(histCol(n), orderBy('fechaInicio', 'desc'))
    );
    document.getElementById('modal-hist-loading').style.display = 'none';
    const rows = histSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderHistorial(rows);
    document.getElementById('modal-hist-content').style.display = '';
  } catch(err) {
    document.getElementById('modal-hist-loading').textContent = 'Error al cargar historial';
  }
}

function renderHistorial(rows) {
  historialRows = rows;
  const tbody = document.getElementById('modal-hist-body');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:#888;text-align:center;">Sin registros</td></tr>';
  } else {
    tbody.innerHTML = rows.map((r, i) => `
      <tr>
        <td>${r.conductor || '—'}</td>
        <td>${r.fechaInicio ? formatShortFull(r.fechaInicio) : '—'}</td>
        <td>${r.fechaFin ? formatShortFull(r.fechaFin) : '<span class="hist-en-prog">en prog.</span>'}</td>
        <td style="white-space:nowrap;text-align:right;">
          <button class="hist-edit-btn" onclick="startEdit('${r.id}', '${r.conductor||''}', '${r.fechaInicio||''}', '${r.fechaFin||''}')">Editar</button>
          <button class="hist-del-btn" onclick="deleteEntry('${r.id}')">✕</button>
        </td>
      </tr>`).join('');
  }
  const histContent = document.getElementById('modal-hist-content');
  let addBtn = document.getElementById('btn-add-entry');
  if (!addBtn) {
    addBtn = document.createElement('button');
    addBtn.id = 'btn-add-entry';
    addBtn.className = 'btn-add-entry';
    addBtn.textContent = '+ Agregar entrada';
    addBtn.onclick = startAddEntry;
    histContent.appendChild(addBtn);
  }
}

async function deleteEntry(docId) {
  const ok = await uiConfirm({
    title: '¿Eliminar entrada?',
    msg: 'Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  });
  if (!ok) return;
  await deleteDoc(doc(db, 'congregaciones', CONGRE_ID, 'territorios', String(modalTerr), 'historial', docId));
  await openModal(modalTerr);
}

function startAddEntry() {
  editingRow = null;
  document.getElementById('modal-edit-form').style.display = '';
  const conductores = CONDUCTORES_BY_GROUP[selectedGrupo] || [];
  const dl = document.getElementById('conductores-list');
  if (dl) dl.innerHTML = conductores.map(c => `<option value="${c}">`).join('');
  document.getElementById('edit-cond').value = '';
  document.getElementById('edit-ini').value = '';
  document.getElementById('edit-fin').value = '';
  if (window.upgradeInputs) upgradeInputs(document.getElementById('modal-edit-form'));
}

function startEdit(docId, conductor, ini, fin) {
  editingRow = docId;
  document.getElementById('modal-edit-form').style.display = '';
  const conductores = CONDUCTORES_BY_GROUP[selectedGrupo] || [];
  const sel = document.getElementById('edit-cond');
  sel.innerHTML = '<option value="">— Elegir —</option>' +
    conductores.map(c => `<option value="${c}" ${c===conductor?'selected':''}>${c}</option>`).join('');
  if (conductor && !conductores.includes(conductor))
    sel.innerHTML += `<option value="${conductor}" selected>${conductor}</option>`;
  document.getElementById('edit-ini').value = ini;
  document.getElementById('edit-fin').value = fin;
  if (window.upgradeInputs) upgradeInputs(document.getElementById('modal-edit-form'));
}

function cancelEdit() {
  editingRow = null;
  document.getElementById('modal-edit-form').style.display = 'none';
}

async function saveEdit() {
  const conductor = document.getElementById('edit-cond').value.trim();
  const ini = document.getElementById('edit-ini').value;
  const fin = document.getElementById('edit-fin').value || null;
  if (!conductor) {
    await uiAlert('Elegí un conductor antes de guardar.', 'Falta el conductor');
    return;
  }
  const data = { conductor, fechaInicio: ini, fechaFin: fin };
  if (editingRow) {
    await updateDoc(
      doc(db, 'congregaciones', CONGRE_ID, 'territorios', String(modalTerr), 'historial', editingRow),
      data
    );
  } else {
    await addDoc(histCol(modalTerr), data);
  }
  cancelEdit();
  await openModal(modalTerr);
}

function closeModal() {
  document.getElementById('estado-modal').style.display = 'none';
  modalTerr  = null;
  editingRow = null;
}

async function setTerritoryEstado(estado) {
  if (!modalTerr) return;
  closeModal();
  const n = modalTerr;
  if (estado === 'normal') delete configData[n]; else configData[n] = estado;
  renderInfoGrid();
  // Actualizar el campo `tipo` en el documento del territorio en Firestore
  await updateDoc(doc(terrCol(), String(n)), { tipo: estado });
}

// ─────────────────────────────────────────
//   HISTORIAL DE SALIDAS
// ─────────────────────────────────────────
async function goToHistorial() {
  hide('view-modo'); show('view-historial');
  const titulo = document.getElementById('hist-titulo');
  titulo.textContent = (selectedGrupo === 'C' ? 'Congregación' : 'Grupo ' + selectedGrupo) + ' — Historial';
  titulo.style.color = GCOLORS[selectedGrupo] || '#97C459';
  show('hist-loading'); hide('hist-content'); hide('hist-error');
  try {
    const q = query(
      salidaCol(),
      where('grupoId', '==', String(selectedGrupo)),
      orderBy('fechaReg', 'desc')
    );
    const snap = await getDocs(q);
    hide('hist-loading');
    const rows = [];
    snap.forEach(d => {
      const data = d.data();
      (data.salidas || []).forEach(s => {
        rows.push({ ...s, fechaReg: data.fechaReg, salidaDocId: d.id });
      });
    });
    renderHistorialSalidas(rows, snap.docs);
    show('hist-content');
  } catch(err) {
    hide('hist-loading');
    document.getElementById('hist-error').innerHTML = `<div class="error-wrap">Error: ${err.message}</div>`;
    show('hist-error');
  }
}

function renderHistorialSalidas(rows, docs) {
  const c = document.getElementById('hist-content');
  c.innerHTML = '';
  if (rows.length === 0) {
    c.innerHTML = '<div style="text-align:center;color:#888;padding:2rem;font-size:14px;">No hay salidas registradas todavía.</div>';
    return;
  }
  // Agrupar por salidaDocId (cada documento = una semana registrada)
  const grupos = {}, orden = [];
  rows.forEach(r => {
    if (!grupos[r.salidaDocId]) { grupos[r.salidaDocId] = { rows:[], fechaReg: r.fechaReg }; orden.push(r.salidaDocId); }
    grupos[r.salidaDocId].rows.push(r);
  });
  orden.forEach(docId => {
    const g = grupos[docId];
    const group = document.createElement('div');
    group.className = 'hist-registro-group';
    group.innerHTML = `
      <div class="hist-registro-header">
        <span class="hist-registro-fecha">Semana del ${fmtHistDate(g.fechaReg)}</span>
        <button class="hist-registro-del" onclick="deleteHistorialDoc('${docId}', this)">Eliminar semana</button>
      </div>`;
    g.rows.forEach(r => {
      const esTel = String(r.terr).toUpperCase().includes('TEL');
      const dia   = getDiaFromFecha(r.fecha ? fmtHistDate(r.fecha) : '');
      const row   = document.createElement('div');
      row.className = 'hist-row';
      row.innerHTML = `
        <span class="hist-row-terr ${esTel ? 'hist-row-tel' : ''}">${esTel ? 'Tel.' : 'T.' + r.terr}</span>
        <span class="hist-row-dia">${dia} ${r.fecha || ''}</span>
        <span class="hist-row-cond">${r.cond}</span>
        <span class="hist-row-hora">${r.hora}</span>`;
      group.appendChild(row);
    });
    c.appendChild(group);
  });
}

async function deleteHistorialDoc(docId, btn) {
  const ok = await uiConfirm({
    title: '¿Eliminar semana?',
    msg: 'Se eliminará el registro de esta semana. Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  });
  if (!ok) return;
  btn.disabled = true;
  await deleteDoc(doc(db, 'congregaciones', CONGRE_ID, 'salidas', docId));
  await goToHistorial();
}

// ─────────────────────────────────────────
//   MAPA POPUP
// ─────────────────────────────────────────
function openMapaPopup(modo) {
  const popup  = document.getElementById('mapa-popup');
  const iframe = document.getElementById('mapa-iframe');
  const title  = document.getElementById('mapa-popup-title');
  const g      = selectedGrupo;
  const grupoLabel = g === 'C' ? 'Congregación' : 'Grupo ' + g;
  title.textContent = modo === 'registrar'
    ? `Mapa — ${grupoLabel} · En progreso`
    : `Mapa — ${grupoLabel}`;

  let enProgresoParam = '';
  if (modo === 'registrar') {
    const enProg = Object.keys(territoriosData).filter(n => territoriosData[n].enProgreso);
    enProgresoParam = '&enprogreso=' + encodeURIComponent(enProg.join(','));
  }

  iframe.src = `mapa.html?grupo=${g}&modo=${modo}${enProgresoParam}`;
  popup.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeMapaPopup() {
  document.getElementById('mapa-popup').style.display = 'none';
  document.getElementById('mapa-iframe').src = '';
  document.body.style.overflow = '';
}

window.selectGrupo = selectGrupo;
window.goToModo = goToModo;
window.goToStep1 = goToStep1;
window.goToRegistrar = goToRegistrar;
window.goToInfoGrupo = goToInfoGrupo;
window.goToHistorial = goToHistorial;
window.goToMapa = goToMapa;
window.cerrarSesion = cerrarSesion;
window.guardarRegistros = guardarRegistros;
window.setTerritoryEstado = setTerritoryEstado;
window.closeModal = closeModal;
window.handleModalBg = handleModalBg;
window.pinPress = pinPress;
window.pinDelete = pinDelete;
window.pinCancel = pinCancel;
window.openPin = openPin;
window.generatePreview = generatePreview;
window.guardarImagen = guardarImagen;
window.registrarEnProgreso = registrarEnProgreso;
window.goBackToConfig = goBackToConfig;
window.addSalida = addSalida;
window.cambiarSemana = cambiarSemana;
window.closeMapaPopup = closeMapaPopup;
window.openTerritorioPicker = openTerritorioPicker;
window.openConductorPicker = openConductorPicker;
window.startEdit = startEdit;
window.startAddEntry = startAddEntry;
window.cancelEdit = cancelEdit;
window.saveEdit = saveEdit;
window.deleteEntry = deleteEntry; 
window.deleteHistorialDoc = deleteHistorialDoc;
window.openMapaPicker = openMapaPicker;