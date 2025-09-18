// script.js — Timesheet entry (robust field mapping; no structural changes elsewhere)

document.addEventListener("DOMContentLoaded", () => {
  init().catch(showError);
});

/* ============================
   API
============================ */
const Data = {
  fetchJson: async (url, opts) => {
    const res = await fetch(url, opts);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} on ${url}${txt ? ` — ${txt}` : ""}`);
    }
    return res.json();
  },
  employees: () => Data.fetchJson("/api/employees"),
  ticketsOpen: () => Data.fetchJson("/api/tickets/open"),
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
    return res.json().catch(() => ({}));
  },
};

/* ============================
   INIT
============================ */
async function init() {
  await populateEmployees();     // employee list
  await addRow();                // one editable row
  wireForm();                    // submit + manager nav
}

/* ============================
   NORMALIZERS
============================ */
function normalizeEmployees(raw) {
  // Accepts any of: employee_id/id/EmployeeId/user_id etc, and *Name variations
  return (Array.isArray(raw) ? raw : []).map(e => {
    const id =
      e.employee_id ?? e.id ?? e.EmployeeId ?? e.user_id ?? e.userId ?? null;

    const first =
      e.first_name ?? e.firstName ?? e.FirstName ?? e.given_name ?? e.givenName ?? "";
    const last =
      e.last_name ?? e.lastName ?? e.LastName ?? e.surname ?? e.Surname ?? "";
    let name = `${first} ${last}`.trim();

    if (!name) {
      name = e.name ?? e.display_name ?? e.displayName ?? ""; // fallbacks
    }
    if (id == null) return null;
    return { id: Number(id), name: name || String(id) };
  }).filter(Boolean);
}

function isOpenFlag(val) {
  if (val === true || val === 1) return true;
  if (typeof val === "string") return val.toLowerCase() === "true";
  return false;
}

function normalizeTickets(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter(t => isOpenFlag(t.open_flag ?? t.open ?? t.isOpen))
    .map(t => {
      const id = t.ticket_id ?? t.id ?? t.TicketId ?? null;
      const code = t.cw_ticket_id ?? t.cwTicketId ?? "";
      const name = t.name ?? t.ticket_name ?? t.description ?? "";
      let label = `${code}${code && name ? " - " : ""}${name}`.trim();
      if (!id) return null;
      return { id: Number(id), label: label || String(id) };
    })
    .filter(Boolean);
}

/* ============================
   EMPLOYEES
============================ */
async function populateEmployees() {
  const empSel = $("#employeeSelect");
  disable([empSel], true);
  empSel.innerHTML = `<option value="">Select Employee</option>`;

  const raw = await Data.employees();
  // Debug aid (visible in DevTools):
  console.debug("Employees raw:", raw);

  const list = normalizeEmployees(raw);
  if (list.length === 0) {
    console.warn("No employees after normalization.");
  }

  list.forEach(e => {
    const opt = document.createElement("option");
    opt.value = String(e.id);
    opt.textContent = e.name;
    empSel.appendChild(opt);
  });

  disable([empSel], false);
}

/* ============================
   TICKETS (OPEN ONLY)
============================ */
async function loadOpenTickets(selectEl) {
  disable([selectEl], true);
  selectEl.innerHTML = `<option value="">Loading tickets…</option>`;

  const raw = await Data.ticketsOpen();
  console.debug("Tickets raw:", raw);

  const tickets = normalizeTickets(raw);
  selectEl.innerHTML = `<option value="">Select Ticket</option>`;

  tickets.forEach(t => {
    const opt = document.createElement("option");
    opt.value = String(t.id);
    opt.textContent = t.label;
    selectEl.appendChild(opt);
  });

  disable([selectEl], false);
}

/* ============================
   ROWS
============================ */
async function addRow() {
  const tbody = $("#timesheetBody");
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="col-date"><input type="date" required></td>
    <td class="col-ticket"><select class="ticketSelect" required></select></td>
    <td class="col-num"><input type="number" step="0.1" min="0" value="0" required></td>
    <td class="col-num"><input type="number" step="0.1" min="0" value="0"></td>
    <td class="col-num"><input type="number" step="0.1" min="0" value="0"></td>
    <td class="col-notes"><input type="text" maxlength="500" placeholder="Notes (optional)"></td>
    <td class="col-action action-cell">
      <button type="button" class="btn remove-btn" onclick="this.closest('tr').remove()">Remove</button>
    </td>
  `;
  tbody.appendChild(tr);

  const ticketSel = tr.querySelector(".ticketSelect");
  await loadOpenTickets(ticketSel);
}

/* ============================
   FORM WIRING
============================ */
function wireForm() {
  $("#timesheetForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const payloads = collectEntries();
      console.log("Submitting payloads:", payloads);

      for (const p of payloads) {
        await Data.submitEntry(p);
      }

      alert("Timesheet submitted successfully");
      $("#timesheetBody").innerHTML = "";
      await addRow();
    } catch (err) {
      showError(err);
    }
  });

  const managerBtn = $("#managerBtn");
  if (managerBtn) {
    managerBtn.addEventListener("click", () => {
      window.location.href = "manager.html";
    });
  }
}

/* ============================
   PAYLOAD (matches earlier working shapes)
============================ */
function collectEntries() {
  const empId = toInt($("#employeeSelect").value, "Employee");
  const rows = [...document.querySelectorAll("#timesheetBody tr")];
  if (!rows.length) throw new Error("No rows to submit");

  return rows.map(tr => {
    const date = tr.querySelector('input[type="date"]').value;
    const ticketId = toInt(tr.querySelector(".ticketSelect").value, "Ticket");
    const nums = tr.querySelectorAll('input[type="number"]');
    const hStd = toNum(nums[0].value);
    const h15  = toNum(nums[1].value);
    const h2   = toNum(nums[2].value);
    const notes = tr.querySelector('input[type="text"]').value?.trim() || null;

    if (!date) throw new Error("Date is required on all rows");
    const total = +(hStd + h15 + h2).toFixed(2);
    if (total <= 0) throw new Error("Hours must be greater than 0");

    // Keep original client contract; backend SubmitTimesheet maps this.
    return {
      employeeId: empId,
      ticketId: ticketId,
      date,
      hoursStandard: hStd,
      hours15x: h15,
      hours2x: h2,
      notes,
    };
  });
}

/* ============================
   UTIL
============================ */
function $(sel) { return document.querySelector(sel); }
function disable(nodes, v) { (Array.isArray(nodes) ? nodes : [nodes]).forEach(n => n && (n.disabled = v)); }
function toInt(v, name) { const n = parseInt(v, 10); if (isNaN(n)) throw new Error(`${name} is required`); return n; }
function toNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function showError(err){ console.error(err); alert(err.message || String(err)); }
