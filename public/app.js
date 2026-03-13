// app.js — windxtenshop CRM Frontend

// ─── State ─────────────────────────────────────────────────────────────────────
let allContacts   = [];
let currentPage   = 'dashboard';
let searchDebounce = null; // debounce timer

// ─── Helpers ───────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function showToast(msg, isError = false) {
  const t = $('toast');
  $('toast-icon').textContent = isError ? '❌' : '✅';
  $('toast-msg').textContent  = msg;
  $('toast-msg').style.color  = isError ? '#f87171' : '#93c5fd';
  t.style.borderColor         = isError ? '#7f1d1d' : '#1e3a5f';
  t.classList.remove('opacity-0', 'translate-y-3');
  t.classList.add('opacity-100', 'translate-y-0');
  setTimeout(() => {
    t.classList.add('opacity-0', 'translate-y-3');
    t.classList.remove('opacity-100', 'translate-y-0');
  }, 3000);
}

function formatMoney(n) {
  return Number(n).toLocaleString('th-TH') + ' ฿';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ป้องกัน XSS
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// Highlight คำค้นหาใน string (ป้องกัน XSS ก่อน แล้วค่อย wrap)
function highlight(text, keyword) {
  const safe = esc(text);
  if (!keyword) return safe;
  // escape regex special chars
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'gi');
  return safe.replace(re, '<span class="hl">$1</span>');
}

// ─── Status Badges ─────────────────────────────────────────────────────────────
// lead = น้ำเงิน | prospect = เหลือง | customer = เขียว | inactive = เทา
function contactBadge(status) {
  const map = {
    lead:     { bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.4)',  color: '#93c5fd', label: 'Lead' },
    prospect: { bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.4)',  color: '#fcd34d', label: 'Prospect' },
    customer: { bg: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.4)',  color: '#6ee7b7', label: 'Customer' },
    inactive: { bg: 'rgba(107,114,128,0.15)', border: 'rgba(107,114,128,0.4)', color: '#9ca3af', label: 'Inactive' },
  };
  const b = map[status] || map.inactive;
  return `<span style="background:${b.bg};border:1px solid ${b.border};color:${b.color};
                       padding:2px 9px;border-radius:6px;font-size:.7rem;font-weight:700;
                       letter-spacing:.06em;text-transform:uppercase;">${b.label}</span>`;
}

// Stage badge — Deals
function stageBadge(stage) {
  const map = {
    new:         { bg: 'rgba(59,130,246,0.15)',  border: 'rgba(59,130,246,0.35)',  color: '#93c5fd', label: 'New' },
    contacted:   { bg: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.35)',  color: '#c4b5fd', label: 'Contacted' },
    proposal:    { bg: 'rgba(251,191,36,0.15)',  border: 'rgba(251,191,36,0.35)',  color: '#fcd34d', label: 'Proposal' },
    negotiation: { bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.35)',  color: '#fdba74', label: 'Negotiation' },
    won:         { bg: 'rgba(52,211,153,0.15)',  border: 'rgba(52,211,153,0.35)',  color: '#6ee7b7', label: '✓ Won' },
    lost:        { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.35)',   color: '#fca5a5', label: 'Lost' },
  };
  const b = map[stage] || { bg:'transparent', border:'#374151', color:'#9ca3af', label: stage };
  return `<span style="background:${b.bg};border:1px solid ${b.border};color:${b.color};
                       padding:2px 9px;border-radius:6px;font-size:.7rem;font-weight:700;
                       letter-spacing:.06em;text-transform:uppercase;">${b.label}</span>`;
}

// Loading row
function loadingRow(cols) {
  return `<tr><td colspan="${cols}">
    <div class="flex flex-col items-center justify-center py-16 gap-3">
      <div class="spinner w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      <p class="text-xs text-blue-800 tracking-wider">กำลังโหลด...</p>
    </div></td></tr>`;
}

// Empty state
function emptyRow(cols, msg = 'ไม่พบข้อมูล') {
  return `<tr><td colspan="${cols}">
    <div class="flex flex-col items-center justify-center py-16 gap-4">
      <div class="w-14 h-14 rounded-full flex items-center justify-center" style="background:rgba(59,130,246,0.08);">
        <svg class="w-7 h-7 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4"/>
        </svg>
      </div>
      <p class="text-sm text-blue-800">${msg}</p>
    </div></td></tr>`;
}

