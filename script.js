// script.js - Timesheet entry logic
document.addEventListener('DOMContentLoaded', () => {
  init().catch(showError);
});

/* -----------------------------
   API Wrapper
-------------------------------- */
const Data = {
  employees: async () => {
    const res = await fetch("/api/employees");
    if (!res.ok) throw new Error("Could not load employees");
    return res.json();
  },
  tickets: async (employeeId) => {
    const res = await fetch(`/api/tickets/${employeeId}`);
    if (!res.ok) throw new Error("Could not load tickets");
    return res.json();
  },
  submitEntry: async (payload) => {
    const res = await fetch("/api/timesheets/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Submit failed");
    return res.json();
  },
};

/* -----------------------------
   Init + Form Wiring
-------------------------------- */
async function init() {
  await populatePeople();
  addRow(); // start with one row
  wireForm();
}

async function populatePeople() {
  const empSel = $('#employeeSelect');
  const mgrSel = $('#managerSelect');
  disable([empSel, mgrSel], true);

  const employees = await Data.employees();
  fillSelect(empSel, employees, 'Select Employee');
  fillSelect(mgrSel, employees, 'Select Manager');

  disable([empSel, mgrSel], false);
}

async function addRow() {
  const tbody = $('#timesheetBody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="date" required></td>
    <td>
      <select class="ticketSelect" required>
        <option value="">Select Ticket</option>
      </select>
    </td>
    <td><input type="number" step="0.1" min="0" value="0" required></td>
    <td><input type="number" step="0.1" min="0" value="0"></td>
    <td><input type="number" step="0.1" min="0" value="0"></td>
    <td><input type="text" maxlength="500" placeholder="Notes (optional)"></td>
    <td><button type="button" class="btn" onclick="this.closest('tr').remove()">Remove</button></td>
  `;
  tbody.appendChild(tr);

  const empId = $('#employeeSelect').value;
  if (empId) await refreshTicketsForRow(tr, empId);
}

async function refreshTicketsForRow(tr, employeeId) {
  const sel = tr.querySelector('.ticketSelect');
  sel.disabled = true;
  const tickets = await Data.tickets(employeeId);
  fillSelect(sel, tickets, 'Select Ticket');
  sel.disabled = false;
}

function wireForm() {
  $('#employeeSelect').addEventListener('change', async (e) => {
    const empId = e.target.value;
    const rows = document.querySelectorAll('#timesheetBody tr');
    for (const tr of rows) await refreshTicketsForRow(tr, empId);
  });

  $('#timesheetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payloads = collectEntries();
      console.log('Submitting...', payloads);

      for (const p of payloads) {
        await Data.submitEntry(p);
      }

      alert('Timesheet submitted successfully');
    } catch (err) {
      showError(err);
    }
  });

  // Manager view button
  $('#managerBtn').addEventListener('click', () => {
    window.location.href = "manager.html";
  });
}

/* -----------------------------
   Helpers
-------------------------------- */
function fillSelect(selOrArray, items, placeholder) {
  const mk = (sel) => {
    sel.innerHTML = ['<option value="">'+placeholder+'</option>']
      .concat(items.map(i => `<option value="${escapeHtml(i.id)}">${escapeHtml(i.name)}</option>`)).join('');
  };
  Array.isArray(selOrArray) ? selOrArray.forEach(mk) : mk(selOrArray);
}

function collectEntries() {
  const empId = toInt($('#employeeSelect').value, 'Employee');
  const rows = [...document.querySelectorAll('#timesheetBody tr')];
  if (!rows.length) throw new Error('No rows to submit');

  return rows.map(tr => {
    const date = tr.querySelector('input[type="date"]').value;
    const ticketId = toInt(tr.querySelector('.ticketSelect').value, 'Ticket');
    const nums = tr.querySelectorAll('input[type="number"]');
    const hStd = toNum(nums[0].value);
    const h15  = toNum(nums[1].value);
    const h2   = toNum(nums[2].value);
    const notes = tr.querySelector('input[type="text"]').value?.trim() || null;

    if (!date) throw new Error('Date is required on all rows');
    if (hStd + h15 + h2 <= 0) throw new Error('Hours must be greater than 0');

    return {
      employeeId: empId,
      ticketId,
      date,
      hoursStandard: hStd,
      hours15x: h15,
      hours2x: h2,
      notes
    };
  });
}

function $(sel) { return document.querySelector(sel); }
function disable(nodes, v) { nodes.forEach(n => n.disabled = v); }
function toInt(v, name) { const n = parseInt(v,10); if (isNaN(n)) throw new Error(`${name} is required`); return n; }
function toNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function showError(err){ console.error(err); alert(err.message || String(err)); }
