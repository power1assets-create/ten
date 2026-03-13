// app.js — windxtenshop CRM Frontend

// ─── State ─────────────────────────────────────────────────────────────────────
let allContacts  = [];
let currentPage  = 'dashboard';
let customSections = JSON.parse(localStorage.getItem('crm_sections') || '[]');

// ─── Helpers ───────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function showToast(msg, isError = false) {
  const t = $('toast');
  $('toast-icon').textContent = isError ? '⚠' : '⚡';
  $('toast-icon').style.color = isError ? '#f87171' : '#1e90ff';
  $('toast-msg').textContent  = msg;
  $('toast-msg').style.color  = isError ? '#f87171' : '#a8c8f0';
  t.classList.remove('translate-y-4','opacity-0');
  t.classList.add('translate-y-0','opacity-100');
  setTimeout(() => {
    t.classList.add('translate-y-4','opacity-0');
    t.classList.remove('translate-y-0','opacity-100');
  }, 3000);
}

function formatMoney(n) {
  return Number(n).toLocaleString('th-TH') + ' ฿';
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
                  .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// Status badge — สีน้ำเงิน theme
function contactBadge(status) {
  const map = {
    lead:     { s: 'color:#00d4ff;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.3)',   label: '◈ LEAD' },
    active:   { s: 'color:#34d399;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.3)', label: '◉ ACTIVE' },
    inactive: { s: 'color:#4a7aaa;background:rgba(74,122,170,.1);border:1px solid rgba(74,122,170,.3)', label: '◌ INACTIVE' },
  };
  const b = map[status] || map.inactive;
  return `<span class="badge" style="${b.s}">${b.label}</span>`;
}

// Stage badge — Deals
function stageBadge(stage) {
  const map = {
    lead:        { s: 'color:#1e90ff;background:rgba(30,144,255,.12);border:1px solid rgba(30,144,255,.25)',  label: 'LEAD' },
    proposal:    { s: 'color:#fbbf24;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.25)',  label: 'PROPOSAL' },
    negotiation: { s: 'color:#a78bfa;background:rgba(167,139,250,.12);border:1px solid rgba(167,139,250,.25)',label: 'NEGO' },
    won:         { s: 'color:#34d399;background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.25)',  label: '✓ WON' },
    lost:        { s: 'color:#f87171;background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.25)',label: 'LOST' },
  };
  const b = map[stage] || { s: '', label: stage };
  return `<span class="badge" style="${b.s}">${b.label}</span>`;
}

function loadingRow(cols) {
  return `<tr><td colspan="${cols}" class="py-16 text-center">
    <div class="flex flex-col items-center gap-3">
      <div class="spinner w-8 h-8 border-2 rounded-full" style="border-color:#1e90ff22;border-top-color:#1e90ff;"></div>
      <span class="text-xs tracking-widest" style="color:#1e4a7a;font-family:'Orbitron',sans-serif;font-size:.6rem;">LOADING DATA...</span>
    </div></td></tr>`;
}

function emptyRow(cols, msg = 'NO DATA') {
  return `<tr><td colspan="${cols}" class="py-16 text-center">
    <div class="flex flex-col items-center gap-3">
      <svg class="w-10 h-10" style="color:#0a3060;" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      <span class="text-xs tracking-widest" style="color:#1e4a7a;font-family:'Orbitron',sans-serif;font-size:.6rem;">${msg}</span>
    </div></td></tr>`;
}

// ─── Navigation ────────────────────────────────────────────────────────────────
function navigate(page) {
  currentPage = page;

  // ซ่อนทุก section หลัก
  ['dashboard','contacts','deals'].forEach(p => {
    $(`section-${p}`)?.classList.add('hidden');
    const nav = $(`nav-${p}`);
    if (nav) {
      nav.classList.remove('nav-active');
      nav.classList.add('text-blue-300/70');
    }
  });

  // ซ่อน custom sections
  document.querySelectorAll('.custom-section').forEach(el => el.classList.add('hidden'));

  const titles = { dashboard: 'DASHBOARD', contacts: 'CONTACTS', deals: 'DEALS' };

  if (['dashboard','contacts','deals'].includes(page)) {
    $(`section-${page}`).classList.remove('hidden');
    const nav = $(`nav-${page}`);
    nav.classList.add('nav-active');
    nav.classList.remove('text-blue-300/70');
    $('page-title').textContent = titles[page];
  } else {
    // custom section
    const sec = document.getElementById(`custom-sec-${page}`);
    if (sec) {
      sec.classList.remove('hidden');
      const s = customSections.find(s => s.id === page);
      $('page-title').textContent = s ? s.title.toUpperCase() : page.toUpperCase();
    }
  }

  if (page === 'dashboard') loadDashboard();
  if (page === 'contacts')  loadContacts();
  if (page === 'deals')     loadDeals();

  closeSidebar();
}

function toggleSidebar() {
  $('sidebar').classList.toggle('-translate-x-full');
  $('overlay').classList.toggle('hidden');
}
function closeSidebar() {
  $('sidebar').classList.add('-translate-x-full');
  $('overlay').classList.add('hidden');
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [stats, pipeline] = await Promise.all([
      fetch('/api/contacts/stats').then(r => r.json()),
      fetch('/api/deals/pipeline').then(r => r.json()),
    ]);

    $('stat-total').textContent      = stats.total  ?? 0;
    $('stat-lead').textContent       = stats.lead   ?? 0;
    $('stat-active').textContent     = stats.active ?? 0;

    const total = pipeline.reduce((s, p) => s + Number(p.total_value), 0);
    $('stat-deal-value').textContent = formatMoney(total);

    renderPipeline(pipeline);
    $('last-updated').textContent = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  } catch (err) {
    showToast('โหลด dashboard ไม่สำเร็จ', true);
  }
}

