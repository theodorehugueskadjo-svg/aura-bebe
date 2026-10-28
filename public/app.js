'use strict';
/* ==========================================================================
   AURA BÉBÉ v3.1
   - Chiffrement AES-256-GCM (PBKDF2 200k) · verrouillage progressif
   - Photos en Blob dans IndexedDB · PWA offline · toasts + modal
   - Kit d'urgence · Contractions · Allaitement · Post-partum · Consultation · Veilleuse
   ========================================================================== */

/* ==================== 1. i18n & utilitaires ==================== */
let lang = 'fr';
const T = p => Array.isArray(p) ? p[lang === 'en' ? 1 : 0] : p;
const L = (f, e) => lang === 'en' ? e : f;
const LOC = () => lang === 'en' ? 'en-GB' : 'fr-FR';
const nD  = n => n + ' ' + L(n > 1 ? 'jours' : 'jour', n > 1 ? 'days' : 'day');
const nW  = n => n + ' ' + L(n > 1 ? 'semaines' : 'semaine', n > 1 ? 'weeks' : 'week');
const nMo = n => n + ' ' + L('mois', n > 1 ? 'months' : 'month');
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const f1 = n => n.toLocaleString(LOC(), { maximumFractionDigits: 1 });
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => iso(new Date());
const P = s => { const a = s.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); };
const diff = (a, b) => Math.round((P(b) - P(a)) / 864e5);
const add = (s, n) => { const d = P(s); d.setDate(d.getDate() + n); return iso(d); };
const addM = (s, n) => { const d = P(s); d.setMonth(d.getMonth() + n); return iso(d); };
const fmt = (s, o) => P(s).toLocaleDateString(LOC(), o || { day: 'numeric', month: 'long', year: 'numeric' });
const fmtS = s => fmt(s, { day: 'numeric', month: 'short' });
const fmtY = s => fmt(s, { day: 'numeric', month: 'short', year: 'numeric' });
const nowT = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const val = id => { const e = document.getElementById(id); return e ? String(e.value).trim().slice(0, 500) : ''; };
const radio = n => { const e = document.querySelector('input[name="' + n + '"]:checked'); return e ? e.value : ''; };
const gcal = (t, d) => 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(t) + '&dates=' + d.replace(/-/g, '') + '/' + add(d, 1).replace(/-/g, '');
const hm = m => Math.floor(m / 60) + ' h ' + pad(m % 60);

/* ==================== 2. Icônes ==================== */
const ICONS = {
  home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  pulse:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  clip:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 14l2 2 4-4"/>',
  book:'<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5M9 8h6"/>',
  chart:'<path d="M3 20h18M5 16l4-5 4 3 6-8"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  bottle:'<path d="M9 3h6M10 3v3M14 3v3M8 8a2 2 0 012-2h4a2 2 0 012 2v11a2 2 0 01-2 2h-4a2 2 0 01-2-2zM8 12h8"/>',
  sprout:'<path d="M12 21v-9M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 14c0-3 2.5-5 6-5 0 3-2.5 5-6 5z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  check:'<path d="M5 12l5 5 9-10"/>',
  music:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  spark:'<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/>',
  lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',
  moon:'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sos:'<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M12 17v4M9 19h6"/>'
};
const ic = n => '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>';

/* ==================== 3. Crypto ==================== */
const PBKDF2_ITER = 200000;
const AUTH_KEY = 'aura-auth-v3';
const DATA_KEY = 'aura-data-v3';
const FAIL_KEY = 'aura-fails-v3';
const THEME_KEY = 'aura-theme';
const LOCK_STEPS = [0, 0, 0, 30, 300, 900, 3600, 86400];
let cryptoKey = null, AUTH = null, unlocked = false, S = null;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64e = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function deriveKey(password, salt) {
  const m = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: PBKDF2_ITER, hash: 'SHA-256' },
    m, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function aesEncrypt(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { iv: b64e(iv), ct: b64e(ct) };
}
async function aesDecrypt(key, blob) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64d(blob.iv) }, key, b64d(blob.ct));
  return JSON.parse(dec.decode(pt));
}
const randomSalt = () => b64e(crypto.getRandomValues(new Uint8Array(16)));

function failState() { try { return JSON.parse(localStorage.getItem(FAIL_KEY)) || { n: 0, until: 0 }; } catch { return { n: 0, until: 0 }; } }
function failRecord() {
  const s = failState(); s.n += 1;
  const idx = Math.min(s.n, LOCK_STEPS.length - 1);
  const delay = LOCK_STEPS[idx] * 1000;
  s.until = Date.now() + delay;
  localStorage.setItem(FAIL_KEY, JSON.stringify(s));
  return { n: s.n, seconds: Math.ceil(delay / 1000) };
}
function failReset() { localStorage.setItem(FAIL_KEY, JSON.stringify({ n: 0, until: 0 })); }
function failRemaining() { const s = failState(); return Math.max(0, Math.ceil((s.until - Date.now()) / 1000)); }

async function createAuth(login, password, recovery, q) {
  if (!login || login.length < 3) return 'Identifiant trop court (min. 3 caractères).';
  if (!password || password.length < 8) return 'Mot de passe trop court (min. 8 caractères).';
  const salt = randomSalt();
  const key = await deriveKey(password, salt);
  const verify = await aesEncrypt(key, { ok: true, login });
  const rec = recovery ? await aesEncrypt(key, { r: recovery, q }) : null;
  AUTH = { login: login.slice(0, 80), salt, verifyIv: verify.iv, verifyCt: verify.ct, rec, q, created: today(), iter: PBKDF2_ITER };
  localStorage.setItem(AUTH_KEY, JSON.stringify(AUTH));
  cryptoKey = key; unlocked = true;
  await migrateLegacyIfNeeded();
  return null;
}
async function verifyAuth(password) {
  if (!AUTH) return false;
  try { const key = await deriveKey(password, AUTH.salt); await aesDecrypt(key, { iv: AUTH.verifyIv, ct: AUTH.verifyCt }); cryptoKey = key; return true; } catch { return false; }
}
async function saveSecure() {
  if (!cryptoKey || !S) return false;
  try {
    const payload = JSON.stringify(S);
    if (payload.length * 2 > 4.5 * 1024 * 1024) { toast('Espace presque plein. Sauvegardez puis supprimez des photos.', 'warn', 6000); return false; }
    const blob = await aesEncrypt(cryptoKey, S);
    localStorage.setItem(DATA_KEY, JSON.stringify(blob));
    return true;
  } catch (e) { console.error('save failed', e); toast('Échec de la sauvegarde locale.', 'bad'); return false; }
}
async function loadSecure() {
  if (!cryptoKey) return null;
  const raw = localStorage.getItem(DATA_KEY);
  if (!raw) return null;
  try { return normalizeData(await aesDecrypt(cryptoKey, JSON.parse(raw))); }
  catch { toast('Données illisibles.', 'bad'); return null; }
}
async function migrateLegacyIfNeeded() {
  const legacy = localStorage.getItem('aura-bebe-v2') || localStorage.getItem('aura-bebe-v1');
  if (!legacy) return;
  try {
    const parsed = JSON.parse(legacy);
    if (parsed && typeof parsed === 'object') {
      S = normalizeData(parsed);
      delete S.userEmail; delete S.isSynced;
      localStorage.removeItem('aura-bebe-v2'); localStorage.removeItem('aura-bebe-v1');
    }
  } catch {}
}
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { saveSecure(); }, 150); }

/* ==================== 4. IndexedDB photos ==================== */
const IDB_NAME = 'aura-bebe-idb';
const IDB_STORE = 'photos';
let idbP = null;
function idb() {
  if (idbP) return idbP;
  idbP = new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: 'id' }); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return idbP;
}
async function idbPut(rec) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction(IDB_STORE, 'readwrite'); tx.objectStore(IDB_STORE).put(rec); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
async function idbGet(id) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction(IDB_STORE, 'readonly'); const q = tx.objectStore(IDB_STORE).get(id); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function idbDel(id) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction(IDB_STORE, 'readwrite'); tx.objectStore(IDB_STORE).delete(id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
async function compressToBlob(file, maxW = 1024, quality = 0.72) {
  if (!file || !file.type.startsWith('image/')) throw new Error('not image');
  if (file.size > 12 * 1024 * 1024) throw new Error('too large');
  const bmp = await createImageBitmap(file);
  const ratio = Math.min(1, maxW / bmp.width);
  const w = Math.round(bmp.width * ratio), h = Math.round(bmp.height * ratio);
  const c = new OffscreenCanvas(w, h);
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  return c.convertToBlob({ type: 'image/jpeg', quality });
}

/* ==================== 5. UI toasts + modal ==================== */
function toast(msg, kind = '', ms = 3200) {
  let host = document.querySelector('.toast-host');
  if (!host) { host = document.createElement('div'); host.className = 'toast-host'; host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 220); }, ms);
}
function modal({ title, body, ok = 'Confirmer', cancel = 'Annuler', danger = false }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = `<div class="modal-bg" data-m="0"></div>
      <div class="modal-box" role="dialog" aria-modal="true">
        <h3>${esc(title)}</h3><div style="margin-top:12px">${body || ''}</div>
        <div class="modal-actions">
          ${cancel ? `<button class="btn ghost" data-m="0">${esc(cancel)}</button>` : ''}
          <button class="btn ${danger ? 'danger' : ''}" data-m="1">${esc(ok)}</button>
        </div></div>`;
    document.body.appendChild(wrap);
    const done = v => { wrap.remove(); resolve(v); };
    wrap.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) done(b.dataset.m === '1'); });
    const onKey = e => { if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); done(false); } if (e.key === 'Enter') { document.removeEventListener('keydown', onKey); done(true); } };
    document.addEventListener('keydown', onKey);
  });
}

/* ==================== 6. Modèle ==================== */
const defaults = () => ({
  mode: 'preg', onboarded: false, version: '3.1',
  fs: 20, fontFamily: '', lang: '', lead: 7,
  colorTheme: '', colorPreg: '', colorBaby: '', theme: '', plan: 'free',
  lastBackup: '', bloodType: '', allergies: [], conditions: [], emergencyContacts: [],
  preg: { name: '', lmp: '', weights: [], bps: [], appts: {}, custom: [], bag: {}, journal: [], edema: [], stress: [], umb: [], contractions: [] },
  baby: { name: '', birth: '', sex: '', measures: [], health: [], vacc: {}, customVacc: [], foods: {}, feeds: [], miles: {}, memories: [], photos: [], appts: {}, custom: [], sleeps: [], musicNotes: [], feedPlan: [], postpartum: {} }
});
function normalizeData(obj) {
  if (!obj || typeof obj !== 'object') return defaults();
  const d = defaults();
  const out = Object.assign(d, obj, { preg: Object.assign(d.preg, obj.preg || {}), baby: Object.assign(d.baby, obj.baby || {}) });
  if (!out.preg.contractions) out.preg.contractions = [];
  if (!out.emergencyContacts) out.emergencyContacts = [];
  if (!out.allergies) out.allergies = [];
  if (!out.conditions) out.conditions = [];
  if (typeof out.bloodType !== 'string') out.bloodType = '';
  if (!out.baby.postpartum) out.baby.postpartum = {};
  return out;
}

