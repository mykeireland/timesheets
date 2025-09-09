let rowCounter = 0;

function addRow() {
  const tbody = document.getElementById("timesheetBody");
  const row = document.createElement("tr");
  row.innerHTML = `
    <td><input type="date" name="date-${rowCounter}" required /></td>
    <td>
      <select name="ticket-${rowCounter}" required>
        <option value="">Select ticket</option>
        ${TICKETS.map(t => `<option value="${t}">${t}</option>`).join("")}
      </select>
    </td>
    <td><input type="number" name="std-${rowCounter}" step="0.1" min="0" /></td>
    <td><input type="number" name="ot15-${rowCounter}" step="0.1" min="0" /></td>
    <td><input type="number" name="ot2-${rowCounter}" step="0.1" min="0" /></td>
    <td><button type="button" onclick="removeRow(this)">🗑️</button></td>
  `;
  tbody.appendChild(row);
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

  const data = [];
  for (let i = 0; i < rowCounter; i++) {
    const date = document.querySelector(`[name="date-${i}"]`)?.value;
    const ticket = document.querySelector(`[name="ticket-${i}"]`)?.value;
    const std = parseFloat(document.querySelector(`[name="std-${i}"]`)?.value) || 0;
    const ot15 = parseFloat(document.querySelector(`[name="ot15-${i}"]`)?.value) || 0;
    const ot2 = parseFloat(document.querySelector(`[name="ot2-${i}"]`)?.value) || 0;

    if (date && ticket) {
      data.push({ date, ticket, hours: { std, ot15, ot2 } });
    }
  }

  console.log("📝 Timesheet Submitted:", data);
  alert(`Submitted ${data.length} entries. Check console for details.`);
});
