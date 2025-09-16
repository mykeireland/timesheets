async function loadPendingTimesheets() {
  try {
    const res = await fetch(
      "https://func-timesheetsnet-api-dev-ghdtdedagnf8a0a7.australiasoutheast-01.azurewebsites.net/api/timesheets/pending"
    );

    if (!res.ok) throw new Error("Failed to fetch pending timesheets");

    const data = await res.json();

    const table = document.getElementById("pendingTable");
    const tbody = table.querySelector("tbody");
    const loadingDiv = document.getElementById("loading");

    // hide loading
    loadingDiv.style.display = "none";
    table.style.display = "";

    tbody.innerHTML = "";

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7">No pending timesheets</td></tr>`;
      return;
    }

    for (const row of data) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(row.firstName)} ${escapeHtml(row.lastName)}</td>
        <td>${escapeHtml(row.siteName)}</td>
        <td>${escapeHtml(row.ticketId)}</td>
        <td>${escapeHtml(row.date)}</td>
        <td>${row.hours}</td>
        <td>${escapeHtml(row.status)}</td>
        <td>
          <button onclick="approveTimesheet('${row.ticketId}', '${row.date}')">Approve</button>
          <button onclick="rejectTimesheet('${row.ticketId}', '${row.date}')">Reject</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  } catch (err) {
    showError(err);
  }
}

function approveTimesheet(ticketId, date) {
  alert(`Approving ticket ${ticketId} for ${date}`);
  // TODO: call API endpoint
}

function rejectTimesheet(ticketId, date) {
  alert(`Rejecting ticket ${ticketId} for ${date}`);
  // TODO: call API endpoint
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

function showError(err) {
  console.error(err);
  alert(err.message || String(err));
}