// ─── Navigation ────────────────────────────────────────────────────────────────
function navigate(page) {
  currentPage = page;

  ['dashboard','contacts','deals'].forEach(p => {
    $(`section-${p}`)?.classList.add('hidden');
    const nav = $(`nav-${p}`);
    if (nav) nav.classList.remove('nav-active');
  });

  $(`section-${page}`)?.classList.remove('hidden');
  $(`nav-${page}`)?.classList.add('nav-active');

  const titles = { dashboard: 'DASHBOARD', contacts: 'CONTACTS', deals: 'DEALS' };
  $('page-title').textContent = titles[page] || page.toUpperCase();

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
  // ปิด sidebar เฉพาะ mobile (< 1024px) — desktop ให้ sidebar คงอยู่เสมอ
  if (window.innerWidth < 1024) {
    $('sidebar').classList.add('-translate-x-full');
  }
  $('overlay').classList.add('hidden');
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [stats, pipeline] = await Promise.all([
      fetch('/api/contacts/stats').then(r => r.json()),
      fetch('/api/deals/pipeline').then(r => r.json()),
    ]);

    $('stat-total').textContent    = stats.total    ?? 0;
    $('stat-lead').textContent     = (stats.lead ?? 0) + (stats.prospect ?? 0);
    $('stat-customer').textContent = stats.customer ?? 0;

    const totalValue = pipeline.reduce((s, p) => s + Number(p.total_value), 0);
    $('stat-deal-value').textContent = formatMoney(totalValue);

    renderPipeline(pipeline);
    $('last-updated').textContent = 'อัปเดต ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  } catch {
    showToast('โหลด dashboard ไม่สำเร็จ', true);
  }
}

function renderPipeline(pipeline) {
  const colors = {
    new:'#3b82f6', contacted:'#8b5cf6', proposal:'#f59e0b',
    negotiation:'#f97316', won:'#10b981', lost:'#ef4444',
  };
  const maxVal = Math.max(...pipeline.map(s => Number(s.total_value)), 1);

  $('pipeline-bars').innerHTML = pipeline.map(s => {
    const pct = (Number(s.total_value) / maxVal * 100).toFixed(1);
    const col = colors[s.stage] || '#3b82f6';
    return `
      <div class="flex items-center gap-4">
        <span class="text-xs w-24 shrink-0 capitalize tracking-wider" style="color:#94a3b8;">${s.stage}</span>
        <div class="flex-1 rounded-full h-1.5" style="background:#0f1f3d;">
          <div style="width:${pct}%;height:100%;border-radius:4px;
                      background:${col};box-shadow:0 0 8px ${col}88;
                      transition:width .6s ease;"></div>
        </div>
        <span class="text-xs w-28 text-right shrink-0" style="color:#cbd5e1;">${formatMoney(s.total_value)}</span>
        <span class="text-xs w-14 text-right shrink-0" style="color:#64748b;">${s.count} deals</span>
      </div>`;
  }).join('');
}

// ─── Contacts ──────────────────────────────────────────────────────────────────
async function loadContacts() {
  $('contacts-tbody').innerHTML = loadingRow(6);
  try {
    const res = await fetch('/api/contacts');
    allContacts = await res.json();
    renderContacts(allContacts);
    populateContactSelect(allContacts);
  } catch {
    $('contacts-tbody').innerHTML = emptyRow(6, 'เชื่อมต่อ server ไม่สำเร็จ');
  }
}

// filterContacts — เรียกทุกครั้งที่ input เปลี่ยน (ผ่าน debounce)
function filterContacts() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(_doFilter, 300); // debounce 300ms
}

function _doFilter() {
  const status  = $('filter-status').value;
  const keyword = $('filter-search').value.trim();
  const q       = keyword.toLowerCase();

  // แสดง/ซ่อน clear X button ใน input
  $('search-clear').classList.toggle('hidden', !keyword);

  const hasFilter = !!(status || keyword);

  // สลับ UI ระหว่าง badge count (มี filter) กับ plain count (ไม่มี filter)
  $('filter-active').classList.toggle('hidden', !hasFilter);
  $('filter-active').classList.toggle('flex', hasFilter);
  $('contact-count-plain').classList.toggle('hidden', hasFilter);

  const list = allContacts.filter(c => {
    const matchStatus = !status || c.status === status;
    const matchQuery  = !q ||
      (c.name    ||'').toLowerCase().includes(q) ||
      (c.company ||'').toLowerCase().includes(q) ||
      (c.email   ||'').toLowerCase().includes(q) ||
      (c.phone   ||'').toLowerCase().includes(q);
    return matchStatus && matchQuery;
  });

  // แสดง "X จาก Y รายการ"
  const countText = hasFilter
    ? `แสดง ${list.length} จาก ${allContacts.length} รายการ`
    : `${list.length} รายการ`;

  $('contact-count').textContent       = countText;
  $('contact-count-plain').textContent = countText;

  renderContacts(list, keyword);
}

function clearSearch() {
  $('filter-search').value = '';
  _doFilter();
  $('filter-search').focus();
}

function clearAll() {
  $('filter-search').value  = '';
  $('filter-status').value  = '';
  _doFilter();
}

