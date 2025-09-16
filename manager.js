//helo
async function loadPendingTimesheets() {
  const tableBody = document.querySelector("#pendingTable tbody");
  tableBody.innerHTML = "<tr><td colspan='7'>Loading...</td></tr>";

  try {
    const res = await fetch(
      "https://func-timesheetsnet-api-dev-ghdtdedagnf8a0a7.australiasoutheast-01.azurewebsites.net/api/timesheets/pending"
    );

    if (!res.ok) throw new Error("Failed to fetch pending timesheets");

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      tableBody.innerHTML = "<tr><td colspan='7'>No pending timesheets</td></tr>";
      return;
    }

    tableBody.innerHTML = ""; // clear loader
    data.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.FirstName} ${row.LastName}</td>
        <td>${row.SiteName}</td>
        <td>${row.TicketId}</td>
        <td>${row.Date}</td>
        <td>${row.Hours}</td>
        <td>${row.Status}</td>
        <td>
          <button onclick="approveTimesheet(${row.TicketId}, '${row.FirstName}')">Approve</button>
          <button onclick="rejectTimesheet(${row.TicketId}, '${row.FirstName}')">Reject</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

  } catch (err) {
    console.error(err);
    tableBody.innerHTML = `<tr><td colspan='7' style="color:red;">${err.message}</td></tr>`;
  }
}

function approveTimesheet(ticketId, user) {
  alert(`Approve clicked for ${user} (ticket ${ticketId})`);
}

function rejectTimesheet(ticketId, user) {
  alert(`Reject clicked for ${user} (ticket ${ticketId})`);
}
