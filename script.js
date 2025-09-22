"use strict";

/* ============================
   API (stable names)
============================ */
const Data = {
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

  employees: () => Data.fetchJson(`${window.API_BASE}/employees`),
  tickets:   () => Data.fetchJson(`${window.API_BASE}/tickets/open`),
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
    return res.text().then(t => { try { return t ? JSON.parse(t) : {}; } catch { return {}; } });
  },
};

/* ============================
   Helpers
============================ */
function $(sel) { return document.querySelector(sel); }
function toInt(v, name) { const n = parseInt(v,10); if (isNaN(n)) throw new Error(`${name} is required`); return n; }
function toNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function showError(err){ console.error(err); alert(err.message || String(err)); }

/* ============================
   Normalisers
============================ */
function toEmployeeItems(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(e => {
    if (!e) return null;
    const id = e.employee_id ?? e.employeeId ?? e.id ?? e.user_id ?? e.userId ?? null;
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
    const id    = t.ticketId ?? t.ticket_id ?? t.id ?? null;
    const cw    = t.cwTicketId ?? t.cw_ticket_id ?? t.cwId ?? "";
    const name  = t.ticketName ?? t.ticket_name ?? t.name ?? "";
    const site  = t.siteName ?? t.site_name ?? t.site ?? "";
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
   Init
============================ */
document.addEventListener("DOMContentLoaded", () => {
  init().catch(showError);
});

async function init() {
  await populatePeople();
  await loadOpenTickets($("#entryTicket"));
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
   Tickets
============================ */
async function loadOpenTickets(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = `<option value="">Loading…</option>`;
  const ticketsRaw = await Data.tickets();
  const tickets = toTicketItems(ticketsRaw);
  selectEl.innerHTML = `<option value="">Select Ticket</option>`;
  tickets.forEach(t => {
    const opt = document.createElement("option");
    opt.value = String(t.id);
    opt.textContent = t.label;
    selectEl.appendChild(opt);
  });
}

/* ============================
   Wire form
============================ */
function wireForm() {
  const form = $('#timesheetForm');
  if (!form) return;

  // Add → queue entry
  const addBtn = $('#addRowBtn');
  if (addBtn) {
    addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      try {
        const entry = collectSingleEntry();
        queueEntry(entry);
        form.reset();
      } catch (err) {
        showError(err);
      }
    });
  }

  // Submit → only check queue
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payloads = getQueuedEntries();
      if (!payloads.length) throw new Error("No entries queued");  // ✅ only rule
      for (const p of payloads) {
        await Data.submitEntry(p);
      }
      alert("Timesheet submitted successfully");
      clearQueuedEntries();
    } catch (err) {
      showError(err);
    }
  });

  // Manager view
  const mgrBtn = $('#managerBtn');
  if (mgrBtn) {
    mgrBtn.addEventListener('click', () => { window.location.href = 'manager.html'; });
  }
}

/* ============================
   Collect + Queue
============================ */
function collectSingleEntry() {
  const empId = toInt($("#employeeSelect").value, "Employee");
  const date = $("#entryDate").value;
  const ticketId = toInt($("#entryTicket").value, "Ticket");
  const start = $("#entryStart").value;
  const hStd = toNum($("#hoursStd").value);
  const h15 = toNum($("#hours15").value);
  const h2 = toNum($("#hours2").value);
  const notes = $("#entryNotes").value?.trim() || null;

  if (!date) throw new Error("Date required");
  if (!start) throw new Error("Start time required");
  if (hStd + h15 + h2 <= 0) throw new Error("At least 1 hour required");

  return { employeeId: empId, ticketId, date, startTime: start, hoursStandard: hStd, hours15x: h15, hours2x: h2, notes };
}

function addToQueue() {
  try {
    const entry = collectSingleEntry();
    const tbody = $("#queueTable");
    $("#queuedEntries").style.display = "block";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(entry.date)}</td>
      <td>${escapeHtml(entry.ticketId)}</td>
      <td>${escapeHtml(entry.startTime)}</td>
      <td>${entry.hoursStandard}</td>
      <td>${entry.hours15x}</td>
      <td>${entry.hours2x}</td>
      <td>${escapeHtml(entry.notes || "")}</td>
      <td><button type="button" class="btn danger">Remove</button></td>
    `;
    tr.dataset.entry = JSON.stringify(entry);

    tr.querySelector("button").addEventListener("click", () => tr.remove());

    tbody.appendChild(tr);

    // reset form inputs for next add
    $("#entryDate").value = "";
    $("#entryStart").value = "";
    $("#hoursStd").value = "0";
    $("#hours15").value = "0";
    $("#hours2").value = "0";
    $("#entryNotes").value = "";
    $("#entryTicket").selectedIndex = 0;
  } catch (err) {
    showError(err);
  }
}

function getQueuedEntries() {
  return [...document.querySelectorAll("#queueTable tr")].map(tr => JSON.parse(tr.dataset.entry));
}

function clearQueuedEntries() {
  $("#queueTable").innerHTML = "";
  $("#queuedEntries").style.display = "none";
}

/* ============================
   Fill select helper
============================ */
function fillSelect(sel, items, placeholder) {
  if (!sel) return;
  sel.innerHTML = [`<option value="">${placeholder}</option>`]
    .concat(items.map(i => `<option value="${escapeHtml(i.id)}">${escapeHtml(i.name)}</option>`))
    .join("");
}