function renderContacts(list, keyword = '') {
  if (!list.length) {
    const msg = keyword || $('filter-status').value
      ? 'ไม่พบข้อมูลที่ค้นหา'
      : 'ยังไม่มี contacts';
    $('contacts-tbody').innerHTML = emptyRow(6, msg);
    return;
  }

  $('contacts-tbody').innerHTML = list.map(c => {
    // highlight เฉพาะ field ที่ค้นหาได้
    const hName    = highlight(c.name,    keyword);
    const hCompany = highlight(c.company, keyword);
    const hEmail   = highlight(c.email,   keyword);
    const hPhone   = highlight(c.phone,   keyword);

    return `
    <tr class="trow border-t transition-colors" style="border-color:rgba(30,58,94,0.5);">
      <!-- ชื่อ -->
      <td class="px-5 py-3.5">
        <div class="font-semibold text-blue-100 text-sm">${hName}</div>
        ${c.tags ? `<div class="text-xs text-blue-800 mt-0.5">${esc(c.tags)}</div>` : ''}
      </td>
      <!-- บริษัท -->
      <td class="px-5 py-3.5 hidden sm:table-cell text-sm text-blue-500">${hCompany || '—'}</td>
      <!-- อีเมล -->
      <td class="px-5 py-3.5 hidden md:table-cell text-sm text-blue-600">${hEmail}</td>
      <!-- เบอร์ -->
      <td class="px-5 py-3.5 hidden lg:table-cell text-sm text-blue-700 font-mono">${hPhone || '—'}</td>
      <!-- Status badge -->
      <td class="px-5 py-3.5">${contactBadge(c.status)}</td>
      <!-- Actions -->
      <td class="px-5 py-3.5 text-right">
        <div class="flex items-center justify-end gap-1.5">
          <button onclick='openContactModal(${JSON.stringify(c)})'
            class="text-xs px-2.5 py-1 rounded-lg transition-all font-medium"
            style="color:#60a5fa;border:1px solid rgba(59,130,246,0.25);"
            onmouseover="this.style.background='rgba(59,130,246,0.1)'"
            onmouseout="this.style.background='transparent'">แก้ไข</button>
          <button onclick="deleteContact(${c.id},'${esc(c.name)}')"
            class="text-xs px-2.5 py-1 rounded-lg transition-all font-medium"
            style="color:#6b7280;border:1px solid rgba(107,114,128,0.2);"
            onmouseover="this.style.color='#f87171';this.style.borderColor='rgba(239,68,68,0.3)'"
            onmouseout="this.style.color='#6b7280';this.style.borderColor='rgba(107,114,128,0.2)'">ลบ</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function populateContactSelect(list) {
  $('d-contact').innerHTML = '<option value="">— ไม่ระบุ —</option>' +
    list.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
}

function openContactModal(c = null) {
  $('contact-id').value  = c?.id      || '';
  $('c-name').value      = c?.name    || '';
  $('c-email').value     = c?.email   || '';
  $('c-phone').value     = c?.phone   || '';
  $('c-status').value    = c?.status  || 'lead';
  $('c-company').value   = c?.company || '';
  $('c-tags').value      = c?.tags    || '';
  $('c-notes').value     = c?.notes   || '';
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
    status:  $('c-status').value,
    company: $('c-company').value.trim(),
    tags:    $('c-tags').value.trim(),
    notes:   $('c-notes').value.trim(),
  };
  if (!payload.name)  return showToast('กรุณาระบุ ชื่อ', true);
  if (!payload.email) return showToast('กรุณาระบุ อีเมล', true);

  try {
    const res  = await fetch(`/api/contacts${id ? '/' + id : ''}`, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'บันทึกไม่สำเร็จ', true);
    showToast(id ? 'อัปเดตสำเร็จ' : 'เพิ่ม Contact สำเร็จ');
    closeContactModal();
    loadContacts();
    if (currentPage === 'dashboard') loadDashboard();
  } catch { showToast('เชื่อมต่อ server ไม่ได้', true); }
}

async function deleteContact(id, name) {
  if (!confirm(`ยืนยันลบ "${name}"?`)) return;
  try {
    const res  = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'ลบไม่สำเร็จ', true);
    showToast(`ลบ "${name}" สำเร็จ`);
    loadContacts();
    if (currentPage === 'dashboard') loadDashboard();
  } catch { showToast('เชื่อมต่อ server ไม่ได้', true); }
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
    $('deals-tbody').innerHTML = emptyRow(5, 'เชื่อมต่อ server ไม่สำเร็จ');
  }
}

function renderDeals(list) {
  $('deals-count').textContent = `${list.length} รายการ`;
  if (!list.length) {
    $('deals-tbody').innerHTML = emptyRow(5, 'ยังไม่มี deals');
    return;
  }
  $('deals-tbody').innerHTML = list.map(d => `
    <tr class="trow border-t transition-colors" style="border-color:rgba(30,58,94,0.5);">
      <td class="px-5 py-3.5">
        <div class="font-semibold text-blue-100 text-sm">${esc(d.title)}</div>
        <div class="text-xs text-blue-800 mt-0.5">${formatDate(d.created_at)}</div>
      </td>
      <td class="px-5 py-3.5 hidden sm:table-cell text-sm text-blue-500">${esc(d.contact_name||'—')}</td>
      <td class="px-5 py-3.5">${stageBadge(d.stage)}</td>
      <td class="px-5 py-3.5 text-right font-bold text-sm" style="color:#60a5fa;">${formatMoney(d.value)}</td>
      <td class="px-5 py-3.5 text-right">
        <div class="flex items-center justify-end gap-1.5">
          <button onclick='openDealModal(${JSON.stringify(d)})'
            class="text-xs px-2.5 py-1 rounded-lg transition-all font-medium"
            style="color:#60a5fa;border:1px solid rgba(59,130,246,0.25);"
            onmouseover="this.style.background='rgba(59,130,246,0.1)'"
            onmouseout="this.style.background='transparent'">แก้ไข</button>
          <button onclick="deleteDeal(${d.id},'${esc(d.title)}')"
            class="text-xs px-2.5 py-1 rounded-lg transition-all font-medium"
            style="color:#6b7280;border:1px solid rgba(107,114,128,0.2);"
            onmouseover="this.style.color='#f87171';this.style.borderColor='rgba(239,68,68,0.3)'"
            onmouseout="this.style.color='#6b7280';this.style.borderColor='rgba(107,114,128,0.2)'">ลบ</button>
        </div>
      </td>
    </tr>`).join('');
}

function openDealModal(d = null) {
  $('deal-id').value        = d?.id         || '';
  $('d-title').value        = d?.title      || '';
  $('d-value').value        = d?.value      || '';
  $('d-stage').value        = d?.stage      || 'new';
  $('d-contact').value      = d?.contact_id || '';
  $('d-close-date').value   = d?.close_date ? d.close_date.split('T')[0] : '';
  $('d-notes').value        = d?.notes      || '';
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
    close_date: $('d-close-date').value || null,
    notes:      $('d-notes').value.trim(),
  };
  if (!payload.title) return showToast('กรุณาระบุ ชื่อ Deal', true);

  try {
    const res  = await fetch(`/api/deals${id ? '/' + id : ''}`, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'บันทึกไม่สำเร็จ', true);
    showToast(id ? 'อัปเดต Deal สำเร็จ' : 'เพิ่ม Deal สำเร็จ');
    closeDealModal();
    loadDeals();
    if (currentPage === 'dashboard') loadDashboard();
  } catch { showToast('เชื่อมต่อ server ไม่ได้', true); }
}

async function deleteDeal(id, title) {
  if (!confirm(`ยืนยันลบ "${title}"?`)) return;
  try {
    const res  = await fetch(`/api/deals/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'ลบไม่สำเร็จ', true);
    showToast(`ลบ "${title}" สำเร็จ`);
    loadDeals();
    if (currentPage === 'dashboard') loadDashboard();
  } catch { showToast('เชื่อมต่อ server ไม่ได้', true); }
}

