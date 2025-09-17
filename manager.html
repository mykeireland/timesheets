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
      // ✅ Call through SWA proxy, not the azurewebsites host
      const res = await fetch("/api/timesheets/pending");
      if (!res.ok) throw new Error("Failed to fetch pending timesheets");
      timesheets = await res.json();
      renderTable();
    } catch (err) {
      showError(err);
      tbody.innerHTML = `<tr><td colspan="7">Error loading timesheets</td></tr>`;
    }
  }

  function renderTable() {
    const tbody = document.querySelector("#pendingTable tbody");
    tbody.innerHTML = "";

    // Filter
    const filter = document.getElementById("filterInput").value.toLowerCase();
    let data = timesheets.filter(ts =>
      `${ts.firstName} ${ts.lastName} ${ts.siteName} ${ts.status}`.toLowerCase().includes(filter)
    );

    // Sort
    if (currentSort.col) {
      data.sort((a, b) => {
        let A, B;
        switch (currentSort.col) {
          case "employee": A = `${a.firstName} ${a.lastName}`.toLowerCase(); B = `${b.firstName} ${b.lastName}`.toLowerCase(); break;
          case "site":     A = a.siteName.toLowerCase(); B = b.siteName.toLowerCase(); break;
          case "ticket":   A = String(a.ticketId); B = String(b.ticketId); break;
          case "date":     A = new Date(a.date); B = new Date(b.date); break;
          case "hours":    A = parseFloat(a.hours); B = parseFloat(b.hours); break;
          case "status":   A = a.status.toLowerCase(); B = b.status.toLowerCase(); break;
          default:         A = ""; B = "";
        }
        if (A < B) return currentSort.asc ? -1 : 1;
        if (A > B) return currentSort.asc ? 1 : -1;
        return 0;
      });
    }

    // Render rows
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="7">No timesheets found</td></tr>`;
      updateSortIcons();
      return;
    }

    for (const ts of data) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(ts.firstName)} ${escapeHtml(ts.lastName)}</td>
        <td>${escapeHtml(ts.siteName)}</td>
        <td>${escapeHtml(ts.ticketId)}</td>
        <td>${escapeHtml(ts.date)}</td>
        <td>${escapeHtml(ts.hours)}</td>
        <td>${escapeHtml(ts.status)}</td>
        <td>
          <button class="btn" onclick="approveTimesheet(${ts.entryId})">Approve</button>
          <button class="btn" onclick="rejectTimesheet(${ts.entryId})">Reject</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    updateSortIcons();
  }

  function sortBy(col) {
    if (currentSort.col === col) {
      currentSort.asc = !currentSort.asc;
    } else {
      currentSort = { col, asc: true };
    }
    renderTable();
  }

  function updateSortIcons() {
    ["employee", "site", "ticket", "date", "hours", "status"].forEach(c => {
      const el = document.getElementById(`sort-${c}`);
      if (!el) return;
      el.textContent = currentSort.col === c ? (currentSort.asc ? "▲" : "▼") : "";
    });
  }

  async function approveTimesheet(entryId) {
    try {
      const res = await fetch(`/api/timesheets/approve/${entryId}`, { method: "POST" });
      if (!res.ok) throw new Error("Approve failed");
      await loadPendingTimesheets();
    } catch (err) { showError(err); }
  }

  async function rejectTimesheet(entryId) {
    try {
      const res = await fetch(`/api/timesheets/reject/${entryId}`, { method: "POST" });
      if (!res.ok) throw new Error("Reject failed");
      await loadPendingTimesheets();
    } catch (err) { showError(err); }
  }

  function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function showError(err){ console.error(err); alert(err.message || String(err)); }

  // Expose globally for onclick handlers
  window.sortBy = sortBy;
  window.approveTimesheet = approveTimesheet;
  window.rejectTimesheet = rejectTimesheet;
})();
