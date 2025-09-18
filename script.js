// script.js - Timesheet entry logic

document.addEventListener("DOMContentLoaded", () => {
  init().catch(showError);
});

/* -----------------------------
   API Wrapper
-------------------------------- */
const Data = {
  employees: async () => {
    const res = await fetch("/api/employees");
    if (!res.ok) throw new Error("Could not load employees");
    return res.json(); // [{ employee_id, first_name, last_name, ... }]
  },
  tickets: async () => {
    const res = await fetch("/api/tickets/open");
    if (!res.ok) throw new Error("Could not load tickets");
    return res.json(); // [{ ticket_id, cw_ticket_id, name, open_flag }]
  },
  submitEntry: async (payload) => {
    const res = await fetch("/api/timesheets/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Submit failed: ${text}`);
    }
    return res.json();
  },
};

/* -----------------------------
   Init + Form Wiring
-------------------------------- */
async function init() {
  await populateEmployees();
  await addRow(); // start with one row
  wireForm();
}

/* -----------------------------
   Load Employees
-------------------------------- */
async function populateEmployees() {
  const empSel = $("#employeeSelect");
  disable([empSel], true);

  const employees = await Data.employees();
  empSel.innerHTML = `<option value="">Select Employee</option>`;
  employees.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e.employee_id;
    opt.textContent = `${e.first_name} ${e.last_name}`;
    empSel.appendChild(opt);
  });

  disable([empSel], false);
}

/* -----------------------------
   Load Open Tickets
-------------------------------- */
async function loadOpenTickets(selectEl) {
  try {
    const tickets = await Data.tickets();
    selectEl.innerHTML = "";

    const defaultOpt = document.createElement("option");
    defaultOpt.value = "";
    defaultOpt.textContent = "Select Ticket";
    selectEl.appendChild(defaultOpt);

    tickets
      .filter(t => t.open_flag === true || t.open_flag === 1) // ✅ only open tickets
      .forEach(ticket => {
        const opt = document.createElement("option");
        opt.value = ticket.ticket_id;
        opt.textContent = `${ticket.cw_ticket_id} - ${ticket.name}`;
        selectEl.appendChild(opt);
      });
  } catch (err) {
    showError(err);
  }
}

/* -----------------------------
   Rows + Tickets
-------------------------------- */
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

/* -----------------------------
   Form Wiring
-------------------------------- */
function wireForm() {
  $("#timesheetForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const payloads = collectEntries();
      console.log("Submitting...", payloads);

      for (const p of payloads) {
        await Data.submitEntry(p);
      }

      alert("Timesheet submitted successfully");
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

/* -----------------------------
   Helpers
-------------------------------- */
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
    if (hStd + h15 + h2 <= 0) throw new Error("Hours must be greater than 0");

    return {
      employee_id: empId,   // ✅ match DB column
      ticket_id: ticketId,  // ✅ match DB column
      date,
      hours_standard: hStd,
      hours_15x: h15,
      hours_2x: h2,
      notes,
    };
  });
}

function $(sel) { return document.querySelector(sel); }
function disable(nodes, v) { nodes.forEach(n => n.disabled = v); }
function toInt(v, name) { const n = parseInt(v, 10); if (isNaN(n)) throw new Error(`${name} is required`); return n; }
function toNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function showError(err){ console.error(err); alert(err.message || String(err)); }
