import { db } from '../firebase.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

window.addEventListener('pageshow', e => { if (e.persisted) window.location.reload(); });
if (!sessionStorage.getItem('congreId')) window.location.href = '../index.html';

const CONGRE_ID     = sessionStorage.getItem('congreId')     || '';
const CONGRE_NOMBRE = sessionStorage.getItem('congreNombre') || CONGRE_ID;

document.querySelectorAll('.js-congre').forEach(el => el.textContent = CONGRE_NOMBRE);

// ─────────────────────────────────────────
//   ROLES
// ─────────────────────────────────────────
const ROLES_ASIGN = [
  { id: 'LECTOR',                label: 'Lector' },
  { id: 'SONIDO',                label: 'Sonido' },
  { id: 'PLATAFORMA',            label: 'Plataforma' },
  { id: 'MICROFONISTAS',         label: 'Micrófonos' },
  { id: 'ACOMODADOR_AUDITORIO',  label: 'Acod. Auditorio' },
  { id: 'ACOMODADOR_ENTRADA',    label: 'Acod. Entrada' },
  { id: 'PRESIDENTE',            label: 'Pres. Reunión' },
  { id: 'REVISTAS',              label: 'Revistas' },
  { id: 'PUBLICACIONES',         label: 'Publicaciones' },
  { id: 'CONDUCTOR_GRUPO_1',     label: 'Conductor Grupo 1' },
  { id: 'CONDUCTOR_GRUPO_2',     label: 'Conductor Grupo 2' },
  { id: 'CONDUCTOR_GRUPO_3',     label: 'Conductor Grupo 3' },
  { id: 'CONDUCTOR_GRUPO_4',     label: 'Conductor Grupo 4' },
  { id: 'CONDUCTOR_CONGREGACION',label: 'Conductor Cong.' },
];

const ROLES_VM = [
  { id: 'VM_PRESIDENTE',               label: 'Presidente' },
  { id: 'VM_ORACION',                  label: 'Oración' },
  { id: 'VM_TESOROS',                  label: 'Discurso Tesoros' },
  { id: 'VM_JOYAS',                    label: 'Perlas escondidas' },
  { id: 'VM_LECTURA',                  label: 'Lectura Bíblica' },
  { id: 'VM_MINISTERIO_CONVERSACION',  label: 'Min. Conversación' },
  { id: 'VM_MINISTERIO_REVISITA',      label: 'Min. Revisita' },
  { id: 'VM_MINISTERIO_ESCENIFICACION',label: 'Min. Escenificación' },
  { id: 'VM_MINISTERIO_DISCURSO',      label: 'Min. Discurso' },
  { id: 'VM_VIDA_CRISTIANA',           label: 'Vida Cristiana' },
  { id: 'VM_ESTUDIO_CONDUCTOR',        label: 'Conductor Estudio' },
];

const TODOS_LOS_ROLES = [...ROLES_ASIGN, ...ROLES_VM];

function rolLabel(id) {
  return TODOS_LOS_ROLES.find(r => r.id === id)?.label || id;
}

// ─────────────────────────────────────────
//   ESTADO
// ─────────────────────────────────────────
let publicadores  = [];
let pinEncargado  = null;
let pinBuffer     = '';
let editandoId    = null;

// ─────────────────────────────────────────
//   UTILIDADES
// ─────────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  document.getElementById('btn-home').classList.toggle('visible', id !== 'view-cover');
}

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pubCol() {
  return collection(db, 'congregaciones', CONGRE_ID, 'publicadores');
}

// ─────────────────────────────────────────
//   INIT — cargar config
// ─────────────────────────────────────────
(async function init() {
  try {
    const snap = await getDoc(doc(db, 'congregaciones', CONGRE_ID));
    if (snap.exists()) pinEncargado = String(snap.data().pinEncargado || '1234');
  } catch(e) {
    console.error('Error cargando config:', e);
  }
})();

// ─────────────────────────────────────────
//   PIN
// ─────────────────────────────────────────
function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('pd' + i);
    if (!dot) continue;
    const filled = i < pinBuffer.length;
    dot.style.borderColor = filled ? '#D85A30' : '#555';
    dot.style.background  = filled ? '#D85A30' : 'transparent';
    dot.classList.toggle('filled', filled);
  }
  document.getElementById('pin-error').textContent = '';
}

window.pinPress = function(d) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += d;
  updatePinDots();
  if (pinBuffer.length === 4) setTimeout(checkPin, 150);
};

window.pinDelete = function() {
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();
};

window.goToPin = function() {
  pinBuffer = '';
  updatePinDots();
  document.getElementById('pin-modal-hermanos').style.display = 'flex';
};

window.pinCancel = function() {
  pinBuffer = '';
  updatePinDots();
  document.getElementById('pin-modal-hermanos').style.display = 'none';
};

function checkPin() {
  if (pinEncargado === null) {
    document.getElementById('pin-error').textContent = 'Cargando configuración…';
    pinBuffer = ''; updatePinDots(); return;
  }
  if (pinBuffer === pinEncargado) {
    pinBuffer = ''; updatePinDots();
    document.getElementById('pin-modal-hermanos').style.display = 'none';
    cargarYMostrar();
  } else {
    document.getElementById('pin-error').textContent = 'PIN incorrecto';
    pinBuffer = ''; updatePinDots();
  }
}

window.goToCover = function() {
  pinCancel();
  showView('view-cover');
};

