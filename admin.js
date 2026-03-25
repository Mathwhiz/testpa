import { db } from './firebase.js';
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, writeBatch, Timestamp
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
  ['view-pin', 'view-dashboard', 'view-wizard', 'view-territorios'].forEach(v => {
    document.getElementById(v).style.display = v === id ? '' : 'none';
  });
}

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

let userEditedId = false;
function onNombreInput() {
  if (!userEditedId) {
    document.getElementById('w-id').value = slugify(document.getElementById('w-nombre').value);
  }
}
function onIdInput() {
  userEditedId = true;
  const el = document.getElementById('w-id');
  el.value = el.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
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
              <button class="btn-card-action" onclick="openTerritorios('${d.id}','${nombreSafe}')" title="Territorios">📍</button>
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
const PALETA_COLORES = ['#378ADD','#97C459','#7F77DD','#EF9F27','#1D9E75','#D85A30'];

function renderColorSwatches(selectedColor) {
  const wrap = document.getElementById('w-color-swatches');
  if (!wrap) return;
  const colorInput = document.getElementById('w-color');
  wrap.innerHTML = PALETA_COLORES.map(c => `
    <div onclick="selectCongreColor('${c}')" style="
      width:28px;height:28px;border-radius:8px;background:${c};cursor:pointer;
      box-shadow:${c === selectedColor ? '0 0 0 2px #fff, 0 0 0 4px '+c : '0 2px 6px rgba(0,0,0,0.3)'};
      transition:.15s;flex-shrink:0;">
    </div>`).join('');
  if (colorInput) colorInput.value = selectedColor || '#378ADD';
}

function selectCongreColor(hex) {
  document.getElementById('w-color').value = hex;
  renderColorSwatches(hex);
}

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
  wizardStep     = 0;
  kmlTerritories = null;
  userEditedId   = false;
  if (!prefill) editingCongreId = null;
  wizardGrupos   = prefill?.grupos?.map(g => ({ ...g })) ?? GRUPOS_DEFAULT.map(g => ({ ...g }));

  const isEdit = !!editingCongreId;
  document.getElementById('w-nombre').value  = prefill?.nombre       || '';
  document.getElementById('w-id').value      = isEdit ? editingCongreId : '';
  document.getElementById('w-pin').value     = prefill?.pinEncargado || '';
  const initColor = prefill?.color || PALETA_COLORES[Math.floor(Math.random() * PALETA_COLORES.length)];
  renderColorSwatches(initColor);
  document.getElementById('kml-input').value = '';
  document.getElementById('kml-preview').style.display  = 'none';
  document.getElementById('btn-crear').disabled          = !isEdit;
  document.getElementById('btn-crear').textContent       = isEdit ? 'Guardar →' : 'Crear →';
  document.getElementById('wizard-status').textContent   = '';
  document.getElementById('field-id').style.display      = '';
  document.getElementById('field-id-hint').textContent   = isEdit
    ? 'Cambiar el ID moverá todos los datos a la nueva dirección.'
    : 'Solo minúsculas, números y guiones. No se puede cambiar después.';
  document.getElementById('step0-title').textContent     = isEdit ? 'Editar congregación' : 'Nueva congregación';
  document.getElementById('step0-sub').textContent       = isEdit ? 'Editando datos básicos' : 'Paso 1 de 3 · Datos básicos';

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
    startWizard({ nombre: data.nombre, pinEncargado: data.pinEncargado, color: data.color || null, grupos });
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
    const id     = document.getElementById('w-id').value.trim();
    const pin    = document.getElementById('w-pin').value.trim();
    if (!nombre)                             { uiAlert('Ingresá el nombre de la congregación.'); return; }
    if (!id)                                 { uiAlert('Ingresá un ID para la congregación.'); return; }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id))  {
      uiAlert('El ID solo puede tener minúsculas, números y guiones, y debe empezar con una letra o número.');
      return;
    }
    if (!/^\d{4}$/.test(pin))               { uiAlert('El PIN del encargado debe ser 4 dígitos numéricos.'); return; }
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
    const name     = pm.getElementsByTagName('name')[0]?.textContent?.trim() || '';
    // Soporta "1", "1a", "92b", "Territorio 1", "Territorio 1a", etc.
    const numMatch = name.match(/(\d+)[a-zA-Z]*$/);
    if (!numMatch) continue;
    const baseNum = numMatch[1];

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
//   RENAME CONGREGACIÓN (copia + elimina)
// ─────────────────────────────────────────
async function renameCongre(oldId, newId) {
  const existing = await getDoc(doc(db, 'congregaciones', newId));
  if (existing.exists()) throw new Error(`Ya existe una congregación con el ID "${newId}".`);

  const oldSnap = await getDoc(doc(db, 'congregaciones', oldId));
  await setDoc(doc(db, 'congregaciones', newId), oldSnap.data());

  const subcols = ['grupos', 'territorios', 'historial', 'salidas', 'publicadores', 'asignaciones'];
  for (const sub of subcols) {
    const snap = await getDocs(collection(db, 'congregaciones', oldId, sub));
    if (snap.empty) continue;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      docs.slice(i, i + 400).forEach(d => batch.set(doc(db, 'congregaciones', newId, sub, d.id), d.data()));
      await batch.commit();
    }
  }

  for (const sub of subcols) {
    const snap = await getDocs(collection(db, 'congregaciones', oldId, sub));
    if (snap.empty) continue;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await deleteDoc(doc(db, 'congregaciones', oldId));
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
      const newId = document.getElementById('w-id').value.trim();
      if (newId !== editingCongreId) {
        uiLoading.show('Renombrando congregación...');
        const oldId = editingCongreId;
        await renameCongre(oldId, newId);
        if (sessionStorage.getItem('congreId') === oldId) sessionStorage.setItem('congreId', newId);
        editingCongreId = newId;
      }
      congreId = editingCongreId;
      const color = document.getElementById('w-color')?.value || null;
      await updateDoc(doc(db, 'congregaciones', congreId), { nombre, pinEncargado, ...(color && { color }) });

      // Reemplazar grupos: borrar existentes y crear los nuevos
      const existSnap = await getDocs(collection(db, 'congregaciones', congreId, 'grupos'));
      const delBatch = writeBatch(db);
      existSnap.forEach(d => delBatch.delete(d.ref));
      await delBatch.commit();
    } else {
      // ── MODO CREACIÓN ──
      congreId = document.getElementById('w-id').value.trim();
      const existing = await getDoc(doc(db, 'congregaciones', congreId));
      if (existing.exists()) {
        uiLoading.hide();
        await uiAlert(`Ya existe una congregación con el ID "${congreId}".`);
        return;
      }
      const color = document.getElementById('w-color')?.value || PALETA_COLORES[0];
      await setDoc(doc(db, 'congregaciones', congreId), {
        nombre,
        pinEncargado,
        color,
        creadoEn: Timestamp.now(),
      });
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

// ─────────────────────────────────────────
//   TERRITORIOS
// ─────────────────────────────────────────
let terrCongreId = null;
let terrData     = [];
let terrGrupos   = [];
let terrChanges  = {};
let terrFiltro   = null; // null=todos, '__none__'=sin grupo, o grupoId

async function openTerritorios(id, nombre) {
  terrCongreId = id;
  terrChanges  = {};
  terrFiltro   = null;
  document.getElementById('terr-title').textContent = nombre;
  showView('view-territorios');

  const loading = document.getElementById('terr-loading');
  document.getElementById('terr-list').innerHTML = '';
  document.getElementById('terr-save-bar').style.display = 'none';
  loading.style.display = 'flex';

  try {
    const [terrSnap, gruposSnap] = await Promise.all([
      getDocs(collection(db, 'congregaciones', id, 'territorios')),
      getDocs(collection(db, 'congregaciones', id, 'grupos')),
    ]);
    terrData = [];
    terrSnap.forEach(d => terrData.push({ ...d.data(), _docId: d.id }));
    terrData.sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));

    terrGrupos = [];
    gruposSnap.forEach(d => terrGrupos.push(d.data()));
    terrGrupos.sort((a, b) => String(a.id) < String(b.id) ? -1 : 1);

    loading.style.display = 'none';
    renderTerrFiltros();
    renderTerrList();
  } catch(e) {
    loading.innerHTML = `<span class="status-err">Error: ${e.message}</span>`;
  }
}

