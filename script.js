// script.js - UI logic using Data.j

document.addEventListener('DOMContentLoaded', () => {
  init().catch(showError);
});

async function init() {
  await populatePeople();
  addRow();         // start with one ro
  wireForm();
}

async function populatePeople() {
  const empSel = $('#employeeSelect');
  const mgrSel = $('#managerSelect');
  disable([empSel, mgrSel], true);
  const employees = await Data.employees(); // throws if API/CORS/SQL fail
  fillSelect(empSel, employees, 'Select Employee');
  fillSelect(mgrSel, employees, 'Select Manager'); // reuse for now
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
  const tickets = await Data.tickets(employeeId); // throws if API not ready
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
      console.log('Ready to submit', payloads);
      // TODO: loop Data.submitEntry(payload) when you're ready to POST
      alert('Submit will post to API next. This confirms wiring.');
    } catch (err) {
      showError(err);
    }
  });
}

/* helpers */
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
