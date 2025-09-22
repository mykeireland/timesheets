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
function wireForm() {
  const form = $('#timesheetForm');
  if (!form) return;

  // Add button → queue entry
  const addBtn = $('#addRowBtn'); // rename this in HTML: <button id="addRowBtn">Add</button>
  if (addBtn) {
    addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        const entry = collectSingleEntry(); // grab current form
        queueEntry(entry); // add to list below
        form.reset(); // clear form for next entry
      } catch (err) {
        showError(err);
      }
    });
  }

  // Submit → send all queued
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payloads = getQueuedEntries();
      if (!payloads.length) throw new Error("No entries queued");
      for (const p of payloads) {
        await Data.submitEntry(p);
      }
      alert('Timesheet submitted successfully');
      clearQueuedEntries();
    } catch (err) {
      showError(err);
    }
  });
}

/* ---- helpers ---- */

// collect one entry from the input panel
function collectSingleEntry() {
  const empId = toInt($('#employeeSelect').value, 'Employee');
  const date = $('#dateInput').value;
  const ticketId = toInt($('#ticketSelect').value, 'Ticket');
  const start = $('#startTime').value;
  const hStd = toNum($('#hoursStd').value);
  const h15 = toNum($('#hours15').value);
  const h2 = toNum($('#hours2').value);
  const notes = $('#notes').value?.trim() || null;

  if (!date) throw new Error('Date required');
  if (!start) throw new Error('Start time required');
  if (hStd + h15 + h2 <= 0) throw new Error('At least 1 hour required');

  return { employeeId: empId, ticketId, date, startTime: start, hoursStandard: hStd, hours15x: h15, hours2x: h2, notes };
}

// add entry card to queued list
function queueEntry(entry) {
  const list = $('#entriesList');
  $('#queuedEntries').style.display = 'block'; // reveal container

  const div = document.createElement('div');
  div.className = 'entry-card';
  div.style.border = '1px solid #ddd';
  div.style.padding = '8px';
  div.style.margin = '6px 0';
  div.style.borderRadius = '4px';
  div.style.background = '#fafafa';

  div.textContent = `${entry.date} ${entry.startTime} — Ticket #${entry.ticketId} — Std: ${entry.hoursStandard}, 1.5x: ${entry.hours15x}, 2x: ${entry.hours2x} — Notes: ${entry.notes || ""}`;

  const btn = document.createElement('button');
  btn.textContent = "Remove";
  btn.className = "btn danger";
  btn.style.marginLeft = "10px";
  btn.onclick = () => div.remove();

  div.appendChild(btn);
  list.appendChild(div);
}

// get all queued entry objects
function getQueuedEntries() {
  const list = [...document.querySelectorAll('#entriesList .entry-card')];
  return list.map(div => JSON.parse(div.dataset.entry));
}

// clear queue
function clearQueuedEntries() {
  $('#entriesList').innerHTML = "";
  $('#queuedEntries').style.display = 'none';
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
  if (addBtn) addBtn.addEventListener('click', () => addToQueue().catch(showError));
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
