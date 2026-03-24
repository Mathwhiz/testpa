import { db } from './firebase.js';
import {
  collection, doc, getDoc, getDocs, addDoc, writeBatch, Timestamp
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
        list.innerHTML += `
          <div class="congre-item">
            <div>
              <div class="congre-nombre">${nombre || '(sin nombre)'}</div>
              <div class="congre-meta">${d.id} · ${fecha}</div>
            </div>
            <span class="badge">activa</span>
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

let wizardStep     = 0;
let kmlTerritories = null;

function startWizard() {
  wizardStep     = 0;
  kmlTerritories = null;

  document.getElementById('w-nombre').value = '';
  document.getElementById('w-pin').value    = '';
  document.getElementById('kml-input').value = '';
  document.getElementById('kml-preview').style.display = 'none';
  document.getElementById('btn-crear').disabled = true;
  document.getElementById('wizard-status').textContent = '';

  // Render grupos
  document.getElementById('grupos-config').innerHTML = GRUPOS_DEFAULT.map(g => `
    <div class="grupo-row">
      <div class="grupo-label" style="color:${g.color}">${g.label}</div>
      <input type="color" id="gc-color-${g.id}" value="${g.color}">
      <input type="text"  id="gc-pin-${g.id}"   value="${g.pin}" placeholder="PIN" maxlength="4" inputmode="numeric">
    </div>
  `).join('');

  showWizardStep(0);
  showView('view-wizard');
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
    for (const g of GRUPOS_DEFAULT) {
      const pin = document.getElementById(`gc-pin-${g.id}`).value.trim();
      if (!/^\d{4}$/.test(pin)) { uiAlert(`El PIN del ${g.label} debe ser 4 dígitos.`); return; }
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
    const ptEl = pm.querySelector('Point coordinates');
    if (ptEl) {
      const [lng, lat] = ptEl.textContent.trim().split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) territories[baseNum].punto = { lat, lng };
    }

    // Polígono (coordenadas en formato KML: lng,lat,alt separados por espacios)
    const polyEl = pm.querySelector('Polygon outerBoundaryIs LinearRing coordinates');
    if (polyEl) {
      const coords = polyEl.textContent.trim().split(/\s+/)
        .map(c => { const [lng, lat] = c.split(',').map(Number); return { lat, lng }; })
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

  const grupos = GRUPOS_DEFAULT.map(g => ({
    id:    g.id,
    label: g.label,
    color: document.getElementById(`gc-color-${g.id}`).value,
    pin:   document.getElementById(`gc-pin-${g.id}`).value.trim(),
  }));

  uiLoading.show('Creando congregación...');
  try {
    // 1. Crear doc de congregación
    const congreRef = await addDoc(collection(db, 'congregaciones'), {
      nombre,
      pinEncargado,
      creadoEn: Timestamp.now(),
    });
    const congreId = congreRef.id;

    // 2. Crear grupos en batch
    const gruposBatch = writeBatch(db);
    grupos.forEach(g => {
      gruposBatch.set(doc(db, 'congregaciones', congreId, 'grupos', g.id), g);
    });
    await gruposBatch.commit();

    // 3. Subir territorios del KML en batches de 400
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
    await uiAlert(
      `Congregación "${nombre}" creada correctamente.\n\nID: ${congreId}`,
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
window.wizardNext        = wizardNext;
window.wizardPrev        = wizardPrev;
window.onKmlFile         = onKmlFile;
window.crearCongregacion = crearCongregacion;