// ─────────────────────────────────────────
//   CARGAR PUBLICADORES
// ─────────────────────────────────────────
async function cargarYMostrar() {
  showView('view-main');
  document.getElementById('hermanos-list').innerHTML =
    '<div class="loading-wrap"><div class="spinner"></div><div class="loading-txt">Cargando…</div></div>';
  try {
    const snap = await getDocs(pubCol());
    publicadores = snap.docs.map(d => ({ id: d.id, ...d.data(), roles: d.data().roles || [] }));
    publicadores.sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)));
    renderLista(publicadores);
  } catch(e) {
    document.getElementById('hermanos-list').innerHTML =
      `<div class="error-wrap">Error al cargar: ${e.message}</div>`;
  }
}

// ─────────────────────────────────────────
//   RENDER LISTA
// ─────────────────────────────────────────
function renderLista(lista) {
  const el = document.getElementById('hermanos-list');
  if (!lista.length) {
    el.innerHTML = '<div class="empty-state">No hay hermanos cargados.</div>';
    return;
  }
  el.innerHTML = lista.map(h => {
    const asignRoles = (h.roles || []).filter(r => !r.startsWith('VM_'));
    const vmRoles    = (h.roles || []).filter(r => r.startsWith('VM_'));
    const chips = [
      ...asignRoles.map(r => `<span class="chip chip-asign">${esc(rolLabel(r))}</span>`),
      ...vmRoles.map(r    => `<span class="chip chip-vm">${esc(rolLabel(r))}</span>`),
    ].join('');
    return `<div class="hermano-row" onclick="abrirEditar('${h.id}')">
      <div class="hermano-info">
        <div class="hermano-nombre">${esc(h.nombre)}</div>
        <div class="hermano-chips">${chips || '<span class="sin-roles">Sin roles</span>'}</div>
      </div>
      <div class="hermano-actions">
        <button class="btn-del" onclick="event.stopPropagation();confirmarEliminar('${h.id}','${(h.nombre || '').replace(/'/g, "\\'")}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

window.filtrarLista = function() {
  const q   = norm(document.getElementById('h-search')?.value || '');
  const rol = document.getElementById('h-rol')?.value || '';
  renderLista(publicadores.filter(h =>
    (!q   || norm(h.nombre).includes(q)) &&
    (!rol || (h.roles || []).includes(rol))
  ));
};

// ─────────────────────────────────────────
//   MODAL — ADD / EDIT
// ─────────────────────────────────────────
window.abrirNuevo = function() {
  editandoId = null;
  document.getElementById('modal-titulo').textContent = 'Nuevo hermano';
  document.getElementById('modal-nombre').value = '';
  document.getElementById('modal-status').textContent = '';
  TODOS_LOS_ROLES.forEach(r => {
    const cb = document.getElementById('hcb-' + r.id);
    if (cb) cb.checked = false;
  });
  document.getElementById('modal-hermano').style.display = 'flex';
  document.getElementById('modal-nombre').focus();
};

window.abrirEditar = function(id) {
  const h = publicadores.find(p => p.id === id);
  if (!h) return;
  editandoId = id;
  document.getElementById('modal-titulo').textContent = esc(h.nombre);
  document.getElementById('modal-nombre').value = h.nombre;
  document.getElementById('modal-status').textContent = '';
  TODOS_LOS_ROLES.forEach(r => {
    const cb = document.getElementById('hcb-' + r.id);
    if (cb) cb.checked = (h.roles || []).includes(r.id);
  });
  document.getElementById('modal-hermano').style.display = 'flex';
};

window.cerrarModal = function() {
  document.getElementById('modal-hermano').style.display = 'none';
  editandoId = null;
};

window.guardarHermano = async function() {
  const nombre = document.getElementById('modal-nombre').value.trim();
  if (!nombre) { uiToast('Ingresá un nombre', 'error'); return; }

  const roles = TODOS_LOS_ROLES
    .filter(r => document.getElementById('hcb-' + r.id)?.checked)
    .map(r => r.id);

  const status = document.getElementById('modal-status');
  status.style.color = '#888'; status.textContent = 'Guardando…';

  try {
    if (editandoId) {
      await updateDoc(doc(pubCol(), editandoId), { nombre, roles });
      const idx = publicadores.findIndex(p => p.id === editandoId);
      if (idx >= 0) publicadores[idx] = { ...publicadores[idx], nombre, roles };
    } else {
      const ref = await addDoc(pubCol(), { nombre, roles, activo: true });
      publicadores.push({ id: ref.id, nombre, roles, activo: true });
    }
    publicadores.sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)));
    cerrarModal();
    // reset filtros
    const searchEl = document.getElementById('h-search');
    const rolEl    = document.getElementById('h-rol');
    if (searchEl) searchEl.value = '';
    if (rolEl)    rolEl.value    = '';
    renderLista(publicadores);
    uiToast(editandoId ? 'Guardado' : 'Hermano agregado', 'success');
  } catch(e) {
    status.style.color = '#F09595'; status.textContent = 'Error: ' + e.message;
  }
};

window.confirmarEliminar = async function(id, nombre) {
  const ok = await uiConfirm({
    title: 'Eliminar hermano',
    msg: `¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar', cancelText: 'Cancelar', type: 'danger',
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(pubCol(), id));
    publicadores = publicadores.filter(p => p.id !== id);
    renderLista(publicadores);
    uiToast('Eliminado', 'success');
  } catch(e) {
    uiToast('Error: ' + e.message, 'error');
  }
};