function renderTerrFiltros() {
  const filtros = [
    { id: null,       label: 'Todos',     color: '#555' },
    { id: '__none__', label: 'Sin grupo', color: '#444' },
    ...terrGrupos,
  ];
  document.getElementById('terr-filtros').innerHTML = filtros.map(f => {
    const active = terrFiltro === f.id;
    return `<button class="terr-filtro-btn ${active ? 'active' : ''}"
      style="border-color:${f.color};${active ? `background:${f.color};` : `color:${f.color};`}"
      onclick="setTerrFiltro(${f.id === null ? 'null' : `'${f.id}'`})">${f.label}</button>`;
  }).join('');
}

function setTerrFiltro(f) {
  terrFiltro = f;
  renderTerrFiltros();
  renderTerrList();
}

function renderTerrList() {
  let lista = terrData;
  if (terrFiltro === '__none__') {
    lista = terrData.filter(t => !(terrChanges[t._docId] ?? t.grupoId));
  } else if (terrFiltro !== null) {
    lista = terrData.filter(t => (terrChanges[t._docId] ?? t.grupoId) === terrFiltro);
  }

  const noBtn = `<button class="terr-g-btn" data-grupo="" style="border-color:#555;"
    onclick="assignGrupo('{ID}','')">—</button>`;

  document.getElementById('terr-list').innerHTML = lista.length === 0
    ? '<p style="color:#666;font-size:14px;text-align:center;padding:20px 0;">Sin territorios en este filtro.</p>'
    : lista.map(t => {
        const cur     = terrChanges[t._docId] ?? t.grupoId ?? '';
        const changed = t._docId in terrChanges;
        const btns = [
          ...terrGrupos.map(g => {
            const sel = cur === g.id;
            return `<button class="terr-g-btn${sel ? ' sel' : ''}" data-grupo="${g.id}"
              style="border-color:${g.color};${sel ? `background:${g.color};` : ''}"
              onclick="assignGrupo('${t._docId}','${g.id}')">${g.label.replace(/^Grupo\s*/i,'').substring(0,5)}</button>`;
          }),
          `<button class="terr-g-btn${!cur ? ' sel' : ''}" data-grupo=""
            style="border-color:#555;${!cur ? 'background:#555;' : ''}"
            onclick="assignGrupo('${t._docId}','')">—</button>`,
        ].join('');
        return `<div class="terr-row${changed ? ' changed' : ''}" id="terr-row-${t._docId}">
          <span class="terr-num">${t.id}</span>
          <div class="terr-g-btns">${btns}</div>
        </div>`;
      }).join('');
}

