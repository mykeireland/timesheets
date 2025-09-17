let timesheetData = [];
let currentSort = { col: null, asc: true };

document.addEventListener("DOMContentLoaded", () => {
  loadPendingTimesheets();
  document.getElementById("filterInput").addEventListener("input", applyFilter);

  // Add sorting event listeners
  document.querySelectorAll("#pendingTable th[data-col]").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      if (currentSort.col === col) {
        currentSort.asc = !currentSort.asc; // toggle asc/desc
      } else {
        currentSort = { col, asc: true };
      }
      renderTable();
    });
  });
});

async function loadPendingTimesheets() {
  const tbody = document.querySelector("#pendingTable tbody");
  tbody.innerHTML = "<tr><td colspan='7'>Loading...</td></tr>";

  try {
    const res = await fetch("/api/timesheets/pending");
    if (!res.ok) throw new Error("Failed to load timesheets");
    timesheetData = await res.json();
    renderTable();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7">Error: ${err.message}</td></tr>`;
  }
}

function renderTable() {
  const tbody = document.querySelector("#pendingTable tbody");
  tbody.innerHTML = "";

  let data = [...timesheetData];

  // Apply filter
  const filter = document.getElementById("filterInput").value.toLowerCase();
  if (filter) {
    data = data.filter(r =>
      r.firstName.toLowerCase().includes(filter) ||
      r.lastName.toLowerCase().includes(filter) ||
      r.siteName.toLowerCase().includes(filter) ||
      r.status.toLowerCase().includes(filter)
    );
  }

  // Apply sorting
  if (currentSort.col) {
    data.sort((a, b) => {
      let valA, valB;
      switch (currentSort.col) {
        case "employee": valA = a.firstName + " " + a.lastName; valB = b.firstName + " " + b.lastName; break;
        case "site": valA = a.siteName; valB = b.siteName; break;
        case "ticket": valA = a.ticketId; valB = b.ticketId; break;
        case "date": valA = a.date; valB = b.date; break;
        case "hours": valA = a.hours; valB = b.hours; break;
        case "status": valA = a.status; valB = b.status; break;
      }
      return currentSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }

  // Render rows
  data.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.firstName} ${r.lastName}</td>
      <td>${r.siteName}</td>
      <td>${r.ticketId}</td>
      <td>${r.date}</td>
      <td>${r.hours}</td>
      <td>${r.status}</td>
      <td>
        <button onclick="approve('${r.ticketId}','${r.date}')">Approve</button>
        <button onclick="reject('${r.ticketId}','${r.date}')">Reject</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (!data.length) {
    tbody.innerHTML = "<tr><td colspan='7'>No records found</td></tr>";
  }
}

function applyFilter() {
  renderTable();
}

// Stubs for actions
async function approve(ticketId, date) {
  alert(`TODO: Approve ${ticketId} for ${date}`);
}

async function reject(ticketId, date) {
  alert(`TODO: Reject ${ticketId} for ${date}`);
}