/* ==================== 7. Contenu statique ==================== */
const FRUITS = [
 [0,'✨',['une promesse','a promise'],['encore microscopique','still microscopic']],
 [4,'🌱',['une graine de sésame','a sesame seed'],'≈ 1 mm'],[6,'🟤',['une lentille','a lentil'],'≈ 6 mm'],
 [8,'🍓',['une framboise','a raspberry'],'≈ 1,6 cm · 1 g'],[9,'🫒',['une olive','an olive'],'≈ 2,3 cm · 2 g'],[10,'🍊',['une mandarine','a tangerine'],'≈ 3 cm · 4 g'],
 [11,'🍋',['un citron vert','a lime'],'≈ 4 cm · 7 g'],[12,'🍑',['une pêche','a peach'],'≈ 5,5 cm · 14 g'],[14,'🍋',['un citron','a lemon'],'≈ 9 cm · 45 g'],
 [16,'🥑',['un avocat','an avocado'],'≈ 12 cm · 100 g'],[18,'🍠',['une patate douce','a sweet potato'],'≈ 14 cm · 190 g'],[20,'🍌',['une banane','a banana'],'≈ 16 cm · 300 g'],
 [22,'🥭',['une mangue','a mango'],'≈ 28 cm · 430 g'],[24,'🌽',['un épi de maïs','an ear of corn'],'≈ 30 cm · 600 g'],[26,'🥕',['une grosse carotte','a big carrot'],'≈ 35 cm · 760 g'],
 [28,'🍆',['une aubergine','an eggplant'],'≈ 37 cm · 1 kg'],[30,'🥬',['un chou','a cabbage'],'≈ 40 cm · 1,3 kg'],[32,'🥥',['une noix de coco','a coconut'],'≈ 42 cm · 1,7 kg'],
 [34,'🍈',['un melon','a melon'],'≈ 45 cm · 2,1 kg'],[36,'🍍',['un ananas','a pineapple'],'≈ 47 cm · 2,6 kg'],[38,'🎃',['une citrouille','a pumpkin'],'≈ 50 cm · 3,1 kg'],
 [40,'🍉',['une pastèque','a watermelon'],'≈ 51 cm · 3,4 kg']
];
const fruit = sa => { let r = FRUITS[0]; FRUITS.forEach(f => { if (sa >= f[0]) r = f; }); let s = T(r[3]); if (lang === 'en') s = s.replace(/,/g, '.'); return { e: r[1], n: T(r[2]), s }; };
const MSTART = [0, 5, 9, 14, 18, 23, 27, 32, 36];
const monthOf = sa => { let m = 1; MSTART.forEach((s, i) => { if (sa >= s) m = i + 1; }); return m; };
const PM = [
 {sa:['0 à 4 SA','Weeks 0 to 4'],b:['L’œuf fécondé descend vers l’utérus et s’y installe.','The fertilized egg travels to the uterus and settles in.'],m:['Souvent aucun signe.','Often no signs.'],f:['Test de grossesse, voir un médecin, arrêter alcool et tabac.','Pregnancy test, see a doctor, stop alcohol and tobacco.']},
 {sa:['5 à 8 SA','Weeks 5 to 8'],b:['Le cœur se met à battre. Environ 1,5 cm.','The heart starts beating. About 1.5 cm.'],m:['Nausées, fatigue, envies fréquentes.','Nausea, fatigue, frequent urination.'],f:['Déclarer la grossesse, bilan sanguin.','Register the pregnancy, blood tests.']},
 {sa:['9 à 13 SA','Weeks 9 to 13'],b:['Les organes sont formés : on parle de fœtus.','The organs are formed: it is a fetus.'],m:['Les nausées s’atténuent souvent.','Nausea often eases.'],f:['Échographie du 1er trimestre.','First-trimester ultrasound.']},
 {sa:['14 à 17 SA','Weeks 14 to 17'],b:['La peau est fine, un duvet apparaît.','Skin is thin, fine hair appears.'],m:['Retour de l’énergie.','Energy returns.'],f:['Consultation mensuelle.','Monthly visit.']},
 {sa:['18 à 22 SA','Weeks 18 to 22'],b:['Vous sentez les premiers mouvements.','You feel the first movements.'],m:['Ventre bien visible, maux de dos.','Visible belly, back pain.'],f:['Échographie morphologique.','Anatomy ultrasound.']},
 {sa:['23 à 26 SA','Weeks 23 to 26'],b:['Les poumons mûrissent.','The lungs mature.'],m:['Reflux, jambes lourdes.','Reflux, heavy legs.'],f:['Dépistage du diabète gestationnel.','Gestational diabetes screening.']},
 {sa:['27 à 31 SA','Weeks 27 to 31'],b:['Il ouvre les yeux, prend de la graisse.','It opens its eyes, gains fat.'],m:['Fatigue, sommeil difficile.','Fatigue, difficulty sleeping.'],f:['Début du 3e trimestre.','Third trimester begins.']},
 {sa:['32 à 35 SA','Weeks 32 to 35'],b:['Il prend du poids vite.','It gains weight quickly.'],m:['Besoin fréquent d’uriner.','Frequent urination.'],f:['Échographie du 3e trimestre.','Third-trimester ultrasound.']},
 {sa:['36 à 41 SA','Weeks 36 to 41'],b:['Il est prêt à naître.','It is ready to be born.'],m:['Contractions plus nettes.','Stronger contractions.'],f:['Repérer les signes de travail.','Know the signs of labor.']}
];
const PREG_ALERT=[['Saignements','Bleeding'],['Perte de liquide','Leaking fluid'],['Fièvre','Fever'],['Forte douleur au ventre','Severe abdominal pain'],['Maux de tête intenses, vision trouble ou gonflement brutal','Severe headache, blurred vision or sudden swelling'],['Mouvements du bébé nettement diminués','Clearly reduced baby movements']];
const APPTS = [
 {id:'c1',t:['CPN 1','ANC 1'],sa:8,n:['Bilan initial.','Initial tests.']},
 {id:'e1',t:['Échographie du 1er trimestre','First-trimester ultrasound'],sa:12,n:['Datation, vitalité.','Dating, viability.']},
 {id:'c2',t:['CPN 2','ANC 2'],sa:16,n:['Poids, tension.','Weight, BP.']},
 {id:'e2',t:['Échographie morphologique','Anatomy ultrasound'],sa:22,n:['Étude de l’anatomie.','Anatomy study.']},
 {id:'c3',t:['CPN 3','ANC 3'],sa:24,n:['Suivi courant.','Routine follow-up.']},
 {id:'dg',t:['Dépistage du diabète','Diabetes screening'],sa:27,n:['24–28 SA.','24–28 wks.']},
 {id:'c4',t:['CPN 4','ANC 4'],sa:30,n:['Début du 3e trimestre.','Third trimester.']},
 {id:'e3',t:['Échographie du 3e trimestre','Third-trimester ultrasound'],sa:32,n:['Croissance, position.','Growth, position.']},
 {id:'c5',t:['CPN 5','ANC 5'],sa:34,n:['Mode d’accouchement, valise.','Birth plan, bag.']},
 {id:'vac',t:['Vaccination antitétanique / coqueluche','Tetanus / pertussis vaccination'],sa:28,n:['Selon calendrier.','According to schedule.']},
 {id:'med',t:['Rappel médicaments prénataux','Prenatal medicines reminder'],sa:14,n:['Vérifiez avec votre médecin.','Check with your doctor.']},
 {id:'c6',t:['CPN 6','ANC 6'],sa:36,n:['Position du bébé.','Baby’s position.']},
 {id:'c7',t:['CPN 7','ANC 7'],sa:38,n:['Surveillance rapprochée.','Closer monitoring.']},
 {id:'c8',t:['CPN 8','ANC 8'],sa:40,n:['Terme.','Due date.']}
];
const CHECKUPS=[1,2,3,4,6,9,12,15,18,24];
const BAG=[
 [['Pour vous','For you'],[['Carnet de grossesse et résultats','Pregnancy record and test results'],['Chemises de nuit','Nightgowns'],['Sous-vêtements jetables','Disposable underwear'],['Serviettes hygiéniques maternité','Maternity pads'],['Trousse de toilette','Toiletries'],['Soutien-gorge d’allaitement','Nursing bra'],['Tenue de sortie','Going-home outfit'],['Chargeur de téléphone','Phone charger'],['Eau et collations','Water and snacks']]],
 [['Pour bébé','For baby'],[['Bodies et grenouillères','Bodysuits and sleepsuits'],['Bonnet et chaussettes','Hat and socks'],['Couches','Diapers'],['Coton, lingettes','Cotton and wipes'],['Couverture','Blanket'],['Tenue de sortie','Going-home outfit'],['Transport sûr','Safe transport']]],
 [['Papiers','Documents'],[['Pièces d’identité','Parents’ ID'],['Assurance santé','Health insurance'],['Dossier d’inscription','Registration file']]]
];
const MOODS=[['😊',['Bien','Well']],['😴',['Fatiguée','Tired']],['🤢',['Nauséeuse','Nauseous']],['😟',['Inquiète','Worried']],['🥰',['Émue','Moved']]];
const TIPS_P=[['Buvez régulièrement : l’eau aide la circulation.','Drink regularly: water helps circulation.'],['Dormez sur le côté gauche.','Sleep on your left side.'],['Lavez fruits et légumes, cuisez bien les viandes.','Wash fruit and vegetables, cook meat well.'],['Marchez 20 à 30 minutes par jour.','Walk 20 to 30 minutes a day.'],['Ni alcool ni tabac.','No alcohol, no tobacco.'],['Parlez à votre bébé.','Talk to your baby.'],['Dormez sous moustiquaire imprégnée.','Sleep under a treated bed net.'],['Petits repas fréquents en cas de nausées.','Small frequent meals if nauseous.'],['Aucun médicament sans avis médical.','No medicine without medical advice.'],['Notez vos questions avant chaque consultation.','Write your questions down before each visit.']];
const TIPS_B=[['Couchez bébé sur le dos, matelas ferme.','Lay baby on the back, firm mattress.'],['Le portage ne gâte pas.','Carrying does not spoil.'],['Parlez, chantez.','Talk, sing.'],['Quelques minutes sur le ventre, éveillé.','A few minutes of awake tummy time.'],['Lavez-vous les mains avant les repas.','Wash your hands before meals.'],['Moustiquaire imprégnée.','Treated bed net.'],['Rangez médicaments et petits objets.','Keep medicines and small objects out of reach.'],['Lire une histoire chaque soir.','Read a story each evening.'],['Ne secouez jamais un bébé.','Never shake a baby.'],['Chaque bébé avance à son rythme.','Every baby moves at their own pace.']];
const VACC=[
 {t:['À la naissance','At birth'],d:0,v:[['BCG','BCG'],['Polio oral (dose 0)','Oral polio (dose 0)'],['Hépatite B (dose de naissance)','Hepatitis B (birth dose)']]},
 {t:['6 semaines','6 weeks'],d:42,v:[['Pentavalent 1','Pentavalent 1'],['Polio 1','Polio 1'],['Pneumocoque 1','Pneumococcal 1'],['Rotavirus 1','Rotavirus 1']]},
 {t:['10 semaines','10 weeks'],d:70,v:[['Pentavalent 2','Pentavalent 2'],['Polio 2','Polio 2'],['Pneumocoque 2','Pneumococcal 2'],['Rotavirus 2','Rotavirus 2']]},
 {t:['14 semaines','14 weeks'],d:98,v:[['Pentavalent 3','Pentavalent 3'],['Polio 3','Polio 3'],['Pneumocoque 3','Pneumococcal 3'],['VPI','IPV']]},
 {t:['9 mois','9 months'],d:274,v:[['Rougeole-rubéole 1','Measles-rubella 1'],['Fièvre jaune','Yellow fever'],['Méningite A','Meningitis A']]},
 {t:['15 à 18 mois','15 to 18 months'],d:457,v:[['Rougeole-rubéole 2','Measles-rubella 2']]}
];
const CATS={M:['Motricité','Motor'],L:['Langage','Language'],S:['Relations','Social'],C:['Éveil','Thinking']};
const DEV=[
 [1,[['M',['Lève brièvement la tête','Briefly lifts head']],['C',['Fixe un visage','Gazes at a face']],['L',['Sursaute aux bruits','Startles at sounds']],['S',['Se calme dans les bras','Calms when held']]]],
 [2,[['S',['Premier sourire','First smile']],['L',['Gazouille','Coos']],['M',['Tient sa tête quelques secondes','Holds head briefly']],['C',['Suit un objet des yeux','Follows an object']]]],
 [3,[['M',['Soulève la tête sur le ventre','Lifts head on tummy']],['L',['Rit aux éclats','Laughs out loud']],['M',['Ouvre les mains','Opens hands']],['S',['Reconnaît la voix','Recognizes voice']]]],
 [4,[['M',['Se retourne ventre→dos','Rolls tummy to back']],['C',['Attrape un objet','Reaches for an object']],['L',['Tourne la tête vers une voix','Turns head to a voice']],['M',['Tient sa tête assis','Holds head when sitting']]]],
 [5,[['M',['Se retourne dans les deux sens','Rolls both ways']],['C',['Porte les objets à la bouche','Mouths objects']],['L',['Babille','Babbles']],['S',['Reconnaît les visages','Recognizes faces']]]],
 [6,[['M',['Tient assis avec appui','Sits with support']],['L',['Répète des syllabes','Repeats syllables']],['C',['Passe un objet d’une main à l’autre','Passes object hand to hand']],['S',['Réagit à son prénom','Responds to own name']]]],
 [7,[['M',['Tient assis sans appui','Sits without support']],['C',['Cherche l’objet qui tombe','Looks for a dropped object']],['L',['Varie les sons','Varies sounds']],['S',['Se méfie des inconnus','Wary of strangers']]]],
 [8,[['M',['Rampe, pivote','Crawls, pivots']],['C',['Pince pouce-index','Pincer grasp']],['L',['Comprend « non »','Understands “no”']],['S',['Joue à coucou','Plays peek-a-boo']]]],
 [9,[['M',['Se met à quatre pattes','Hands and knees']],['M',['Se met debout','Pulls to stand']],['L',['Dit « papa » ou « mama »','Says “dada” or “mama”']],['C',['Cherche un objet caché','Looks for hidden object']]]],
 [10,[['M',['Marche en se tenant','Walks holding on']],['L',['Fait au revoir','Waves bye-bye']],['S',['Imite les gestes','Imitates gestures']],['C',['Pince fine','Fine pincer grasp']]]],
 [11,[['M',['Tient debout seul','Stands alone']],['L',['Premier mot','First word']],['C',['Met et sort des objets','In and out objects']],['S',['Tend un objet','Hands an object']]]],
 [12,[['M',['Premiers pas','First steps']],['L',['1 à 3 mots','1 to 3 words']],['S',['Montre du doigt','Points']],['C',['Boit au gobelet','Drinks from a cup']]]],
 [15,[['M',['Marche seul','Walks alone']],['L',['4 à 6 mots','4 to 6 words']],['C',['Empile 2 cubes','Stacks 2 blocks']],['S',['Imite le quotidien','Imitates daily tasks']]]],
 [18,[['M',['Monte les escaliers','Climbs stairs']],['L',['10 à 20 mots','10 to 20 words']],['C',['Montre des parties du corps','Points to body parts']],['S',['Mange à la cuillère','Feeds with a spoon']]]],
 [24,[['M',['Court et tape dans un ballon','Runs and kicks']],['L',['Deux mots associés','Two-word phrases']],['C',['Empile 5 à 6 cubes','Stacks 5–6 blocks']],['S',['Joue à côté des autres','Plays alongside others']]]]
];
const FOOD=[
 {a:0,t:['0 à 5 mois','0 to 5 months'],h:['Le lait, rien que le lait','Milk and only milk'],p:['Allaitement exclusif à la demande, ou lait infantile. Ni eau, ni bouillie avant 6 mois.','Exclusive breastfeeding on demand, or formula. No water or porridge before 6 months.']},
 {a:6,t:['6 à 7 mois','6 to 7 months'],h:['Les premières cuillères','First spoonfuls'],p:['1 à 2 purées par jour : igname, patate douce, plantain, courge, enrichies d’un peu d’huile, poisson, œuf bien cuit. Un nouvel aliment tous les 2–3 jours.','1 to 2 purées a day: yam, sweet potato, plantain, squash, with oil, fish, well-cooked egg. One new food every 2–3 days.']},
 {a:8,t:['8 à 9 mois','8 to 9 months'],h:['Textures écrasées','Mashed textures'],p:['2 à 3 repas en plus du lait. Viande, poisson, œuf ou légumineuses chaque jour.','2 to 3 meals in addition to milk. Meat, fish, egg or legumes daily.']},
 {a:10,t:['10 à 11 mois','10 to 11 months'],h:['Petits morceaux','Soft finger foods'],p:['3 repas et 1 à 2 collations. Laissez-le attraper des morceaux mous.','3 meals and 1 to 2 snacks. Let baby pick up soft pieces.']},
 {a:12,t:['12 mois et plus','12 months and over'],h:['Repas de la famille','Family meals'],p:['Comme la famille, peu salé et peu sucré, en morceaux adaptés. Passez au gobelet.','Like the family, little salt and sugar, in suitable pieces. Move to a cup.']}
];
const PLATE=[[['Féculent','Starch'],['igname, patate douce, plantain, manioc, riz','yam, sweet potato, plantain, cassava, rice']],[['Protéines et fer','Protein and iron'],['poisson, œuf, poulet, viande, haricots, niébé','fish, egg, chicken, meat, beans, cowpeas']],[['Légumes et fruits','Vegetables and fruit'],['feuilles vertes, carotte, courge, mangue, papaye','leafy greens, carrot, squash, mango, papaya']],[['Matière grasse','Healthy fat'],['une cuillère à café d’huile, avocat','a teaspoon of oil, avocado']]];
const FOOD_AVOID=[['Miel avant 12 mois','Honey before 12 months'],['Sel, bouillons cubes et sucre ajoutés','Added salt, bouillon cubes and sugar'],['Jus sucrés et sodas','Sugary juices and sodas'],['Arachides et morceaux durs entiers','Whole peanuts and hard chunks'],['Lait de vache comme boisson avant 12 mois','Cow’s milk as drink before 12 months']];
const IDEAS=[
 {a:6,t:['Purée d’igname et de poisson','Yam and fish purée'],i:['Igname, poisson blanc, 1 c. à café d’huile','Yam, white fish, 1 tsp oil'],h:['Cuire l’igname, écraser avec le poisson.','Boil yam, mash with fish.']},
 {a:6,t:['Bouillie de mil à l’arachide','Millet porridge with peanut'],i:['Farine de mil, pâte d’arachide fine','Millet flour, fine peanut paste'],h:['Délayer et cuire 10 minutes. Sans sucre ni sel.','Mix and cook 10 minutes. No sugar or salt.']},
 {a:6,t:['Purée de patate douce','Sweet potato purée'],i:['Patate douce, un peu d’huile','Sweet potato, a little oil'],h:['Cuire, écraser.','Boil, mash.']},
 {a:6,t:['Avocat et banane','Avocado and banana'],i:['½ avocat, ½ banane','½ avocado, ½ banana'],h:['Écraser à la fourchette.','Mash with a fork.']},
 {a:7,t:['Œuf dur et patate douce','Hard egg and sweet potato'],i:['1 œuf, patate douce','1 egg, sweet potato'],h:['Cuire 10 min, écraser.','Boil 10 min, mash.']},
 {a:7,t:['Yaourt et mangue','Yogurt and mango'],i:['Yaourt nature, mangue','Plain yogurt, mango'],h:['Écraser la mangue, mélanger.','Mash mango, mix.']},
 {a:8,t:['Riz, haricots et feuilles','Rice, beans and greens'],i:['Riz, haricots, feuilles','Rice, beans, greens'],h:['Écraser, mélanger. Pas de sel.','Mash, mix. No salt.']},
 {a:8,t:['Attiéké et poisson','Attiéké and fish'],i:['Attiéké, poisson, tomate','Attiéké, fish, tomato'],h:['Écraser. Sans piment.','Mash. No chili.']},
 {a:9,t:['Soupe de poulet','Chicken soup'],i:['Poulet, carotte, courge','Chicken, carrot, squash'],h:['Effilocher, écraser.','Shred, mash.']},
 {a:10,t:['Doigts de fruits','Fruit fingers'],i:['Mangue ou banane','Mango or banana'],h:['Couper en bâtonnets mous.','Cut into soft sticks.']},
 {a:12,t:['Omelette','Omelette'],i:['1 œuf, tomate, oignon','1 egg, tomato, onion'],h:['Cuire, couper en morceaux.','Cook, cut into pieces.']}
];
const FOODS=[['Igname','Yam'],['Patate douce','Sweet potato'],['Banane plantain','Plantain'],['Manioc / attiéké','Cassava / attiéké'],['Riz','Rice'],['Maïs','Maize'],['Mil','Millet'],['Carotte','Carrot'],['Courge','Squash'],['Feuilles (épinards…)','Leafy greens'],['Tomate','Tomato'],['Aubergine','Eggplant'],['Avocat','Avocado'],['Mangue','Mango'],['Papaye','Papaya'],['Banane','Banana'],['Orange','Orange'],['Œuf cuit','Cooked egg'],['Poisson','Fish'],['Poulet','Chicken'],['Viande de bœuf','Beef'],['Haricot / niébé','Beans / cowpeas'],['Arachide (pâte fine)','Peanut (fine paste)'],['Yaourt nature','Plain yogurt']];
const foodName = k => { const f = FOODS.filter(x => x[0] === k)[0]; return f ? T(f) : k; };
const FEEDTYPES=[['Tétée',['Tétée','Breastfeed']],['Biberon',['Biberon','Bottle']],['Repas',['Repas','Meal']],['Eau',['Eau','Water']]];
const HTYPES=[['Température',['Température','Temperature']],['Médicament',['Médicament','Medicine']],['Maladie',['Maladie','Illness']],['Allergie',['Allergie','Allergy']],['Consultation',['Consultation','Visit']],['Autre',['Autre','Other']]];
const STYPES=[['Nuit',['Nuit','Night']],['Sieste',['Sieste','Nap']]];
const typeName = (list, k) => { const f = list.filter(x => x[0] === k)[0]; return f ? T(f[1]) : k; };
const BABY_ALERT=[['Fièvre à 38 °C ou plus avant 3 mois','Fever of 38 °C or more before 3 months'],['Respiration difficile','Difficult breathing'],['Refus de téter','Refusing to feed'],['Somnolence inhabituelle, bébé mou','Unusual sleepiness, floppy baby'],['Convulsions','Seizures'],['Vomissements répétés ou diarrhée','Repeated vomiting or diarrhea'],['Peau ou yeux très jaunes','Very yellow skin or eyes']];
const SOUV=[['Premier sourire','First smile'],['Premier rire','First laugh'],['Premier mot','First word'],['Première dent','First tooth'],['Premiers pas','First steps'],['Première bouillie','First porridge']];
const SLEEP_SAFE=[['Toujours sur le dos, matelas ferme et plat.','Always on the back, firm flat mattress.'],['Rien dans le lit : ni oreiller, ni couette, ni peluche.','Nothing in the cot: no pillow, duvet or soft toy.'],['Tête découverte, pièce aérée, pas trop chaude.','Head uncovered, ventilated room, not too hot.'],['Moustiquaire imprégnée bien installée.','Treated bed net properly fitted.'],['Dans son propre lit, dans la chambre des parents les premiers mois.','In its own cot, in the parents’ room for the first months.'],['Aucune fumée de tabac.','No tobacco smoke.']];
const SCREEN_RULES=[['Pas d’écran pendant les repas, ni dans la chambre.','No screens during meals or in the bedroom.'],['Aucun écran dans l’heure avant le coucher.','No screens in the hour before bed.'],['Éteignez la télé quand personne ne regarde.','Switch off the TV when nobody is watching.'],['Évitez le téléphone en donnant le sein.','Avoid your phone while feeding.'],['Ne vous servez pas de l’écran pour le calmer.','Do not use a screen to calm baby.'],['Choisissez des programmes calmes, sans publicité.','Choose calm programmes without ads.']];
const SCREEN_ALT=[['Parler, chanter, comptines','Talk, sing, rhymes'],['Livre cartonné, miroir','Board book, mirror'],['Promenade, jeux d’eau','Walks, water play'],['Casseroles, cuillère en bois','Pots, wooden spoon'],['Danser ensemble','Dancing together']];
const BABY_MUSIC=[
 {age:0,t:['Sons blancs et battements de cœur','White noise & heartbeat'],desc:['Idéal pour apaiser les nouveau-nés.','Ideal for calming newborns.'],url:'#'},
 {age:3,t:['Douces berceuses','Gentle lullabies'],desc:['Mélodies douces pour l’endormissement.','Soft melodies for falling asleep.'],url:'#'},
 {age:6,t:['Comptines rythmées','Rhythmic rhymes'],desc:['Pour stimuler le langage.','To stimulate language.'],url:'#'},
 {age:12,t:['Chansons pour danser','Songs for dancing'],desc:['Pour bouger et s’amuser.','For moving and having fun.'],url:'#'}
];
const WK=[0,1,2,3,4,5,6,7,8,9,10,11,12,18,24];
const WHO={
 w:{M:[3.3,4.5,5.6,6.4,7.0,7.5,7.9,8.3,8.6,8.9,9.2,9.4,9.6,10.9,12.2],F:[3.2,4.2,5.1,5.8,6.4,6.9,7.3,7.6,7.9,8.2,8.5,8.7,8.9,10.2,11.5]},
 l:{M:[49.9,54.7,58.4,61.4,63.9,65.9,67.6,69.2,70.6,72.0,73.3,74.5,75.7,82.3,87.1],F:[49.1,53.7,57.1,59.8,62.1,64.0,65.7,67.3,68.7,70.1,71.5,72.8,74.0,80.7,86.4]},
 h:{M:[34.5,37.3,39.1,40.5,41.6,42.6,43.3,44.0,44.5,45.0,45.4,45.8,46.1,47.4,48.3],F:[33.9,36.5,38.3,39.5,40.6,41.5,42.2,42.8,43.4,43.8,44.2,44.6,44.9,46.2,47.2]}
};
const METRICS={w:{label:['Poids','Weight'],unit:'kg',key:'kg'},l:{label:['Taille','Length'],unit:'cm',key:'cm'},h:{label:['Périmètre crânien','Head size'],unit:'cm',key:'hc'}};
function interp(arr, x) { for (let i = 0; i < WK.length - 1; i++) { if (x >= WK[i] && x <= WK[i + 1]) { const t = (x - WK[i]) / (WK[i + 1] - WK[i]); return arr[i] + (arr[i + 1] - arr[i]) * t; } } return arr[arr.length - 1]; }
const PCV = (k, x, up) => k === 'w' ? (up ? .135 : .11) : k === 'l' ? .037 - .0005 * x : .037 - .0004 * x;
const pctVal = (m, z, k, x) => m * (1 + z * PCV(k, x, z > 0));
const ncdf = z => { const t = 1 / (1 + .2316419 * Math.abs(z)), d = .3989423 * Math.exp(-z * z / 2), p = d * t * (.3193815 + t * (-.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };

/* ==================== 8. Histoires ==================== */
const STORIES=[
 {id:'lune',t:['La petite lune qui ne voulait pas dormir','The little moon who would not sleep'],tag:['Dès la naissance','From birth'],min:2,p:[['Dans le ciel du village, il y avait une petite lune qui ne voulait jamais dormir. « Je veux regarder les toits, disait-elle. »','In the village sky, there was a little moon who never wanted to sleep. “I want to watch the rooftops,” she said.'],['Alors le vent est venu, tout doux. « Ferme un œil, petite lune. »','So the wind came, very gently. “Close one eye, little moon.”'],['Le fleuve lui a chanté sa chanson : « Chhh… chhh… chhh… »','The river sang her its song: “Shhh… shhh… shhh…”'],['Le baobab a étendu son ombre comme une grande couverture.','The baobab spread its shadow like a big blanket.'],['Et la petite lune a bâillé, très grand, et s’est endormie sur son nuage.','And the little moon yawned, very wide, and fell asleep on her cloud.'],['Bonne nuit, petite lune. Bonne nuit, petit cœur.','Good night, little moon. Good night, little heart.']]},
 {id:'graine',t:['Petite graine, nous t’attendons','Little seed, we are waiting for you'],tag:['À lire pendant la grossesse','To read during pregnancy'],min:2,p:[['Petite graine, tu grandis au chaud, tout près de mon cœur.','Little seed, you are growing warm and snug, close to my heart.'],['Quand tu bouges, je souris. Quand tu dors, je te chante une chanson.','When you move, I smile. When you sleep, I sing you a song.'],['Dehors, il y a un monde pour toi : le soleil du matin, la pluie sur les toits.','Out here there is a world for you: the morning sun, rain on the rooftops.'],['Il y a des bras prêts à te porter, des mains prêtes à te bercer.','There are arms ready to carry you, hands ready to rock you.'],['Prends ton temps, petite graine. Grandis doucement. Nous serons là.','Take your time, little seed. Grow slowly. We will be here.']]},
 {id:'tortue',t:['Kouadio et la tortue du marigot','Kouadio and the pond turtle'],tag:['Dès 6 mois','From 6 months'],min:3,p:[['Chaque matin, Kouadio allait au marigot.','Every morning, Kouadio went to the pond.'],['Un jour, il a couru et plouf ! Il est tombé dans la boue.','One day he ran and splash! He fell in the mud.'],['La tortue a ri : « Hi hi hi ! Doucement, doucement. »','The turtle laughed: “Hee hee hee! Slowly, slowly.”'],['Le lendemain, il a vu une fleur jaune, un oiseau, une mangue.','The next day he saw a yellow flower, a bird, a mango.'],['« Tu vois, quand on va doucement, on voit tout. »','“You see, when we go slowly, we see everything.”']]},
 {id:'luciole',t:['Ama et les lucioles','Ama and the fireflies'],tag:['Dès 12 mois','From 12 months'],min:3,p:[['Ama avait peur du noir.','Ama was afraid of the dark.'],['Une petite lumière est entrée. « Je porte ma lumière avec moi. »','A tiny light came in. “I carry my light with me.”'],['Puis dix lucioles. « La nuit n’est pas vide. Elle est pleine d’amis. »','Then ten fireflies. “The night is not empty. It is full of friends.”'],['Ama a regardé les lumières danser.','Ama watched the lights dance.'],['Et les dix lucioles ont veillé sur elle jusqu’au matin.','And the ten fireflies watched over her until morning.']]},
 {id:'baobab',t:['Le baobab qui chantait','The singing baobab'],tag:['Dès 18 mois','From 18 months'],min:3,p:[['Au milieu de la savane se tenait un très vieux baobab.','In the middle of the savanna stood a very old baobab.'],['Chaque soir il chantait : « Hmmmm… hmmmm… »','Every evening he sang: “Hmmmm… hmmmm…”'],['Le petit singe l’écoutait, l’éléphanteau aussi.','The little monkey listened, the baby elephant too.'],['« Pourquoi chantes-tu ? » a demandé le singe.','“Why do you sing?” asked the monkey.'],['« Pour dire que demain, le soleil revient. »','“To say that tomorrow the sun comes back.”'],['Et la savane s’est endormie.','And the savanna fell asleep.']]}
];
(function(){
  const C = [['la petite tortue','the little turtle',1],['le petit éléphant','the little elephant',0],['le petit colibri','the little hummingbird',0],['la petite girafe','the little giraffe',1],['le petit lapin','the little rabbit',0],['le petit hibou','the little owl',0],['le petit poisson','the little fish',0],['le petit papillon','the little butterfly',0],['le petit chat','the little cat',0],['la petite luciole','the little firefly',1]];
  const Pl = [['sous le baobab','under the baobab'],['au bord du fleuve','by the river'],['près du puits','by the well'],['sur la colline','on the hill'],['dans la savane','on the savanna'],['au marché','at the market'],['dans la forêt','in the forest'],['près de la mer','by the sea'],['dans le jardin','in the garden'],['sous la lune','under the moon']];
  const Cm = [['Le vent a chuchoté : « Doucement, tout vient en son temps. »','The wind whispered: “Gently, everything comes in its own time.”'],['Le fleuve a chanté : « Tu es en sécurité. »','The river sang: “You are safe.”'],['Les étoiles ont murmuré : « Nous veillons sur toi. »','The stars murmured: “We are watching over you.”'],['Une voix familière a dit : « Je suis là, tout près. »','A familiar voice said: “I am here, very close.”'],['La nuit a posé sa grande couverture : « Repose-toi. »','The night laid its big blanket: “Rest now.”']];
  const PT = [['une petite graine toute neuve','a brand-new little seed'],['un cœur qui bat très fort','a heart beating strongly'],['de minuscules doigts','tiny little fingers'],['une voix douce que l’on reconnaît','a soft voice it knows'],['les tout premiers mouvements','the very first little movements'],['des bruits venus du dehors','sounds from outside'],['la lumière qui traverse le ventre','light shining through the belly'],['un nid bien douillet','a cosy little nest'],['que le grand jour approche','that the big day is near']];
  const BT = [[2,'un sourire','a smile'],[5,'ses deux petites mains','its two little hands'],[8,'les premiers goûts','the first tastes'],[11,'le monde à quatre pattes','the world on all fours'],[17,'les premiers pas','the first steps'],[24,'des mots tout neufs','brand-new words']];
  const cap = s => s[0].toUpperCase() + s.slice(1);
  const J = [['Σ a pris le petit chemin qui sent la terre mouillée. À chaque pas, un nouveau bruit.','Σ took the little path that smells of damp earth. With every step came a new sound.'],['Σ a marché longtemps, sans se presser.','Σ walked a long way, in no hurry.'],['Σ s’est arrêté pour regarder son ombre s’allonger.','Σ stopped to watch its shadow stretch out.'],['Σ a trouvé une plume, un caillou lisse et une petite fleur.','Σ found a feather, a smooth pebble and a tiny flower.']];
  const F = [['Le vieux baobab a ouvert ses branches : « Viens, raconte-moi ta journée. »','The old baobab opened its branches: “Come, tell me about your day.”'],['Une vieille tortue sage est passée. « Rien ne presse. »','A wise old turtle went by. “There is no rush.”'],['Les lucioles sont venues danser autour de Σ.','The fireflies came to dance around Σ.'],['Maman éléphant a soufflé un air tiède : « Tout va bien. »','Mother elephant blew a warm breath: “All is well.”']];
  const Q = [['Mais un petit nuage a caché la lune, et Σ a eu un peu peur.','But a little cloud hid the moon, and Σ felt a bit afraid.'],['Un bruit inconnu est venu de loin.','An unfamiliar sound came from far away.'],['Σ a senti que ses yeux devenaient lourds.','Σ felt its eyes growing heavy.'],['Soudain, Σ s’est senti tout petit dans ce grand monde.','Suddenly Σ felt very small in the big world.']];
  const sub = (t, c) => t.replace(/Σ/g, cap(c)).replace(/§/g, c);
  function mk(m, i, preg) {
    const c = C[(i + m) % 10], p = Pl[(i * 3 + m) % 10], cm = Cm[(i + m) % 5], cm2 = Cm[(i + m + 2) % 5];
    const th = preg ? PT[m - 1] : (BT.find(b => m <= b[0]) || BT[5]).slice(1);
    const jj = J[(i + m) % 4], ff = F[(i * 2 + m) % 4], qq = Q[(i + 2 * m) % 4];
    const fr = [`${cap(c[0])} vivait ${p[0]}. Chaque soir, ${c[0]} écoutait les bruits de la nuit.`, `Ce mois-ci, ${c[0]} découvrait ${th[0]}.`, sub(jj[0], c[0]), sub(ff[0], c[0]), sub(qq[0], c[0]), cm[0], `Alors ${c[0]} a pensé à tous ceux qui l’aiment.`, sub(cm2[0], c[0]), `${cap(c[0])} a respiré lentement.`, `Les paupières de ${c[0]} se sont fermées.`, `Bonne nuit, ${c[0]}. Bonne nuit, petit cœur.`];
    const en = [`${cap(c[1])} lived ${p[1]}. Every evening, ${c[1]} listened to the sounds of the night.`, `This month, ${c[1]} was discovering ${th[1]}.`, sub(jj[1], c[1]), sub(ff[1], c[1]), sub(qq[1], c[1]), cm[1], `Then ${c[1]} thought of everyone who loves it.`, sub(cm2[1], c[1]), `${cap(c[1])} breathed slowly.`, `${cap(c[1])}’s eyelids closed.`, `Good night, ${c[1]}. Good night, little heart.`];
    const o = { id: (preg ? 'gp' : 'gb') + m + '_' + i, t: [`${cap(c[0])} ${p[0]}`, `${cap(c[1])} ${p[1]}`], min: Math.max(3, Math.round(fr.join(' ').split(/\s+/).length / 105)), p: fr.map((x, l) => [x, en[l]]) };
    if (preg) { o.pm = m; o.tag = [`À lire pendant la grossesse · mois ${m}`, `To read during pregnancy · month ${m}`]; }
    else { o.age = m; o.tag = [m ? `Mois ${m}` : `Dès la naissance`, m ? `Month ${m}` : `From birth`]; }
    return o;
  }
  for (let m = 1; m <= 9; m++) for (let i = 0; i < 10; i++) STORIES.push(mk(m, i, true));
  for (let m = 0; m <= 24; m++) for (let i = 0; i < 10; i++) STORIES.push(mk(m, i, false));
})();
function storiesForAge(m) { return STORIES.filter(s => { const a = s.age != null ? s.age : 0; return a <= Math.max(m, 0); }).slice().sort((a, b) => (b.age || 0) - (a.age || 0)); }

/* ==================== 9. Audio ==================== */
const AUD = { el: null, to: null, url: null, on: null, ctx: null, src: null };
function audStop() {
  clearTimeout(AUD.to);
  if (AUD.src) { try { AUD.src.stop(); } catch (e) {} try { AUD.src.disconnect(); } catch (e) {} AUD.src = null; }
  if (AUD.el) { AUD.el.pause(); AUD.el.removeAttribute('src'); AUD.el.load(); }
  if (AUD.url) URL.revokeObjectURL(AUD.url);
  AUD.url = null; AUD.on = null;
}
function genPCM(age) {
  const sr = 22050, sc = [261.6, 293.7, 329.6, 392, 440, 523.3], mel = [0, 2, 4, 2, 1, 3, 5, 3, 4, 2, 0, 1];
  const tp = age < 6 ? .9 : age < 12 ? .48 : .3, n = Math.round(sr * (age === 0 ? 7.8 : tp * 12)), d = new Float32Array(n);
  if (age === 0) {
    let l = 0;
    for (let i = 0; i < n; i++) { l = (l + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 1.6; }
    for (let k = 0; k < 15; k++) for (const [o, a, len] of [[0, .8, .15], [.22, .5, .12]]) { const st = Math.round((k * .52 + o) * sr); for (let i = 0; i < len * sr && st + i < n; i++) { const t = i / sr; d[st + i] += Math.sin(6.283 * 58 * t) * Math.exp(-t * 22) * a; } }
  } else for (let k = 0; k < 12; k++) {
    const f = sc[mel[k]], st = Math.round(k * tp * sr), len = Math.round(tp * 1.6 * sr);
    for (let i = 0; i < len && st + i < n; i++) {
      const t = i / sr, e = Math.min(1, t * 40) * Math.exp(-t * (age < 6 ? 2.2 : 4));
      let w = Math.sin(6.283 * f * t) + (age >= 12 ? .4 * Math.sin(6.283 * 2 * f * t) : 0);
      if (age >= 6 && k % 2 === 0) w += .5 * Math.sin(6.283 * f / 2 * t);
      d[st + i] += w * e * .3;
    }
  }
  return { d, sr };
}
function makeWav(age) {
  const g = genPCM(age), d = g.d, sr = g.sr, n = d.length;
  const pcm = new DataView(new ArrayBuffer(44 + n * 2)), W = (o, t) => { for (let i = 0; i < t.length; i++) pcm.setUint8(o + i, t.charCodeAt(i)); };
  W(0, 'RIFF'); pcm.setUint32(4, 36 + n * 2, true); W(8, 'WAVEfmt '); pcm.setUint32(16, 16, true); pcm.setUint16(20, 1, true); pcm.setUint16(22, 1, true); pcm.setUint32(24, sr, true); pcm.setUint32(28, sr * 2, true); pcm.setUint16(32, 2, true); pcm.setUint16(34, 16, true); W(36, 'data'); pcm.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) pcm.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32000, true);
  return new Blob([pcm.buffer], { type: 'audio/wav' });
}
function audPlay(age, title) {
  audStop();
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw 0;
    const ctx = AUD.ctx || (AUD.ctx = new AC());
    if (ctx.state === 'suspended') ctx.resume();
    const g = genPCM(age), buf = ctx.createBuffer(1, g.d.length, g.sr);
    buf.getChannelData(0).set(g.d);
    const src = ctx.createBufferSource(), gn = ctx.createGain();
    src.buffer = buf; src.loop = true; gn.gain.value = 1.5;
    src.connect(gn); gn.connect(ctx.destination); src.start(0);
    AUD.src = src;
  } catch (e) {
    const el = AUD.el || (AUD.el = new Audio());
    AUD.url = URL.createObjectURL(makeWav(age));
    el.src = AUD.url; el.loop = true; el.volume = .8;
    const pr = el.play();
    if (pr && pr.catch) pr.catch(() => { toast('Lecture impossible.', 'bad'); audStop(); render(); });
  }
  AUD.on = title;
  AUD.to = setTimeout(() => { audStop(); render(); }, 20 * 60000);
}

