async function loadPendingTimesheets() {
  const table = document.querySelector('#pendingTable tbody');
  table.innerHTML = "<tr><td colspan='7'>Loading...</td></tr>";

  try {
    const res = await fetch("/api/timesheets/pending"); // SWA proxies this
    if (!res.ok) throw new Error("Failed to fetch pending timesheets");
    const data = await res.json();

    if (!data.length) {
      table.innerHTML = "<tr><td colspan='7'>No pending entries</td></tr>";
      return;
    }

    table.innerHTML = "";
    data.forEach(entry => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
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
      table.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    table.innerHTML = "<tr><td colspan='7'>Error loading timesheets</td></tr>";
  }
}

async function approve(id) {
  const res = await fetch(`/api/timesheets/approve/${id}`, { method: "POST" });
  if (res.ok) {
    alert("Approved!");
    loadPendingTimesheets();
  } else {
    alert("Approval failed");
  }
}

async function reject(id) {
  const res = await fetch(`/api/timesheets/reject/${id}`, { method: "POST" });
  if (res.ok) {
    alert("Rejected!");
    loadPendingTimesheets();
  } else {
    alert("Rejection failed");
  }
}

document.addEventListener("DOMContentLoaded", loadPendingTimesheets);
