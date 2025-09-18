(() => {
  let timesheets = [];
  let currentSort = { col: null, asc: true };

  document.addEventListener("DOMContentLoaded", () => {
    loadPendingTimesheets().catch(showError);
    const f = document.getElementById("filterInput");
    if (f) f.addEventListener("input", renderTable);
  });

  async function loadPendingTimesheets() {
    const tbody = document.querySelector("#pendingTable tbody");
    tbody.innerHTML = `<tr><td colspan="7">Loading...</td></tr>`;

    try {
      const res = await fetch("/api/timesheets/pending"); // SWA proxy
      if (!res.ok) throw new Error(`Failed to fetch pending timesheets (HTTP ${res.status})`);
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

    const filter = (document.getElementById("filterInput")?.value || "").toLowerCase();
    let data = timesheets.filter(ts =>
      `${ts.firstName} ${ts.lastName} ${ts.siteName} ${ts.status}`.toLowerCase().includes(filter)
    );

    if (currentSort.col) {
      data.sort((a, b) => {
        let A, B;
        switch (currentSort.col) {
          case "employee": A = `${a.firstName} ${a.lastName}`.toLowerCase(); B = `${b.firstName} ${b.lastName}`.toLowerCase(); break;
          case "site":     A = (a.siteName||"").toLowerCase(); B = (b.siteName||"").toLowerCase(); break;
          case "ticket":   A = String(a.ticketId||""); B = String(b.ticketId||""); break;
          case "date":     A = new Date(a.date); B = new Date(b.date); break;
          case "hours":    A = parseFloat(a.hours||0); B = parseFloat(b.hours||0); break;
          case "status":   A = (a.status||"").toLowerCase(); B = (b.status||"").toLowerCase(); break;
          default:         A = ""; B = "";
        }
        if (A < B) return currentSort.asc ? -1 : 1;
        if (A > B) return currentSort.asc ?  1 : -1;
        return 0;
      });
    }

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
        <td class="col-action">
          <button class="btn" data-id="${ts.entryId}" data-action="approve">Approve</button>
          <button class="btn danger" data-id="${ts.entryId}" data-action="reject">Reject</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    // delegate clicks for Approve/Reject
    tbody.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = parseInt(e.currentTarget.getAttribute("data-id"), 10);
        const action = e.currentTarget.getAttribute("data-action");
        try {
          if (action === "approve") await approveTimesheet(id);
          else await rejectTimesheet(id);
          await loadPendingTimesheets();
        } catch (err) {
          showError(err);
        }
      });
    });

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
      el.textContent = currentSort.col === c ? (currentSort.asc ? "▲" : "▼") : "⇅";
    });
  }

  async function approveTimesheet(entryId) {
    const res = await fetch(`/api/timesheets/approve/${entryId}`, { method: "POST" });
    if (!res.ok) throw new Error(`Approve failed (HTTP ${res.status})`);
  }

  async function rejectTimesheet(entryId) {
    const res = await fetch(`/api/timesheets/reject/${entryId}`, { method: "POST" });
    if (!res.ok) throw new Error(`Reject failed (HTTP ${res.status})`);
  }

  /* utils */
  function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function showError(err){ console.error(err); alert(err.message || String(err)); }

  // expose for inline onclick if needed
  window.sortBy = sortBy;
})();
