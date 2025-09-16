async function loadPendingTimesheets() {
  const tableBody = document.querySelector("#pendingTable tbody");
  tableBody.innerHTML = "<tr><td colspan='7'>Loading...</td></tr>";

  try {
    const res = await fetch("/api/timesheets/pending");
    if (!res.ok) throw new Error("Failed to fetch pending timesheets");
    const data = await res.json();

    if (!data.length) {
      tableBody.innerHTML = "<tr><td colspan='7'>No pending timesheets</td></tr>";
      return;
    }

    tableBody.innerHTML = "";
    data.forEach((entry) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${entry.firstName} ${entry.lastName}</td>
        <td>${entry.siteName}</td>
        <td>${entry.ticketId}</td>
        <td>${entry.date}</td>
        <td>${entry.hours}</td>
        <td>${entry.status}</td>
        <td>
          <button onclick="approve(${entry.entryId})">Approve</button>
          <button onclick="reject(${entry.entryId})">Reject</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    tableBody.innerHTML = `<tr><td colspan='7'>Error loading timesheets</td></tr>`;
  }
}

async function approve(entryId) {
  try {
    const res = await fetch(`/api/timesheets/approve/${entryId}`, { method: "POST" });
    if (res.ok) {
      alert("Approved!");
      loadPendingTimesheets();
    } else {
      alert("Approval failed");
    }
  } catch (err) {
    console.error(err);
    alert("Error approving timesheet");
  }
}

async function reject(entryId) {
  try {
    const res = await fetch(`/api/timesheets/reject/${entryId}`, { method: "POST" });
    if (res.ok) {
      alert("Rejected!");
      loadPendingTimesheets();
    } else {
      alert("Rejection failed");
    }
  } catch (err) {
    console.error(err);
    alert("Error rejecting timesheet");
  }
}

document.addEventListener("DOMContentLoaded", loadPendingTimesheets);
