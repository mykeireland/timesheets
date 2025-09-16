document.addEventListener('DOMContentLoaded', () => {
  loadPendingTimesheets().catch(showError);
});

async function loadPendingTimesheets() {
  const tbody = document.querySelector("#pendingTable tbody");
  tbody.innerHTML = `<tr><td colspan="7">Loading...</td></tr>`;

  try {
    // 👇 Use relative path so SWA proxy handles auth + routing
    const res = await fetch("/api/timesheets/pending");

    if (!res.ok) throw new Error("Failed to fetch pending timesheets");

    const data = await res.json();

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7">No pending timesheets found.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    data.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(row.firstName)} ${escapeHtml(row.lastName)}</td>
        <td>${escapeHtml(row.siteName)}</td>
        <td>${escapeHtml(row.ticketId)}</td>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.hours)}</td>
        <td>${escapeHtml(row.status)}</td>
        <td>
          <button onclick="approveTimesheet('${escapeHtml(row.ticketId)}', '${escapeHtml(row.date)}')">Approve</button>
          <button onclick="rejectTimesheet('${escapeHtml(row.ticketId)}', '${escapeHtml(row.date)}')">Reject</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showError(err);
    tbody.innerHTML = `<tr><td colspan="7">Error loading timesheets.</td></tr>`;
  }
}

async function approveTimesheet(ticketId, date) {
  alert(`TODO: Approve ticket ${ticketId} for ${date}`);
  // later -> POST /api/timesheets/approve
}

async function rejectTimesheet(ticketId, date) {
  alert(`TODO: Reject ticket ${ticketId} for ${date}`);
  // later -> POST /api/timesheets/reject
}

/* helpers */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]
  ));
}
function showError(err) {
  console.error(err);
  alert(err.message || String(err));
}
