document.addEventListener("DOMContentLoaded", () => {
  loadPendingTimesheets().catch(showError);
});

async function loadPendingTimesheets() {
  const tbody = document.querySelector("#pendingTable tbody");
  tbody.innerHTML = "<tr><td colspan='7'>Loading...</td></tr>";

  try {
    const res = await fetch(
      "https://func-timesheetsnet-api-dev-ghdtdedagnf8a0a7.australiasoutheast-01.azurewebsites.net/api/timesheets/pending"
    );

    if (!res.ok) throw new Error("Failed to fetch pending timesheets");
    const data = await res.json();
    console.log("Fetched data:", data);

    tbody.innerHTML = "";
    if (!data.length) {
      tbody.innerHTML = "<tr><td colspan='7'>No pending timesheets found</td></tr>";
      return;
    }

    for (const row of data) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(row.firstName)} ${escapeHtml(row.lastName)}</td>
        <td>${escapeHtml(row.siteName)}</td>
        <td>${escapeHtml(row.ticketId)}</td>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.hours)}</td>
        <td>${escapeHtml(row.status)}</td>
        <td>
          <button onclick="approveTimesheet('${row.ticketId}','${row.date}','${row.firstName}','${row.lastName}')">Approve</button>
          <button onclick="rejectTimesheet('${row.ticketId}','${row.date}','${row.firstName}','${row.lastName}')">Reject</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  } catch (err) {
    showError(err);
    tbody.innerHTML = "<tr><td colspan='7'>Error loading timesheets</td></tr>";
  }
}

async function approveTimesheet(ticketId, date, firstName, lastName) {
  alert(`Would approve ${ticketId} for ${firstName} ${lastName} (${date})`);
  // TODO: replace with fetch PUT/PATCH to /api/timesheets/approve
}

async function rejectTimesheet(ticketId, date, firstName, lastName) {
  alert(`Would reject ${ticketId} for ${firstName} ${lastName} (${date})`);
  // TODO: replace with fetch PUT/PATCH to /api/timesheets/reject
}

/* helpers */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function showError(err) {
  console.error(err);
  alert(err.message || String(err));
}
