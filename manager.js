(() => {
  let timesheets = [];
  let currentSort = { col: null, asc: true };

  document.addEventListener("DOMContentLoaded", () => {
    loadPendingTimesheets().catch(showError);
    document.getElementById("filterInput").addEventListener("input", renderTable);
  });

  async function loadPendingTimesheets() {
    const tbody = document.querySelector("#pendingTable tbody");
    tbody.innerHTML = `<tr><td colspan="7">Loading...</td></tr>`;

    try {
      const res = await fetch(
        "https://func-timesheetsnet-api-dev-ghdtdedagnf8a0a7.australiasoutheast-01.azurewebsites.net/api/timesheets/pending"
      );
      if (!res.ok) throw new Error("Failed to fetch pending timesheets");
      timesheets = await res.json();
      renderTable();
    } catch (err) {
      showError(err);
    }
  }

  function renderTable() {
    const tbody = document.querySelector("#pendingTable tbody");
    tbody.innerHTML = "";

    // filter
    const filter = document.getElementById("filterInput").value.toLowerCase();
    let filtered = timesheets.filter(ts =>
      `${ts.firstName} ${ts.lastName} ${ts.siteName} ${ts.status}`
        .toLowerCase()
        .includes(filter)
    );

    // sort
    if (currentSort.col) {
      filtered.sort((a, b) => {
        let valA, valB;
        switch (currentSort.col) {
          case "employee":
            valA = `${a.firstName} ${a.lastName}`;
            valB = `${b.firstName} ${b.lastName}`;
            break;
          case "site":
            valA = a.siteName;
            valB = b.siteName;
            break;
          case "ticket":
            valA = a.ticketId;
            valB = b.ticketId;
            break;
          case "date":
            valA = new Date(a.date);
            valB = new Date(b.date);
            break;
          case "hours":
            valA = a.hours;
            valB = b.hours;
            break;
          case "status":
            valA = a.status;
            valB = b.status;
            break;
          default:
            valA = "";
            valB = "";
        }
        if (valA < valB) return currentSort.asc ? -1 : 1;
        if (valA > valB) return currentSort.asc ? 1 : -1;
        return 0;
      });
    }

    // render rows
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7">No timesheets found</td></tr>`;
      return;
    }

    for (const ts of filtered) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${ts.firstName} ${ts.lastName}</td>
        <td>${ts.siteName}</td>
        <td>${ts.ticketId}</td>
        <td>${ts.date}</td>
        <td>${ts.hours}</td>
        <td>${ts.status}</td>
        <td>
          <button class="btn" onclick="approveTimesheet('${ts.ticketId}','${ts.date}')">Approve</button>
          <button class="btn" onclick="rejectTimesheet('${ts.ticketId}','${ts.date}')">Reject</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    updateSortIcons();
  }

  function sortBy(col) {
    if (currentSort.col === col) {
      currentSort.asc = !currentSort.asc; // toggle asc/desc
    } else {
      currentSort.col = col;
      currentSort.asc = true;
    }
    renderTable();
  }

  function updateSortIcons() {
    ["employee", "site", "ticket", "date", "hours", "status"].forEach(c => {
      const el = document.getElementById(`sort-${c}`);
      if (!el) return;
      if (currentSort.col === c) {
        el.textContent = currentSort.asc ? "▲" : "▼";
      } else {
        el.textContent = "";
      }
    });
  }

  async function approveTimesheet(ticketId, date) {
    try {
      const res = await fetch(
        `https://func-timesheetsnet-api-dev-ghdtdedagnf8a0a7.australiasoutheast-01.azurewebsites.net/api/timesheets/approve?ticketId=${ticketId}&date=${date}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Approve failed");
      alert(`Approved ticket ${ticketId} for ${date}`);
      await loadPendingTimesheets();
    } catch (err) {
      showError(err);
    }
  }

  async function rejectTimesheet(ticketId, date) {
    try {
      const res = await fetch(
        `https://func-timesheetsnet-api-dev-ghdtdedagnf8a0a7.australiasoutheast-01.azurewebsites.net/api/timesheets/reject?ticketId=${ticketId}&date=${date}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Reject failed");
      alert(`Rejected ticket ${ticketId} for ${date}`);
      await loadPendingTimesheets();
    } catch (err) {
      showError(err);
    }
  }

  function showError(err) {
    console.error(err);
    alert(err.message || String(err));
  }

  // expose sorting + actions to window so HTML can call them
  window.sortBy = sortBy;
  window.approveTimesheet = approveTimesheet;
  window.rejectTimesheet = rejectTimesheet;
})();