// ─── Keyboard shortcut ─────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeContactModal(); closeDealModal(); }
});

// ─── Init ──────────────────────────────────────────────────────────────────────

// ─── Section Title (Sidebar) ───────────────────────────────────────────────────
// โหลด saved titles จาก localStorage
function loadSectionTitles() {
  const saved = JSON.parse(localStorage.getItem('sectionTitles') || '{}');
  document.querySelectorAll('.section-title-edit').forEach(input => {
    const key = input.dataset.key;
    if (key && saved[key]) input.value = saved[key];
  });
}

function focusSecTitle(btn) {
  // หา input ใน sec-header เดียวกัน
  const input = btn.closest('.sec-header')?.querySelector('.section-title-edit');
  if (!input) return;
  input.focus();
  input.select();
}

function saveSectionTitle(input) {
  const key = input.dataset.key;
  if (!key) return;
  const val = input.value.trim();
  if (!val) { input.value = input.dataset.default || key; return; }

  const saved = JSON.parse(localStorage.getItem('sectionTitles') || '{}');
  saved[key] = val;
  localStorage.setItem('sectionTitles', JSON.stringify(saved));
  showToast(`บันทึกหัวข้อ "${val}" แล้ว`);
}

// ผูก input event กับ debounce (ต้องรอ DOM พร้อมก่อน)
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = $('filter-search');
  if (searchInput) {
    searchInput.addEventListener('input', filterContacts);
  }
  loadSectionTitles();
});

navigate('dashboard');
