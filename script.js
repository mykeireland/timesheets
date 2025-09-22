// script.js — stable and consistent
"use strict";

/* ============================
   API (stable names)
============================ */
const Data = {
  // generic JSON fetch with better errors
    fetchJson: async (url, opts) => {
      const res = await fetch(url, { ...(opts||{}), headers: { ...(opts?.headers||{}), Accept: "application/json" }});
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} on ${url}${txt ? ` — ${txt}` : ""}`);
      }
      const text = await res.text().catch(() => "");
      if (!text) return [];
      try { return JSON.parse(text); } catch { return []; }
    },

  // DO NOT RENAME these — keep both for compatibility
  employees: () => Data.fetchJson(`${window.API_BASE}/employees`),
  tickets:   () => Data.fetchJson(`${window.API_BASE}/tickets/open`),
  // alias that some earlier drafts referenced
  ticketsOpen: () => Data.fetchJson(`${window.API_BASE}/tickets/open`),

  submitEntry: async (payload) => {
    const res = await fetch(`${window.API_BASE}/timesheets/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Submit failed (HTTP ${res.status})${txt ? ` — ${txt}` : ""}`);
    }
    // handle empty body gracefully
    return res.text().then(t => { try { return t ? JSON.parse(t) : {}; } catch { return {}; } });
  },
};

/* ============================
   Small helpers
============================ */
function $(sel) { return document.querySelector(sel); }
function toInt(v, name) { const n = parseInt(v,10); if (isNaN(n)) throw new Error(`${name} is required`); return n; }
function toNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function showError(err){ console.error(err); alert(err.message || String(err)); }

/* ============================
   Normalisers (ONLY map shapes)
============================ */
function toEmployeeItems(raw) {
  // Expect array; tolerate alternate shapes
  if (!Array.isArray(raw)) return [];
  return raw.map(e => {
    if (!e) return null;
    // candidate id fields
    const id = e.employee_id ?? e.employeeId ?? e.id ?? e.user_id ?? e.userId ?? null;
    // build a display name
    const first = e.first_name ?? e.firstName ?? "";
    const last  = e.last_name  ?? e.lastName  ?? "";
    let name = `${first} ${last}`.trim();
    if (!name) name = e.display_name ?? e.displayName ?? e.name ?? e.email ?? (id != null ? `#${id}` : "");
    if (id == null) return null;
    return { id: Number(id), name: String(name) };
  }).filter(Boolean);
}

function toTicketItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(t => {
    if (!t) return null;
    const id    = t.ticketId    ?? t.ticket_id ?? t.id ?? null;
    const cw    = t.cwTicketId  ?? t.cw_ticket_id ?? t.cwId ?? "";
    const name  = t.ticketName  ?? t.ticket_name ?? t.name ?? "";
    const site  = t.siteName    ?? t.site_name ?? t.site ?? "";
    // if an open flag exists and is false, skip
    const openFlag = t.open_flag ?? t.openFlag ?? t.open ?? t.isOpen;
    if (openFlag !== undefined) {
      const ok = (openFlag === true || openFlag === 1 || String(openFlag).toLowerCase() === "true");
      if (!ok) return null;
    }
    if (!id) return null;
    return { id: Number(id), label: `${cw || "—"} - ${name || "(no title)"}${site ? " - " + site : ""}` };
  }).filter(Boolean);
}

/* ============================
   Init + wiring
============================ */
document.addEventListener("DOMContentLoaded", () => {
  init().catch(showError);
});

async function init() {
  await populatePeople();
  await addRow();   // start with one row
  wireForm();
}

/* ============================
   Populate employees
============================ */
async function populatePeople() {
  const empSel = $("#employeeSelect");
  if (!empSel) return;

  empSel.disabled = true;
  empSel.innerHTML = `<option value="">Loading…</option>`;
  try {
     const raw = await Data.employees();
     console.info("[populatePeople] /api/employees →", raw);
    const employees = toEmployeeItems(raw);
    if (!employees.length) {
       empSel.innerHTML = `<option value="">No employees found</option>`;
     } else {
       fillSelect(empSel, employees, "Select Employee");
     }
   } catch (e) {
     console.error(e);
     empSel.innerHTML = `<option value="">Error loading employees</option>`;
   } finally {
     empSel.disabled = false;
   }
}

