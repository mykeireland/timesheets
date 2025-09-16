document.addEventListener("DOMContentLoaded", () => {
  loadPending().catch(showError);
});

async function loadPending() {
  const tableBody = document.querySelector("#pendingTable tbody");
  tableBody.innerHTML = `<tr><td colspan="7">Loading...</td></tr>`;

  try {
    const res = await fetch("/api/timesheets/pending");
    if (!res.ok) throw new Error("Failed to fetch pending timesheets");
    const rows = await res.json();

    tableBody.innerHTML = "";

    if (!rows.length) {
      tableBody.innerHTML = `<tr><td colspan="7">No pending timesheets 🎉</td></tr>`;
      return;
    }

    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(row.firstName)} ${escapeHtml(row.lastName)}</td>
        <td>${escapeHtml(row.siteName)}</td>
        <td>${escapeHtml(row.ticketId)}</td>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.hours)}</td>
        <td>${escapeHtml(row.status)}</td>
        <td>
          <button class="btn-approve" onclick="approve('${row.ticketId}', '${row.date}')">Approve</button>
          <button class="btn-reject" onclick="reject('${row.ticketId}', '${row.date}')">Reject</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  } catch (err) {
    showError(err);
    tableBody.innerHTML = `<tr><td colspan="7">⚠️ Failed to load data</td></tr>`;
  }
}

function approve(ticketId, date) {
  alert(`Approve ticket ${ticketId} for ${date}`);
  // TODO: Call API to approve
}

function reject(ticketId, date) {
  alert(`Reject ticket ${ticketId} for ${date}`);
  // TODO: Call API to reject
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
  );
}

function showError(err) {
  console.error(err);
  alert(err.message || String(err));
}