/* ==================== 10. Calculs ==================== */
function pI() {
  const l = S.preg.lmp, t = today(), days = diff(l, t), sa = Math.floor(days / 7), j = days % 7, dpa = add(l, 280);
  return { days, sa, j, dpa, left: diff(t, dpa), pct: Math.min(Math.max(days / 280, 0), 1), tri: sa < 14 ? 1 : sa < 28 ? 2 : 3, month: monthOf(sa) };
}
function bI() {
  const b = S.baby.birth, t = today(), B = P(b), T0 = P(t);
  let m = (T0.getFullYear() - B.getFullYear()) * 12 + T0.getMonth() - B.getMonth();
  if (T0.getDate() < B.getDate()) m--;
  if (m < 0) return { m: 0, d: 0, days: diff(b, t), fut: true };
  const base = new Date(B.getFullYear(), B.getMonth() + m, B.getDate());
  return { m, d: Math.round((T0 - base) / 864e5), days: diff(b, t), fut: false };
}
function ageText(m, d, days) { if (m < 1) return nD(Math.max(days, 0)); return nMo(m) + (d ? L(' et ', ' and ') + nD(d) : ''); }
function ageAt(date) {
  const b = S.baby.birth, days = diff(b, date);
  if (days < 0) return '';
  const B = P(b), T0 = P(date);
  let m = (T0.getFullYear() - B.getFullYear()) * 12 + T0.getMonth() - B.getMonth();
  if (T0.getDate() < B.getDate()) m--;
  return m < 1 ? nD(days) : nMo(m);
}
const apptDate = a => add(S.preg.lmp, a.sa * 7);
function pregItems() { const p = S.preg; return APPTS.map(a => ({ id: a.id, t: T(a.t), n: T(a.n), d: apptDate(a), sa: a.sa })).concat(p.custom.map(c => ({ id: c.id, t: c.t, n: c.n || '', d: c.d, c: true }))); }
function babyItems() {
  const b = S.baby;
  return CHECKUPS.map(m => ({ id: 'bc' + m, t: L('Suivi de bébé : ', 'Baby check-up: ') + nMo(m), n: L('Poids, taille, périmètre crânien, développement, alimentation, sommeil.', 'Weight, length, head size, development, feeding, sleep.'), d: addM(b.birth, m) })).concat(b.custom.map(c => ({ id: c.id, t: c.t, n: c.n || '', d: c.d, c: true })));
}
const doneMap = () => S.mode === 'preg' ? S.preg.appts : S.baby.appts;
function vaccList() {
  const out = [];
  VACC.forEach((g, gi) => g.v.forEach((n, i) => out.push({ id: 'v' + gi + '_' + i, name: n, grp: g.t, due: add(S.baby.birth, g.d) })));
  S.baby.customVacc.forEach(c => out.push({ id: c.id, name: c.name, grp: ['Autres vaccins', 'Other vaccines'], due: c.due || '', custom: true }));
  return out;
}
function vState(v) {
  const done = S.baby.vacc[v.id];
  if (done) return { k: 'done', l: L('Fait le ', 'Done ') + fmtS(done), c: 'ok' };
  if (!v.due) return { k: 'none', l: L('À planifier', 'To schedule'), c: '' };
  const n = diff(today(), v.due);
  if (n < 0) return { k: 'late', l: L('En retard', 'Overdue'), c: 'bad' };
  if (n <= 30) return { k: 'soon', l: L('Dans ', 'In ') + nD(n), c: 'warn' };
  return { k: 'later', l: L('Vers le ', 'Around ') + fmtS(v.due), c: '' };
}
function reminders() {
  const t = today(), lead = S.lead || 7, out = [];
  if (S.mode === 'preg') {
    if (!S.preg.lmp) return [];
    pregItems().forEach(a => { if (S.preg.appts[a.id]) return; const n = diff(t, a.d); if (n >= -14 && n <= lead) out.push(Object.assign({ n }, a)); });
  } else {
    if (!S.baby.birth) return [];
    babyItems().forEach(a => { if (S.baby.appts[a.id]) return; const n = diff(t, a.d); if (n >= -14 && n <= lead) out.push(Object.assign({ n }, a)); });
    vaccList().forEach(v => { if (S.baby.vacc[v.id] || !v.due) return; const n = diff(t, v.due); if (n <= lead) out.push({ id: v.id, t: L('Vaccin : ', 'Vaccine: ') + T(v.name), d: v.due, n }); });
  }
  return out.sort((a, b) => a.d.localeCompare(b.d));
}
const whenChip = n => n < 0 ? '<span class="chip bad">' + L('En retard', 'Overdue') + '</span>' : n === 0 ? '<span class="chip warn">' + L('Aujourd’hui', 'Today') + '</span>' : n === 1 ? '<span class="chip warn">' + L('Demain', 'Tomorrow') + '</span>' : '<span class="chip">' + L('Dans ', 'In ') + nD(n) + '</span>';
const calLink = (t, d) => '<a class="del" href="' + gcal(t, d) + '" target="_blank" rel="noopener noreferrer" aria-label="' + esc(L('Ajouter à l’agenda', 'Add to calendar')) + '">' + ic('cal') + '</a>';
function remCard() {
  const r = reminders();
  if (!r.length) return '';
  return '<div class="card rem"><h3>' + L('Rappels', 'Reminders') + '</h3>' + r.slice(0, 5).map(x => '<div class="row" style="flex-wrap:wrap;align-items:flex-start"><div class="grow" style="min-width:140px;flex:1 1 140px"><div class="t">' + esc(x.t) + '</div><div class="muted small">' + fmt(x.d, { weekday: 'short', day: 'numeric', month: 'long' }) + '</div></div><div style="display:flex;align-items:center;gap:4px;flex:none;margin-top:4px">' + whenChip(x.n) + calLink(x.t, x.d) + '</div></div>').join('') + (r.length > 5 ? '<p class="muted small" style="margin-top:6px">+ ' + (r.length - 5) + L(' autres', ' more') + '</p>' : '') + '</div>';
}
function sleepMins(s, e) { const a = s.split(':').map(Number), b = e.split(':').map(Number); let m = (b[0] * 60 + b[1]) - (a[0] * 60 + a[1]); if (m <= 0) m += 1440; return m; }
const sEnd = x => x.s >= x.e ? add(x.d, 1) : x.d;
const sleepOn = d => S.baby.sleeps.reduce((a, x) => a + (sEnd(x) === d ? x.m : 0), 0);

/* ==================== 11. Aura Conseils ==================== */
function smartInsights(section) {
  const insights = [];
  section = section || 'home';
  if (S.mode === 'preg' && S.preg.lmp) {
    const I = pI();
    if (section === 'home' || section === 'appts') {
      if (I.sa >= 7 && I.sa <= 10) insights.push(L('CPN 1 à programmer vers 8 SA.', 'ANC 1 to schedule around week 8.'));
      if (I.sa >= 10 && I.sa <= 13) insights.push(L('Échographie du 1er trimestre.', 'First-trimester ultrasound.'));
      if (I.sa >= 20 && I.sa <= 25) insights.push(L('Échographie morphologique.', 'Anatomy scan.'));
      if (I.sa >= 24 && I.sa <= 28) insights.push(L('Dépistage du diabète gestationnel.', 'Gestational diabetes screening.'));
      if (I.left <= 21 && I.left > 0) insights.push(L('Terme dans moins de 3 semaines : finalisez la valise.', 'Due in less than 3 weeks: finish the bag.'));
      if (I.left < 0) insights.push(L('Terme dépassé : contactez votre sage-femme.', 'Past due: contact your midwife.'));
    }
    if (section === 'home' || section === 'track') {
      const ws = S.preg.weights;
      if (ws.length >= 2) { const g = ws[ws.length - 1].kg - ws[0].kg; if (g > 15) insights.push(L('Prise de poids importante.', 'Significant weight gain.')); }
      const lastBp = S.preg.bps.slice().sort((a, b) => b.d.localeCompare(a.d))[0];
      if (lastBp && (lastBp.sys >= 140 || lastBp.dia >= 90)) insights.push(L('Dernière tension ≥ 140/90.', 'Last BP ≥ 140/90.'));
      const lastEd = (S.preg.edema || []).slice().sort((a, b) => b.d.localeCompare(a.d))[0];
      if (lastEd && lastEd.v === 'oui') insights.push(L('Œdème noté : surveillez maux de tête et vision.', 'Edema noted: watch headaches and vision.'));
      const lastSt = (S.preg.stress || []).slice().sort((a, b) => b.d.localeCompare(a.d))[0];
      if (lastSt && lastSt.score >= 7) insights.push(L('Stress élevé. Respiration, marche, soutien.', 'High stress. Breathing, walk, support.'));
    }
    if (section === 'appts' || section === 'bag') {
      if (I.sa >= 30 && I.sa < 36) insights.push(L('Commencez la valise vers 32–34 SA.', 'Start the bag around 32–34 weeks.'));
      if (I.sa >= 36) insights.push(L('Valise : vérifiez qu’elle est complète.', 'Hospital bag: check it is complete.'));
    }
  }
  if (S.mode === 'baby' && S.baby.birth) {
    const I = bI();
    if (section === 'home' || section === 'health') {
      const overdue = vaccList().filter(v => !S.baby.vacc[v.id] && v.due && diff(today(), v.due) < 0);
      if (overdue.length) insights.push(L(overdue.length + ' vaccin(s) en retard.', overdue.length + ' vaccine(s) overdue.'));
    }
    if (section === 'home' || section === 'growth') {
      const ms = S.baby.measures.filter(m => m.kg != null).sort((a, b) => b.d.localeCompare(a.d));
      if (ms.length) { const last = ms[0], ageM = diff(S.baby.birth, last.d) / 30.4375; const med = interp(WHO.w[S.baby.sex === 'M' ? 'M' : 'F'], ageM); if (med && Math.abs(last.kg - med) / med > 0.18) insights.push(L('Poids éloigné de la médiane OMS.', 'Weight far from WHO median.')); }
    }
    if (section === 'home' || section === 'food') {
      if (I.m >= 5 && I.m <= 7 && Object.keys(S.baby.foods).length < 3) insights.push(L('Un nouvel aliment tous les 2–3 jours.', 'One new food every 2–3 days.'));
      if (I.m < 6) insights.push(L('Avant 6 mois : lait exclusif.', 'Before 6 months: exclusive milk.'));
    }
    if (section === 'home' || section === 'sleep') {
      const avg = (() => { let t = 0, c = 0; for (let i = 0; i < 7; i++) { const d = add(today(), -i), s = sleepOn(d); if (s > 0) { t += s; c++; } } return c ? t / c : 0; })();
      if (avg > 0 && I.m >= 4 && avg < 11 * 60) insights.push(L('Sommeil un peu bas. Un rituel régulier aide.', 'Sleep a bit low. A regular routine helps.'));
    }
  }
  if (!insights.length) insights.push(L('Tout semble calme. Continuez à noter.', 'Everything looks calm. Keep logging.'));
  return insights.slice(0, 4);
}
function smartCard(section) {
  const list = smartInsights(section || 'home');
  return '<div class="card smart"><div class="smart-badge">' + ic('spark') + ' Aura Conseils</div><h3>' + L('Repères personnalisés', 'Personalised guidance') + '</h3>' + list.map(t => '<p style="margin-top:8px">• ' + esc(t) + '</p>').join('') + '<div style="margin-top:12px"><button class="btn ghost sm" data-act="smartMore" data-sec="' + (section || 'home') + '">' + L('Voir plus', 'See more') + '</button></div></div>';
}

