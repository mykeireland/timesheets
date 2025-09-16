async function loadPendingTimesheets() {
  const container = document.getElementById("pending-timesheets");
  container.innerHTML = "<p>Loading...</p>";

  try {
    const res = await fetch(
      "https://func-timesheetsNET-api-dev.azurewebsites.net/api/timesheets/pending",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    if (!res.ok) throw new Error("Failed to fetch pending timesheets");

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = "<p>No pending timesheets found.</p>";
      return;
    }

    // Build table
    let html = `
      <table border="1" cellpadding="6">
        <thead>
          <tr>
            <th>First</th>
            <th>Last</th>
            <th>Site</th>
            <th>Ticket</th>
            <th>Date</th>
            <th>Hours</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach(row => {
      html += `
        <tr>
          <td>${row.firstName}</td>
          <td>${row.lastName}</td>
          <td>${row.siteName}</td>
          <td>${row.ticketId}</td>
          <td>${row.date}</td>
          <td>${row.hours}</td>
          <td>${row.status}</td>
          <td>
            <button onclick="approveTimesheet('${row.ticketId}', '${row.firstName}')">Approve</button>
            <button onclick="rejectTimesheet('${row.ticketId}', '${row.firstName}')">Reject</button>
          </td>
        </tr>
      `;
    });

    html += "</tbody></table>";
    container.innerHTML = html;

  } catch (err) {
    console.error("Error loading timesheets:", err);
    container.innerHTML = `<p style="color:red;">${err.message}</p>`;
  }
}

// Dummy handlers (you’ll hook to API later)
function approveTimesheet(ticketId, user) {
  alert(`Approve clicked for ${user} (ticket ${ticketId})`);
}

function rejectTimesheet(ticketId, user) {
  alert(`Reject clicked for ${user} (ticket ${ticketId})`);
}

