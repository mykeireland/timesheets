// script.js — Single-authority, stable front-end API + UI wiring
// Drop this file into the same place your index.html loads script.js from.

"use strict";

/* ============================
   API (stable surface)
============================ */
const Data = {
  // low-level fetch with good error messages
  fetchJson: async (url, opts) => {
    const res = await fetch(url, opts);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} on ${url}${txt ? ` — ${txt}` : ""}`);
    }
    // If empty body, return []
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return [];
    return res.json();
  },

  // stable high-level methods — keep both names so old code works
  employees: () => Data.fetchJson("/api/employees"),
  ticketsOpen: () => Data.fetchJson("/api/tickets/open"),
  tickets: () => Data.ticketsOpen(), // alias for historical compatibility

  submitEntry: async (payload) => {
    const res = await fetch("/api/timesheets/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Submit failed (HTTP ${res.status})${txt ? ` — ${txt}` : ""}`);
    }
    // optional JSON response expected; ignore or return {} if none
    return res.text().then(t => {
      try { return JSON.parse(t || "{}"); } catch (_) { return {}; }
    });
  }
};

/* ============================
   UTILITIES
============================ */
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }
function disable(nodes, v) { (Array.isArray(nodes) ? nodes : [nodes]).forEach(n => n && (n.disabled = v)); }
function toInt(v, name) { const n = parseInt(v, 10); if (isNaN(n)) throw new Error(`${name} is required`); return n; }
function toNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function showError(err){ console.error(err); alert(err.message || String(err)); }

/* ============================
   NORMALISERS (make UI resilient)
   - Employees: return { id, name }
   - Tickets: return { id, cwId, name, site }
============================ */
function normalizeEmployees(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(e => {
    const id = e.employee_id ?? e.employeeId ?? e.id ?? e.user_id ?? e.userId ?? null;
    const first = e.first_name ?? e.firstName ?? "";
    const last = e.last_name ?? e.lastName ?? "";
    let name = `${first} ${last}`.trim();
    if (!name) name = e.display_name ?? e.name ?? `${id}`;
    if (id == null) return null;
    return { id: Number(id), name: String(name) };
  }).filter(Boolean);
}

function normalizeTickets(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(t => {
    const id = t.ticket_id ?? t.ticketId ?? t.id ?? null;
    const cw = t.cw_ticket_id ?? t.cwTicketId ?? t.cwId ?? "";
    const name = t.ticketName ?? t.ticket_name ?? t.name ?? t.ticket_name_display ?? "";
    const site = t.siteName ?? t.site_name ?? t.site ?? "";
    // open flag handling (if present)
    const openFlag = t.open_flag ?? t.openFlag ?? t.open ?? t.isOpen;
    // If openFlag exists and is false-y, skip
    if (openFlag !== undefined && !(openFlag === true || openFlag === 1 || String(openFlag).toLowerCase() === "true")) {
      return null;
    }
    if (!id) return null;
    return { id: Number(id), cwId: String(cw), name: String(name), site: String(site) };
  }).filter(Boolean);
}

/* ============================
   UI: populate employees
============================ */
async function populateEmployees() {
  const empSel = $("#employeeSelect");
  if (!empSel) return;
  try {
    disable([empSel], true);
    empSel.innerHTML = `<option value="">Loading employees…</option>`;

    const raw = await Data.employees();
    console.debug("Employees raw:", raw);
    const list = normalizeEmployees(raw);

    empSel.innerHTML = `<option value="">Select Employee</option>`;
    list.forEach(e => {
      const opt = document.createElement("option");
      opt.value = String(e.id);
      opt.textContent = e.name;
      empSel.appendChild(opt);
    });

    disable([empSel], false);
  } catch (err) {
    empSel.innerHTML = `<option value="">Error loading employees</option>`;
    showError(err);
  }
}

/* ============================
   UI: load open tickets into a specific select element
   (uses Data.ticketsOpen() under the hood)
============================ */
async function loadOpenTicketsInto(selectEl) {
  if (!selectEl) return;
  try {
    disable([selectEl], true);
    selectEl.innerHTML = `<option value="">Loading tickets…</option>`;

    const raw = await Data.ticketsOpen();
    console.debug("Tickets raw:", raw);
    const tickets = normalizeTickets(raw);

    selectEl.innerHTML = `<option value="">Select Ticket</option>`;
    tickets.forEach(t => {
      const opt = document.createElement("option");
      opt.value = String(t.id);
      // human-friendly label
      const cw = t.cwId || "—";
      const label = `${cw} — ${t.name || "(no title)"}${t.site ? ` (${t.site})` : ""}`;
      opt.textContent = label;
      selectEl.appendChild(opt);
    });

    disable([selectEl], false);
  } catch (err) {
    selectEl.innerHTML = `<option value="">Error loading tickets</option>`;
    console.error("Failed to load tickets:", err);
    // Do not alert user every time ticket load fails to prevent noise; show once.
  }
}