function renderPipeline(pipeline) {
  const max = Math.max(...pipeline.map(s => Number(s.total_value)), 1);
  const stageColor = {
    lead:'#60a5fa', proposal:'#fbbf24', negotiation:'#a78bfa', won:'#34d399', lost:'#f87171'
  };
  $('pipeline-bars').innerHTML = pipeline.map(s => {
    const pct = (Number(s.total_value) / max * 100).toFixed(1);
    const col = stageColor[s.stage] || '#00cfff';
    return `
      <div class="flex items-center gap-3">
        <span class="text-xs text-blue-500 w-24 shrink-0 uppercase tracking-wider">${s.stage}</span>
        <div class="flex-1 h-1.5 rounded-full" style="background:#0d1f33">
          <div style="width:${pct}%;background:${col};height:100%;border-radius:3px;
                      box-shadow:0 0 8px ${col}88;transition:width .6s ease;"></div>
        </div>
        <span class="text-xs text-blue-400 w-28 text-right shrink-0">${formatMoney(s.total_value)}</span>
        <span class="text-xs text-blue-700 w-14 text-right shrink-0">${s.count} deals</span>
      </div>`;
  }).join('');
}

// ─── Contacts ──────────────────────────────────────────────────────────────────
async function loadContacts() {
  $('contacts-tbody').innerHTML = loadingRow(5);
  try {
    const res = await fetch('/api/contacts');
    allContacts = await res.json();
    renderContacts(allContacts);
    populateContactSelect(allContacts);
  } catch {
    $('contacts-tbody').innerHTML = emptyRow(5, 'CONNECTION ERROR');
  }
}

function filterContacts() {
  const status = $('filter-status').value;
  const search = $('filter-search').value.toLowerCase();
  const filtered = allContacts.filter(c => {
    const ms = !status || c.status === status;
    const mq = !search || c.name.toLowerCase().includes(search) ||
               c.email.toLowerCase().includes(search) || (c.company||'').toLowerCase().includes(search);
    return ms && mq;
  });
  renderContacts(filtered);
}

