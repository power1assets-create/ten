// app.js — Frontend JavaScript สำหรับ CRM App
// ติดต่อกับ API ผ่าน fetch() และอัปเดต DOM โดยตรง

const API = ''; // ใช้ relative path เพราะ serve จาก Express เดียวกัน

// ─── Utility ───────────────────────────────────────────────────────────────────

// แสดง toast notification ชั่วคราว
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ฟอร์แมตตัวเลขเป็น currency ไทย
function formatMoney(n) {
  return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0 }) + ' ฿';
}

// สร้าง badge HTML สำหรับ stage
function stageBadge(stage) {
  const labels = {
    lead:        'Lead',
    proposal:    'Proposal',
    negotiation: 'Negotiation',
    won:         '✅ Won',
    lost:        '❌ Lost',
  };
  return `<span class="badge badge-${stage}">${labels[stage] || stage}</span>`;
}

// ─── Tab Navigation ────────────────────────────────────────────────────────────
function switchTab(name, btn) {
  // ซ่อนทุก tab
  document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(el => el.classList.remove('active'));

  // แสดง tab ที่เลือก
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');

  // รีโหลดข้อมูลของ tab นั้น
  if (name === 'contacts') loadContacts();
  if (name === 'deals')    loadDeals();
}

// ─── Contacts ──────────────────────────────────────────────────────────────────

async function loadContacts() {
  try {
    const res  = await fetch(`${API}/api/contacts`);
    const data = await res.json();
    renderContacts(data);
    populateContactSelect(data); // อัปเดต dropdown ใน deals form
  } catch (err) {
    console.error('loadContacts:', err);
    showToast('โหลด contacts ไม่สำเร็จ');
  }
}

function renderContacts(contacts) {
  const tbody = document.getElementById('contacts-table');
  if (contacts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999">ยังไม่มีข้อมูล</td></tr>';
    return;
  }
  tbody.innerHTML = contacts.map(c => `
    <tr>
      <td>${c.name}</td>
      <td>${c.email}</td>
      <td>${c.phone || '-'}</td>
      <td>${c.company || '-'}</td>
      <td>
        <button class="btn btn-danger" onclick="deleteContact(${c.id})">ลบ</button>
      </td>
    </tr>
  `).join('');
}

// เติม option ใน <select> ของ deals form
function populateContactSelect(contacts) {
  const sel = document.getElementById('d-contact');
  const current = sel.value;
  sel.innerHTML = '<option value="">-- เลือก Contact --</option>' +
    contacts.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  sel.value = current; // คงค่าเดิมถ้ามี
}

async function addContact() {
  const name    = document.getElementById('c-name').value.trim();
  const email   = document.getElementById('c-email').value.trim();
  const phone   = document.getElementById('c-phone').value.trim();
  const company = document.getElementById('c-company').value.trim();

  if (!name || !email) {
    showToast('⚠️ กรุณาระบุ ชื่อ และ Email');
    return;
  }

  try {
    const res = await fetch(`${API}/api/contacts`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, phone, company }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
      return;
    }

    // เคลียร์ form
    ['c-name','c-email','c-phone','c-company'].forEach(id => {
      document.getElementById(id).value = '';
    });

    showToast('✅ เพิ่ม Contact สำเร็จ');
    loadContacts();
  } catch (err) {
    console.error('addContact:', err);
    showToast('❌ เชื่อมต่อ server ไม่ได้');
  }
}

async function deleteContact(id) {
  if (!confirm('ยืนยันการลบ Contact นี้?')) return;

  try {
    const res = await fetch(`${API}/api/contacts/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      showToast('❌ ' + (data.error || 'ลบไม่สำเร็จ'));
      return;
    }

    showToast('🗑️ ลบ Contact สำเร็จ');
    loadContacts();
  } catch (err) {
    console.error('deleteContact:', err);
    showToast('❌ เชื่อมต่อ server ไม่ได้');
  }
}

// ─── Deals ─────────────────────────────────────────────────────────────────────

async function loadDeals() {
  try {
    const res  = await fetch(`${API}/api/deals`);
    const data = await res.json();
    renderDeals(data);
  } catch (err) {
    console.error('loadDeals:', err);
    showToast('โหลด deals ไม่สำเร็จ');
  }
}

function renderDeals(deals) {
  const tbody = document.getElementById('deals-table');
  if (deals.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999">ยังไม่มีข้อมูล</td></tr>';
    return;
  }
  tbody.innerHTML = deals.map(d => `
    <tr>
      <td>${d.title}</td>
      <td>${formatMoney(d.value)}</td>
      <td>${stageBadge(d.stage)}</td>
      <td>${d.contact_name || '-'}</td>
      <td>
        <button class="btn btn-danger" onclick="deleteDeal(${d.id})">ลบ</button>
      </td>
    </tr>
  `).join('');
}

async function addDeal() {
  const title      = document.getElementById('d-title').value.trim();
  const value      = document.getElementById('d-value').value;
  const stage      = document.getElementById('d-stage').value;
  const contact_id = document.getElementById('d-contact').value;

  if (!title) {
    showToast('⚠️ กรุณาระบุ ชื่อ Deal');
    return;
  }

  try {
    const res = await fetch(`${API}/api/deals`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ title, value: Number(value) || 0, stage, contact_id: contact_id || null }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast('❌ ' + (data.error || 'เกิดข้อผิดพลาด'));
      return;
    }

    // เคลียร์ form
    document.getElementById('d-title').value = '';
    document.getElementById('d-value').value = '';
    document.getElementById('d-stage').value = 'lead';
    document.getElementById('d-contact').value = '';

    showToast('✅ เพิ่ม Deal สำเร็จ');
    loadDeals();
  } catch (err) {
    console.error('addDeal:', err);
    showToast('❌ เชื่อมต่อ server ไม่ได้');
  }
}

async function deleteDeal(id) {
  if (!confirm('ยืนยันการลบ Deal นี้?')) return;

  try {
    const res = await fetch(`${API}/api/deals/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      showToast('❌ ' + (data.error || 'ลบไม่สำเร็จ'));
      return;
    }

    showToast('🗑️ ลบ Deal สำเร็จ');
    loadDeals();
  } catch (err) {
    console.error('deleteDeal:', err);
    showToast('❌ เชื่อมต่อ server ไม่ได้');
  }
}

// ─── Init ──────────────────────────────────────────────────────────────────────
// โหลด contacts ตอนเปิดหน้าเว็บ
loadContacts();