/* ============================
   Rows: add one row (ticket select will be loaded)
============================ */
async function addRow() {
  const tbody = $("#timesheetBody");
  if (!tbody) throw new Error("Timesheet table body (#timesheetBody) not found");

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="col-date"><input type="date" required></td>
    <td class="col-ticket"><select class="ticketSelect" required></select></td>
    <td class="col-num"><input type="number" step="0.1" min="0" value="0" required></td>
    <td class="col-num"><input type="number" step="0.1" min="0" value="0"></td>
    <td class="col-num"><input type="number" step="0.1" min="0" value="0"></td>
    <td class="col-notes"><input type="text" maxlength="500" placeholder="Notes (optional)"></td>
    <td class="col-action action-cell"><button type="button" class="btn remove-btn">Remove</button></td>
  `.trim();

  tbody.appendChild(tr);

  // hook remove button (avoid inline onclick)
  const rem = tr.querySelector(".remove-btn");
  if (rem) rem.addEventListener("click", () => tr.remove());

  // load tickets for this row
  const ticketSel = tr.querySelector(".ticketSelect");
  await loadOpenTicketsInto(ticketSel);
}

/* ============================
   Collect entries and submit
============================ */
function collectEntries() {
  const empId = $("#employeeSelect")?.value;
  if (!empId) throw new Error("Please select an employee");

  const rows = [...document.querySelectorAll("#timesheetBody tr")];
  if (!rows.length) throw new Error("No rows to submit");

  return rows.map(tr => {
    const date = tr.querySelector('input[type="date"]').value;
    const ticketVal = tr.querySelector('.ticketSelect')?.value;
    const nums = tr.querySelectorAll('input[type="number"]');
    const notes = tr.querySelector('input[type="text"]')?.value?.trim() || null;

    const hoursStandard = toNum(nums[0]?.value || 0);
    const hours15x = toNum(nums[1]?.value || 0);
    const hours2x = toNum(nums[2]?.value || 0);

    if (!date) throw new Error("Date is required on all rows");
    if (!ticketVal) throw new Error("Please select a ticket for each row");
    const total = +(hoursStandard + hours15x + hours2x).toFixed(2);
    if (total <= 0) throw new Error("Hours must be greater than 0");

    return {
      employeeId: Number(empId),
      ticketId: Number(ticketVal),
      date,
      hoursStandard,
      hours15x,
      hours2x,
      notes
    };
  });
}

/* ============================
   Wiring: attach events
============================ */
function wireForm() {
  const form = $("#timesheetForm");
  if (form) {
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      try {
        const payloads = collectEntries();
        console.debug("Submitting payloads:", payloads);
        for (const payload of payloads) {
          await Data.submitEntry(payload);
        }
        alert("Timesheet(s) submitted successfully");
        // reset table to one fresh row
        $("#timesheetBody").innerHTML = "";
        await addRow();
      } catch (err) {
        showError(err);
      }
    });
  }

  // Employee change: reload tickets per row (optional)
  const empSel = $("#employeeSelect");
  if (empSel) {
    empSel.addEventListener("change", async () => {
      // refresh ticket dropdowns (keeps user choices simpler)
      const rows = [...document.querySelectorAll("#timesheetBody tr")];
      for (const tr of rows) {
        const ticketSel = tr.querySelector(".ticketSelect");
        await loadOpenTicketsInto(ticketSel);
      }
    });
  }

  // Manager view button
  const managerBtn = $("#managerBtn");
  if (managerBtn) {
    managerBtn.addEventListener("click", () => {
      // go to manager page (same origin)
      window.location.href = "manager.html";
    });
  }

  // Add row button
  const addBtn = $("#addRowBtn");
  if (addBtn) {
    addBtn.addEventListener("click", () => addRow().catch(showError));
  }
}

/* ============================
   INIT
============================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await populateEmployees();
    // start with a single row
    await addRow();
    wireForm();
  } catch (err) {
    showError(err);
  }
});