function renderContacts(list) {
  $('contact-count').textContent = `${list.length} รายการ`;
  if (!list.length) {
    $('contacts-tbody').innerHTML = emptyRow(6, 'NO CONTACTS FOUND');
    return;
  }
  $('contacts-tbody').innerHTML = list.map(c => `
    <tr class="trow transition-colors" style="border-top:1px solid rgba(10,48,96,.6);">
      <!-- ชื่อ / Email -->
      <td class="px-5 py-3.5">
        <div class="font-semibold text-sm" style="color:#a8c8f0;">${escHtml(c.name)}</div>
        <div class="text-xs mt-0.5" style="color:#1e4a7a;">${escHtml(c.email)}</div>
      </td>
      <!-- สมาชิก = team/company -->
      <td class="px-5 py-3.5 hidden sm:table-cell text-sm" style="color:#4a7aaa;">${escHtml(c.company||'—')}</td>
      <!-- อาวุธ = phone -->
      <td class="px-5 py-3.5 hidden md:table-cell text-sm font-mono" style="color:#1e90ff;font-size:.78rem;">${escHtml(c.phone||'—')}</td>
      <!-- การกระทำ = created date -->
      <td class="px-5 py-3.5 text-xs" style="color:#1e4a7a;letter-spacing:.04em;">${formatDate(c.created_at)}</td>
      <!-- Status badge -->
      <td class="px-5 py-3.5">${contactBadge(c.status)}</td>
      <!-- Actions -->
      <td class="px-5 py-3.5 text-right">
        <div class="flex items-center justify-end gap-1">
          <button onclick='openContactModal(${JSON.stringify(c)})'
            class="text-xs px-2.5 py-1 rounded transition-colors tracking-wider"
            style="color:#1e90ff;border:1px solid rgba(30,144,255,.2);"
            onmouseover="this.style.background='rgba(30,144,255,.1)'"
            onmouseout="this.style.background='transparent'">EDIT</button>
          <button onclick="deleteContact(${c.id},'${escHtml(c.name)}')"
            class="text-xs px-2.5 py-1 rounded transition-colors tracking-wider"
            style="color:#4a7aaa;border:1px solid rgba(74,122,170,.15);"
            onmouseover="this.style.color='#f87171';this.style.borderColor='rgba(248,113,113,.3)'"
            onmouseout="this.style.color='#4a7aaa';this.style.borderColor='rgba(74,122,170,.15)'">DEL</button>
        </div>
      </td>
    </tr>`).join('');
}

function openContactModal(c = null) {
  $('contact-id').value   = c?.id      || '';
  $('c-name').value       = c?.name    || '';
  $('c-email').value      = c?.email   || '';
  $('c-phone').value      = c?.phone   || '';
  $('c-company').value    = c?.company || '';
  $('c-status').value     = c?.status  || 'lead';
  $('contact-modal-title').textContent = c ? 'EDIT CONTACT' : 'ADD CONTACT';
  $('contact-modal').classList.remove('hidden');
  setTimeout(() => $('c-name').focus(), 50);
}
function closeContactModal() { $('contact-modal').classList.add('hidden'); }

async function saveContact() {
  const id = $('contact-id').value;
  const payload = {
    name:    $('c-name').value.trim(),
    email:   $('c-email').value.trim(),
    phone:   $('c-phone').value.trim(),
    company: $('c-company').value.trim(),
    status:  $('c-status').value,
  };
  if (!payload.name)  return showToast('ต้องระบุ NAME', true);
  if (!payload.email) return showToast('ต้องระบุ EMAIL', true);
  try {
    const res  = await fetch(`/api/contacts${id?'/'+id:''}`, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'ERROR', true);
    showToast(id ? 'UPDATED ⚡' : 'RECRUITED ⚡');
    closeContactModal();
    loadContacts();
    if (currentPage === 'dashboard') loadDashboard();
  } catch { showToast('CONNECTION ERROR', true); }
}

async function deleteContact(id, name) {
  if (!confirm(`DELETE "${name}"?`)) return;
  try {
    const res  = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'ERROR', true);
    showToast(`DELETED: ${name}`);
    loadContacts();
    if (currentPage === 'dashboard') loadDashboard();
  } catch { showToast('CONNECTION ERROR', true); }
}

function populateContactSelect(list) {
  $('d-contact').innerHTML = '<option value="">— ไม่ระบุ —</option>' +
    list.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
}

// ─── Deals ─────────────────────────────────────────────────────────────────────
async function loadDeals() {
  $('deals-tbody').innerHTML = loadingRow(5);
  try {
    const res   = await fetch('/api/deals');
    const deals = await res.json();
    renderDeals(deals);
    if (!allContacts.length) {
      const cr = await fetch('/api/contacts');
      allContacts = await cr.json();
      populateContactSelect(allContacts);
    }
  } catch {
    $('deals-tbody').innerHTML = emptyRow(5, 'CONNECTION ERROR');
  }
}

