import { db } from './firebase.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, writeBatch, Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// ── Super-admin PIN ──
let ADMIN_PIN = null;

(async function loadAdminPin() {
  try {
    const snap = await getDoc(doc(db, 'config', 'superadmin'));
    if (snap.exists() && snap.data().pin) {
      ADMIN_PIN = snap.data().pin;
    } else {
      document.getElementById('pin-error').textContent =
        'Falta crear config/superadmin → { pin } en Firestore';
    }
  } catch(e) {
    document.getElementById('pin-error').textContent = 'Error al conectar con Firestore';
  }
})();

// ─────────────────────────────────────────
//   PIN
// ─────────────────────────────────────────
let pinBuffer = '';

function pinPress(d) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += d;
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
    document.getElementById('ad' + i).classList.toggle('filled', i < pinBuffer.length);
  }
}

function checkPin() {
  if (ADMIN_PIN === null) {
    document.getElementById('pin-error').textContent = 'PIN no cargado, revisá la configuración en Firestore';
    pinBuffer = '';
    updatePinDots();
    return;
  }
  if (pinBuffer === ADMIN_PIN) {
    showView('view-dashboard');
    loadDashboard();
  } else {
    document.getElementById('pin-error').textContent = 'PIN incorrecto';
    pinBuffer = '';
    updatePinDots();
  }
}

// ─────────────────────────────────────────
//   NAVEGACIÓN
// ─────────────────────────────────────────
function showView(id) {
  ['view-pin', 'view-dashboard', 'view-wizard'].forEach(v => {
    document.getElementById(v).style.display = v === id ? '' : 'none';
  });
}

