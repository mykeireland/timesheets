let rowCounter = 0;
let selectedEmployeeId = null;

function populateDropdowns() {
  const empSelect = document.getElementById("employeeSelect");
  const mgrSelect = document.getElementById("managerSelect");

  EMPLOYEES.forEach(emp => {
    const opt = document.createElement("option");
    opt.value = emp.id;
    opt.textContent = emp.name;
    empSelect.appendChild(opt);
  });

  MANAGERS.forEach(mgr => {
    const opt = document.createElement("option");
    opt.value = mgr.id;
    opt.textContent = mgr.name;
    mgrSelect.appendChild(opt);
  });

  empSelect.addEventListener("change", () => {
    selectedEmployeeId = parseInt(empSelect.value);
    updateAllTicketDropdowns();
  });
}

function updateAllTicketDropdowns() {
  const rows = document.querySelectorAll("#timesheetBody tr");
  rows.forEach(row => {
    const ticketSelect = row.querySelector("select[name^='ticket-']");
    updateTicketOptions(ticketSelect);
  });
}

function updateTicketOptions(selectElement) {
  if (!selectedEmployeeId) return;

  const options = TICKETS.filter(t => t.employeeId === selectedEmployeeId);
  selectElement.innerHTML = `<option value="">Select ticket</option>`;
  options.forEach(ticket => {
    const opt = document.createElement("option");
    opt.value = ticket.id;
    opt.textContent = ticket.label;
    selectElement.appendChild(opt);
  });
}

function addRow() {
  const tbody = document.getElementById("timesheetBody");
  const row = document.createElement("tr");

  row.innerHTML = `
    <td><input type="date" name="date-${rowCounter}" required /></td>
    <td>
      <select name="ticket-${rowCounter}" required></select>
    </td>
    <td><input type="number" name="hours_std-${rowCounter}" min="0" step="0.1" /></td>
    <td><input type="number" name="hours_ot_15x-${rowCounter}" min="0" step="0.1" /></td>
    <td><input type="number" name="hours_ot_2x-${rowCounter}" min="0" step="0.1" /></td>
    <td><textarea name="notes-${rowCounter}" rows="1"></textarea></td>
    <td><button type="button" onclick="removeRow(this)">🗑</button></td>
  `;

  tbody.appendChild(row);
  updateTicketOptions(row.querySelector("select"));
  rowCounter++;
}

function removeRow(btn) {
  btn.closest("tr").remove();
}

function clearForm() {
  document.getElementById("timesheetBody").innerHTML = "";
  rowCounter = 0;
  addRow();
}

function printForm() {
  window.print();
}

document.getElementById("timesheetForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const employee = document.getElementById("employeeSelect").value;
  const manager = document.getElementById("managerSelect").value;

  if (!employee || !manager) {
    alert("Please select both employee and manager.");
    return;
  }

  const entries = [];

  for (let i = 0; i < rowCounter; i++) {
    const get = name => document.querySelector(`[name="${name}-${i}"]`);
    const date = get("date")?.value;
    const ticket = get("ticket")?.value;
    const std = parseFloat(get("hours_std")?.value) || 0;
    const ot15 = parseFloat(get("hours_ot_15x")?.value) || 0;
    const ot2 = parseFloat(get("hours_ot_2x")?.value) || 0;
    const notes = get("notes")?.value || "";

    if (date && ticket) {
      entries.push({
        employeeId: parseInt(employee),
        managerId: manager,
        date,
        ticketId: ticket,
        hours_standard: std,
        hours_15x: ot15,
        hours_2x: ot2,
        notes
      });
    }
  }

  console.log("📤 Submitted timesheet data:", entries);
  alert(`Submitted ${entries.length} entry(ies). See console for output.`);
});

populateDropdowns();
addRow();