function renderDeals(list) {
  $('deals-count').textContent = `${list.length} รายการ`;
  if (!list.length) {
    $('deals-tbody').innerHTML = emptyRow(5, 'NO DEALS FOUND');
    return;
  }
  $('deals-tbody').innerHTML = list.map(d => `
    <tr class="trow transition-colors" style="border-top:1px solid rgba(10,48,96,.6);">
      <td class="px-5 py-3.5">
        <div class="font-semibold text-sm" style="color:#a8c8f0;">${escHtml(d.title)}</div>
        <div class="text-xs mt-0.5" style="color:#1e4a7a;">${formatDate(d.created_at)}</div>
      </td>
      <td class="px-5 py-3.5 hidden sm:table-cell text-sm" style="color:#4a7aaa;">${escHtml(d.contact_name||'—')}</td>
      <td class="px-5 py-3.5">${stageBadge(d.stage)}</td>
      <td class="px-5 py-3.5 text-right font-bold text-sm"
          style="color:#1e90ff;text-shadow:0 0 10px rgba(30,144,255,.4);font-family:'Orbitron',sans-serif;font-size:.8rem;">
        ${formatMoney(d.value)}</td>
      <td class="px-5 py-3.5 text-right">
        <div class="flex items-center justify-end gap-1">
          <button onclick='openDealModal(${JSON.stringify(d)})'
            class="text-xs px-2.5 py-1 rounded transition-colors tracking-wider"
            style="color:#1e90ff;border:1px solid rgba(30,144,255,.2);"
            onmouseover="this.style.background='rgba(30,144,255,.1)'"
            onmouseout="this.style.background='transparent'">EDIT</button>
          <button onclick="deleteDeal(${d.id},'${escHtml(d.title)}')"
            class="text-xs px-2.5 py-1 rounded transition-colors tracking-wider"
            style="color:#4a7aaa;border:1px solid rgba(74,122,170,.15);"
            onmouseover="this.style.color='#f87171';this.style.borderColor='rgba(248,113,113,.3)'"
            onmouseout="this.style.color='#4a7aaa';this.style.borderColor='rgba(74,122,170,.15)'">DEL</button>
        </div>
      </td>
    </tr>`).join('');
}

function openDealModal(d = null) {
  $('deal-id').value   = d?.id         || '';
  $('d-title').value   = d?.title      || '';
  $('d-value').value   = d?.value      || '';
  $('d-stage').value   = d?.stage      || 'lead';
  $('d-contact').value = d?.contact_id || '';
  $('deal-modal-title').textContent = d ? 'EDIT DEAL' : 'NEW DEAL';
  $('deal-modal').classList.remove('hidden');
  setTimeout(() => $('d-title').focus(), 50);
}
function closeDealModal() { $('deal-modal').classList.add('hidden'); }

async function saveDeal() {
  const id = $('deal-id').value;
  const payload = {
    title:      $('d-title').value.trim(),
    value:      Number($('d-value').value) || 0,
    stage:      $('d-stage').value,
    contact_id: $('d-contact').value || null,
  };
  if (!payload.title) return showToast('ต้องระบุ DEAL NAME', true);
  try {
    const res  = await fetch(`/api/deals${id?'/'+id:''}`, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'ERROR', true);
    showToast(id ? 'DEAL UPDATED ⚡' : 'DEAL CREATED ⚡');
    closeDealModal();
    loadDeals();
    if (currentPage === 'dashboard') loadDashboard();
  } catch { showToast('CONNECTION ERROR', true); }
}