function assignGrupo(docId, grupoId) {
  const terr = terrData.find(t => t._docId === docId);
  if (!terr) return;

  const original = terr.grupoId ?? '';
  if (grupoId === original) delete terrChanges[docId];
  else terrChanges[docId] = grupoId;

  const cur     = terrChanges[docId] ?? original;
  const changed = docId in terrChanges;
  const row = document.getElementById(`terr-row-${docId}`);
  if (row) {
    row.classList.toggle('changed', changed);
    row.querySelectorAll('.terr-g-btn').forEach(btn => {
      const bg = btn.dataset.grupo;
      const g  = terrGrupos.find(x => x.id === bg);
      const sel = bg === cur || (!bg && !cur);
      btn.classList.toggle('sel', sel);
      btn.style.background = sel ? (g ? g.color : '#555') : '';
    });
  }
  updateTerrSaveBar();
}

function updateTerrSaveBar() {
  const n = Object.keys(terrChanges).length;
  document.getElementById('terr-changes-count').textContent = n;
  document.getElementById('terr-save-bar').style.display = n > 0 ? '' : 'none';
}

async function saveTerritorios() {
  const entries = Object.entries(terrChanges);
  if (!entries.length) return;
  uiLoading.show(`Guardando ${entries.length} territorios...`);
  try {
    for (let i = 0; i < entries.length; i += 400) {
      const batch = writeBatch(db);
      entries.slice(i, i + 400).forEach(([docId, grupoId]) => {
        batch.update(doc(db, 'congregaciones', terrCongreId, 'territorios', docId), {
          grupoId: grupoId || null,
        });
      });
      await batch.commit();
    }
    entries.forEach(([docId, grupoId]) => {
      const t = terrData.find(x => x._docId === docId);
      if (t) t.grupoId = grupoId || null;
    });
    terrChanges = {};
    uiLoading.hide();
    updateTerrSaveBar();
    renderTerrList();
    uiToast(`${entries.length} territorios guardados`, 'success');
  } catch(e) {
    uiLoading.hide();
    await uiAlert('Error al guardar: ' + e.message);
  }
}

// ── Exponer al HTML ──
window.pinPress          = pinPress;
window.pinDelete         = pinDelete;
window.showView          = showView;
window.onNombreInput     = onNombreInput;
window.onIdInput         = onIdInput;
window.startWizard       = startWizard;
window.editCongre        = editCongre;
window.deleteCongre      = deleteCongre;
window.selectCongreColor = selectCongreColor;
window.renderColorSwatches = renderColorSwatches;
window.wizardNext        = wizardNext;
window.wizardPrev        = wizardPrev;
window.addGrupo          = addGrupo;
window.removeGrupo       = removeGrupo;
window.onKmlFile         = onKmlFile;
window.crearCongregacion = crearCongregacion;
window.openTerritorios   = openTerritorios;
window.setTerrFiltro     = setTerrFiltro;
window.assignGrupo       = assignGrupo;
window.saveTerritorios   = saveTerritorios;
