(function () {
  "use strict";

  const API_BASE = (window.API_BASE || "http://localhost:7071/api").replace(/\/+$/g, "");

  const els = {
    filterInput: document.getElementById("filterInput"),
    tableBody: document.querySelector("#pendingTable tbody"),
  };

  const state = {
    timesheets: [],
    sortField: null,
    sortDir: 1,
  };

  async function loadPending() {
  try {
    const url = `${API_BASE}/timesheets/pending`;
    console.log("🔎 GET", url);
    const res = await fetch(url);
    const raw = await res.json();
    console.log("📥 raw response:", raw);

    // Accept either array or wrapped object
    const items = Array.isArray(raw) ? raw
                 : Array.isArray(raw.results) ? raw.results
                 : Array.isArray(raw.data) ? raw.data
                 : [];

    if (!Array.isArray(items)) throw new Error("Unexpected response format (no array)");

    // Normalize to what renderTable expects:
    // { entryId, firstName, lastName, siteName, ticketId, date, hours, status, notes }
    state.timesheets = items.map((r) => {
      // derive first/last from employeeName if needed
      const fullName = r.employeeName ?? r.name ?? "";
      let first = r.firstName ?? "";
      let last = r.lastName ?? "";
      if ((!first || !last) && fullName) {
        const parts = String(fullName).trim().split(/\s+/);
        first = first || parts[0] || "";
        last = last || parts.slice(1).join(" ");
      }

      // compute hours if only split fields exist
      const hours =
        r.hours ??
        (Number(r.hoursStandard ?? r.hours_standard ?? 0) +
         Number(r.hours15x ?? r.hours_15x ?? 0) +
         Number(r.hours2x ?? r.hours_2x ?? 0));

      return {
        entryId: r.entryId ?? r.entry_id ?? r.id,
        firstName: first,
        lastName: last,
        siteName: r.siteName ?? r.companyName ?? r.company ?? "",
        ticketId: r.ticketId ?? r.cw_ticket_id ?? r.cwTicketId ?? r.cw_id ?? "",
        date: r.date ?? r.Date ?? "",
        hours,
        status: r.status ?? "",
        notes: r.notes ?? r.notes_internal ?? r.notesInternal ?? ""
      };
    });

    console.log("✅ normalized rows:", state.timesheets.length);
    renderTable();
  } catch (err) {
    console.error("Failed to load pending timesheets:", err);
    els.tableBody.innerHTML = `<tr><td colspan="8">Error loading timesheets</td></tr>`;
  }
}

  function renderTable() {
    let rows = [...state.timesheets];

    const q = els.filterInput.value.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        [r.firstName, r.lastName, r.siteName, r.status, r.ticketId]
          .map((x) => (x ? String(x).toLowerCase() : ""))
          .some((s) => s.includes(q))
      );
    }

    if (state.sortField) {
      rows.sort((a, b) => {
        const va = (a[state.sortField] ?? "").toString().toLowerCase();
        const vb = (b[state.sortField] ?? "").toString().toLowerCase();
        if (va < vb) return -1 * state.sortDir;
        if (va > vb) return 1 * state.sortDir;
        return 0;
      });
    }

    if (rows.length === 0) {
      els.tableBody.innerHTML = `<tr><td colspan="8">No pending timesheets</td></tr>`;
      return;
    }

    els.tableBody.innerHTML = rows
      .map(
        (r) => `
      <tr data-id="${r.entryId}">
        <td>${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}</td>
        <td>${escapeHtml(r.siteName)}</td>
        <td>${escapeHtml(r.ticketId)}</td>
        <td>${escapeHtml(r.date)}</td>
        <td>${escapeHtml(r.hours)}</td>
        <td><span class="status ${escapeHtml(r.status)}">${escapeHtml(r.status)}</span></td>
        <td class="col-notes">${escapeHtml(r.notes || "")}</td>
        <td>
          <button class="btn approve" data-approve="${r.entryId}">Approve</button>
          <button class="btn reject" data-reject="${r.entryId}">Reject</button>
        </td>
      </tr>`
      )
      .join("");
  }

  async function approve(entryId) {
    try {
      const res = await fetch(`${API_BASE}/timesheets/approve/${entryId}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      state.timesheets = state.timesheets.filter((t) => t.entryId !== entryId);
      renderTable();
    } catch (err) {
      alert("Approve failed: " + err.message);
    }
  }

  async function reject(entryId) {
    try {
      const res = await fetch(`${API_BASE}/timesheets/reject/${entryId}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      state.timesheets = state.timesheets.filter((t) => t.entryId !== entryId);
      renderTable();
    } catch (err) {
      alert("Reject failed: " + err.message);
    }
  }

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
      if (state.sortField === field) {
        state.sortDir *= -1;
      } else {
        state.sortField = field;
        state.sortDir = 1;
      }
      updateSortIcons();
      renderTable();
    }
  });

  function updateSortIcons() {
    document.querySelectorAll("th .sort-icon").forEach((el) => (el.textContent = "⇅"));
    if (state.sortField) {
      const icon = document.querySelector(`th[data-field="${state.sortField}"] .sort-icon`);
      if (icon) icon.textContent = state.sortDir === 1 ? "↑" : "↓";
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  loadPending();
})();