async function deleteDeal(id, title) {
  if (!confirm(`DELETE "${title}"?`)) return;
  try {
    const res  = await fetch(`/api/deals/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'ERROR', true);
    showToast(`DELETED: ${title}`);
    loadDeals();
    if (currentPage === 'dashboard') loadDashboard();
  } catch { showToast('CONNECTION ERROR', true); }
}

// ─── Custom Sections ───────────────────────────────────────────────────────────

function renderCustomSectionsNav() {
  const nav = $('custom-sections-nav');
  nav.innerHTML = customSections.map(s => `
    <div class="flex items-center group">
      <button onclick="navigate('${s.id}')"
        class="flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-blue-300/70
               hover:text-cyan-300 hover:bg-cyan-400/5 transition-all text-left">
        <svg class="w-4 h-4 opacity-60" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <span class="truncate">${escHtml(s.title)}</span>
      </button>
      <button onclick="deleteSection('${s.id}')"
        class="opacity-0 group-hover:opacity-100 text-blue-800 hover:text-red-400
               transition-all pr-2 text-xs">✕</button>
    </div>`).join('');
}

function renderCustomSectionsContent() {
  const container = $('custom-sections-container');
  container.innerHTML = customSections.map(s => `
    <section id="custom-sec-${s.id}" class="custom-section hidden fade-in">
      <div class="card p-6 mb-4" style="border-color:#00cfff22;">
        <!-- Editable title -->
        <div class="flex items-center gap-3 mb-3">
          <svg class="w-5 h-5 text-cyan-400/60 bolt-deco" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <h2 contenteditable="true" spellcheck="false"
              onblur="updateSectionTitle('${s.id}', this.textContent)"
              class="editable-heading text-cyan-300 font-bold tracking-wider"
              style="font-family:'Orbitron',sans-serif; font-size:.9rem;"
              title="คลิกเพื่อแก้ไขหัวข้อ">${escHtml(s.title)}</h2>
          <span class="text-blue-700 text-xs">✎</span>
        </div>
        <div class="lightning-line mb-4"></div>

        <!-- Editable description -->
        <p contenteditable="true" spellcheck="false"
           onblur="updateSectionDesc('${s.id}', this.textContent)"
           class="editable-heading text-blue-400 text-sm leading-relaxed min-h-[40px]"
           title="คลิกเพื่อแก้ไขคำอธิบาย">${escHtml(s.desc || 'คลิกเพื่อเพิ่มคำอธิบาย...')}</p>

        <!-- Note area -->
        <div class="mt-4">
          <p class="text-xs text-blue-700 uppercase tracking-widest mb-2">NOTES</p>
          <textarea onblur="updateSectionNotes('${s.id}', this.value)"
            placeholder="บันทึกเพิ่มเติม..."
            class="w-full bg-[#050a12] border border-blue-900/40 text-blue-300 text-sm rounded-lg
                   px-3 py-2.5 focus:outline-none focus:border-cyan-500/40 placeholder-blue-900
                   resize-none min-h-[100px]">${escHtml(s.notes||'')}</textarea>
        </div>
      </div>
    </section>`).join('');
}

function saveCustomSections() {
  localStorage.setItem('crm_sections', JSON.stringify(customSections));
}

function addSection() {
  $('new-section-title').value = '';
  $('new-section-desc').value  = '';
  $('section-modal').classList.remove('hidden');
  setTimeout(() => $('new-section-title').focus(), 50);
}
function closeSectionModal() { $('section-modal').classList.add('hidden'); }

function confirmAddSection() {
  const title = $('new-section-title').value.trim();
  if (!title) return showToast('ต้องระบุ SECTION TITLE', true);

  const id = 'sec_' + Date.now();
  customSections.push({ id, title, desc: $('new-section-desc').value.trim(), notes: '' });
  saveCustomSections();
  renderCustomSectionsNav();
  renderCustomSectionsContent();
  closeSectionModal();
  showToast(`SECTION "${title}" CREATED ⚡`);
  navigate(id);
}

function deleteSection(id) {
  const s = customSections.find(s => s.id === id);
  if (!confirm(`DELETE SECTION "${s?.title}"?`)) return;
  customSections = customSections.filter(s => s.id !== id);
  saveCustomSections();
  renderCustomSectionsNav();
  renderCustomSectionsContent();
  showToast('SECTION DELETED');
  navigate('dashboard');
}

function updateSectionTitle(id, val) {
  const s = customSections.find(s => s.id === id);
  if (s) { s.title = val.trim(); saveCustomSections(); renderCustomSectionsNav(); }
}
function updateSectionDesc(id, val) {
  const s = customSections.find(s => s.id === id);
  if (s) { s.desc = val.trim(); saveCustomSections(); }
}
function updateSectionNotes(id, val) {
  const s = customSections.find(s => s.id === id);
  if (s) { s.notes = val; saveCustomSections(); }
}

// ─── Keyboard ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeContactModal();
    closeDealModal();
    closeSectionModal();
  }
});

// Page title editable — save เมื่อ blur
$('page-title').addEventListener('blur', function() {
  // แค่ visual — ไม่ได้ persist เพราะหน้าหลักเป็น system page
});

// ─── Init ──────────────────────────────────────────────────────────────────────
renderCustomSectionsNav();
renderCustomSectionsContent();
navigate('dashboard');
