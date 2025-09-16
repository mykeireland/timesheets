// manager.js

// Show errors nicely
function showError(err) {
  console.error(err);
  alert(err.message || String(err));
}

// Load pending timesheets for manager approval
function loadPendingTimesheets() {
  fetch("/api/timesheets/pending")
    .then(res => {
      if (!res.ok) throw new Error("Failed to fetch pending timesheets");
      return res.json();
    })
    .then(data => {
      const tbody = document.querySelector("#pendingTable tbody");
      if (!tbody) return;

      tbody.innerHTML = "";
      data.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.first_name} ${row.last_name}</td>
          <td>${row.site_name}</td>
          <td>${row.cw_ticket_id}</td>
          <td>${row.date}</td>
          <td>${row.hours_decimal}</td>
          <td>${row.status}</td>
          <td>
            <button onclick="updateStatus(${row.timesheet_entry_id}, 'approved')">Approve</button>
            <button onclick="updateStatus(${row.timesheet_entry_id}, 'rejected')">Reject</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    })
    .catch(showError);
}

// Update a timesheet status
function updateStatus(entryId, status) {
  fetch(`/api/timesheets/${entryId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  })
    .then(res => {
      if (!res.ok) throw new Error("Failed to update timesheet status");
      return res.json();
    })
    .then(() => {
      alert(`Timesheet ${entryId} ${status}`);
      loadPendingTimesheets();
    })
    .catch(showError);
}

// Initialize manager view
document.addEventListener("DOMContentLoaded", () => {
  loadPendingTimesheets();
});
