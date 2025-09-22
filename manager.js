// manager.js
// Manager view: fetches pending timesheets, renders them with Approve/Reject,
// supports filtering + sorting.

(function () {
  "use strict";

  const API_BASE = (window.API_BASE || "http://localhost:7071/api").replace(/\/+$/g, "");

  const els = {
    filterInput: document.getElementById("filterInput"),
    tableBody: document.querySelector("#pendingTable tbody"),
  };

  let timesheets = []; // full dataset from API
  let sortField = null;
  let sortDir = 1; // 1 = asc, -1 = desc

  // -------- Fetch & render --------
  async function loadPending() {
    try {
      const res = await fetch(`${API_BASE}/timesheets/pending`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Unexpected response");
      timesheets = data;
      renderTable();
    } catch (err) {
      console.error("Failed to load pending timesheets:", err);
      els.tableBody.innerHTML = `<tr><td colspan="7">Error loading timesheets</td></tr>`;
    }
  }

  function renderTable() {
    let rows = [...timesheets];

    // Apply filter
    const q = els.filterInput.value.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        [r.firstName, r.lastName, r.siteName, r.status, r.ticketId]
          .map((x) => (x ? String(x).toLowerCase() : ""))
          .some((s) => s.includes(q))
      );
    }

    // Apply sort
    if (sortField) {
      rows.sort((a, b) => {
        const va = a[sortField] ?? "";
        const vb = b[sortField] ?? "";
        return va > vb ? sortDir : va < vb ? -sortDir : 0;
      });
    }

    // Render
    if (rows.length === 0) {
      els.tableBody.innerHTML = `<tr><td colspan="7">No pending timesheets</td></tr>`;
      return;
    }

    els.tableBody.innerHTML = rows
      .map(
        (r) => `
      <tr data-id="${r.entryId}">
        <td>${r.firstName} ${r.lastName}</td>
        <td>${r.siteName}</td>
        <td>${r.ticketId}</td>
        <td>${r.date}</td>
        <td>${r.hours}</td>
        <td><span class="status ${r.status}">${r.status}</span></td>
        <td>
          <button class="btn approve" data-approve="${r.entryId}">Approve</button>
          <button class="btn reject" data-reject="${r.entryId}">Reject</button>
        </td>
      </tr>`
      )
      .join("");
  }

  // -------- Actions --------
  async function approve(entryId) {
    try {
      const res = await fetch(`${API_BASE}/timesheets/approve/${entryId}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      timesheets = timesheets.filter((t) => t.entryId !== entryId);
      renderTable();
    } catch (err) {
      alert("Approve failed: " + err.message);
    }
  }

  async function reject(entryId) {
    try {
      const res = await fetch(`${API_BASE}/timesheets/reject/${entryId}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      timesheets = timesheets.filter((t) => t.entryId !== entryId);
      renderTable();
    } catch (err) {
      alert("Reject failed: " + err.message);
    }
  }

  // -------- Events --------
  els.filterInput.addEventListener("input", renderTable);

  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLElement)) return;

    if (t.dataset.approve) {
      approve(parseInt(t.dataset.approve, 10));
    } else if (t.dataset.reject) {
      reject(parseInt(t.dataset.reject, 10));
    } else if (t.closest(".sort-btn")) {
      const th = t.closest("th");
      const field = th.getAttribute("data-field");
      if (sortField === field) {
        sortDir *= -1; // toggle
      } else {
        sortField = field;
        sortDir = 1;
      }
      updateSortIcons();
      renderTable();
    }
  });

  function updateSortIcons() {
    document.querySelectorAll("th .sort-icon").forEach((el) => (el.textContent = "⇅"));
    if (sortField) {
      const icon = document.querySelector(`th[data-field="${sortField}"] .sort-icon`);
      if (icon) icon.textContent = sortDir === 1 ? "↑" : "↓";
    }
  }

  // -------- Init --------
  loadPending();
})();