/* ==================== 12. Graphiques ==================== */
function chart(o) {
  const pts = o.pts, med = o.med || [], xMax = o.xMax, W = 340, H = 210, ML = 42, MR = 30, MT = 14, MB = 28;
  const all = pts.concat(med, (o.bands || []).reduce((a, b) => a.concat(b.pts), []));
  if (!all.length) return '';
  let a = Math.min.apply(null, all.map(p => p.y)), b = Math.max.apply(null, all.map(p => p.y));
  const pd = ((b - a) || 1) * .12; a -= pd; b += pd;
  const X = x => ML + x / xMax * (W - ML - MR), Y = y => MT + (1 - (y - a) / (b - a)) * (H - MT - MB);
  let g = '';
  for (let i = 0; i <= 3; i++) { const v = a + (b - a) * i / 3, y = Y(v); g += '<line x1="' + ML + '" x2="' + (W - MR) + '" y1="' + y + '" y2="' + y + '" class="gl"/><text x="' + (ML - 6) + '" y="' + (y + 3.5) + '" text-anchor="end" class="gt">' + f1(v) + '</text>'; }
  for (let x = 0; x <= xMax; x += o.xStep) g += '<text x="' + X(x) + '" y="' + (H - 8) + '" text-anchor="middle" class="gt">' + x + '</text>';
  const path = ps => ps.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
  let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label) + '">' + g;
  (o.bands || []).forEach(b => { const e = b.pts[b.pts.length - 1]; s += '<path class="cp" d="' + path(b.pts) + '"/><text x="' + (X(xMax) + 3) + '" y="' + (Y(e.y) + 3) + '" class="gt">P' + b.lab + '</text>'; });
  if (med.length) s += '<path class="cm" d="' + path(med) + '"/>';
  if (pts.length > 1) s += '<path class="cu" d="' + path(pts) + '"/>';
  pts.forEach(p => { s += '<circle class="dot" cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="4.5"/>'; });
  return s + '</svg>';
}
function bars(days, ref, label) {
  const W = 340, H = 170, M0 = 8, MB = 24, MT = 18, bw = (W - 2 * M0) / days.length;
  const mx = Math.max(ref + 3, Math.max.apply(null, days.map(d => d.v)) + 2);
  const Y = v => MT + (1 - v / mx) * (H - MT - MB);
  let s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + '"><line x1="' + M0 + '" x2="' + (W - M0) + '" y1="' + Y(ref) + '" y2="' + Y(ref) + '" class="cm"/>';
  days.forEach((d, i) => {
    const x = M0 + i * bw + bw * .18, w = bw * .64, y = Y(d.v), h = Math.max(H - MB - y, d.v > 0 ? 3 : 0);
    s += (d.v > 0 ? '<rect class="bar" x="' + x.toFixed(1) + '" y="' + (H - MB - h).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="6"/><text class="gt" x="' + (x + w / 2).toFixed(1) + '" y="' + (H - MB - h - 4).toFixed(1) + '" text-anchor="middle">' + f1(d.v) + '</text>' : '') + '<text class="gt" x="' + (x + w / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(d.l) + '</text>';
  });
  return s + '</svg>';
}

/* ==================== 13. Sheets ==================== */
function sheet(title, body) {
  $('#sheetRoot').innerHTML = '<div class="scrim" data-act="close"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="sheet-h"><h2>' + esc(title) + '</h2><button class="icon" data-act="close" aria-label="' + L('Fermer', 'Close') + '">' + ic('close') + '</button></div><div class="sheet-b">' + body + '</div></section>';
  document.body.classList.add('lock');
}
function closeSheet() { $('#sheetRoot').innerHTML = ''; document.body.classList.remove('lock'); }
const dateField = (id, v, max, lab) => '<label class="f"><span>' + (lab || 'Date') + '</span><input type="date" id="' + id + '" value="' + (v || today()) + '"' + (max ? ' max="' + max + '"' : '') + '></label>';
const delBtn = (list, id) => '<button class="del" data-act="del" data-list="' + list + '" data-id="' + id + '" aria-label="' + L('Supprimer', 'Delete') + '">' + ic('trash') + '</button>';
const empty = t => '<div class="empty">' + t + '</div>';
const sortD = (arr, k) => arr.slice().sort((x, y) => (y[k || 'd'] + (y.t || '')).localeCompare(x[k || 'd'] + (x.t || '')));
const lab = t => '<div class="muted small" style="font-weight:600;margin-bottom:6px">' + t + '</div>';
const seg = (items, cur, key) => '<div class="seg">' + items.map(i => '<button data-act="sub" data-k="' + key + '" data-v="' + i[0] + '" aria-pressed="' + (cur === i[0]) + '">' + T(i[1]) + '</button>').join('') + '</div>';
const chipsNav = (items, cur, key) => '<div class="subnav">' + items.map(i => '<button class="chip' + (cur === i[0] ? ' on' : '') + '" data-act="sub" data-k="' + key + '" data-v="' + i[0] + '" aria-pressed="' + (cur === i[0]) + '">' + T(i[1]) + '</button>').join('') + '</div>';
const opts = (name, items, cur) => '<div class="opts">' + items.map((i, n) => '<label class="opt"><input type="radio" name="' + name + '" value="' + esc(i[0]) + '"' + ((cur ? cur === i[0] : n === 0) ? ' checked' : '') + '><span>' + esc(T(i[1])) + '</span></label>').join('') + '</div>';
const dayIdx = () => Math.floor(Date.now() / 864e5);
const isOpen = (id, def) => ui.open[id] === undefined ? def : ui.open[id];

const ui = { tab: { preg: 'home', baby: 'home' }, sub: { pmore: 'stories', beveil: 'dev', bfood: 'guide', bhealth: 'vacc' }, metric: 'w', open: {}, anim: true, confirm: false, story: null, prefBirth: '' };

/* ==================== 14. Auth views ==================== */
function authView() {
  const has = !!AUTH;
  const remaining = failRemaining();
  if (has) {
    const locked = remaining > 0;
    const lockMsg = locked ? '<p class="err" style="margin-top:8px">' + L('Trop de tentatives. Réessayez dans ', 'Too many attempts. Try again in ') + Math.ceil(remaining / 60) + L(' min.', ' min.') + '</p>' : '';
    return '<div class="setup stack" style="max-width:380px;margin:24px auto 0;text-align:center">' +
      '<div class="cover" aria-hidden="true">🔒</div>' +
      '<h1 style="margin-bottom:16px">' + L('Connexion', 'Sign in') + '</h1>' +
      '<div class="card" style="text-align:left">' +
      '<p class="muted small" style="margin-bottom:10px">' + L('Identifiant : ', 'Login: ') + '<b>' + esc(AUTH.login) + '</b></p>' +
      '<label class="f"><span>' + L('Mot de passe', 'Password') + '</span><input type="password" id="a_pass" autocomplete="current-password" maxlength="128"' + (locked ? ' disabled' : '') + '></label>' +
      '<div class="err" id="err"></div>' + lockMsg +
      '<button class="btn block" data-act="doUnlock"' + (locked ? ' disabled' : '') + '>' + L('Déverrouiller', 'Unlock') + '</button>' +
      '</div><button class="btn ghost block" style="margin-top:14px" data-act="showRecover">' + L('Mot de passe oublié', 'Forgot password') + '</button></div>';
  }
  return '<div class="setup stack" style="max-width:380px;margin:24px auto 0;text-align:center">' +
    '<div class="cover" aria-hidden="true">🌱</div>' +
    '<h1 style="margin-bottom:8px">' + L('Créer un accès', 'Create access') + '</h1>' +
    '<p class="muted small" style="margin-bottom:16px">' + L('Votre mot de passe chiffre vos données. Il n\'est jamais transmis ni stocké en clair.', 'Your password encrypts your data. It is never sent or stored in clear.') + '</p>' +
    '<div class="card" style="text-align:left">' +
    '<label class="f"><span>' + L('E-mail ou numéro', 'Email or phone') + '</span><input id="a_login" autocomplete="username" maxlength="80" placeholder="marie@mail.com"></label>' +
    '<label class="f"><span>' + L('Mot de passe (min. 8 caractères)', 'Password (min. 8 characters)') + '</span><input type="password" id="a_pass" autocomplete="new-password" maxlength="128"></label>' +
    '<label class="f"><span>' + L('Confirmer', 'Confirm') + '</span><input type="password" id="a_pass2" autocomplete="new-password" maxlength="128"></label>' +
    '<div class="err" id="err"></div>' +
    '<button class="btn block" data-act="doCreateAuth">' + L('Créer mon accès local', 'Create local access') + '</button>' +
    '</div><div class="secure-note">' + ic('lock') + ' ' + L('Chiffrement AES-256 · 100 % local', 'AES-256 encryption · 100% local') + '</div></div>';
}

/* ==================== 15. Setup ==================== */
function welcomeView() {
  const card = (v, e, t, d) => '<button type="button" class="card" data-act="pickMode" data-v="' + v + '" aria-pressed="' + (S.mode === v) + '" style="text-align:left;display:flex;gap:14px;align-items:center;width:100%;' + (S.mode === v ? 'border:2px solid var(--accent);background:var(--accent-soft)' : '') + '"><span style="font-size:34px" aria-hidden="true">' + e + '</span><span><b style="display:block;font-size:17px">' + t + '</b><span class="muted small">' + d + '</span></span></button>';
  return '<div class="setup stack" style="max-width:380px;margin:24px auto 0;text-align:center">' +
    '<div class="cover">🌱</div><h1>' + L('Bienvenue', 'Welcome') + '</h1>' +
    '<p class="muted">' + L('Que souhaitez-vous suivre ?', 'What would you like to follow?') + '</p>' +
    card('preg', '🌱', L('Grossesse', 'Pregnancy'), L('Semaines, rendez-vous, valise, journal', 'Weeks, appointments, bag, journal')) +
    card('baby', '🍼', L('Bébé', 'Baby'), L('Croissance, vaccins, repas, sommeil', 'Growth, vaccines, meals, sleep')) +
    '<button class="btn block" data-act="startApp" style="margin-top:6px">' + L('Commencer', 'Start') + '</button>' +
    '<button class="btn ghost block" data-act="restoreFile">' + L('Restaurer une sauvegarde', 'Restore a backup') + '</button>' +
    '<input type="file" id="rf" accept=".json,application/json" hidden></div>';
}
function setupView(m) {
  if (m === 'preg') return '<div class="setup stack"><div class="cover">🌱</div><h1>' + L('Votre grossesse', 'Your pregnancy') + '</h1><p class="muted">' + L('Indiquez une date.', 'Enter a date.') + '</p><div class="card"><label class="f"><span>' + L('Votre prénom (facultatif)', 'Your first name (optional)') + '</span><input id="s_name" maxlength="40"></label>' + lab(L('Je connais', 'I know')) + opts('kind', [['lmp', ['Le 1er jour de mes dernières règles', 'The first day of my last period']], ['dpa', ['La date prévue d’accouchement', 'My due date']]]) + '<label class="f"><span>Date</span><input type="date" id="s_date"></label><div class="err" id="err"></div><button class="btn block" data-act="setupPreg">' + L('Commencer', 'Start') + '</button></div></div>';
  return '<div class="setup stack"><div class="cover">🍼</div><h1>' + L('Le suivi de bébé', 'Baby tracking') + '</h1><p class="muted">' + L('Croissance, vaccins, repas, sommeil, éveil, photos.', 'Growth, vaccines, meals, sleep, play, photos.') + '</p><div class="card"><label class="f"><span>' + L('Prénom de bébé', 'Baby’s first name') + '</span><input id="s_name" maxlength="40"></label><label class="f"><span>' + L('Date de naissance', 'Date of birth') + '</span><input type="date" id="s_date" max="' + today() + '" value="' + (ui.prefBirth || '') + '"></label>' + lab(L('Bébé est', 'Baby is')) + opts('sex', [['F', ['Une fille', 'A girl']], ['M', ['Un garçon', 'A boy']]]) + '<div class="err" id="err"></div><button class="btn block" data-act="setupBaby">' + L('Commencer', 'Start') + '</button></div></div>';
}

/* ==================== 16. Appointments rows ==================== */
function apptRows(items, dm, list) {
  const t = today();
  return items.slice().sort((a, b) => a.d.localeCompare(b.d)).map(a => {
    const done = dm[a.id], n = diff(t, a.d);
    let chip = '';
    if (!done) chip = n < -3 ? '<span class="chip">' + L('Passé', 'Past') + '</span>' : n <= 14 ? '<span class="chip warn">' + L('Bientôt', 'Soon') + '</span>' : '';
    return '<div class="row"><button class="tick' + (done ? ' on' : '') + '" data-act="toggleAppt" data-id="' + a.id + '" aria-pressed="' + !!done + '">' + ic('check') + '</button><div class="grow"><div class="t">' + esc(a.t) + ' ' + chip + '</div><div class="muted small">' + (a.c ? L('Le ', 'On ') : L('Vers le ', 'Around ')) + fmt(a.d, { day: 'numeric', month: 'long' }) + (a.sa ? ' · ' + a.sa + L(' SA', ' wks') : '') + (a.n ? ' · ' + esc(a.n) : '') + '</div></div>' + (done ? '' : calLink(a.t, a.d)) + (a.c ? delBtn(list, a.id) : '') + '</div>';
  }).join('');
}
const remNote = () => '<p class="muted small" style="margin-top:8px">' + L('Les rappels apparaissent sur « Aujourd’hui ». Le bouton agenda ouvre Google Agenda.', 'Reminders appear on “Today”. The calendar button opens Google Calendar.') + '</p>';

/* ==================== 17. Vue Grossesse ==================== */
function prog(lab, ok, tot) {
  const p = tot ? Math.round(ok / tot * 100) : 0;
  return '<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;font-weight:600"><span>' + lab + '</span><span>' + ok + '/' + tot + ' · ' + p + ' %</span></div><div role="progressbar" aria-valuenow="' + p + '" aria-valuemin="0" aria-valuemax="100" style="height:10px;border-radius:99px;background:var(--line);overflow:hidden;margin-top:4px"><div style="height:100%;width:' + p + '%;background:var(--ok)"></div></div></div>';
}
function apptProgress() {
  const d = S.preg.appts || {}, c = APPTS.filter(a => /^c\d/.test(a.id)), e = APPTS.filter(a => /^e\d/.test(a.id)), n = l => l.filter(a => d[a.id]).length;
  let x = '';
  if (S.preg.lmp) { const sa = pI().sa, ec = c.filter(a => a.sa <= sa).length, ee = e.filter(a => a.sa <= sa).length; x = '<p class="muted small" style="margin-top:10px">' + L('À ce stade, attendues : ' + ec + ' CPN et ' + ee + ' échographie(s).', 'Expected by now: ' + ec + ' ANC visit(s) and ' + ee + ' ultrasound(s).') + '</p>'; }
  return '<div class="card soft" style="margin-bottom:12px"><h3>' + L('Suivi prénatal réalisé', 'Prenatal follow-up done') + '</h3>' + prog(L('Consultations (CPN)', 'Visits (ANC)'), n(c), c.length) + prog(L('Échographies', 'Ultrasounds'), n(e), e.length) + x + '</div>';
}
function pregHome() {
  const I = pI(), F = fruit(I.sa), p = S.preg, nx = pregItems().filter(a => !p.appts[a.id] && diff(today(), a.d) >= -7).sort((a, b) => a.d.localeCompare(b.d))[0], C = 2 * Math.PI * 96, rem = remCard();
  const who = p.name ? esc(p.name) + L(', v', ', y') : L('V', 'Y');
  const late = I.left < 0 ? '<div class="card alert"><h3>' + L('Terme dépassé', 'Past your due date') + '</h3><p>' + L('Le terme prévu est dépassé de ' + nD(-I.left) + '. Contactez votre sage-femme.', 'Your due date has passed by ' + nD(-I.left) + '. Contact your midwife.') + '</p></div>' : '';
  return '<section class="hero"><div class="ring"><svg viewBox="0 0 224 224" width="224" height="224" aria-hidden="true"><circle cx="112" cy="112" r="96" class="rt"/><circle cx="112" cy="112" r="96" class="rp' + (ui.anim ? ' anim' : '') + '" style="--c:' + C + ';stroke-dasharray:' + C + ';stroke-dashoffset:' + (C * (1 - I.pct)) + '" transform="rotate(-90 112 112)"/></svg><div class="c" aria-hidden="true">' + F.e + '</div></div>' +
    '<h1>' + nW(I.sa) + (I.j ? L(' et ', ' and ') + nD(I.j) : '') + '</h1>' +
    '<p>' + who + L('otre bébé est gros comme ', 'our baby is about the size of ') + F.n + '.</p>' +
    '<p class="fruit-note">' + F.s + L(' · valeurs moyennes', ' · average values') + '</p></section>' +
    '<div class="strip"><div><b>' + I.tri + '<small style="font-size:14px">/3</small></b><span>' + L('trimestre', 'trimester') + '</span></div><div><b>' + I.month + '<small style="font-size:14px">/9</small></b><span>' + L('mois', 'months') + '</span></div><div><b>' + (I.left >= 0 ? I.left : 0) + '</b><span>' + L('jours avant terme', 'days to due date') + '</span></div></div>' +
    late + smartCard('home') + rem +
    '<div class="card"><h3>' + L('Terme prévu', 'Due date') + '</h3><p>' + fmt(I.dpa) + '</p><p class="muted small">' + I.sa + L(' SA + ', ' wks + ') + I.j + L(' j', ' d') + '</p></div>' +
    (!rem && nx ? '<div class="card"><h3>' + L('Prochain rendez-vous', 'Next appointment') + '</h3><p><b>' + esc(nx.t) + '</b></p><p class="muted small">' + L('Vers le ', 'Around ') + fmt(nx.d) + '</p></div>' : '') +
    '<div class="card soft"><h3>' + L('Conseil du jour', 'Tip of the day') + '</h3><p>' + T(TIPS_P[dayIdx() % TIPS_P.length]) + '</p></div>' +
    (I.sa >= 37 ? '<div class="card"><h3>' + L('Bébé est arrivé ?', 'Has baby arrived?') + '</h3><p class="muted small" style="margin-bottom:10px">' + L('Passez au suivi de bébé.', 'Switch to baby tracking.') + '</p><button class="btn" data-act="born">' + L('Commencer le suivi de bébé', 'Start baby tracking') + '</button></div>' : '');
}
function pregMonths() {
  const cur = pI().month;
  return '<div class="sec-h"><h2>' + L('Mois par mois', 'Month by month') + '</h2></div>' + PM.map((m, i) => {
    const id = 'pm' + i, n = i + 1;
    return '<details class="acc" data-id="' + id + '"' + (isOpen(id, n === cur) ? ' open' : '') + '><summary><span class="mn">' + n + '</span><span><b>' + L('Mois ', 'Month ') + n + '</b><br><span class="muted small">' + T(m.sa) + '</span></span>' + (n === cur ? ' <span class="chip on">' + L('En cours', 'Current') + '</span>' : n < cur ? ' <span class="chip ok">' + L('Passé', 'Past') + '</span>' : '') + '</summary><div class="in"><div class="blk"><b>' + L('Votre bébé', 'Your baby') + '</b><p>' + T(m.b) + '</p></div><div class="blk"><b>' + L('Votre corps', 'Your body') + '</b><p>' + T(m.m) + '</p></div><div class="blk"><b>' + L('À prévoir', 'To plan') + '</b><p>' + T(m.f) + '</p></div></div></details>';
  }).join('') + '<div class="card alert" style="margin-top:14px"><h3>' + L('Consultez sans attendre en cas de', 'See a doctor right away if you have') + '</h3><ul class="l">' + PREG_ALERT.map(a => '<li>' + T(a) + '</li>').join('') + '</ul></div>';
}
function pregTrack() {
  const p = S.preg, ws = p.weights.slice().sort((a, b) => a.d.localeCompare(b.d));
  const contractions = contractionsCard();
  const pts = ws.map(w => ({ x: diff(p.lmp, w.d) / 7, y: w.kg })).filter(q => q.x >= 0 && q.x <= 42);
  let gain = '';
  if (ws.length > 1) { const g = ws[ws.length - 1].kg - ws[0].kg; gain = '<p class="muted small">' + L('Variation depuis la 1re pesée : ', 'Change since first weigh-in: ') + '<b>' + (g > 0 ? '+' : '') + f1(g) + ' kg</b></p>'; }
  return contractions + '<div class="sec-h"><h2>' + L('Poids', 'Weight') + '</h2><button class="btn sm" data-act="addWeight">' + ic('plus') + L('Peser', 'Weigh') + '</button></div>' +
    '<div class="card">' + (ws.length ? chart({ pts, xMax: 42, xStep: 6, label: L('Courbe de poids', 'Weight curve') }) + gain : empty(L('Ajoutez votre première pesée.', 'Add your first weigh-in.'))) + '</div>' +
    (ws.length ? '<div class="card" style="padding:4px 16px">' + sortD(ws).map(w => '<div class="row"><div class="grow"><div class="t">' + f1(w.kg) + ' kg</div><div class="muted small">' + fmtY(w.d) + ' · ' + Math.floor(diff(p.lmp, w.d) / 7) + L(' SA', ' wks') + '</div></div>' + delBtn('preg.weights', w.id) + '</div>').join('') + '</div>' : '') +
    smartCard('track') +
    '<div class="sec-h"><h2>' + L('Tension artérielle', 'Blood pressure') + '</h2><button class="btn sm" data-act="addBp">' + ic('plus') + L('Mesurer', 'Measure') + '</button></div>' +
    (p.bps.length ? '<div class="card" style="padding:4px 16px">' + sortD(p.bps).map(b => { const hi = b.sys >= 140 || b.dia >= 90; return '<div class="row"><div class="grow"><div class="t">' + b.sys + '/' + b.dia + ' mmHg ' + (hi ? '<span class="chip bad">' + L('À signaler', 'Report it') + '</span>' : '') + '</div><div class="muted small">' + fmtY(b.d) + '</div></div>' + delBtn('preg.bps', b.id) + '</div>'; }).join('') + '</div>' : '<div class="card">' + empty(L('Aucune mesure.', 'No readings yet.')) + '</div>') +
    '<div class="sec-h"><h2>' + L('Œdème, stress, PO', 'Edema, stress, UG') + '</h2></div>' +
    '<div class="card"><div class="opts" style="margin:0"><button class="chip" data-act="addEdema">' + L('Œdème', 'Edema') + '</button><button class="chip" data-act="addStress">' + L('Stress', 'Stress') + '</button><button class="chip" data-act="addUmb">' + L('Périmètre ombilical', 'Umbilical girth') + '</button></div>' +
    ((p.edema && p.edema.length) || (p.stress && p.stress.length) || (p.umb && p.umb.length) ? '<div style="margin-top:10px">' +
      (p.edema || []).slice().sort((a, b) => b.d.localeCompare(a.d)).slice(0, 3).map(e => '<div class="row"><div class="grow"><div class="t">' + L('Œdème', 'Edema') + ': ' + (e.v === 'oui' ? L('Oui', 'Yes') : L('Non', 'No')) + '</div><div class="muted small">' + fmtY(e.d) + '</div></div>' + delBtn('preg.edema', e.id) + '</div>').join('') +
      (p.stress || []).slice().sort((a, b) => b.d.localeCompare(a.d)).slice(0, 3).map(e => '<div class="row"><div class="grow"><div class="t">' + L('Stress', 'Stress') + ': ' + e.score + '/10</div><div class="muted small">' + fmtY(e.d) + '</div></div>' + delBtn('preg.stress', e.id) + '</div>').join('') +
      (p.umb || []).slice().sort((a, b) => b.d.localeCompare(a.d)).slice(0, 3).map(e => '<div class="row"><div class="grow"><div class="t">' + L('PO', 'UG') + ': ' + f1(e.cm) + ' cm</div><div class="muted small">' + fmtY(e.d) + '</div></div>' + delBtn('preg.umb', e.id) + '</div>').join('') + '</div>' : '') + '</div>';
}
function pregAppts() {
  const p = S.preg;
  let tot = 0, ok = 0;
  const bag = BAG.map((g, gi) => { const items = g[1].map((n, i) => { const id = 'b' + gi + '_' + i; tot++; if (p.bag[id]) ok++; return '<button class="row" data-act="toggleBag" data-id="' + id + '" aria-pressed="' + !!p.bag[id] + '"><span class="tick' + (p.bag[id] ? ' on' : '') + '">' + ic('check') + '</span><span class="grow">' + T(n) + '</span></button>'; }).join(''); return '<h3 style="margin:14px 0 2px">' + T(g[0]) + '</h3>' + items; }).join('');
  const score = tot ? Math.round(ok / tot * 100) : 0;
  const scoreChip = score >= 90 ? 'ok' : score >= 50 ? 'on' : 'warn';
  const I = pI();
  let bagAdvice = '';
  if (I.sa < 30) bagAdvice = L('Commencez la valise vers 32–34 SA.', 'Start the bag around 32–34 weeks.');
  else if (I.sa < 36) bagAdvice = L('Moment idéal pour préparer la valise.', 'Ideal time to prepare the bag.');
  else bagAdvice = L('Valise prête près de la porte, papiers et chargeur compris.', 'Bag ready by the door, papers and charger.');
  return apptProgress() + '<div class="sec-h"><h2>' + L('Rendez-vous', 'Appointments') + '</h2><button class="btn sm" data-act="addAppt">' + ic('plus') + L('Ajouter', 'Add') + '</button></div>' + smartCard('appts') + '<div class="card" style="padding:4px 16px">' + apptRows(pregItems(), p.appts, 'preg.custom') + '</div>' + remNote() +
    '<div class="sec-h"><h2>' + L('Valise de maternité', 'Hospital bag') + '</h2><span class="chip ' + scoreChip + '">' + score + '% · ' + ok + L(' sur ', ' of ') + tot + '</span></div>' +
    '<div class="card soft" style="margin-bottom:10px"><p class="small">' + bagAdvice + '</p></div>' +
    '<div class="card" style="padding:4px 16px 12px">' + bag + '</div>';
}
function storiesList() {
  let list = STORIES;
  if (S.mode === 'baby' && S.baby.birth) list = storiesForAge(bI().m).slice(0, 30);
  else if (S.mode === 'preg') { const mo = S.preg.lmp ? Math.min(9, Math.max(1, pI().month)) : 1; list = STORIES.filter(s => s.pm != null ? (s.pm <= mo && s.pm >= mo - 1) : (s.age == null && (s.tag && String(s.tag[0]).indexOf('grossesse') >= 0))).sort((a, b) => (b.pm || 0) - (a.pm || 0)); }
  if (!list.length) list = STORIES.slice(0, 5);
  return list.map(s => '<button class="card row" style="margin-top:10px;border:1px solid var(--line)" data-act="story" data-id="' + s.id + '"><span class="grow"><span class="t" style="display:block;font-family:var(--serif);font-weight:400;font-size:18px">' + esc(T(s.t)) + '</span><span class="muted small">' + T(s.tag) + ' · ' + s.min + L(' min', ' min read') + '</span></span></button>').join('');
}
function pregMore() {
  const p = S.preg, sub = ui.sub.pmore;
  let body;
  if (sub === 'stories') body = '<p class="muted small" style="margin-bottom:4px">' + L('Lire à voix haute, même avant la naissance.', 'Read aloud, even before birth.') + '</p>' + storiesList();
  else body = '<div class="sec-h"><h2>' + L('Journal de grossesse', 'Pregnancy journal') + '</h2><button class="btn sm" data-act="addJournal">' + ic('plus') + L('Écrire', 'Write') + '</button></div>' + (p.journal.length ? sortD(p.journal).map(j => '<div class="card" style="margin-top:10px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span class="muted small">' + fmt(j.d) + ' · ' + Math.max(0, Math.floor(diff(p.lmp, j.d) / 7)) + L(' SA', ' wks') + '</span>' + delBtn('preg.journal', j.id) + '</div><p><span aria-hidden="true">' + esc(j.mood) + '</span> ' + esc(j.text) + '</p></div>').join('') : '<div class="card">' + empty(L('Notez vos ressentis, vos questions.', 'Note how you feel, your questions.')) + '</div>');
  return '<div class="sec-h"><h2>' + L('Histoires et journal', 'Stories and journal') + '</h2></div>' + seg([['stories', ['Histoires', 'Stories']], ['journal', ['Journal', 'Journal']]], sub, 'pmore') + '<div style="margin-top:6px">' + body + '</div>';
}

/* ==================== 18. Vue Bébé ==================== */
function babyHome() {
  const b = S.baby, I = bI(), C = 2 * Math.PI * 96, pct = Math.min(I.m / 24, 1);
  const ms = b.measures.slice().sort((x, y) => y.d.localeCompare(x.d));
  const lastW = ms.filter(m => m.kg != null)[0], lastL = ms.filter(m => m.cm != null)[0];
  let cur = DEV[0]; DEV.forEach(d => { if (I.m >= d[0]) cur = d; });
  const got = cur[1].filter((_, i) => b.miles['m' + cur[0] + '_' + i]).length;
  const sl = sleepOn(today()), idea = IDEAS.filter(x => x.a <= Math.max(I.m, 6));
  const nm = b.name ? esc(b.name) : L('Bébé', 'Baby');
  return '<section class="hero"><div class="ring"><svg viewBox="0 0 224 224" width="224" height="224" aria-hidden="true"><circle cx="112" cy="112" r="96" class="rt"/><circle cx="112" cy="112" r="96" class="rp' + (ui.anim ? ' anim' : '') + '" style="--c:' + C + ';stroke-dasharray:' + C + ';stroke-dashoffset:' + (C * (1 - pct)) + '" transform="rotate(-90 112 112)"/></svg><div class="c num" aria-hidden="true"><span>' + (I.m < 1 ? Math.max(I.days, 0) : I.m) + '<small>' + (I.m < 1 ? L(I.days > 1 ? 'jours' : 'jour', I.days > 1 ? 'days' : 'day') : L('mois', I.m > 1 ? 'months' : 'month')) + '</small></span></div></div>' +
    '<h1>' + nm + '</h1><p>' + (I.fut ? L('La naissance est à venir.', 'The birth is still to come.') : ageText(I.m, I.d, I.days)) + '</p></section>' +
    '<div class="strip"><div><b>' + (lastW ? f1(lastW.kg) : '—') + '</b><span>' + L('kg, dernier', 'kg, last') + '</span></div><div><b>' + (lastL ? f1(lastL.cm) : '—') + '</b><span>' + L('cm, dernier', 'cm, last') + '</span></div><div><b>' + (sl ? hm(sl) : '—') + '</b><span>' + L('de sommeil', 'of sleep') + '</span></div></div>' +
    smartCard('home') + remCard() +
    '<div class="card"><h3>' + L('Repères du mois', 'Milestones') + '</h3><p class="muted small">' + got + L(' sur ', ' of ') + cur[1].length + L(' repères notés à ', ' milestones ticked at ') + nMo(cur[0]) + '</p><div style="margin-top:10px"><button class="btn ghost sm" data-act="goGrow">' + L('Voir les repères', 'See milestones') + '</button></div></div>' +
    (I.m >= 5 ? '<div class="card"><h3>' + L('Idée de repas', 'Meal idea') + '</h3><p><b>' + T(idea[dayIdx() % idea.length].t) + '</b></p><p class="muted small">' + T(idea[dayIdx() % idea.length].i) + '</p></div>' : '') +
    '<div class="card soft"><h3>' + L('Conseil du jour', 'Tip of the day') + '</h3><p>' + T(TIPS_B[dayIdx() % TIPS_B.length]) + '</p></div>' +
    '<div class="card"><h3>' + L('Noter maintenant', 'Log now') + '</h3><div class="opts" style="margin:8px 0 0"><button class="chip" data-act="addFeed">' + L('Repas', 'Feed') + '</button><button class="chip" data-act="addSleep">' + L('Sommeil', 'Sleep') + '</button><button class="chip" data-act="addMeasure">' + L('Mesure', 'Measurement') + '</button><button class="chip" data-act="addMemory">' + L('Souvenir', 'Memory') + '</button><button class="chip" data-act="addPhoto">' + L('Photo', 'Photo') + '</button><button class="chip" data-act="nightlight">🌙 ' + L('Veilleuse', 'Nightlight') + '</button></div></div>';
}
function babyGrowth() {
  const b = S.baby, I = bI(), M = METRICS[ui.metric], sx = b.sex === 'M' ? 'M' : 'F';
  const ms = b.measures.filter(m => m[M.key] != null).sort((x, y) => x.d.localeCompare(y.d));
  const pts = ms.map(m => ({ x: Math.max(0, diff(b.birth, m.d) / 30.4375), y: m[M.key] }));
  const need = Math.max(I.m + 1, pts.length ? Math.ceil(Math.max.apply(null, pts.map(p => p.x))) : 0);
  const xMax = need <= 6 ? 6 : need <= 12 ? 12 : 24;
  const xStep = xMax <= 6 ? 1 : xMax <= 12 ? 2 : 3;
  const med = []; for (let x = 0; x <= xMax; x += .5) med.push({ x, y: interp(WHO[ui.metric][sx], x) });
  const bands = [[-1.88, '3'], [-1.04, '15'], [1.04, '85'], [1.88, '97']].map(z => ({ lab: z[1], pts: med.map(p => ({ x: p.x, y: pctVal(p.y, z[0], ui.metric, p.x) })) }));
  let pctLine = '';
  const lp = pts.slice().sort((a, b) => a.x - b.x).pop();
  if (lp) { const m0 = interp(WHO[ui.metric][sx], lp.x); const z = (lp.y - m0) / (m0 * PCV(ui.metric, lp.x, lp.y > m0)); pctLine = L('Dernière mesure : environ P' + Math.round(ncdf(z) * 100) + ' (indicatif).', 'Latest measurement: about P' + Math.round(ncdf(z) * 100) + ' (rough).'); }
  return smartCard('growth') + '<div class="sec-h"><h2>' + L('Croissance', 'Growth') + '</h2><button class="btn sm" data-act="addMeasure">' + ic('plus') + L('Mesurer', 'Measure') + '</button></div>' +
    '<div class="opts" style="margin-bottom:10px">' + Object.keys(METRICS).map(k => '<button class="chip' + (ui.metric === k ? ' on' : '') + '" data-act="metric" data-v="' + k + '" aria-pressed="' + (ui.metric === k) + '">' + T(METRICS[k].label) + '</button>').join('') + '</div>' +
    '<div class="card">' + chart({ pts, med, bands, xMax, xStep, label: T(M.label) + ' (' + M.unit + ')' }) + '<div class="legend"><span><i></i>' + esc(b.name || L('Bébé', 'Baby')) + '</span><span><i class="d"></i>' + L('Médiane OMS', 'WHO median') + '</span><span>' + L('Âge : mois', 'Age: months') + '</span></div></div>' +
    '<p class="muted small" style="margin:8px 2px 0">' + pctLine + ' ' + L('Médianes OMS arrondies ; P3, P15, P85, P97 estimés. L’interprétation revient à votre pédiatre.', 'Rounded WHO medians; P3, P15, P85, P97 estimated. Interpretation is up to your pediatrician.') + '</p>' +
    '<div class="sec-h"><h2>' + L('Historique', 'History') + '</h2></div>' +
    (b.measures.length ? '<div class="card" style="padding:4px 16px">' + sortD(b.measures).map(m => '<div class="row"><div class="grow"><div class="t">' + [m.kg != null ? f1(m.kg) + ' kg' : '', m.cm != null ? f1(m.cm) + ' cm' : '', m.hc != null ? L('PC ', 'HC ') + f1(m.hc) + ' cm' : ''].filter(Boolean).join(' · ') + '</div><div class="muted small">' + fmtY(m.d) + ' · ' + ageAt(m.d) + '</div></div>' + delBtn('baby.measures', m.id) + '</div>').join('') + '</div>' : '<div class="card">' + empty(L('Aucune mesure.', 'No measurements yet.')) + '</div>');
}
function babyHealth() {
  const b = S.baby, sub = ui.sub.bhealth;
  let body;
  if (sub === 'vacc') {
    const vl = vaccList(), groups = {}, order = [];
    vl.forEach(v => { const g = T(v.grp); if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(v); });
    let done = 0; vl.forEach(v => { if (b.vacc[v.id]) done++; });
    const gh = order.map(g => '<h3 style="margin:14px 0 2px">' + esc(g) + '</h3>' + groups[g].map(v => { const st = vState(v); return '<button class="row" data-act="vaccSheet" data-id="' + v.id + '"><span class="tick' + (st.k === 'done' ? ' on' : '') + '">' + ic('check') + '</span><span class="grow"><span class="t" style="display:block">' + esc(T(v.name)) + '</span>' + (v.due && st.k !== 'later' ? '<span class="muted small">' + L('Prévu le ', 'Due ') + fmtS(v.due) + '</span>' : '') + '</span><span class="chip ' + st.c + '">' + st.l + '</span></button>'; }).join('')).join('');
    body = '<div class="sec-h"><h2>' + L('Vaccins', 'Vaccines') + '</h2><span class="chip ' + (done === vl.length ? 'ok' : 'on') + '">' + done + L(' sur ', ' of ') + vl.length + '</span></div><div class="card" style="padding:4px 16px 12px">' + gh + '<div style="margin-top:12px"><button class="btn ghost sm" data-act="addVacc">' + ic('plus') + L('Ajouter un vaccin', 'Add a vaccine') + '</button></div></div><p class="muted small" style="margin-top:8px">' + L('Calendrier type PEV. Vérifiez avec le carnet et le calendrier national.', 'Reference EPI schedule. Check with the vaccination card and national schedule.') + '</p>' + remNote();
  } else if (sub === 'appts') body = '<div class="sec-h"><h2>' + L('Rendez-vous', 'Appointments') + '</h2><button class="btn sm" data-act="addAppt">' + ic('plus') + L('Ajouter', 'Add') + '</button></div><div class="card" style="padding:4px 16px">' + apptRows(babyItems(), b.appts, 'baby.custom') + '</div>' + remNote();
  else {
    const hs = sortD(b.health);
    body = '<div class="sec-h"><h2>' + L('Journal de santé', 'Health journal') + '</h2><button class="btn sm" data-act="addHealth">' + ic('plus') + L('Noter', 'Log') + '</button></div>' +
      (hs.length ? '<div class="card" style="padding:4px 16px">' + hs.map(h => { const fev = h.type === 'Température' && h.v != null && h.v >= 38; return '<div class="row"><div class="grow"><div class="t">' + esc(typeName(HTYPES, h.type)) + (h.type === 'Température' && h.v != null ? ' ' + f1(h.v) + ' °C' : '') + (fev ? ' <span class="chip bad">' + L('Fièvre', 'Fever') + '</span>' : '') + '</div>' + (h.text ? '<div>' + esc(h.text) + '</div>' : '') + '<div class="muted small">' + fmtY(h.d) + (h.t ? L(' à ', ' at ') + h.t : '') + '</div></div>' + delBtn('baby.health', h.id) + '</div>'; }).join('') + '</div>' : '<div class="card">' + empty(L('Températures, médicaments, consultations…', 'Temperatures, medicines, visits…')) + '</div>') +
      '<div class="card alert" style="margin-top:14px"><h3>' + L('Consultez rapidement si', 'See a doctor quickly if') + '</h3><ul class="l">' + BABY_ALERT.map(a => '<li>' + T(a) + '</li>').join('') + '</ul></div>';
  }
  return '<div class="sec-h"><h2>' + L('Santé', 'Health') + '</h2></div>' + seg([['vacc', ['Vaccins', 'Vaccines']], ['appts', ['Rendez-vous', 'Visits']], ['log', ['Journal', 'Journal']]], sub, 'bhealth') + '<div style="margin-top:4px">' + body + '</div>';
}
function babyFood() {
  const b = S.baby, I = bI(), t = today(), sub = ui.sub.bfood;
  let g = FOOD[0]; FOOD.forEach(f => { if (I.m >= f.a) g = f; });
  let body;
  if (sub === 'guide') {
    body = '<div class="card soft"><h3>' + T(g.t) + L(' : ', ': ') + T(g.h) + '</h3><p>' + T(g.p) + '</p></div>' +
      '<div class="sec-h"><h2>' + L('Étapes de la diversification', 'Weaning stages') + '</h2></div>' +
      FOOD.map(f => { const id = 'fd' + f.a; return '<details class="acc" data-id="' + id + '"' + (isOpen(id, f.a === g.a) ? ' open' : '') + '><summary><span><b>' + T(f.t) + '</b><br><span class="muted small">' + T(f.h) + '</span></span>' + (f.a === g.a ? ' <span class="chip on">' + L('Âge actuel', 'Current age') + '</span>' : '') + '</summary><div class="in"><p>' + T(f.p) + '</p></div></details>'; }).join('') +
      '<div class="sec-h"><h2>' + L('L’assiette de bébé (dès 6 mois)', 'Baby’s plate (from 6 months)') + '</h2></div>' +
      '<div class="card" style="padding:4px 16px">' + PLATE.map(x => '<div class="row"><div class="grow"><div class="t">' + T(x[0]) + '</div><div class="muted small">' + T(x[1]) + '</div></div></div>').join('') + '</div>' +
      '<div class="card" style="margin-top:12px"><h3>' + L('À éviter', 'To avoid') + '</h3><ul class="l">' + FOOD_AVOID.map(a => '<li>' + T(a) + '</li>').join('') + '</ul></div>';
  } else if (sub === 'ideas') {
    body = IDEAS.map((x, i) => { const id = 'id' + i; return '<details class="acc idea' + (x.a > Math.max(I.m, 6) ? ' far' : '') + '" data-id="' + id + '"' + (isOpen(id, false) ? ' open' : '') + '><summary><span><b>' + T(x.t) + '</b><br><span class="muted small">' + L('Dès ', 'From ') + nMo(x.a) + '</span></span></summary><div class="in"><div class="blk"><b>' + L('Ingrédients', 'Ingredients') + '</b><p>' + T(x.i) + '</p></div><div class="blk"><b>' + L('Préparation', 'How to') + '</b><p>' + T(x.h) + '</p></div></div></details>'; }).join('');
  } else {
    const breastTimerCard = breastfeedingCard();
    const days = {}; b.feeds.forEach(f => { (days[f.d] = days[f.d] || []).push(f); });
    const dk = Object.keys(days).sort().reverse().slice(0, 3);
    const sum = a => { const c = {}; a.forEach(f => { c[f.type] = (c[f.type] || 0) + 1; }); return Object.keys(c).map(k => c[k] + ' ' + typeName(FEEDTYPES, k).toLowerCase()).join(', '); };
    const names = FOODS.map(f => f[0]).concat(Object.keys(b.foods).filter(k => !FOODS.some(f => f[0] === k)));
    body = breastTimerCard + '<div class="sec-h"><h2>' + L('Tétées et repas', 'Feeds and meals') + '</h2><button class="btn sm" data-act="addFeed">' + ic('plus') + L('Noter', 'Log') + '</button></div>' +
      (dk.length ? dk.map(d => '<div class="card" style="margin-bottom:10px;padding-bottom:4px"><div style="display:flex;justify-content:space-between;gap:8px"><b>' + (d === t ? L('Aujourd’hui', 'Today') : d === add(t, -1) ? L('Hier', 'Yesterday') : fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })) + '</b><span class="muted small">' + sum(days[d]) + '</span></div>' + days[d].slice().sort((x, y) => (y.t || '').localeCompare(x.t || '')).map(f => '<div class="row"><div class="grow"><span class="t">' + esc(typeName(FEEDTYPES, f.type)) + '</span> <span class="muted">' + (f.t || '') + (f.q ? ' · ' + esc(f.q) : '') + '</span></div>' + delBtn('baby.feeds', f.id) + '</div>').join('') + '</div>').join('') : '<div class="card">' + empty(L('Aucun repas noté.', 'No feeds logged.')) + '</div>') +
      '<div class="sec-h"><h2>' + L('Aliments découverts', 'Foods tried') + '</h2><span class="chip on">' + Object.keys(b.foods).length + '</span></div>' +
      '<div class="card"><div class="opts" style="margin-bottom:12px">' + names.map(n => { const on = b.foods[n]; return '<button class="chip' + (on ? ' on' : '') + '" data-act="toggleFood" data-n="' + esc(n) + '" aria-pressed="' + !!on + '">' + (on ? '✓ ' : '') + esc(foodName(n)) + '</button>'; }).join('') + '</div><button class="btn ghost sm" data-act="addFood">' + ic('plus') + L('Ajouter un aliment', 'Add a food') + '</button></div>';
  }
  return '<div class="sec-h"><h2>' + L('Alimentation', 'Feeding') + '</h2></div>' + seg([['guide', ['Guide', 'Guide']], ['ideas', ['Idées', 'Ideas']], ['log', ['Journal', 'Journal']]], sub, 'bfood') + smartCard('food') + '<div style="margin-top:6px">' + body + '</div>';
}
function babySleep() {
  const b = S.baby, I = bI(), t = today(), rec = I.m < 4 ? [14, 17] : I.m < 12 ? [12, 16] : [11, 14];
  const msg = I.m < 4 ? L('Sommeil en petits cycles, réveils fréquents : c’est normal.', 'Short cycles, frequent wake-ups: normal.') : I.m < 12 ? L('Les siestes se regroupent. Un rituel court du coucher aide.', 'Naps consolidate. A short routine helps.') : L('1 à 2 siestes par jour.', '1 to 2 naps a day.');
  const days = []; for (let i = 6; i >= 0; i--) { const d = add(t, -i); days.push({ d, l: fmt(d, { weekday: 'short' }).replace('.', ''), v: Math.round(sleepOn(d) / 6) / 10 }); }
  const ss = sortD(b.sleeps.map(x => Object.assign({}, x, { d: sEnd(x), sd: x.d })), 'd').slice(0, 8);
  return '<div class="sec-h"><h2>' + L('Sommeil', 'Sleep') + '</h2><button class="btn sm" data-act="addSleep">' + ic('plus') + L('Noter', 'Log') + '</button></div>' +
    '<div class="card soft"><h3>' + L('À ', 'At ') + nMo(Math.max(I.m, 0)) + L(' : ', ': ') + rec[0] + ' ' + L('à', 'to') + ' ' + rec[1] + ' h ' + L('par 24 h', 'per 24 h') + '</h3><p>' + msg + '</p></div>' +
    '<div class="card" style="margin-top:12px"><h3>' + L('7 derniers jours (heures)', 'Last 7 days (hours)') + '</h3>' + (b.sleeps.length ? bars(days, rec[0], L('Heures de sommeil par jour', 'Hours of sleep per day')) : empty(L('Notez un premier sommeil.', 'Log a first sleep.'))) + '</div>' +
    (ss.length ? '<div class="card" style="padding:4px 16px;margin-top:12px">' + ss.map(x => '<div class="row"><div class="grow"><div class="t">' + esc(typeName(STYPES, x.type)) + ' · ' + hm(x.m) + '</div><div class="muted small">' + fmt(x.sd, { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + x.s + ' → ' + x.e + '</div></div>' + delBtn('baby.sleeps', x.id) + '</div>').join('') + '</div>' : '') +
    '<div class="card" style="margin-top:12px"><h3>' + L('Un sommeil sûr', 'Safe sleep') + '</h3><ul class="l">' + SLEEP_SAFE.map(a => '<li>' + T(a) + '</li>').join('') + '</ul></div>';
}
function babyScreens() {
  const I = bI();
  const msg = I.m < 18 ? L('Pas d’écran, sauf les appels vidéo avec la famille.', 'No screens, except video calls with family.') : I.m < 24 ? L('Mieux vaut éviter.', 'Best avoided.') : L('Moins d’une heure par jour, toujours avec un adulte.', 'Less than one hour a day, always with an adult.');
  return '<div class="sec-h"><h2>' + L('Écrans et télévision', 'Screens and TV') + '</h2></div><div class="card soft"><h3>' + L('À ', 'At ') + nMo(I.m) + '</h3><p>' + msg + '</p></div>' +
    '<div class="card" style="margin-top:12px"><h3>' + L('Bonnes habitudes', 'Good habits') + '</h3><ul class="l">' + SCREEN_RULES.map(a => '<li>' + T(a) + '</li>').join('') + '</ul></div>' +
    '<div class="card" style="margin-top:12px"><h3>' + L('À la place', 'Instead') + '</h3><ul class="l">' + SCREEN_ALT.map(a => '<li>' + T(a) + '</li>').join('') + '</ul></div>';
}
function babyMusic() {
  return '<div class="sec-h"><h2>' + L('Musique & Berceuses', 'Music & Lullabies') + '</h2></div><p class="muted small" style="margin-bottom:12px">' + L('Sons adaptés à l’âge de bébé.', 'Sounds adapted to baby’s age.') + '</p>' +
    BABY_MUSIC.map(m => '<div class="card" style="margin-bottom:10px"><h3>' + T(m.t) + '</h3><p class="muted small" style="margin-bottom:8px">' + L('Adapté dès ', 'Adapted from ') + nMo(m.age) + '</p><p>' + T(m.desc) + '</p><div style="margin-top:10px"><button class="btn ghost sm" data-act="playMusic" data-age="' + m.age + '" data-title="' + esc(T(m.t)) + '">' + ic('music') + (AUD.on === T(m.t) ? L('Arrêter', 'Stop') : L('Écouter', 'Listen')) + '</button></div></div>').join('');
}
function babyGallery() {
  const b = S.baby;
  const photos = (b.photos || []).slice(0, 30);
  return '<div class="sec-h"><h2>' + L('Galerie photos', 'Photo gallery') + '</h2><button class="btn sm" data-act="addPhoto">' + ic('plus') + L('Ajouter', 'Add') + '</button></div>' +
    (photos.length ? '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:10px">' + photos.map(p => '<div class="card" style="padding:8px;text-align:center"><div id="ph_' + p.id + '" style="background:var(--bg);height:140px;border-radius:10px;display:grid;place-items:center;font-size:32px;overflow:hidden;margin-bottom:6px">📸</div><p style="font-weight:600;font-size:14px">' + esc(p.title || L('Souvenir', 'Memory')) + '</p><p class="muted small">' + fmtS(p.d) + '</p><button class="btn danger sm" style="margin-top:6px" data-act="delPhoto" data-id="' + p.id + '">' + L('Supprimer', 'Delete') + '</button></div>').join('') + '</div>' : empty(L('Aucune photo dans la galerie.', 'No photos in the gallery.')));
}
async function loadPhotoThumbs() {
  const b = S.baby;
  if (!b || !b.photos || !b.photos.length) return;
  for (const p of b.photos) {
    const holder = document.getElementById('ph_' + p.id);
    if (!holder) continue;
    try { const rec = await idbGet(p.id); if (rec && rec.blob) { const url = URL.createObjectURL(rec.blob); holder.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover" alt="">'; setTimeout(() => URL.revokeObjectURL(url), 30000); } } catch (e) {}
  }
}
function babyGrow() {
  const b = S.baby, I = bI(), sub = ui.sub.beveil;
  let body;
  const nav = chipsNav([['dev', ['Repères', 'Milestones']], ['sleep', ['Sommeil', 'Sleep']], ['screens', ['Écrans', 'Screens']], ['stories', ['Histoires', 'Stories']], ['mem', ['Souvenirs', 'Memories']], ['gallery', ['Galerie', 'Gallery']], ['music', ['Musique', 'Music']]], sub, 'beveil');
  if (sub === 'dev') {
    let cur = 1; DEV.forEach(d => { if (I.m >= d[0]) cur = d[0]; });
    body = '<p class="muted small" style="margin:4px 2px 0">' + L('Cochez ce que bébé sait faire.', 'Tick what baby can do.') + '</p>' + DEV.map(d => {
      const id = 'dv' + d[0], got = d[1].filter((_, i) => b.miles['m' + d[0] + '_' + i]).length;
      return '<details class="acc" data-id="' + id + '"' + (isOpen(id, d[0] === cur) ? ' open' : '') + '><summary><span class="mn">' + d[0] + '</span><span><b>' + nMo(d[0]) + '</b><br><span class="muted small">' + got + L(' sur ', ' of ') + d[1].length + L(' repères', ' milestones') + '</span></span>' + (d[0] === cur ? ' <span class="chip on">' + L('Âge actuel', 'Current age') + '</span>' : '') + '</summary><div class="in" style="padding-top:0">' + d[1].map((x, i) => { const mid = 'm' + d[0] + '_' + i, on = b.miles[mid]; return '<button class="row" data-act="toggleMile" data-id="' + mid + '" aria-pressed="' + !!on + '"><span class="tick' + (on ? ' on' : '') + '">' + ic('check') + '</span><span class="grow">' + T(x[1]) + '</span><span class="chip">' + T(CATS[x[0]]) + '</span></button>'; }).join('') + '</div></details>';
    }).join('');
  } else if (sub === 'sleep') body = babySleep();
  else if (sub === 'screens') body = babyScreens();
  else if (sub === 'stories') body = storiesList();
  else if (sub === 'gallery') body = babyGallery();
  else if (sub === 'music') body = babyMusic();
  else body = '<div class="sec-h"><h2>' + L('Souvenirs', 'Memories') + '</h2><button class="btn sm" data-act="addMemory">' + ic('plus') + L('Ajouter', 'Add') + '</button></div>' + (b.memories.length ? sortD(b.memories).map(m => '<div class="card" style="margin-top:10px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="muted small">' + fmt(m.d) + ' · ' + ageAt(m.d) + '</span>' + delBtn('baby.memories', m.id) + '</div><h3>' + esc(m.title) + '</h3>' + (m.text ? '<p>' + esc(m.text) + '</p>' : '') + '</div>').join('') : '<div class="card">' + empty(L('Premier sourire, premier mot… gardez-en la trace.', 'First smile, first word… keep a record.')) + '</div>');
  return '<div class="sec-h"><h2>' + L('Éveil & Souvenirs', 'Play & Memories') + '</h2></div>' + nav + '<div>' + body + '</div>';
}

/* ==================== 19. Vue Maman (post-partum) ==================== */
function mamaHome() {
  const I = bI();
  const pp = S.baby.postpartum || {};
  const daysSince = I.days;
  const ppWeeks = Math.floor(daysSince / 7);
  const alerts = [];
  if (pp.epds && pp.epds.score >= 13) alerts.push(L('Score EPDS élevé. Parlez-en à un professionnel sans attendre.', 'High EPDS score. Talk to a professional without delay.'));
  if (pp.epds && pp.epds.q10 >= 1) alerts.push(L('Pensées difficiles. Contactez un médecin ou une sage-femme aujourd’hui.', 'Difficult thoughts. Contact a doctor or midwife today.'));
  return alerts.map(a => '<div class="card alert" style="margin-bottom:12px"><p>' + esc(a) + '</p></div>').join('') +
    '<div class="card soft"><h3>' + L('Vous venez d’accoucher', 'You have just given birth') + '</h3><p>' + L('Il y a ' + nD(daysSince) + ' (' + ppWeeks + ' semaines).', daysSince + ' days ago (' + ppWeeks + ' weeks).') + '</p><p class="small" style="margin-top:8px">' + L('Prenez soin de vous autant que de bébé.', 'Take care of yourself as much as of baby.') + '</p></div>' +
    '<div class="sec-h"><h2>' + L('Mon moral', 'My mood') + '</h2></div>' +
    '<div class="card"><h3>' + L('Échelle d’Edimbourg (EPDS)', 'Edinburgh Scale (EPDS)') + '</h3><p class="muted small">' + L('10 questions validées OMS. Anonyme.', '10 WHO-validated questions. Anonymous.') + '</p>' +
    (pp.epds ? '<div style="margin-top:12px"><p><b>' + L('Dernier score', 'Last score') + ' : ' + pp.epds.score + '/30</b> <span class="chip ' + (pp.epds.score >= 13 ? 'bad' : pp.epds.score >= 10 ? 'warn' : 'ok') + '">' + (pp.epds.score >= 13 ? L('Consultez', 'Consult') : pp.epds.score >= 10 ? L('À surveiller', 'Monitor') : L('OK', 'OK')) + '</span></p><p class="muted small">' + fmtY(pp.epds.date) + '</p></div>' : '') +
    '<button class="btn block" style="margin-top:12px" data-act="startEpds">' + (pp.epds ? L('Refaire', 'Retake') : L('Faire le test', 'Take the test')) + '</button></div>' +
    '<div class="sec-h"><h2>' + L('Mon corps', 'My body') + '</h2></div>' +
    '<div class="card"><h3>' + L('Retour de couches', 'First postpartum period') + '</h3><p class="muted small">' + L('Généralement 6 à 8 semaines après l’accouchement.', 'Usually 6 to 8 weeks after birth.') + '</p>' +
    ((pp.periods || []).length ? pp.periods.slice(-3).reverse().map(p => '<div class="row"><div class="grow"><div class="t">' + fmtY(p.d) + '</div><div class="muted small">' + (p.heavy ? L('Abondantes', 'Heavy') : L('Normales', 'Normal')) + '</div></div>' + delBtn('baby.postpartum.periods', p.id) + '</div>').join('') : '') +
    '<button class="btn ghost sm" style="margin-top:10px" data-act="addPeriod">' + ic('plus') + L('Noter', 'Log') + '</button></div>' +
    '<div class="card" style="margin-top:12px"><h3>' + L('Rééducation périnéale', 'Perineal rehab') + '</h3><p class="small">' + L('Rendez-vous recommandé entre 6 et 8 semaines après l’accouchement.', 'Recommended appointment 6 to 8 weeks after birth.') + '</p>' +
    '<button class="row" data-act="toggleRehab" data-k="kine"><span class="tick' + (pp.rehab && pp.rehab.kine ? ' on' : '') + '">' + ic('check') + '</span><span class="grow">' + L('RDV kiné périnée pris', 'Perineal physio booked') + '</span></button>' +
    '<button class="row" data-act="toggleRehab" data-k="abdo"><span class="tick' + (pp.rehab && pp.rehab.abdo ? ' on' : '') + '">' + ic('check') + '</span><span class="grow">' + L('Rééducation abdominale commencée', 'Abdominal rehab started') + '</span></button></div>' +
    '<div class="card" style="margin-top:12px"><h3>' + L('Ma cicatrice', 'My scar') + '</h3><p class="small">' + L('Surveillez rougeur, chaleur, écoulement, douleur croissante.', 'Watch for redness, heat, discharge, increasing pain.') + '</p>' +
    ((pp.scars || []).length ? pp.scars.slice(-3).reverse().map(s => '<div class="row"><div class="grow"><div class="t">' + (s.type === 'cesa' ? L('Césarienne', 'C-section') : L('Épisiotomie', 'Episiotomy')) + '</div><div class="muted small">' + fmtY(s.d) + ' · ' + esc(s.status || '') + '</div></div>' + delBtn('baby.postpartum.scars', s.id) + '</div>').join('') : '') +
    '<button class="btn ghost sm" style="margin-top:10px" data-act="addScar">' + ic('plus') + L('Noter', 'Log') + '</button></div>' +
    '<div class="card soft" style="margin-top:16px"><h3>' + L('Vous n’êtes pas seule', 'You are not alone') + '</h3><p class="small">' + L('Si vous vous sentez dépassée, triste, vide : parlez-en. Ce n’est pas de la faiblesse, c’est du courage.', 'If you feel overwhelmed, sad, empty: talk about it. It is courage, not weakness.') + '</p></div>';
}

/* ==================== 20. Rendu ==================== */
const NAV = {
  preg: [['home', ['Aujourd’hui', 'Today'], 'home'], ['months', ['Mois', 'Months'], 'cal'], ['track', ['Suivi', 'Tracking'], 'pulse'], ['appts', ['Rendez-vous', 'Visits'], 'clip'], ['more', ['Histoires', 'Stories'], 'book']],
  baby: [['home', ['Aujourd’hui', 'Today'], 'home'], ['growth', ['Croissance', 'Growth'], 'chart'], ['health', ['Santé', 'Health'], 'shield'], ['food', ['Repas', 'Meals'], 'bottle'], ['grow', ['Éveil', 'Play'], 'sprout']],
  baby_mama: [['home', ['Aujourd’hui', 'Today'], 'home'], ['growth', ['Croissance', 'Growth'], 'chart'], ['health', ['Santé', 'Health'], 'shield'], ['food', ['Repas', 'Meals'], 'bottle'], ['grow', ['Éveil', 'Play'], 'sprout'], ['mama', ['Maman', 'Mama'], 'sprout']]
};
const BADGE = { preg: 'appts', baby: 'health' };
const VIEWS = {
  preg: { home: pregHome, months: pregMonths, track: pregTrack, appts: pregAppts, more: pregMore },
  baby: { home: babyHome, growth: babyGrowth, health: babyHealth, food: babyFood, grow: babyGrow, mama: mamaHome }
};
function onboardView() {
  return '<div class="setup stack" style="max-width:400px;margin:20px auto"><div class="cover" style="text-align:center">🌱</div><h1 style="text-align:center">' + L('Bienvenue', 'Welcome') + '</h1>' +
    '<div class="card"><h3>1. ' + L('Vos données restent ici', 'Your data stays here') + '</h3><p class="muted small">' + L('Aucun serveur, chiffrement AES-256 par votre mot de passe.', 'No server, AES-256 encryption with your password.') + '</p></div>' +
    '<div class="card"><h3>2. ' + L('Deux modes', 'Two modes') + '</h3><p class="muted small">' + L('Grossesse puis Bébé (0–24 mois).', 'Pregnancy then Baby (0–24 months).') + '</p></div>' +
    '<div class="card"><h3>3. ' + L('Aura Conseils', 'Aura Guidance') + '</h3><p class="muted small">' + L('Conseils contextuels — pas un diagnostic médical.', 'Contextual tips — not a medical diagnosis.') + '</p></div>' +
    '<button class="btn block" data-act="finishOnboard">' + L('Commencer', 'Get started') + '</button></div>';
}
function backupBanner() {
  if (ui.hideBackup) return '';
  const lb = S.lastBackup;
  let late = false;
  if (lb) late = diff(lb, today()) >= 14;
  else late = !!(AUTH && AUTH.created && diff(AUTH.created, today()) >= 7);
  if (!late) return '';
  return '<div class="card soft" style="margin-bottom:12px"><h3>' + L('Pensez à sauvegarder', 'Time to back up') + '</h3><p class="small">' + (lb ? L('Dernière sauvegarde : ', 'Last backup: ') + fmtY(lb) : L('Vous n’avez encore jamais sauvegardé.', 'You have never backed up yet.')) + '</p><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sm" data-act="backupFile">' + L('Sauvegarder', 'Back up') + '</button><button class="btn ghost sm" data-act="hideBackup">' + L('Plus tard', 'Later') + '</button></div></div>';
}
function render() {
  const m = S.mode;
  document.documentElement.dataset.mode = m;
  document.documentElement.lang = lang;
  if (S.theme) document.documentElement.setAttribute('data-theme', S.theme);
  else document.documentElement.removeAttribute('data-theme');
  const modeColor = m === 'preg' ? (S.colorPreg || S.colorTheme || '') : (S.colorBaby || S.colorTheme || '');
  if (modeColor) { document.documentElement.style.setProperty('--accent', modeColor); document.documentElement.style.setProperty('--accent-text', modeColor); }
  else { document.documentElement.style.removeProperty('--accent'); document.documentElement.style.removeProperty('--accent-text'); }
  document.title = L('Aura Bébé — grossesse et bébé', 'Aura Bébé — pregnancy and baby');
  $('#gear').setAttribute('aria-label', L('Paramètres', 'Settings'));
  document.querySelectorAll('#modeSeg button').forEach(b => { b.textContent = b.dataset.v === 'preg' ? L('Grossesse', 'Pregnancy') : L('Bébé', 'Baby'); b.setAttribute('aria-pressed', String(b.dataset.v === m)); });
  const nav = $('#nav');
  if (S.fontFamily) document.body.style.fontFamily = S.fontFamily; else document.body.style.fontFamily = '';
  if (S.fs) document.documentElement.style.fontSize = (S.fs / 16 * 100) + '%';
  const sosBtn = $('#sosBtn'), nlBtn = $('#nightlightBtn');
  if (!unlocked) {
    $('#view').innerHTML = authView();
    nav.innerHTML = ''; nav.hidden = true;
    $('#gear').style.display = 'none';
    if (sosBtn) sosBtn.style.display = 'none';
    if (nlBtn) nlBtn.style.display = 'none';
    const modeSeg = $('#modeSeg'); if (modeSeg) modeSeg.style.display = 'none';
    return;
  }
  $('#gear').style.display = '';
  if (sosBtn) sosBtn.style.display = '';
  if (nlBtn) nlBtn.style.display = '';
  const modeSeg = $('#modeSeg'); if (modeSeg) modeSeg.style.display = '';
  if (!S.onboarded) { $('#view').innerHTML = onboardView(); nav.innerHTML = ''; nav.hidden = true; return; }
  if (!S.preg.lmp && !S.baby.birth && !S.started) { if (modeSeg) modeSeg.style.display = 'none'; $('#view').innerHTML = welcomeView(); nav.innerHTML = ''; nav.hidden = true; return; }
  const ready = m === 'preg' ? S.preg.lmp : S.baby.birth;
  if (!ready) { $('#view').innerHTML = setupView(m); nav.innerHTML = ''; nav.hidden = true; return; }
  nav.hidden = false;
  const showMama = m === 'baby' && S.baby.birth && bI().m < 6 && !bI().fut;
  const navKey = showMama ? 'baby_mama' : m;
  const navDef = NAV[navKey];
  nav.classList.toggle('six', navDef.length === 6);
  const cur = ui.tab[m] || 'home';
  const rc = reminders().length;
  nav.innerHTML = '<div class="in">' + navDef.map(n => '<button data-act="tab" data-k="' + n[0] + '" aria-current="' + (cur === n[0]) + '">' + ic(n[2]) + '<span>' + T(n[1]) + '</span>' + (rc && BADGE[m] === n[0] ? '<i class="bdg" aria-hidden="true"></i>' : '') + '</button>').join('') + '</div>';
  const view = VIEWS[m][cur] || VIEWS[m].home;
  $('#view').innerHTML = (cur === 'home' ? backupBanner() : '') + view();
  if (cur === 'grow' && ui.sub.beveil === 'gallery') loadPhotoThumbs();
  ui.anim = false;
}

/* ==================== 21. Paramètres ==================== */
function quotaBar() {
  const used = Math.round(JSON.stringify(S).length * 2 / 1024), max = 4500, pct = Math.min(100, Math.round(used / max * 100));
  const cls = pct >= 90 ? 'bad' : pct >= 75 ? 'warn' : '';
  return '<p class="small">' + L('Espace : ', 'Storage: ') + '<b>' + used + ' Ko</b> / ~' + max + ' Ko</p><div class="quota-bar ' + cls + '"><i style="width:' + pct + '%"></i></div>' + (pct >= 75 ? '<p class="small" style="color:var(--warn);margin-top:6px">' + L('Pensez à sauvegarder et supprimer d’anciennes photos.', 'Back up and delete old photos.') + '</p>' : '');
}
function settingsSheet() {
  const m = S.mode; let f;
  if (m === 'preg') f = '<label class="f"><span>' + L('Prénom', 'First name') + '</span><input id="e_name" value="' + esc(S.preg.name) + '" maxlength="40"></label><label class="f"><span>' + L('1er jour des dernières règles', 'First day of last period') + '</span><input type="date" id="e_date" value="' + S.preg.lmp + '"></label>';
  else f = '<label class="f"><span>' + L('Prénom de bébé', 'Baby’s first name') + '</span><input id="e_name" value="' + esc(S.baby.name) + '" maxlength="40"></label><label class="f"><span>' + L('Date de naissance', 'Date of birth') + '</span><input type="date" id="e_date" value="' + S.baby.birth + '" max="' + today() + '"></label>' + opts('esex', [['F', ['Fille', 'Girl']], ['M', ['Garçon', 'Boy']]], S.baby.sex || 'F');
  sheet(L('Paramètres', 'Settings'), '<div class="stack">' +
    '<h3>' + L('Langue', 'Language') + '</h3><div class="opts"><button class="chip' + (lang === 'fr' ? ' on' : '') + '" data-act="lang">FR</button><button class="chip' + (lang === 'en' ? ' on' : '') + '" data-act="lang">EN</button></div>' +
    '<h3 style="margin-top:18px">' + L('Apparence', 'Appearance') + '</h3>' +
    '<label class="f"><span>' + L('Thème', 'Theme') + '</span><select id="e_theme"><option value=""' + (S.theme === '' ? ' selected' : '') + '>' + L('Système', 'System') + '</option><option value="light"' + (S.theme === 'light' ? ' selected' : '') + '>' + L('Clair', 'Light') + '</option><option value="dark"' + (S.theme === 'dark' ? ' selected' : '') + '>' + L('Sombre', 'Dark') + '</option></select></label>' +
    '<label class="f"><span>' + L('Police', 'Font') + '</span><select id="e_font">' + [['', ['Système (défaut)', 'System (default)']], ['Georgia, Times New Roman, serif', ['Serif classique', 'Classic serif']], ['ui-monospace, Menlo, Consolas, monospace', ['Mono', 'Mono']]].map(o => '<option value="' + o[0] + '"' + (S.fontFamily === o[0] ? ' selected' : '') + '>' + T(o[1]) + '</option>').join('') + '</select></label>' +
    '<label class="f"><span>' + L('Taille du texte', 'Text size') + '</span><select id="e_fs">' + [16, 18, 20, 22, 24].map(n => '<option value="' + n + '"' + ((S.fs || 20) === n ? ' selected' : '') + '>' + n + ' px</option>').join('') + '</select></label>' +
    '<label class="f"><span>' + L('Couleur Grossesse', 'Pregnancy color') + '</span><input type="color" id="e_color_preg" value="' + (S.colorPreg || S.colorTheme || '#C93F5B') + '" style="height:40px;padding:2px"></label>' +
    '<label class="f"><span>' + L('Couleur Bébé', 'Baby color') + '</span><input type="color" id="e_color_baby" value="' + (S.colorBaby || '#E3A21A') + '" style="height:40px;padding:2px"></label>' +
    '<h3 style="margin-top:18px">' + (m === 'preg' ? L('Ma grossesse', 'My pregnancy') : L('Mon bébé', 'My baby')) + '</h3>' + f +
    '<label class="f"><span>' + L('Rappels : afficher à l’avance', 'Reminders: show in advance') + '</span><select id="e_lead">' + [3, 7, 14, 30].map(n => '<option value="' + n + '"' + ((S.lead || 7) === n ? ' selected' : '') + '>' + nD(n) + '</option>').join('') + '</select></label>' +
    '<div class="err" id="err"></div><button class="btn block" data-act="saveSettings">' + L('Enregistrer', 'Save') + '</button>' +
    '<h3 style="margin-top:22px">' + L('Sécurité locale', 'Local security') + '</h3>' +
    '<p class="muted small">' + L('Identifiant : ', 'Login: ') + '<b>' + esc(AUTH ? AUTH.login : '') + '</b></p>' +
    '<p class="muted small">' + L('Chiffrement : AES-256-GCM · PBKDF2 200 000 itérations', 'Encryption: AES-256-GCM · PBKDF2 200,000 iterations') + '</p>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 14px"><button class="btn ghost sm" data-act="lockNow">' + L('Verrouiller', 'Lock') + '</button><button class="btn ghost sm" data-act="changePass">' + L('Changer le mot de passe', 'Change password') + '</button></div>' +
    '<h3 style="margin-top:18px">' + L('Outils', 'Tools') + '</h3>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><button class="btn ghost sm" data-act="consultation">' + L('Fiche consultation', 'Consultation sheet') + '</button><button class="btn ghost sm" data-act="nightlight">' + L('Veilleuse', 'Nightlight') + '</button><button class="btn ghost sm" data-act="emergency">' + L('Kit urgence', 'Emergency kit') + '</button></div>' +
    '<h3 style="margin-top:18px">' + L('Confidentialité & légal', 'Privacy & legal') + '</h3>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-act="showPrivacy">' + L('Confidentialité', 'Privacy') + '</button><button class="btn ghost sm" data-act="showPerms">' + L('Autorisations', 'Permissions') + '</button><button class="btn ghost sm" data-act="shareApp">' + L('Partager', 'Share') + '</button><button class="btn ghost sm" data-act="sendFeedback">' + L('Commentaires', 'Feedback') + '</button></div>' +
    '<h3 style="margin-top:18px">' + L('Mes données', 'My data') + '</h3>' + quotaBar() +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn sm" data-act="backupFile">' + L('Sauvegarder', 'Back up') + '</button><button class="btn ghost sm" data-act="restoreFile">' + L('Restaurer', 'Restore') + '</button></div>' +
    '<p class="muted small" style="margin:8px 0 12px">' + (S.lastBackup ? L('Dernière sauvegarde : ', 'Last backup: ') + fmtY(S.lastBackup) : L('Aucune sauvegarde.', 'No backup yet.')) + '</p>' +
    '<input type="file" id="rf" accept=".json,application/json" hidden>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-act="exportData">' + L('Exporter', 'Export') + '</button><button class="btn ghost sm" data-act="importSheet">' + L('Importer', 'Import') + '</button></div><div id="io"></div>' +
    '<div style="margin-top:18px"><button class="btn danger sm" data-act="wipeAll">' + L('Tout effacer', 'Erase everything') + '</button></div>' +
    '<p class="muted small" style="margin-top:16px">' + L('Cette application ne remplace pas un avis médical.', 'This app does not replace medical advice.') + '</p></div>');
}

/* ==================== 22. Actions ==================== */
const ACT = {
  close() { closeSheet(); },
  async doCreateAuth() {
    const login = val('a_login'), p1 = val('a_pass'), p2 = val('a_pass2'), e = $('#err');
    if (!login || login.length < 3) { e.textContent = L('Identifiant trop court.', 'Login too short.'); return; }
    if (!p1 || p1.length < 8) { e.textContent = L('Mot de passe trop court (min. 8).', 'Password too short (min. 8).'); return; }
    if (p1 !== p2) { e.textContent = L('Les mots de passe ne correspondent pas.', 'Passwords do not match.'); return; }
    e.textContent = L('Chiffrement…', 'Encrypting…');
    try {
      const err = await createAuth(login, p1, '');
      if (err) { e.textContent = err; return; }
      S = defaults(); S.lang = lang;
      await saveSecure(); failReset();
      S.onboarded = false;
      await saveSecure();
      render();
      toast(L('Accès créé. Vos données sont chiffrées.', 'Access created. Your data is encrypted.'), 'ok');
    } catch (x) { e.textContent = L('Erreur technique.', 'Technical error.'); console.error(x); }
  },
  async doUnlock() {
    const p = val('a_pass'), e = $('#err');
    if (failRemaining() > 0) { e.textContent = L('Patientez avant de réessayer.', 'Wait before trying again.'); return; }
    if (!p) { e.textContent = L('Entrez votre mot de passe.', 'Enter your password.'); return; }
    e.textContent = L('Vérification…', 'Checking…');
    const ok = await verifyAuth(p);
    if (!ok) { const s = failRecord(); e.textContent = s.seconds > 0 ? L('Trop de tentatives. Réessayez dans ' + Math.ceil(s.seconds / 60) + ' min.', 'Too many attempts. Try again in ' + Math.ceil(s.seconds / 60) + ' min.') : L('Mot de passe incorrect (' + s.n + ').', 'Incorrect password (' + s.n + ').'); return; }
    failReset(); unlocked = true;
    const loaded = await loadSecure();
    S = loaded || defaults();
    S.lang = lang = S.lang || lang;
    render();
  },
  lockNow() { cryptoKey = null; unlocked = false; S = null; closeSheet(); render(); },
  async wipeAll() {
    const ok = await modal({ title: L('Tout effacer ?', 'Erase everything?'), body: L('Cette action supprime définitivement les données locales ET le mot de passe.', 'This permanently deletes local data AND the password.'), ok: L('Effacer', 'Erase'), danger: true });
    if (!ok) return;
    const confirm2 = await modal({ title: L('Confirmer', 'Confirm'), body: L('Cette action est définitive.', 'This cannot be undone.'), ok: L('Confirmer', 'Confirm'), danger: true });
    if (!confirm2) return;
    try { indexedDB.deleteDatabase(IDB_NAME); } catch (e) {}
    ['aura-bebe-v1', 'aura-bebe-v2', AUTH_KEY, DATA_KEY, FAIL_KEY].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
    cryptoKey = null; AUTH = null; unlocked = false; S = defaults();
    failReset(); closeSheet(); render();
    toast(L('Toutes les données ont été effacées.', 'All data has been erased.'), 'ok');
  },
  showRecover() {
    sheet(L('Mot de passe oublié', 'Forgot password'),
      '<p>' + L('Le mot de passe chiffre vos données. Sans lui, elles sont illisibles.', 'Your password encrypts your data. Without it, data cannot be read.') + '</p>' +
      '<p class="muted small" style="margin-top:10px">' + L('Si vous avez une sauvegarde, vous pouvez effacer l’accès puis restaurer.', 'If you have a backup, erase the access then restore.') + '</p>' +
      '<button class="btn danger block" style="margin-top:14px" data-act="wipeAll">' + L('Effacer et recommencer', 'Erase and start over') + '</button>');
  },
  changePass() {
    sheet(L('Changer le mot de passe', 'Change password'),
      '<label class="f"><span>' + L('Mot de passe actuel', 'Current password') + '</span><input type="password" id="cp_old" maxlength="128"></label>' +
      '<label class="f"><span>' + L('Nouveau (min. 8)', 'New (min. 8)') + '</span><input type="password" id="cp_new" maxlength="128"></label>' +
      '<label class="f"><span>' + L('Confirmer', 'Confirm') + '</span><input type="password" id="cp_new2" maxlength="128"></label>' +
      '<div class="err" id="err"></div><button class="btn block" data-act="saveNewPass">' + L('Enregistrer', 'Save') + '</button>');
  },
  async saveNewPass() {
    const oldp = val('cp_old'), n1 = val('cp_new'), n2 = val('cp_new2'), e = $('#err');
    if (n1 !== n2) { e.textContent = L('Les mots de passe ne correspondent pas.', 'Passwords do not match.'); return; }
    if (n1.length < 8) { e.textContent = L('Mot de passe trop court.', 'Password too short.'); return; }
    const ok = await verifyAuth(oldp);
    if (!ok) { e.textContent = L('Mot de passe actuel incorrect.', 'Current password is incorrect.'); return; }
    const login = AUTH.login, q = AUTH.q;
    await createAuth(login, n1, '', q);
    await saveSecure();
    closeSheet();
    toast(L('Mot de passe mis à jour.', 'Password updated.'), 'ok');
  },
  showPrivacy() {
    sheet(L('Confidentialité', 'Privacy'),
      '<div class="reader"><p>' + L('Vos données sont chiffrées localement avec AES-256-GCM. La clé est dérivée de votre mot de passe (PBKDF2-SHA256, 200 000 itérations). Elle ne quitte jamais la mémoire.', 'Your data is encrypted locally with AES-256-GCM. The key is derived from your password (PBKDF2-SHA256, 200,000 iterations). It never leaves memory.') + '</p>' +
      '<p>' + L('Aucun serveur, aucune synchronisation, aucune publicité. Les photos sont stockées dans IndexedDB sous forme de Blob compressé.', 'No server, no sync, no ads. Photos are stored in IndexedDB as compressed Blobs.') + '</p>' +
      '<p>' + L('Une page web ne peut pas garantir à 100 % l’effacement mémoire. Pour aller plus loin, utilisez un appareil dédié ou un navigateur en mode privé.', 'A web page cannot guarantee 100% memory erasure. For stronger guarantees, use a dedicated device or a private browser window.') + '</p>' +
      '<p class="muted small">' + L('Cette application ne remplace pas un avis médical.', 'This app does not replace medical advice.') + '</p></div>');
  },
  showPerms() {
    sheet(L('Autorisations', 'Permissions'),
      '<ul class="l"><li>' + L('Stockage local : sauvegarder vos données chiffrées.', 'Local storage: save your encrypted data.') + '</li>' +
      '<li>' + L('IndexedDB : stocker les photos en Blob.', 'IndexedDB: store photos as Blob.') + '</li>' +
      '<li>' + L('Photos (optionnel) : uniquement lors de l’ajout à la galerie.', 'Photos (optional): only when adding to the gallery.') + '</li>' +
      '<li>' + L('Aucun accès micro, caméra, localisation, contacts.', 'No microphone, camera, location, contacts access.') + '</li>' +
      '<li>' + L('Aucun envoi réseau par l’application.', 'No network requests by the app.') + '</li></ul>');
  },
  shareApp() {
    const text = L('Aura Bébé — suivi grossesse et bébé, chiffré et 100 % local.', 'Aura Bébé — pregnancy and baby tracking, encrypted and 100% local.');
    if (navigator.share) navigator.share({ title: 'Aura Bébé', text }).catch(() => {});
    else { navigator.clipboard?.writeText(text); toast(L('Texte copié.', 'Text copied.'), 'ok'); }
  },
  sendFeedback() {
    sheet(L('Commentaires', 'Feedback'),
      '<label class="f"><span>' + L('Votre message', 'Your message') + '</span><textarea id="fb_t" maxlength="800"></textarea></label>' +
      '<button class="btn block" data-act="copyFeedback">' + L('Copier', 'Copy') + '</button>');
  },
  copyFeedback() { const t = val('fb_t'); if (!t) return; navigator.clipboard?.writeText(t); toast(L('Copié !', 'Copied!'), 'ok'); },
  lang() { lang = lang === 'fr' ? 'en' : 'fr'; S.lang = lang; save(); closeSheet(); render(); },
  finishOnboard() { S.onboarded = true; save(); render(); },
  pickMode(d) { S.mode = d.v; save(); render(); },
  startApp() { S.started = true; save(); render(); window.scrollTo(0, 0); },
  mode(d) { S.mode = d.v; ui.anim = true; save(); render(); window.scrollTo(0, 0); },
  tab(d) { ui.tab[S.mode] = d.k; if (d.k === 'home') ui.anim = true; render(); window.scrollTo(0, 0); },
  sub(d) { ui.sub[d.k] = d.v; render(); },
  metric(d) { ui.metric = d.v; render(); },
  settings() { settingsSheet(); },
  goGrow() { ui.tab.baby = 'grow'; ui.sub.beveil = 'dev'; render(); window.scrollTo(0, 0); },
  born() { ui.prefBirth = today(); S.mode = 'baby'; ui.anim = true; save(); render(); window.scrollTo(0, 0); },
  setupPreg() {
    const v = val('s_date'), k = radio('kind'), e = $('#err');
    if (!v) { e.textContent = L('Choisissez une date.', 'Choose a date.'); return; }
    const lmp = k === 'dpa' ? add(v, -280) : v, n = diff(lmp, today());
    if (n < 0 || n > 301) { e.textContent = L('Date hors grossesse.', 'Date out of range.'); return; }
    S.preg.lmp = lmp; S.preg.name = val('s_name').slice(0, 40);
    ui.anim = true; save(); render();
  },
  setupBaby() {
    const v = val('s_date'), e = $('#err'), sx = radio('sex');
    if (!v) { e.textContent = L('Indiquez la date.', 'Enter the date.'); return; }
    const n = diff(v, today());
    if (n < 0) { e.textContent = L('Pas dans le futur.', 'Not in the future.'); return; }
    if (n > 1100) { e.textContent = L('Couvre 3 ans max.', 'Covers 3 years max.'); return; }
    S.baby.birth = v; S.baby.name = val('s_name').slice(0, 40); S.baby.sex = sx || 'F';
    ui.anim = true; save(); render();
  },
  saveSettings() {
    const v = val('e_date'), e = $('#err');
    if (!v) { e.textContent = L('Indiquez une date.', 'Enter a date.'); return; }
    if (S.mode === 'preg') { const n = diff(v, today()); if (n < 0 || n > 301) { e.textContent = L('Date hors grossesse.', 'Date out of range.'); return; } S.preg.lmp = v; S.preg.name = val('e_name').slice(0, 40); }
    else { if (diff(v, today()) < 0) { e.textContent = L('Pas dans le futur.', 'Not in the future.'); return; } S.baby.birth = v; S.baby.name = val('e_name').slice(0, 40); S.baby.sex = radio('esex') || S.baby.sex || 'F'; }
    S.lead = parseInt(val('e_lead'), 10) || 7;
    S.colorPreg = val('e_color_preg'); S.colorBaby = val('e_color_baby');
    S.colorTheme = S.colorPreg;
    S.theme = val('e_theme');
    S.fontFamily = val('e_font'); S.fs = parseInt(val('e_fs'), 10) || 20;
    save(); closeSheet(); render();
  },
  async backupFile() {
    const name = 'aura-bebe-sauvegarde-' + today() + '.json';
    const payload = { app: 'aura-bebe', v: 3.1, date: today(), data: S, photos: [] };
    try {
      const db = await idb();
      const photos = await new Promise((res, rej) => { const tx = db.transaction(IDB_STORE, 'readonly'); const q = tx.objectStore(IDB_STORE).getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); });
      for (const p of photos) { const buf = await p.blob.arrayBuffer(); payload.photos.push({ id: p.id, title: p.title, d: p.d, data: b64e(new Uint8Array(buf)), type: p.blob.type }); }
    } catch (e) {}
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    const done = () => { S.lastBackup = today(); save(); render(); toast(L('Sauvegarde enregistrée.', 'Backup saved.'), 'ok'); };
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Aura Bébé' }); done(); return; } catch (e) {} }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    done();
  },
  restoreFile() { const i = document.getElementById('rf'); if (i) i.click(); else { const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.onchange = () => handleRestoreFile(input.files[0]); input.click(); } },
  hideBackup() { ui.hideBackup = true; render(); },
  exportData() { const el = document.getElementById('io'); if (!el) return; el.innerHTML = '<textarea class="mono" id="io_t" readonly style="margin-top:10px"></textarea>'; const t = document.getElementById('io_t'); t.value = JSON.stringify(S, null, 2); },
  importSheet() { const el = document.getElementById('io'); if (!el) return; el.innerHTML = '<textarea class="mono" id="io_t" placeholder="' + L('Collez les données exportées', 'Paste exported data') + '" style="margin-top:10px"></textarea><div class="err" id="io_e"></div><button class="btn sm" data-act="importGo">' + L('Importer', 'Import') + '</button>'; },
  async importGo() {
    const v = document.getElementById('io_t').value;
    try {
      const parsed = JSON.parse(v);
      const r = parsed.app === 'aura-bebe' && parsed.data ? parsed.data : parsed;
      if (!r || !r.preg || !r.baby) throw 0;
      S = normalizeData(r);
      await saveSecure();
      closeSheet(); render();
      toast(L('Données importées.', 'Data imported.'), 'ok');
    } catch { const e = document.getElementById('io_e'); if (e) e.textContent = L('Données invalides.', 'Invalid data.'); }
  },
  del(d) { const a = d.list.split('.'); let obj = S; for (let i = 0; i < a.length - 1; i++) obj = obj[a[i]]; const last = a[a.length - 1]; obj[last] = obj[last].filter(x => x.id !== d.id); save(); render(); },
  async delPhoto(d) {
    const ok = await modal({ title: L('Supprimer cette photo ?', 'Delete this photo?'), body: L('Action définitive.', 'This cannot be undone.'), ok: L('Supprimer', 'Delete'), danger: true });
    if (!ok) return;
    try { await idbDel(d.id); } catch (e) {}
    S.baby.photos = (S.baby.photos || []).filter(p => p.id !== d.id);
    save(); render();
  },
  story(d) { openStory(d.id); },
  fs(d) { S.fs = Math.min(30, Math.max(16, S.fs + Number(d.v))); save(); openStory(ui.story); },
  playMusic(d) { if (AUD.on === d.title) audStop(); else audPlay(Number(d.age), d.title); render(); },
  smartMore(d) {
    const sec = (d && d.sec) || 'home';
    const tips = smartInsights(sec).concat((S.mode === 'preg' ? TIPS_P : TIPS_B).map(T));
    sheet(L('Aura Conseils', 'Aura Guidance'), '<p class="muted small" style="margin-bottom:12px">' + L('Conseils générés localement à partir de vos données.', 'Tips generated locally from your data.') + '</p>' + tips.slice(0, 10).map(t => '<div class="card" style="margin-bottom:8px"><p>' + esc(t) + '</p></div>').join(''));
  },
  toggleAppt(d) { const m = doneMap(); if (m[d.id]) delete m[d.id]; else m[d.id] = true; save(); render(); },
  addAppt() { sheet(L('Nouveau rendez-vous', 'New appointment'), '<label class="f"><span>' + L('Intitulé', 'Title') + '</span><input id="a_t" maxlength="80" placeholder="' + L('Échographie, pédiatre…', 'Ultrasound, pediatrician…') + '"></label>' + dateField('a_d', today()) + '<label class="f"><span>' + L('Note (facultatif)', 'Note (optional)') + '</span><input id="a_n" maxlength="120"></label><div class="err" id="err"></div><button class="btn block" data-act="saveAppt">' + L('Enregistrer', 'Save') + '</button>'); },
  saveAppt() { const t = val('a_t'); if (!t) { $('#err').textContent = L('Intitulé requis.', 'Title required.'); return; } S[S.mode].custom.push({ id: uid(), t: t.slice(0, 80), d: val('a_d') || today(), n: val('a_n').slice(0, 120) }); save(); closeSheet(); render(); },
  addWeight() { sheet(L('Nouvelle pesée', 'New weigh-in'), dateField('w_d', today(), today()) + '<label class="f"><span>' + L('Poids (kg)', 'Weight (kg)') + '</span><input id="w_v" inputmode="decimal" placeholder="68.4"></label><div class="err" id="err"></div><button class="btn block" data-act="saveWeight">' + L('Enregistrer', 'Save') + '</button>'); },
  saveWeight() { const kg = num(val('w_v')); if (kg == null || kg < 25 || kg > 250) { $('#err').textContent = L('Poids en kg, ex 68,4.', 'Weight in kg, e.g. 68.4.'); return; } S.preg.weights.push({ id: uid(), d: val('w_d') || today(), kg }); save(); closeSheet(); render(); },
  addBp() { sheet(L('Tension artérielle', 'Blood pressure'), dateField('b_d', today(), today()) + '<div class="two"><label class="f"><span>' + L('Systolique', 'Systolic') + '</span><input id="b_s" inputmode="numeric" placeholder="120"></label><label class="f"><span>' + L('Diastolique', 'Diastolic') + '</span><input id="b_c" inputmode="numeric" placeholder="80"></label></div><div class="err" id="err"></div><button class="btn block" data-act="saveBp">' + L('Enregistrer', 'Save') + '</button>'); },
  saveBp() { const s = num(val('b_s')), c = num(val('b_c')); if (!s || !c || s < 60 || s > 260 || c < 30 || c > 160) { $('#err').textContent = L('Deux valeurs, ex 120 et 80.', 'Two values, e.g. 120 and 80.'); return; } S.preg.bps.push({ id: uid(), d: val('b_d') || today(), sys: Math.round(s), dia: Math.round(c) }); save(); closeSheet(); render(); },
  toggleBag(d) { if (S.preg.bag[d.id]) delete S.preg.bag[d.id]; else S.preg.bag[d.id] = true; save(); render(); },
  addJournal() { sheet(L('Journal', 'Journal'), lab(L('Aujourd’hui je me sens', 'Today I feel')) + opts('mood', MOODS.map(m => [m[0], m[0] + ' ' + T(m[1])])) + '<label class="f"><span>' + L('Mes mots', 'My words') + '</span><textarea id="j_t" maxlength="800"></textarea></label>' + dateField('j_d', today(), today()) + '<div class="err" id="err"></div><button class="btn block" data-act="saveJournal">' + L('Enregistrer', 'Save') + '</button>'); },
  saveJournal() { const t = val('j_t'); if (!t) { $('#err').textContent = L('Écrivez quelques mots.', 'Write a few words.'); return; } S.preg.journal.push({ id: uid(), d: val('j_d') || today(), mood: radio('mood') || '😊', text: t.slice(0, 800) }); save(); closeSheet(); render(); },
  addEdema() { sheet(L('Œdème', 'Edema'), dateField('ed_d', today(), today()) + opts('ed_v', [['oui', ['Oui', 'Yes']], ['non', ['Non', 'No']]]) + '<button class="btn block" data-act="saveEdema">' + L('Enregistrer', 'Save') + '</button>'); },
  saveEdema() { const v = radio('ed_v') || 'non'; S.preg.edema = S.preg.edema || []; S.preg.edema.push({ id: uid(), d: val('ed_d') || today(), v }); save(); closeSheet(); render(); if (v === 'oui') toast(L('Œdème noté. Surveillez maux de tête et vision.', 'Edema noted. Watch headaches and vision.'), 'warn', 5000); },
  addStress() { sheet(L('Niveau de stress', 'Stress level'), dateField('st_d', today(), today()) + '<label class="f"><span>' + L('Score 0 (aucun) à 10 (très élevé)', 'Score 0 (none) to 10 (very high)') + '</span><input type="number" id="st_s" min="0" max="10" value="5"></label><button class="btn block" data-act="saveStress">' + L('Enregistrer', 'Save') + '</button>'); },
  saveStress() { const s = parseInt(val('st_s'), 10); if (isNaN(s) || s < 0 || s > 10) return; S.preg.stress = S.preg.stress || []; S.preg.stress.push({ id: uid(), d: val('st_d') || today(), score: s }); save(); closeSheet(); render(); if (s >= 7) toast(L('Stress élevé (' + s + '/10).', 'High stress (' + s + '/10).'), 'warn', 5000); },
  addUmb() { sheet(L('Périmètre ombilical', 'Umbilical girth'), dateField('um_d', today(), today()) + '<label class="f"><span>' + L('Mesure (cm)', 'Measure (cm)') + '</span><input id="um_v" inputmode="decimal" placeholder="90"></label><div class="err" id="err"></div><button class="btn block" data-act="saveUmb">' + L('Enregistrer', 'Save') + '</button>'); },
  saveUmb() { const cm = num(val('um_v')); if (cm == null || cm < 50 || cm > 180) { $('#err').textContent = L('Mesure en cm (ex. 90).', 'Measure in cm (e.g. 90).'); return; } S.preg.umb = S.preg.umb || []; S.preg.umb.push({ id: uid(), d: val('um_d') || today(), cm }); save(); closeSheet(); render(); },
  addMeasure() { sheet(L('Nouvelle mesure', 'New measurement'), dateField('m_d', today(), today()) + '<div class="two"><label class="f"><span>' + L('Poids (kg)', 'Weight (kg)') + '</span><input id="m_w" inputmode="decimal" placeholder="6.4"></label><label class="f"><span>' + L('Taille (cm)', 'Length (cm)') + '</span><input id="m_l" inputmode="decimal" placeholder="62"></label></div><label class="f"><span>' + L('Périmètre crânien (cm)', 'Head circumference (cm)') + '</span><input id="m_h" inputmode="decimal" placeholder="41"></label><div class="err" id="err"></div><button class="btn block" data-act="saveMeasure">' + L('Enregistrer', 'Save') + '</button>'); },
  saveMeasure() {
    const kg = num(val('m_w')), cm = num(val('m_l')), hc = num(val('m_h'));
    if (kg == null && cm == null && hc == null) { $('#err').textContent = L('Au moins une mesure.', 'At least one measurement.'); return; }
    if ((kg != null && (kg < 1 || kg > 30)) || (cm != null && (cm < 30 || cm > 130)) || (hc != null && (hc < 25 || hc > 60))) { $('#err').textContent = L('Valeur hors limites.', 'Value out of range.'); return; }
    S.baby.measures.push({ id: uid(), d: val('m_d') || today(), kg, cm, hc });
    save(); closeSheet(); render();
  },
  vaccSheet(d) {
    const v = vaccList().filter(x => x.id === d.id)[0];
    if (!v) return;
    const cur = S.baby.vacc[v.id];
    sheet(T(v.name), '<p class="muted" style="margin-bottom:12px">' + (v.due ? L('Prévu vers le ', 'Due around ') + fmt(v.due) + '.' : L('Sans date prévue.', 'No due date.')) + '</p>' + dateField('v_d', cur || today(), today(), L('Date de l’injection', 'Date given')) + '<div class="stack"><button class="btn block" data-act="saveVacc" data-id="' + v.id + '">' + (cur ? L('Modifier', 'Change') : L('Marquer fait', 'Mark as done')) + '</button>' + (cur ? '<button class="btn danger block" data-act="unVacc" data-id="' + v.id + '">' + L('Retirer', 'Remove') + '</button>' : '') + (v.custom ? '<button class="btn ghost block" data-act="delVacc" data-id="' + v.id + '">' + L('Supprimer', 'Delete') + '</button>' : '') + '</div>');
  },
  saveVacc(d) { S.baby.vacc[d.id] = val('v_d') || today(); save(); closeSheet(); render(); },
  unVacc(d) { delete S.baby.vacc[d.id]; save(); closeSheet(); render(); },
  delVacc(d) { S.baby.customVacc = S.baby.customVacc.filter(x => x.id !== d.id); delete S.baby.vacc[d.id]; save(); closeSheet(); render(); },
  addVacc() { sheet(L('Ajouter un vaccin', 'Add a vaccine'), '<label class="f"><span>' + L('Nom', 'Name') + '</span><input id="x_n" maxlength="60"></label><label class="f"><span>' + L('Date prévue (facultatif)', 'Due date (optional)') + '</span><input type="date" id="x_d"></label><div class="err" id="err"></div><button class="btn block" data-act="saveVaccNew">' + L('Ajouter', 'Add') + '</button>'); },
  saveVaccNew() { const n = val('x_n'); if (!n) { $('#err').textContent = L('Nom requis.', 'Name required.'); return; } S.baby.customVacc.push({ id: uid(), name: n.slice(0, 60), due: val('x_d') }); save(); closeSheet(); render(); },
  addHealth() {
    sheet(L('Journal de santé', 'Health journal'), lab(L('Type', 'Type')) + opts('h_type', HTYPES) + '<div id="h_temp_wrap"><label class="f"><span>' + L('Température (°C)', 'Temperature (°C)') + '</span><input id="h_v" inputmode="decimal" placeholder="37.2"></label></div><label class="f"><span>' + L('Détails', 'Details') + '</span><textarea id="h_t" maxlength="400"></textarea></label>' + dateField('h_d', today(), today()) + '<div class="err" id="err"></div><button class="btn block" data-act="saveHealth">' + L('Enregistrer', 'Save') + '</button>');
    setTimeout(() => {
      document.querySelectorAll('input[name="h_type"]').forEach(r => { r.addEventListener('change', () => { const w = document.getElementById('h_temp_wrap'); if (w) w.style.display = (r.value === 'Température' && r.checked) ? 'block' : 'none'; }); });
      const checked = document.querySelector('input[name="h_type"]:checked');
      const w = document.getElementById('h_temp_wrap');
      if (w && checked) w.style.display = checked.value === 'Température' ? 'block' : 'none';
    }, 50);
  },
  saveHealth() {
    const type = radio('h_type') || 'Autre', v = num(val('h_v')), t = val('h_t');
    if (type === 'Température' && (v == null || v < 33 || v > 43)) { $('#err').textContent = L('Température en °C, ex 37,2.', 'Temperature in °C, e.g. 37.2.'); return; }
    if (type !== 'Température' && !t) { $('#err').textContent = L('Ajoutez quelques détails.', 'Add a few details.'); return; }
    const d = val('h_d') || today();
    S.baby.health.push({ id: uid(), d, t: d === today() ? nowT() : '', type, v: type === 'Température' ? v : null, text: t.slice(0, 400) });
    save(); closeSheet(); render();
    if (type === 'Température' && v >= 38 && bI().m < 3) toast(L('Fièvre avant 3 mois : consultez rapidement.', 'Fever before 3 months: see a doctor quickly.'), 'bad', 8000);
  },
  addFeed() { sheet(L('Tétée ou repas', 'Feed or meal'), lab(L('Type', 'Type')) + opts('f_type', FEEDTYPES) + '<div class="two"><label class="f"><span>' + L('Heure', 'Time') + '</span><input type="time" id="f_h" value="' + nowT() + '"></label><label class="f"><span>' + L('Quantité / durée', 'Amount / duration') + '</span><input id="f_q" maxlength="30"></label></div>' + dateField('f_d', today(), today()) + '<div class="err" id="err"></div><button class="btn block" data-act="saveFeed">' + L('Enregistrer', 'Save') + '</button>'); },
  saveFeed() { S.baby.feeds.push({ id: uid(), d: val('f_d') || today(), t: val('f_h'), type: radio('f_type') || 'Tétée', q: val('f_q').slice(0, 30) }); save(); closeSheet(); render(); },
  addSleep() { sheet(L('Sommeil', 'Sleep'), lab(L('Type', 'Type')) + opts('s_type', STYPES) + dateField('sl_d', today(), today(), L('Date d’endormissement', 'Date fell asleep')) + '<div class="two"><label class="f"><span>' + L('Endormi à', 'Asleep at') + '</span><input type="time" id="sl_s" value="20:00"></label><label class="f"><span>' + L('Réveil à', 'Awake at') + '</span><input type="time" id="sl_e" value="06:00"></label></div><div class="err" id="err"></div><button class="btn block" data-act="saveSleep">' + L('Enregistrer', 'Save') + '</button>'); },
  saveSleep() { const s = val('sl_s'), e = val('sl_e'); if (!s || !e) { $('#err').textContent = L('Indiquez les deux heures.', 'Enter both times.'); return; } S.baby.sleeps.push({ id: uid(), type: radio('s_type') || 'Nuit', d: val('sl_d') || today(), s, e, m: sleepMins(s, e) }); save(); closeSheet(); render(); },
  toggleFood(d) { if (S.baby.foods[d.n]) delete S.baby.foods[d.n]; else S.baby.foods[d.n] = today(); save(); render(); },
  addFood() { sheet(L('Nouvel aliment', 'New food'), '<label class="f"><span>' + L('Nom', 'Name') + '</span><input id="o_n" maxlength="40"></label><div class="err" id="err"></div><button class="btn block" data-act="saveFood">' + L('Ajouter', 'Add') + '</button>'); },
  saveFood() { const n = val('o_n'); if (!n) { $('#err').textContent = L('Nom requis.', 'Name required.'); return; } S.baby.foods[n.slice(0, 40)] = today(); save(); closeSheet(); render(); },
  toggleMile(d) { if (S.baby.miles[d.id]) delete S.baby.miles[d.id]; else S.baby.miles[d.id] = true; save(); render(); },
  addMemory() { sheet(L('Nouveau souvenir', 'New memory'), lab(L('Une première fois ?', 'A first?')) + '<div class="opts">' + SOUV.map(s => '<button class="chip" data-act="pickMem" data-n="' + esc(T(s)) + '">' + T(s) + '</button>').join('') + '</div><label class="f"><span>' + L('Titre', 'Title') + '</span><input id="s_t" maxlength="60"></label><label class="f"><span>' + L('Racontez', 'Tell the story') + '</span><textarea id="s_x" maxlength="600"></textarea></label>' + dateField('s_d', today(), today()) + '<div class="err" id="err"></div><button class="btn block" data-act="saveMemory">' + L('Enregistrer', 'Save') + '</button>'); },
  pickMem(d) { $('#s_t').value = d.n; },
  saveMemory() { const t = val('s_t'); if (!t) { $('#err').textContent = L('Titre requis.', 'Title required.'); return; } S.baby.memories.push({ id: uid(), d: val('s_d') || today(), title: t.slice(0, 60), text: val('s_x').slice(0, 600) }); save(); closeSheet(); render(); },
  addPhoto() { sheet(L('Ajouter une photo', 'Add a photo'), '<label class="f"><span>' + L('Titre', 'Title') + '</span><input id="p_t" maxlength="40"></label><label class="f"><span>' + L('Image (max 12 Mo, compressée)', 'Image (max 12 MB, compressed)') + '</span><input type="file" id="p_file" accept="image/*"></label>' + dateField('p_d', today(), today()) + '<div class="err" id="err"></div><button class="btn block" data-act="savePhoto">' + L('Enregistrer', 'Save') + '</button>'); },
  async savePhoto() {
    const t = val('p_t'), fi = document.getElementById('p_file');
    if (!fi.files || !fi.files[0]) { $('#err').textContent = L('Sélectionnez une image.', 'Select an image.'); return; }
    const btn = document.querySelector('[data-act="savePhoto"]');
    if (btn) { btn.disabled = true; btn.textContent = L('Compression…', 'Compressing…'); }
    try {
      const blob = await compressToBlob(fi.files[0]);
      const id = uid();
      await idbPut({ id, blob, title: (t || L('Photo', 'Photo')).slice(0, 40), d: val('p_d') || today() });
      S.baby.photos = S.baby.photos || [];
      S.baby.photos.push({ id, title: (t || L('Photo', 'Photo')).slice(0, 40), d: val('p_d') || today() });
      save(); closeSheet();
      ui.tab.baby = 'grow'; ui.sub.beveil = 'gallery';
      render();
      toast(L('Photo ajoutée.', 'Photo added.'), 'ok');
    } catch (e) {
      $('#err').textContent = L('Image trop lourde ou format non supporté.', 'Image too large or unsupported.');
      if (btn) { btn.disabled = false; btn.textContent = L('Enregistrer', 'Save'); }
    }
  }
};

/* ==================== 23. Modules v3.1 ==================== */
const EMERGENCY_CI = [
  { n: '185', l: ['SAMU', 'Ambulance'], d: ['Urgence médicale 24/7', 'Medical emergency 24/7'] },
  { n: '180', l: ['Pompiers', 'Fire brigade'], d: ['Incendie, accident', 'Fire, accident'] },
  { n: '110', l: ['Police secours', 'Police'], d: ['Urgence police', 'Police emergency'] },
  { n: '143', l: ['Croix-Rouge CI', 'Red Cross CI'], d: ['Assistance humanitaire', 'Humanitarian assistance'] }
];
function emergencySheet() {
  const p = S.preg, b = S.baby;
  const isPreg = S.mode === 'preg' && p.lmp;
  const I = isPreg ? pI() : null;
  const bi = S.mode === 'baby' && b.birth ? bI() : null;
  const blood = S.bloodType || L('Non renseigné', 'Not set');
  const allergies = (S.allergies || []).join(', ') || L('Aucune connue', 'None known');
  const contacts = S.emergencyContacts || [];
  let ctx = '';
  if (I) ctx = '<p class="small" style="margin-top:8px">' + L('Vous êtes à ' + I.sa + ' SA. Terme prévu le ' + fmt(I.dpa) + '.', 'You are at ' + I.sa + ' wks. Due ' + fmt(I.dpa) + '.') + '</p>';
  else if (bi) ctx = '<p class="small" style="margin-top:8px">' + L((b.name || 'Bébé') + ' a ' + ageText(bi.m, bi.d, bi.days) + '.', (b.name || 'Baby') + ' is ' + ageText(bi.m, bi.d, bi.days) + '.') + '</p>';
  sheet(L('Urgence', 'Emergency'),
    '<div class="card emergency-card"><h3>' + L('Appeler les secours', 'Call emergency services') + '</h3>' + ctx + '<p class="small" style="margin-top:10px">' + L('Ces numéros fonctionnent sans internet.', 'These numbers work without internet.') + '</p>' +
    '<div class="emergency-actions">' + EMERGENCY_CI.slice(0, 2).map(e => '<a class="btn sos" href="tel:' + e.n + '">' + e.n + '<br><small style="font-weight:400;opacity:.9">' + T(e.l) + '</small></a>').join('') + '</div></div>' +
    '<h3 style="margin-top:16px">' + L('Tous les numéros', 'All numbers') + '</h3>' +
    EMERGENCY_CI.map(e => '<a class="row" href="tel:' + e.n + '" style="text-decoration:none"><div class="grow"><div class="t"><span class="emergency-number" style="font-size:22px">' + e.n + '</span> · ' + T(e.l) + '</div><div class="muted small">' + T(e.d) + '</div></div><span class="chip bad">' + L('Appeler', 'Call') + '</span></a>').join('') +
    '<h3 style="margin-top:20px">' + L('Mes informations médicales', 'My medical info') + '</h3>' +
    '<div class="card"><div class="row"><div class="grow"><div class="t">' + L('Groupe sanguin', 'Blood type') + '</div><div class="muted small">' + esc(blood) + '</div></div></div>' +
    '<div class="row"><div class="grow"><div class="t">' + L('Allergies', 'Allergies') + '</div><div class="muted small">' + esc(allergies) + '</div></div></div>' +
    ((S.conditions || []).length ? '<div class="row"><div class="grow"><div class="t">' + L('Antécédents', 'Conditions') + '</div><div class="muted small">' + esc(S.conditions.join(', ')) + '</div></div></div>' : '') +
    '<button class="btn ghost sm" style="margin-top:10px" data-act="editMedicalInfo">' + L('Modifier', 'Edit') + '</button></div>' +
    '<h3 style="margin-top:20px">' + L('Contacts d’urgence', 'Emergency contacts') + '</h3>' +
    (contacts.length ? contacts.map(c => '<a class="row" href="tel:' + esc(c.phone) + '" style="text-decoration:none"><div class="grow"><div class="t">' + esc(c.name) + ' · ' + esc(c.relation || '') + '</div><div class="muted small">' + esc(c.phone) + '</div></div><span class="chip">' + L('Appeler', 'Call') + '</span></a>').join('') : '<div class="card">' + empty(L('Aucun contact enregistré.', 'No contact yet.')) + '</div>') +
    '<button class="btn ghost sm" style="margin-top:10px" data-act="addEmergencyContact">' + ic('plus') + L('Ajouter un contact', 'Add a contact') + '</button>' +
    '<h3 style="margin-top:20px">' + L('Signes qui imposent d’appeler', 'Signs that mean call now') + '</h3>' +
    '<div class="card">' + (isPreg ? '<ul class="l">' + PREG_ALERT.map(a => '<li>' + T(a) + '</li>').join('') + '</ul>' : bi ? '<ul class="l">' + BABY_ALERT.map(a => '<li>' + T(a) + '</li>').join('') + '</ul>' : '<p class="muted small">' + L('Renseignez votre grossesse ou bébé.', 'Fill in your pregnancy or baby.') + '</p>') + '</div>' +
    '<p class="muted small" style="margin-top:12px">' + L('Cette appli ne remplace pas un avis médical. En cas de doute, appelez.', 'This app does not replace medical advice. When in doubt, call.') + '</p>');
}
Object.assign(ACT, {
  emergency: () => emergencySheet(),
  editMedicalInfo: () => { sheet(L('Mes infos médicales', 'My medical info'), '<label class="f"><span>' + L('Groupe sanguin', 'Blood type') + '</span><select id="mi_blood">' + ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(v => '<option value="' + v + '"' + ((S.bloodType || '') === v ? ' selected' : '') + '>' + (v || L('Non renseigné', 'Not set')) + '</option>').join('') + '</select></label><label class="f"><span>' + L('Allergies', 'Allergies') + '</span><input id="mi_allergies" value="' + esc((S.allergies || []).join(', ')) + '" maxlength="200" placeholder="' + L('pénicilline, arachide…', 'penicillin, peanut…') + '"></label><label class="f"><span>' + L('Antécédents médicaux', 'Medical conditions') + '</span><input id="mi_conditions" value="' + esc((S.conditions || []).join(', ')) + '" maxlength="200" placeholder="' + L('diabète, hypertension…', 'diabetes, hypertension…') + '"></label><button class="btn block" data-act="saveMedicalInfo">' + L('Enregistrer', 'Save') + '</button>'); },
  saveMedicalInfo: () => { S.bloodType = val('mi_blood'); S.allergies = val('mi_allergies').split(',').map(s => s.trim()).filter(Boolean); S.conditions = val('mi_conditions').split(',').map(s => s.trim()).filter(Boolean); save(); closeSheet(); toast(L('Informations enregistrées.', 'Info saved.'), 'ok'); },
  addEmergencyContact: () => { sheet(L('Nouveau contact', 'New contact'), '<label class="f"><span>' + L('Nom', 'Name') + '</span><input id="ec_n" maxlength="60"></label><label class="f"><span>' + L('Lien', 'Relation') + '</span><input id="ec_r" maxlength="40" placeholder="' + L('mari, mère, voisin…', 'husband, mother, neighbour…') + '"></label><label class="f"><span>' + L('Téléphone', 'Phone') + '</span><input id="ec_p" type="tel" inputmode="tel" maxlength="20"></label><div class="err" id="err"></div><button class="btn block" data-act="saveEmergencyContact">' + L('Enregistrer', 'Save') + '</button>'); },
  saveEmergencyContact: () => { const n = val('ec_n'), p = val('ec_p'); if (!n || !p) { $('#err').textContent = L('Nom et téléphone requis.', 'Name and phone required.'); return; } S.emergencyContacts = S.emergencyContacts || []; S.emergencyContacts.push({ id: uid(), name: n.slice(0, 60), relation: val('ec_r').slice(0, 40), phone: p.slice(0, 20) }); save(); closeSheet(); emergencySheet(); toast(L('Contact ajouté.', 'Contact added.'), 'ok'); }
});

let contractionTimer = { start: 0, running: false, tick: null };
function contractionsCard() {
  if (!S.preg.lmp) return '';
  const sa = pI().sa;
  if (sa < 34) return '';
  const c = S.preg.contractions || [];
  const now = Date.now();
  const recent = c.filter(x => x.start > now - 3600 * 1000);
  const avgInterval = recent.length >= 2 ? (recent[recent.length - 1].start - recent[0].start) / (recent.length - 1) / 60000 : null;
  const avgDuration = recent.length ? recent.reduce((a, x) => a + x.duration, 0) / recent.length / 1000 : null;
  const rule511 = recent.length >= 12 && avgInterval && avgInterval <= 5 && avgDuration >= 60;
  const nearing = recent.length >= 6 && avgInterval && avgInterval <= 7;
  let banner = '';
  if (rule511) banner = '<div class="card alert" style="margin-bottom:12px"><h3>🚨 ' + L('Règle 5-1-1 atteinte', '5-1-1 rule reached') + '</h3><p>' + L('Contractions toutes les ' + avgInterval.toFixed(1) + ' min, durant ' + Math.round(avgDuration) + ' s.', 'Every ' + avgInterval.toFixed(1) + ' min, lasting ' + Math.round(avgDuration) + ' s.') + '</p><p style="margin-top:8px"><b>' + L('Appelez votre sage-femme maintenant.', 'Call your midwife now.') + '</b></p><a class="btn sos block" style="margin-top:12px" href="tel:185">' + L('Appeler les urgences', 'Call emergency') + '</a></div>';
  else if (nearing) banner = '<div class="card" style="border-color:var(--warn);margin-bottom:12px"><h3>⏱️ ' + L('Ça se rapproche', 'Getting closer') + '</h3><p>' + L('En moyenne toutes les ' + avgInterval.toFixed(1) + ' min.', 'Average every ' + avgInterval.toFixed(1) + ' min.') + '</p></div>';
  return banner + '<div class="card soft" style="text-align:center;padding:20px 16px;margin-bottom:12px"><div class="timer-label">' + (contractionTimer.running ? L('Contraction en cours', 'Contraction in progress') : L('Compteur de contractions', 'Contraction timer')) + '</div><div class="timer-display" id="c_timer" style="margin:10px 0">' + (contractionTimer.running ? '00:00' : '—') + '</div><button class="btn block timer-btn" data-act="toggleContraction">' + (contractionTimer.running ? L('◼ Terminer', '◼ End') : L('▶ Démarrer', '▶ Start')) + '</button>' + (recent.length ? '<div class="strip" style="margin:14px 0 0"><div><b>' + recent.length + '</b><span>' + L('cette heure', 'this hour') + '</span></div><div><b>' + (avgInterval ? avgInterval.toFixed(1) : '—') + '</b><span>' + L('min', 'min') + '</span></div><div><b>' + (avgDuration ? Math.round(avgDuration) : '—') + '</b><span>' + L('sec', 'sec') + '</span></div></div>' : '') + '<p class="muted small" style="margin-top:12px;text-align:left">' + L('Règle 5-1-1 : contractions toutes les 5 min, 1 min chacune, pendant 1 h.', '5-1-1 rule: every 5 min, 1 min each, for 1 h.') + '</p></div>';
}
Object.assign(ACT, {
  toggleContraction: () => {
    const c = S.preg.contractions = S.preg.contractions || [];
    if (!contractionTimer.running) {
      contractionTimer.start = Date.now();
      contractionTimer.running = true;
      contractionTimer.tick = setInterval(() => { const el = document.getElementById('c_timer'); if (!el) return; const s = Math.floor((Date.now() - contractionTimer.start) / 1000); el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }, 250);
      render();
    } else {
      const end = Date.now();
      clearInterval(contractionTimer.tick);
      const previous = c[c.length - 1];
      c.push({ id: uid(), start: contractionTimer.start, end, duration: end - contractionTimer.start, interval: previous ? contractionTimer.start - previous.end : null });
      contractionTimer.running = false;
      contractionTimer.tick = null;
      save(); render();
      const recent = c.filter(x => x.start > Date.now() - 3600 * 1000);
      if (recent.length >= 12) { const avg = (recent[recent.length - 1].start - recent[0].start) / (recent.length - 1) / 60000; if (avg <= 5) toast(L('Règle 5-1-1 atteinte. Appelez.', '5-1-1 rule reached. Call.'), 'bad', 8000); }
    }
  }
});

let breastTimer = { side: null, start: 0, tick: null };
function breastfeedingCard() {
  const b = S.baby;
  const todayFeeds = b.feeds.filter(f => f.d === today() && f.type === 'Tétée');
  const last = todayFeeds[todayFeeds.length - 1];
  let suggest = 'G';
  if (last && last.q && last.q.indexOf('G') === 0) suggest = 'D';
  const leftToday = todayFeeds.filter(f => f.q && f.q.indexOf('G') === 0).length;
  const rightToday = todayFeeds.filter(f => f.q && f.q.indexOf('D') === 0).length;
  if (breastTimer.side) {
    return '<div class="card soft" style="text-align:center;padding:20px 16px;margin-bottom:12px"><div class="timer-label">' + (breastTimer.side === 'G' ? L('Sein gauche', 'Left breast') : L('Sein droit', 'Right breast')) + '</div><div class="timer-display" id="b_timer" style="margin:10px 0">00:00</div><button class="btn block timer-btn" data-act="stopBreast">◼ ' + L('Terminer', 'End') + '</button><button class="btn ghost block" style="margin-top:8px" data-act="switchBreast">⇄ ' + L('Changer de sein', 'Switch side') + '</button></div>';
  }
  return '<div class="card soft" style="text-align:center;padding:16px;margin-bottom:12px"><p class="muted small">' + L('Conseil : commencez par', 'Tip: start on') + ' <b>' + (suggest === 'G' ? L('le sein gauche', 'the left breast') : L('le sein droit', 'the right breast')) + '</b></p><div class="two" style="margin-top:12px;gap:12px"><button class="btn timer-btn" data-act="startBreast" data-side="G">◀ ' + L('Gauche', 'Left') + '</button><button class="btn timer-btn" data-act="startBreast" data-side="D">' + L('Droit', 'Right') + ' ▶</button></div>' + (todayFeeds.length ? '<div class="strip" style="margin:14px 0 0"><div><b>' + todayFeeds.length + '</b><span>' + L('tétées', 'feeds') + '</span></div><div><b>' + leftToday + '</b><span>' + L('gauche', 'left') + '</span></div><div><b>' + rightToday + '</b><span>' + L('droit', 'right') + '</span></div></div>' : '') + (Math.abs(leftToday - rightToday) >= 3 ? '<p class="small" style="color:var(--warn);margin-top:10px">' + L('Alternez mieux pour la lactation.', 'Alternate better for lactation.') + '</p>' : '') + '</div>';
}
Object.assign(ACT, {
  startBreast: (d) => { breastTimer.side = d.side; breastTimer.start = Date.now(); breastTimer.tick = setInterval(() => { const el = document.getElementById('b_timer'); if (!el) return; const s = Math.floor((Date.now() - breastTimer.start) / 1000); el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }, 250); render(); },
  switchBreast: () => { const s = Math.floor((Date.now() - breastTimer.start) / 1000); if (s >= 30) { S.baby.feeds.push({ id: uid(), d: today(), t: nowT(), type: 'Tétée', q: breastTimer.side + ' ' + Math.round(s / 60) + ' min' }); save(); } breastTimer.side = breastTimer.side === 'G' ? 'D' : 'G'; breastTimer.start = Date.now(); render(); },
  stopBreast: () => { const s = Math.floor((Date.now() - breastTimer.start) / 1000); if (s >= 10) { S.baby.feeds.push({ id: uid(), d: today(), t: nowT(), type: 'Tétée', q: breastTimer.side + ' ' + Math.round(s / 60) + ' min' }); save(); } clearInterval(breastTimer.tick); breastTimer = { side: null, start: 0, tick: null }; render(); toast(L('Tétée enregistrée.', 'Feed logged.'), 'ok'); }
});

const EPDS_QUESTIONS = [
  ['J’ai pu rire et voir le bon côté des choses', 'I have been able to laugh and see the funny side'],
  ['J’ai attendu les choses avec plaisir', 'I have looked forward with enjoyment'],
  ['Je me suis reprochée sans raison', 'I have blamed myself unnecessarily'],
  ['J’ai été anxieuse ou inquiète sans raison', 'I have been anxious or worried for no reason'],
  ['J’ai eu peur ou j’ai paniqué sans raison', 'I have felt scared or panicky for no reason'],
  ['Les choses m’ont submergée', 'Things have been getting on top of me'],
  ['J’ai eu du mal à dormir même quand bébé dormait', 'I had difficulty sleeping even when baby slept'],
  ['Je me suis sentie triste ou malheureuse', 'I have felt sad or miserable'],
  ['J’ai été si malheureuse que j’ai pleuré', 'I have been so unhappy I have been crying'],
  ['J’ai pensé à me faire du mal', 'The thought of harming myself has occurred to me']
];
Object.assign(ACT, {
  startEpds: () => {
    let step = 0;
    const answers = [];
    const renderStep = () => {
      if (step >= EPDS_QUESTIONS.length) {
        const score = answers.reduce((a, b) => a + b, 0);
        const q10 = answers[9] || 0;
        S.baby.postpartum = S.baby.postpartum || {};
        S.baby.postpartum.epds = { score, q10, date: today(), answers };
        save(); closeSheet(); render();
        if (score >= 13 || q10 >= 1) toast(L('Score élevé. Parlez-en à un professionnel.', 'High score. Talk to a professional.'), 'bad', 10000);
        else if (score >= 10) toast(L('À surveiller. Refaites dans une semaine.', 'Monitor. Retake in a week.'), 'warn', 6000);
        else toast(L('Tout va bien.', 'All good.'), 'ok');
        return;
      }
      const q = EPDS_QUESTIONS[step];
      sheet(L('EPDS · ' + (step + 1) + '/' + EPDS_QUESTIONS.length, 'EPDS · ' + (step + 1) + '/' + EPDS_QUESTIONS.length), '<p style="margin-bottom:16px;font-weight:600">' + T(q) + '</p>' + opts('epds_a', [['0', [L('Non, pas du tout', 'No, not at all')]], ['1', [L('Pas très souvent', 'Not very often')]], ['2', [L('Oui, parfois', 'Yes, sometimes')]], ['3', [L('Oui, très souvent', 'Yes, very often')]]]) + '<button class="btn block" data-act="nextEpds">' + L('Suivant', 'Next') + '</button>');
      ACT.nextEpds = () => { const v = radio('epds_a'); answers.push(parseInt(v || '0', 10)); step++; renderStep(); };
    };
    renderStep();
  },
  toggleRehab: (d) => { S.baby.postpartum = S.baby.postpartum || {}; S.baby.postpartum.rehab = S.baby.postpartum.rehab || {}; S.baby.postpartum.rehab[d.k] = !S.baby.postpartum.rehab[d.k]; save(); render(); },
  addPeriod: () => { sheet(L('Retour de couches', 'First period'), dateField('pp_d', today(), today()) + lab(L('Aspect', 'Flow')) + opts('pp_flow', [['normal', [L('Normal', 'Normal')]], ['heavy', [L('Abondant', 'Heavy')]]]) + '<button class="btn block" data-act="savePeriod">' + L('Enregistrer', 'Save') + '</button>'); },
  savePeriod: () => { S.baby.postpartum = S.baby.postpartum || {}; S.baby.postpartum.periods = S.baby.postpartum.periods || []; S.baby.postpartum.periods.push({ id: uid(), d: val('pp_d') || today(), heavy: radio('pp_flow') === 'heavy' }); save(); closeSheet(); render(); },
  addScar: () => { sheet(L('Ma cicatrice', 'My scar'), lab(L('Type', 'Type')) + opts('sc_t', [['cesa', ['Césarienne', 'C-section']], ['epi', ['Épisiotomie', 'Episiotomy']]]) + dateField('sc_d', today(), today()) + '<label class="f"><span>' + L('Observation', 'Observation') + '</span><textarea id="sc_x" maxlength="300" placeholder="' + L('Rougeur, sensibilité…', 'Redness, tenderness…') + '"></textarea></label><button class="btn block" data-act="saveScar">' + L('Enregistrer', 'Save') + '</button>'); },
  saveScar: () => { S.baby.postpartum = S.baby.postpartum || {}; S.baby.postpartum.scars = S.baby.postpartum.scars || []; S.baby.postpartum.scars.push({ id: uid(), type: radio('sc_t') || 'cesa', d: val('sc_d') || today(), status: val('sc_x').slice(0, 300) }); save(); closeSheet(); render(); }
});

function consultationSheet() {
  const isPreg = S.mode === 'preg';
  const I = isPreg ? pI() : bI();
  let content = '';
  if (isPreg) {
    const ws = S.preg.weights.slice().sort((a, b) => a.d.localeCompare(b.d));
    const lastBp = S.preg.bps.slice().sort((a, b) => b.d.localeCompare(a.d))[0];
    content = '<h2>' + L('Résumé grossesse', 'Pregnancy summary') + '</h2><table style="width:100%;border-collapse:collapse;font-size:13px"><tr><td style="padding:6px 0;color:var(--muted)">' + L('Nom', 'Name') + '</td><td><b>' + esc(S.preg.name || '—') + '</b></td></tr><tr><td style="padding:6px 0;color:var(--muted)">' + L('1er jour dernières règles', 'LMP') + '</td><td>' + (S.preg.lmp ? fmt(S.preg.lmp) : '—') + '</td></tr><tr><td style="padding:6px 0;color:var(--muted)">' + L('Terme prévu', 'Due date') + '</td><td><b>' + fmt(I.dpa) + '</b></td></tr><tr><td style="padding:6px 0;color:var(--muted)">' + L('SA', 'Weeks') + '</td><td>' + I.sa + ' SA + ' + I.j + ' j</td></tr><tr><td style="padding:6px 0;color:var(--muted)">' + L('Groupe sanguin', 'Blood type') + '</td><td>' + esc(S.bloodType || '—') + '</td></tr><tr><td style="padding:6px 0;color:var(--muted)">' + L('Allergies', 'Allergies') + '</td><td>' + esc((S.allergies || []).join(', ') || '—') + '</td></tr><tr><td style="padding:6px 0;color:var(--muted)">' + L('Poids initial', 'Initial weight') + '</td><td>' + (ws[0] ? f1(ws[0].kg) + ' kg' : '—') + '</td></tr><tr><td style="padding:6px 0;color:var(--muted)">' + L('Poids actuel', 'Current weight') + '</td><td>' + (ws.length ? f1(ws[ws.length - 1].kg) + ' kg' : '—') + '</td></tr><tr><td style="padding:6px 0;color:var(--muted)">' + L('Dernière tension', 'Last BP') + '</td><td>' + (lastBp ? lastBp.sys + '/' + lastBp.dia + ' mmHg (' + fmtS(lastBp.d) + ')' : '—') + '</td></tr></table><h3 style="margin-top:16px">' + L('5 dernières pesées', 'Last 5 weigh-ins') + '</h3><table style="width:100%;border-collapse:collapse;font-size:13px">' + ws.slice(-5).reverse().map(w => '<tr><td style="padding:4px 0">' + fmtS(w.d) + '</td><td>' + f1(w.kg) + ' kg</td><td style="color:var(--muted)">' + Math.floor(diff(S.preg.lmp, w.d) / 7) + ' SA</td></tr>').join('') + '</table>';
  } else {
    const b = S.baby;
    const ms = b.measures.slice().sort((a, b) => b.d.localeCompare(a.d)).slice(0, 5);
    const overdue = vaccList().filter(v => !b.vacc[v.id] && v.due && diff(today(), v.due) < 0);
    content = '<h2>' + L('Résumé bébé', 'Baby summary') + '</h2><table style="width:100%;border-collapse:collapse;font-size:13px"><tr><td style="padding:6px 0;color:var(--muted)">' + L('Prénom', 'Name') + '</td><td><b>' + esc(b.name || '—') + '</b></td></tr><tr><td style="padding:6px 0;color:var(--muted)">' + L('Date de naissance', 'Birth') + '</td><td>' + (b.birth ? fmt(b.birth) : '—') + '</td></tr><tr><td style="padding:6px 0;color:var(--muted)">' + L('Âge', 'Age') + '</td><td>' + ageText(I.m, I.d, I.days) + '</td></tr><tr><td style="padding:6px 0;color:var(--muted)">' + L('Sexe', 'Sex') + '</td><td>' + (b.sex === 'M' ? L('Garçon', 'Boy') : L('Fille', 'Girl')) + '</td></tr></table><h3 style="margin-top:16px">' + L('Mesures récentes', 'Recent measurements') + '</h3><table style="width:100%;border-collapse:collapse;font-size:13px">' + ms.map(m => '<tr><td style="padding:4px 0">' + fmtS(m.d) + '</td><td>' + [m.kg != null ? f1(m.kg) + ' kg' : '', m.cm != null ? f1(m.cm) + ' cm' : '', m.hc != null ? 'PC ' + f1(m.hc) + ' cm' : ''].filter(Boolean).join(' · ') + '</td></tr>').join('') + '</table>' + (overdue.length ? '<h3 style="margin-top:16px;color:var(--bad)">' + L('Vaccins en retard', 'Vaccines overdue') + '</h3><ul class="l">' + overdue.map(v => '<li>' + esc(T(v.name)) + ' (' + L('prévu', 'due') + ' ' + fmtS(v.due) + ')</li>').join('') + '</ul>' : '') + '<h3 style="margin-top:16px">' + L('7 derniers jours', 'Last 7 days') + '</h3><table style="width:100%;border-collapse:collapse;font-size:13px"><tr><td style="padding:4px 0;color:var(--muted)">' + L('Tétées/repas', 'Feeds') + '</td><td><b>' + b.feeds.filter(f => diff(f.d, today()) <= 7).length + '</b></td></tr><tr><td style="padding:4px 0;color:var(--muted)">' + L('Sommeil cumulé', 'Sleep') + '</td><td><b>' + (() => { let t = 0; for (let i = 0; i < 7; i++) t += sleepOn(add(today(), -i)); return hm(t); })() + '</b></td></tr></table><h3 style="margin-top:16px">' + L('Derniers événements', 'Latest events') + '</h3><ul class="l" style="font-size:13px">' + (b.health.slice(0, 5).map(h => '<li>' + fmtS(h.d) + ' — ' + esc(typeName(HTYPES, h.type)) + (h.v != null ? ' ' + f1(h.v) + '°C' : '') + (h.text ? ' · ' + esc(h.text) : '') + '</li>').join('') || '<li>—</li>') + '</ul>';
  }
  return '<p class="muted small">' + L('Fiche à montrer ou imprimer pour votre consultation.', 'Sheet to show or print at your appointment.') + '</p><div id="consult_content" style="background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:12px">' + content + '<p style="margin-top:20px;font-size:11px;color:var(--muted);text-align:center">Aura Bébé · ' + fmtY(today()) + '</p></div><div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn sm" data-act="printConsultation">' + L('Imprimer', 'Print') + '</button><button class="btn ghost sm" data-act="copyConsultation">' + L('Copier le texte', 'Copy text') + '</button></div>';
}
Object.assign(ACT, {
  consultation: () => sheet(L('Fiche de consultation', 'Consultation sheet'), consultationSheet()),
  printConsultation: () => { const el = document.getElementById('consult_content'); if (!el) return; const w = window.open('', '_blank'); if (!w) { toast(L('Impossible d’ouvrir la fenêtre.', 'Cannot open window.'), 'bad'); return; } w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Aura Bébé</title><style>body{font-family:system-ui,sans-serif;padding:24px;color:#17323A;max-width:700px;margin:0 auto;line-height:1.5}h2,h3{margin-top:16px}table td{padding:4px 0}</style></head><body>' + el.innerHTML + '</body></html>'); w.document.close(); setTimeout(() => w.print(), 300); },
  copyConsultation: async () => { const el = document.getElementById('consult_content'); if (!el) return; await navigator.clipboard?.writeText(el.innerText); toast(L('Texte copié.', 'Text copied.'), 'ok'); }
});

let nlInterval = null, nlTimeout = null;
Object.assign(ACT, {
  nightlight: () => {
    if (document.getElementById('nightlight')) return;
    const div = document.createElement('div');
    div.id = 'nightlight';
    div.innerHTML = '<div id="nl_halo"></div><p id="nl_time">--:--</p><p id="nl_status">' + L('Son blanc actif', 'White noise on') + '</p><div class="nl-actions"><button data-act="nlTimer" data-v="15">15 min</button><button data-act="nlTimer" data-v="30">30 min</button><button data-act="nlTimer" data-v="60">60 min</button></div><button class="nl-close" data-act="closeNightlight">' + L('Fermer', 'Close') + '</button>';
    document.body.appendChild(div);
    const updateTime = () => { const el = document.getElementById('nl_time'); if (!el) return; const d = new Date(); el.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()); };
    updateTime();
    nlInterval = setInterval(updateTime, 10000);
    try { audPlay(0, 'Veilleuse'); } catch (e) {}
  },
  nlTimer: (d) => { const mins = parseInt(d.v, 10); clearTimeout(nlTimeout); const st = document.getElementById('nl_status'); if (st) st.textContent = L('Arrêt dans ' + mins + ' min', 'Stop in ' + mins + ' min'); nlTimeout = setTimeout(() => ACT.closeNightlight(), mins * 60 * 1000); },
  closeNightlight: () => { clearInterval(nlInterval); clearTimeout(nlTimeout); try { audStop(); } catch (e) {} const el = document.getElementById('nightlight'); if (el) el.remove(); render(); }
});

/* ==================== 24. Story reader ==================== */
function openStory(id) {
  const s = STORIES.filter(x => x.id === id)[0];
  if (!s) return;
  sheet(T(s.t), '<div class="reader-c"><button class="btn ghost sm" data-act="fs" data-v="-2" aria-label="' + L('Réduire', 'Smaller') + '">A−</button><button class="btn ghost sm" data-act="fs" data-v="2" aria-label="' + L('Agrandir', 'Larger') + '">A+</button><span class="chip" style="align-self:center">' + T(s.tag) + '</span></div><div class="reader" style="font-size:' + S.fs + 'px">' + s.p.map(x => '<p>' + esc(T(x)) + '</p>').join('') + '</div>');
  ui.story = id;
}

/* ==================== 25. Restauration ==================== */
async function handleRestoreFile(f) {
  if (!f) return;
  if (f.size > 25 * 1024 * 1024) { toast(L('Fichier trop volumineux.', 'File too large.'), 'bad'); return; }
  const text = await f.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { toast(L('Fichier invalide.', 'Invalid file.'), 'bad'); return; }
  const r = parsed.app === 'aura-bebe' && parsed.data ? parsed.data : parsed;
  if (!r || typeof r !== 'object' || !r.preg || !r.baby) { toast(L('Format non reconnu.', 'Unrecognized format.'), 'bad'); return; }
  const ok = await modal({ title: L('Remplacer les données ?', 'Replace data?'), body: L('Les données actuelles seront écrasées.', 'Current data will be overwritten.'), ok: L('Remplacer', 'Replace'), danger: true });
  if (!ok) return;
  if (Array.isArray(parsed.photos)) {
    for (const p of parsed.photos) {
      try { const bytes = b64d(p.data); const blob = new Blob([bytes], { type: p.type || 'image/jpeg' }); await idbPut({ id: p.id, blob, title: p.title, d: p.d }); } catch (e) {}
    }
  }
  S = normalizeData(r);
  delete S.userEmail; delete S.isSynced;
  await saveSecure();
  closeSheet(); render();
  toast(L('Sauvegarde restaurée.', 'Backup restored.'), 'ok');
}

/* ==================== 26. Events ==================== */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const f = ACT[t.dataset.act];
  if (f) { e.preventDefault(); try { await f(t.dataset, t); } catch (x) { console.error('action error', t.dataset.act, x); toast(L('Erreur technique.', 'Technical error.'), 'bad'); } }
});
document.addEventListener('toggle', e => { const d = e.target; if (d && d.dataset && d.dataset.id && d.tagName === 'DETAILS') ui.open[d.dataset.id] = d.open; }, true);
document.addEventListener('change', async e => { const t = e.target; if (!t) return; if (t.id === 'rf') { const f = t.files && t.files[0]; t.value = ''; if (f) await handleRestoreFile(f); } });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSheet();
  if (e.key === 'Enter' && !unlocked) { const btn = document.querySelector('[data-act="doUnlock"],[data-act="doCreateAuth"]'); if (btn) btn.click(); }
});
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S && !S.theme) render(); }); } catch (e) {}

/* ==================== 27. Boot ==================== */
(async function boot() {
  try { const raw = localStorage.getItem(AUTH_KEY); if (raw) AUTH = JSON.parse(raw); } catch (e) { AUTH = null; }
  try { const t = localStorage.getItem(THEME_KEY); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); } catch (e) {}
  lang = (typeof navigator !== 'undefined' && String(navigator.language || 'fr').toLowerCase().indexOf('en') === 0) ? 'en' : 'fr';
  S = defaults();
  S.lang = lang;
  render();
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          if (!w) return;
          w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast(L('Nouvelle version disponible. Rechargez.', 'New version available. Reload.'), '', 6000); });
        });
      } catch (e) {}
    });
  }
})();