/* ============================
   Tickets per row
============================ */
async function loadOpenTickets(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = `<option value="">Loading…</option>`;

  const ticketsRaw = await Data.tickets();            // ← uses stable alias
  const tickets    = toTicketItems(ticketsRaw);       // ← normalize to {id,label}

  // Build options
  selectEl.innerHTML = `<option value="">Select Ticket</option>`;
  tickets.forEach(t => {
    const opt = document.createElement("option");
    opt.value = String(t.id);
    opt.textContent = t.label;
    selectEl.appendChild(opt);
  });
}

/* ============================
   Add row
============================ */
async function addRow() {
  const tbody = $('#timesheetBody');

  // First row: date, ticket, notes
  const tr1 = document.createElement('tr');
  tr1.innerHTML = `
    <td><input type="date" required></td>
    <td><select class="ticketSelect" required></select></td>
    <td><input type="text" maxlength="500" placeholder="Notes (optional)" class="notes"></td>
  `.trim();

  // Second row: start time + hours + action
  const tr2 = document.createElement('tr');
  tr2.innerHTML = `
    <td><input type="time" step="900" class="start-time" required></td>
    <td colspan="2">
      <input type="number" step="0.25" min="0.25" class="hours standard" required placeholder="Std">
      <input type="number" step="0.25" min="0" class="hours ot15" placeholder="1.5x">
      <input type="number" step="0.25" min="0" class="hours ot2" placeholder="2x">
    </td>
    <td>
      <button type="button" class="btn remove-btn">Remove</button>
    </td>
  `.trim();

  tbody.appendChild(tr1);
  tbody.appendChild(tr2);

  // hook remove
  tr2.querySelector('.remove-btn').addEventListener('click', () => {
    tr1.remove();
    tr2.remove();
  });

  // populate tickets for this row
  await loadOpenTickets(tr1.querySelector('.ticketSelect'));
}

/* ============================
   Form wiring
============================ */
function wireForm() {
  // Employee change → refresh ticket selects (keeps it simple)
  const empSel = $('#employeeSelect');
  if (empSel) {
    empSel.addEventListener('change', async () => {
      const rows = document.querySelectorAll('#timesheetBody tr');
      for (const tr of rows) {
        await loadOpenTickets(tr.querySelector('.ticketSelect'));
      }
    });
  }

  // Submit
  const form = $('#timesheetForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payloads = collectEntries();
        for (const p of payloads) {
          await Data.submitEntry(p);
        }
        alert('Timesheet submitted successfully');
        // reset to a single row
        $('#timesheetBody').innerHTML = '';
        await addRow();
      } catch (err) {
        showError(err);
      }
    });
  }

  // Manager view
  const mgrBtn = $('#managerBtn');
  if (mgrBtn) {
    mgrBtn.addEventListener('click', () => { window.location.href = 'manager.html'; });
  }

  // Add row button (if you have one with id="addRowBtn")
  const addBtn = $('#addRowBtn');
  if (addBtn) addBtn.addEventListener('click', () => addRow().catch(showError));
}

/* ============================
   Helpers (unchanged UI contract)
============================ */
function fillSelect(sel, items, placeholder) {
  if (!sel) return;
  sel.innerHTML = ['<option value="">'+placeholder+'</option>']
    .concat(items.map(i => `<option value="${escapeHtml(i.id)}">${escapeHtml(i.name)}</option>`))
    .join('');
}

function collectEntries() {
  const empId = toInt($('#employeeSelect').value, 'Employee');
  const rows = [...document.querySelectorAll('#timesheetBody tr')];
  if (!rows.length) throw new Error('No rows to submit');

  const payloads = [];
  for (let i = 0; i < rows.length; i += 2) {
    const tr1 = rows[i];
    const tr2 = rows[i+1];
    if (!tr1 || !tr2) continue;

    const date      = tr1.querySelector('input[type="date"]')?.value || '';
    const ticketId  = toInt(tr1.querySelector('.ticketSelect')?.value, 'Ticket');
    const notes     = (tr1.querySelector('.notes')?.value || '').trim() || null;

    const start_time = tr2.querySelector('.start-time')?.value || '';
    const hoursStandard = toNum(tr2.querySelector('.standard')?.value);
    const hours15x      = toNum(tr2.querySelector('.ot15')?.value);
    const hours2x       = toNum(tr2.querySelector('.ot2')?.value);

    if (!date) throw new Error('Date is required');
    if (!start_time) throw new Error('Start time is required');
    if (hoursStandard + hours15x + hours2x <= 0) {
      throw new Error('At least one hours field must be > 0');
    }

    payloads.push({
      employeeId: empId,
      ticketId,
      date,
      start_time,
      hoursStandard,
      hours15x,
      hours2x,
      notes
    });
  }

  return payloads;
}
