(function () {
  "use strict";

  // Use the global API_BASE defined in config.js
  const API_BASE = window.API_BASE;

  const els = {
    filterInput: document.getElementById("filterInput"),
    tableBody: document.querySelector("#pendingTable tbody"),
  };

  const state = {
    timesheets: [],
    sortField: null,
    sortDir: 1,
    selectedForApproval: new Set(),
    selectedForRejection: new Set(),
  };

  async function loadPending() {
  try {
    const url = `${API_BASE}/timesheets/pending`;
    console.log("🔎 GET", url);
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const raw = await res.json();
    console.log("📥 raw response:", raw);

    // Accept either array or wrapped object
    const items = Array.isArray(raw) ? raw
                 : Array.isArray(raw.results) ? raw.results
                 : Array.isArray(raw.data) ? raw.data
                 : [];

    if (!Array.isArray(items)) {
      throw new Error("Unexpected response format (no array)");
    }

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

      // compute hours breakdown
      const hoursStandard = Number(r.hoursStandard ?? r.hours_standard ?? 0);
      const hours15x = Number(r.hours15x ?? r.hours_15x ?? 0);
      const hours2x = Number(r.hours2x ?? r.hours_2x ?? 0);
      const hours = r.hours ?? (hoursStandard + hours15x + hours2x);
      const hasOT = hours15x + hours2x > 0;

      return {
        entryId: r.entryId ?? r.entry_id ?? r.id,
        firstName: first,
        lastName: last,
        siteName: r.siteName ?? r.companyName ?? r.company ?? "",
        ticketId: r.ticketId ?? r.cw_ticket_id ?? r.cwTicketId ?? r.cw_id ?? "",
        date: r.date ?? r.Date ?? "",
        hours,
        hoursStandard,
        hours15x,
        hours2x,
        hasOT,
        status: r.status ?? "",
        notes: r.notes ?? r.notes_internal ?? r.notesInternal ?? ""
      };
    });

    console.log("✅ normalized rows:", state.timesheets.length);
    renderTable();
  } catch (err) {
    console.error("Failed to load pending timesheets:", err);
    els.tableBody.innerHTML = `<tr><td colspan="6">Error: ${err.message}</td></tr>`;
    alert("Failed to load pending timesheets. Please refresh the page.");
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
        let va = a[state.sortField] ?? "";
        let vb = b[state.sortField] ?? "";

        // For hours, sort numerically
        if (state.sortField === "hours") {
          va = Number(va) || 0;
          vb = Number(vb) || 0;
          return (va - vb) * state.sortDir;
        }

        // For text fields, sort as strings
        va = va.toString().toLowerCase();
        vb = vb.toString().toLowerCase();
        if (va < vb) return -1 * state.sortDir;
        if (va > vb) return 1 * state.sortDir;
        return 0;
      });
    }

    if (rows.length === 0) {
      els.tableBody.innerHTML = `<tr><td colspan="6">No pending timesheets</td></tr>`;
      updateBatchActionsUI();
      return;
    }

    els.tableBody.innerHTML = rows
      .map(
        (r) => {
          // Determine selection state
          const isApprove = state.selectedForApproval.has(r.entryId);
          const isReject = state.selectedForRejection.has(r.entryId);

          // Determine row classes
          const rowClasses = [];
          if (r.hasOT) {
            rowClasses.push("pending-with-overtime");
          } else {
            rowClasses.push("pending-no-overtime");
          }

          if (isApprove) {
            rowClasses.push("selected-approve");
          } else if (isReject) {
            rowClasses.push("selected-reject");
          }

          return `
      <tr data-id="${r.entryId}" class="${rowClasses.join(' ')}" style="cursor: pointer;">
        <td data-label="Employee">${escapeHtml(r.firstName)} ${escapeHtml(r.lastName)}</td>
        <td data-label="Company/Site">${escapeHtml(r.siteName)}</td>
        <td data-label="Ticket ID">${escapeHtml(r.ticketId)}</td>
        <td data-label="Date">${escapeHtml(r.date)}</td>
        <td data-label="Hours"><span class="hours-group">${r.hoursStandard.toFixed(2)} / ${r.hours15x.toFixed(2)} / ${r.hours2x.toFixed(2)}</span></td>
        <td data-label="Notes" class="col-notes">${escapeHtml(r.notes || "")}</td>
      </tr>`;
        }
      )
      .join("");

    updateBatchActionsUI();
  }

  function toggleRowSelection(entryId, action) {
    // action can be "approve" or "reject"
    if (action === "approve") {
      // If already in approval set, remove it
      if (state.selectedForApproval.has(entryId)) {
        state.selectedForApproval.delete(entryId);
      } else {
        // Remove from rejection set if present
        state.selectedForRejection.delete(entryId);
        // Add to approval set
        state.selectedForApproval.add(entryId);
      }
    } else if (action === "reject") {
      // If already in rejection set, remove it
      if (state.selectedForRejection.has(entryId)) {
        state.selectedForRejection.delete(entryId);
      } else {
        // Remove from approval set if present
        state.selectedForApproval.delete(entryId);
        // Add to rejection set
        state.selectedForRejection.add(entryId);
      }
    }

    renderTable();
  }

  function updateBatchActionsUI() {
    const batchActionsDiv = document.getElementById("batchActions");
    const approveCountEl = document.getElementById("approveCount");
    const rejectCountEl = document.getElementById("rejectCount");
    const batchApproveBtn = document.getElementById("batchApproveBtn");
    const batchRejectBtn = document.getElementById("batchRejectBtn");

    const approveCount = state.selectedForApproval.size;
    const rejectCount = state.selectedForRejection.size;

    approveCountEl.textContent = `${approveCount} to approve`;
    rejectCountEl.textContent = `${rejectCount} to reject`;

    // Show the batch actions section if any items are selected
    if (approveCount > 0 || rejectCount > 0) {
      batchActionsDiv.style.display = "block";
    } else {
      batchActionsDiv.style.display = "none";
    }

    // Enable/disable buttons based on selection count
    batchApproveBtn.disabled = approveCount === 0;
    batchRejectBtn.disabled = rejectCount === 0;
  }

  async function batchApprove() {
    const ids = Array.from(state.selectedForApproval);
    if (ids.length === 0) return;

    if (!confirm(`Are you sure you want to approve ${ids.length} entries?`)) {
      return;
    }

    window.showLoading();
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const entryId of ids) {
      try {
        const res = await fetch(`${API_BASE}/timesheets/approve/${entryId}`, { method: "POST" });
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        successCount++;
        state.timesheets = state.timesheets.filter((t) => t.entryId !== entryId);
      } catch (err) {
        console.error(`Approve failed for entry ${entryId}:`, err);
        errors.push(`Entry ${entryId}: ${err.message}`);
        errorCount++;
      }
    }

    window.hideLoading();

    // Clear selection and re-render
    state.selectedForApproval.clear();
    renderTable();

    if (errorCount > 0) {
      alert(`Batch approval completed with errors:\n\nSuccessful: ${successCount}\nFailed: ${errorCount}\n\nErrors:\n${errors.join('\n')}`);
    } else {
      alert(`Successfully approved ${successCount} entries!`);
    }
  }

  async function batchReject() {
    const ids = Array.from(state.selectedForRejection);
    if (ids.length === 0) return;

    if (!confirm(`Are you sure you want to reject ${ids.length} entries?`)) {
      return;
    }

    window.showLoading();
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const entryId of ids) {
      try {
        const res = await fetch(`${API_BASE}/timesheets/reject/${entryId}`, { method: "POST" });
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }
        successCount++;
        state.timesheets = state.timesheets.filter((t) => t.entryId !== entryId);
      } catch (err) {
        console.error(`Reject failed for entry ${entryId}:`, err);
        errors.push(`Entry ${entryId}: ${err.message}`);
        errorCount++;
      }
    }

    window.hideLoading();

    // Clear selection and re-render
    state.selectedForRejection.clear();
    renderTable();

    if (errorCount > 0) {
      alert(`Batch rejection completed with errors:\n\nSuccessful: ${successCount}\nFailed: ${errorCount}\n\nErrors:\n${errors.join('\n')}`);
    } else {
      alert(`Successfully rejected ${successCount} entries!`);
    }
  }

  function clearSelection() {
    state.selectedForApproval.clear();
    state.selectedForRejection.clear();
    renderTable();
  }

  els.filterInput.addEventListener("input", renderTable);

  // Sync Monthly Tickets handler
  async function syncTickets() {
    if (!confirm("Are you sure you want to sync monthly tickets? This may take a few moments.")) {
      return;
    }

    window.showLoading();
    try {
      const res = await fetch(`${API_BASE}/timesheets/sync-tickets`, {
        method: "POST"
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      alert("Tickets synced successfully!");
      // Reload pending timesheets to show any new data
      loadPending();
    } catch (err) {
      console.error("Sync tickets failed:", err);
      alert("Failed to sync tickets: " + err.message);
    } finally {
      window.hideLoading();
    }
  }

  // Navigation button handlers
  const navButtons = {
    staffBtn: "staff.html",
    summaryBtn: "summary.html",
    homeBtn: "index.html"
  };

  Object.entries(navButtons).forEach(([id, url]) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener("click", () => {
        window.location.href = url;
      });
    }
  });

  // Sync Tickets button handler
  const syncTicketsBtn = document.getElementById("syncTicketsBtn");
  if (syncTicketsBtn) {
    syncTicketsBtn.addEventListener("click", syncTickets);
  }

  document.addEventListener("click", (ev) => {
    const t = ev.target;
    if (!(t instanceof HTMLElement)) return;

    // Handle batch action buttons
    if (t.id === "batchApproveBtn") {
      batchApprove();
      return;
    } else if (t.id === "batchRejectBtn") {
      batchReject();
      return;
    } else if (t.id === "clearSelectionBtn") {
      clearSelection();
      return;
    }

    // Handle sort buttons
    if (t.closest(".sort-btn")) {
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
      return;
    }

    // Handle row clicks for selection (with keyboard modifiers)
    const row = t.closest("tr[data-id]");
    if (row) {
      const entryId = parseInt(row.getAttribute("data-id"), 10);

      // Shift+Click = Approve, Ctrl+Click (or Cmd+Click) = Reject, Click = Toggle Approve
      if (ev.shiftKey || ev.ctrlKey || ev.metaKey) {
        // Ctrl/Cmd/Shift click = reject
        if (ev.ctrlKey || ev.metaKey) {
          toggleRowSelection(entryId, "reject");
        } else {
          // Shift click = approve
          toggleRowSelection(entryId, "approve");
        }
      } else {
        // Regular click = toggle approve
        toggleRowSelection(entryId, "approve");
      }
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