// ─────────────────────────────────────────
//   DASHBOARD
// ─────────────────────────────────────────
async function loadDashboard() {
  const loading = document.getElementById('dash-loading');
  const list    = document.getElementById('dash-list');
  loading.style.display = 'flex';
  list.style.display    = 'none';
  try {
    const snap = await getDocs(collection(db, 'congregaciones'));
    list.innerHTML = '';
    if (snap.empty) {
      list.innerHTML = '<p style="color:#666;font-size:14px;text-align:center;padding:24px 0;">No hay congregaciones todavía.</p>';
    } else {
      snap.forEach(d => {
        const { nombre, creadoEn } = d.data();
        const fecha = creadoEn
          ? new Date(creadoEn.seconds * 1000).toLocaleDateString('es-AR')
          : '—';
        const nombreSafe = (nombre || '(sin nombre)').replace(/'/g, "\\'");
        list.innerHTML += `
          <div class="congre-item">
            <div style="flex:1;min-width:0;">
              <div class="congre-nombre">${nombre || '(sin nombre)'}</div>
              <div class="congre-meta">${d.id} · ${fecha}</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;">
              <button class="btn-card-action" onclick="editCongre('${d.id}')" title="Editar">✏️</button>
              <button class="btn-card-action btn-card-delete" onclick="deleteCongre('${d.id}','${nombreSafe}')" title="Eliminar">🗑️</button>
            </div>
          </div>`;
      });
    }
    loading.style.display = 'none';
    list.style.display    = '';
  } catch(err) {
    loading.innerHTML = `<span style="color:#F09595;font-size:14px;">Error: ${err.message}</span>`;
  }
}

// ─────────────────────────────────────────
//   WIZARD
// ─────────────────────────────────────────
const GRUPOS_DEFAULT = [
  { id: '1', label: 'Grupo 1',      color: '#378ADD', pin: '1111' },
  { id: '2', label: 'Grupo 2',      color: '#EF9F27', pin: '2222' },
  { id: '3', label: 'Grupo 3',      color: '#97C459', pin: '3333' },
  { id: '4', label: 'Grupo 4',      color: '#D85A30', pin: '4444' },
  { id: 'C', label: 'Congregación', color: '#7F77DD', pin: '5555' },
];

let wizardStep      = 0;
let kmlTerritories  = null;
let wizardGrupos    = [];
let editingCongreId = null;

function renderGruposConfig() {
  const gc = document.getElementById('grupos-config');
  gc.innerHTML = wizardGrupos.map((g, i) => `
    <div class="grupo-row" data-idx="${i}">
      <input type="color" class="gc-color" value="${g.color}">
      <input type="text" class="gc-label" value="${g.label}" placeholder="Nombre del grupo">
      <input type="text" class="gc-pin" value="${g.pin}" placeholder="PIN" maxlength="4" inputmode="numeric">
      ${wizardGrupos.length > 1
        ? `<button class="btn-remove-grupo" onclick="removeGrupo(${i})" title="Eliminar">×</button>`
        : '<div style="width:28px"></div>'}
    </div>
  `).join('') + `<button class="btn-add-grupo" onclick="addGrupo()">+ Agregar grupo</button>`;
}

function syncGruposFromDOM() {
  document.querySelectorAll('#grupos-config .grupo-row').forEach((row, i) => {
    if (!wizardGrupos[i]) return;
    wizardGrupos[i].color = row.querySelector('.gc-color').value;
    wizardGrupos[i].label = row.querySelector('.gc-label').value.trim();
    wizardGrupos[i].pin   = row.querySelector('.gc-pin').value.trim();
  });
}

function addGrupo() {
  syncGruposFromDOM();
  const maxNum = Math.max(0, ...wizardGrupos.map(g => isNaN(g.id) ? 0 : parseInt(g.id)));
  wizardGrupos.push({ id: String(maxNum + 1), label: `Grupo ${maxNum + 1}`, color: '#888888', pin: '' });
  renderGruposConfig();
}

function removeGrupo(idx) {
  syncGruposFromDOM();
  wizardGrupos.splice(idx, 1);
  renderGruposConfig();
}

function startWizard(prefill = null) {
  wizardStep      = 0;
  kmlTerritories  = null;
  if (!prefill) editingCongreId = null;
  wizardGrupos   = prefill?.grupos?.map(g => ({ ...g })) ?? GRUPOS_DEFAULT.map(g => ({ ...g }));

  document.getElementById('w-nombre').value  = prefill?.nombre       || '';
  document.getElementById('w-pin').value     = prefill?.pinEncargado || '';
  document.getElementById('kml-input').value = '';
  document.getElementById('kml-preview').style.display = 'none';
  // En modo edición el KML es opcional → habilitamos el botón de guardar por defecto
  document.getElementById('btn-crear').disabled = !editingCongreId;
  document.getElementById('btn-crear').textContent = editingCongreId ? 'Guardar →' : 'Crear →';
  document.getElementById('wizard-status').textContent = '';

  renderGruposConfig();
  showWizardStep(0);
  showView('view-wizard');
}

async function editCongre(id) {
  editingCongreId = id;
  uiLoading.show('Cargando datos...');
  try {
    const [congreSnap, gruposSnap] = await Promise.all([
      getDoc(doc(db, 'congregaciones', id)),
      getDocs(collection(db, 'congregaciones', id, 'grupos')),
    ]);
    uiLoading.hide();
    const data   = congreSnap.data();
    const grupos = [];
    gruposSnap.forEach(d => grupos.push(d.data()));
    grupos.sort((a, b) => String(a.id) < String(b.id) ? -1 : 1);
    startWizard({ nombre: data.nombre, pinEncargado: data.pinEncargado, grupos });
  } catch(e) {
    uiLoading.hide();
    await uiAlert('Error al cargar los datos: ' + e.message);
  }
}

async function deleteCongre(id, nombre) {
  const ok = await uiConfirm({
    title: 'Eliminar congregación',
    msg: `¿Seguro que querés eliminar "${nombre}"? Se borrarán también sus grupos, territorios, publicadores y asignaciones. Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger',
  });
  if (!ok) return;

  uiLoading.show('Eliminando...');
  try {
    const subcols = ['grupos', 'territorios', 'salidas', 'publicadores', 'asignaciones'];
    for (const sub of subcols) {
      const snap = await getDocs(collection(db, 'congregaciones', id, sub));
      if (snap.empty) continue;
      const batch = writeBatch(db);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(doc(db, 'congregaciones', id));
    uiLoading.hide();
    uiToast('Congregación eliminada', 'success');
    loadDashboard();
  } catch(e) {
    uiLoading.hide();
    await uiAlert('Error al eliminar: ' + e.message);
  }
}

function showWizardStep(step) {
  [0, 1, 2].forEach(i => {
    document.getElementById(`step-${i}`).style.display  = i === step ? '' : 'none';
    document.getElementById(`sdot-${i}`).classList.toggle('active', i <= step);
  });
  wizardStep = step;
}

function wizardNext() {
  if (wizardStep === 0) {
    const nombre = document.getElementById('w-nombre').value.trim();
    const pin    = document.getElementById('w-pin').value.trim();
    if (!nombre)             { uiAlert('Ingresá el nombre de la congregación.'); return; }
    if (!/^\d{4}$/.test(pin)) { uiAlert('El PIN del encargado debe ser 4 dígitos numéricos.'); return; }
  }
  if (wizardStep === 1) {
    syncGruposFromDOM();
    for (const g of wizardGrupos) {
      if (!g.label) { uiAlert('Todos los grupos deben tener un nombre.'); return; }
      if (!/^\d{4}$/.test(g.pin)) { uiAlert(`El PIN del "${g.label}" debe ser 4 dígitos.`); return; }
    }
  }
  showWizardStep(wizardStep + 1);
}

function wizardPrev() {
  showWizardStep(wizardStep - 1);
}

// ─────────────────────────────────────────
//   KML
// ─────────────────────────────────────────
function onKmlFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      kmlTerritories = parseKML(e.target.result);
      const preview = document.getElementById('kml-preview');
      preview.style.display = '';
      preview.textContent = `✓ ${kmlTerritories.length} territorios encontrados en el KML`;
      document.getElementById('btn-crear').disabled = false;
    } catch(err) {
      uiAlert('Error al procesar el KML: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// Drag & drop
const kmlDrop = document.getElementById('kml-drop');
kmlDrop.addEventListener('dragover',  e => { e.preventDefault(); kmlDrop.classList.add('drag'); });
kmlDrop.addEventListener('dragleave', ()  => kmlDrop.classList.remove('drag'));
kmlDrop.addEventListener('drop', e => {
  e.preventDefault();
  kmlDrop.classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) onKmlFile({ files: [file] });
});

function parseKML(text) {
  const xml        = new DOMParser().parseFromString(text, 'text/xml');
  const placemarks = xml.getElementsByTagName('Placemark');
  const territories = {};

  for (const pm of placemarks) {
    const name    = pm.getElementsByTagName('name')[0]?.textContent?.trim() || '';
    const baseNum = name.replace(/[a-zA-Z]+$/, '');
    if (!baseNum || isNaN(parseInt(baseNum))) continue;

    if (!territories[baseNum]) {
      territories[baseNum] = {
        id:       parseInt(baseNum),
        nombre:   `Territorio ${baseNum}`,
        tipo:     'normal',
        grupoId:  null,
        punto:    null,
        poligonos: [],
      };
    }

    // Punto central
    const pointEls = pm.getElementsByTagName('Point');
    if (pointEls.length > 0) {
      const coordEl = pointEls[0].getElementsByTagName('coordinates')[0];
      if (coordEl) {
        const [lng, lat] = coordEl.textContent.trim().split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) territories[baseNum].punto = { lat, lng };
      }
    }

    // Polígono — usa getElementsByTagName para mayor compatibilidad con KMLs de Google My Maps
    const polygonEls = pm.getElementsByTagName('Polygon');
    for (const poly of polygonEls) {
      const outerEls = poly.getElementsByTagName('outerBoundaryIs');
      if (!outerEls.length) continue;
      const ringEls = outerEls[0].getElementsByTagName('LinearRing');
      if (!ringEls.length) continue;
      const coordEl = ringEls[0].getElementsByTagName('coordinates')[0];
      if (!coordEl) continue;
      const coords = coordEl.textContent.trim().split(/\s+/)
        .map(c => { const p = c.split(',').map(Number); return { lat: p[1], lng: p[0] }; })
        .filter(c => !isNaN(c.lat) && !isNaN(c.lng));
      if (coords.length > 0) territories[baseNum].poligonos.push({ coords });
    }
  }

  return Object.values(territories).filter(t => t.poligonos.length > 0);
}

// ─────────────────────────────────────────
//   CREAR CONGREGACIÓN
// ─────────────────────────────────────────
async function crearCongregacion(skipKml) {
  if (!skipKml && !kmlTerritories) {
    await uiAlert('Subí un archivo KML primero, o usá "Omitir KML".');
    return;
  }

  const nombre       = document.getElementById('w-nombre').value.trim();
  const pinEncargado = document.getElementById('w-pin').value.trim();
  const status       = document.getElementById('wizard-status');
  status.textContent = '';

  const grupos = wizardGrupos;

  uiLoading.show(editingCongreId ? 'Guardando cambios...' : 'Creando congregación...');
  try {
    let congreId;

    if (editingCongreId) {
      // ── MODO EDICIÓN ──
      congreId = editingCongreId;
      await updateDoc(doc(db, 'congregaciones', congreId), { nombre, pinEncargado });

      // Reemplazar grupos: borrar existentes y crear los nuevos
      const existSnap = await getDocs(collection(db, 'congregaciones', congreId, 'grupos'));
      const delBatch = writeBatch(db);
      existSnap.forEach(d => delBatch.delete(d.ref));
      await delBatch.commit();
    } else {
      // ── MODO CREACIÓN ──
      const congreRef = await addDoc(collection(db, 'congregaciones'), {
        nombre,
        pinEncargado,
        creadoEn: Timestamp.now(),
      });
      congreId = congreRef.id;
    }

    // Grupos en batch
    const gruposBatch = writeBatch(db);
    grupos.forEach(g => {
      gruposBatch.set(doc(db, 'congregaciones', congreId, 'grupos', g.id), g);
    });
    await gruposBatch.commit();

    // Territorios del KML en batches de 400
    if (!skipKml && kmlTerritories?.length > 0) {
      const total = kmlTerritories.length;
      const terrCol = collection(db, 'congregaciones', congreId, 'territorios');
      for (let i = 0; i < total; i += 400) {
        uiLoading.show(`Subiendo territorios... (${Math.min(i + 400, total)}/${total})`);
        const batch = writeBatch(db);
        kmlTerritories.slice(i, i + 400).forEach(t => {
          batch.set(doc(terrCol, String(t.id)), t);
        });
        await batch.commit();
      }
    }

    uiLoading.hide();
    const wasEditing = !!editingCongreId;
    editingCongreId = null;
    await uiAlert(
      wasEditing
        ? `Cambios guardados en "${nombre}".`
        : `Congregación "${nombre}" creada.\n\nID: ${congreId}`,
      '¡Listo!'
    );
    showView('view-dashboard');
    loadDashboard();

  } catch(err) {
    uiLoading.hide();
    status.className   = 'status-err';
    status.textContent = 'Error: ' + err.message;
  }
}

// ── Exponer al HTML ──
window.pinPress          = pinPress;
window.pinDelete         = pinDelete;
window.showView          = showView;
window.startWizard       = startWizard;
window.editCongre        = editCongre;
window.deleteCongre      = deleteCongre;
window.wizardNext        = wizardNext;
window.wizardPrev        = wizardPrev;
window.addGrupo          = addGrupo;
window.removeGrupo       = removeGrupo;
window.onKmlFile         = onKmlFile;
window.crearCongregacion = crearCongregacion;
