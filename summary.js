"use strict";

// Use the global API_BASE defined in config.js
const API_BASE = window.API_BASE;

// State management
const state = {
  approved: [],
  unapproved: [],
  filterText: "",
  sortField: {
    approved: null,
    unapproved: null
  },
  sortDir: {
    approved: 1,
    unapproved: 1
  }
};

function num(v) {
  return Number(v) || 0;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadSummary() {
  try {
    const res = await fetch(`${API_BASE}/timesheets/summary`);
    const data = await res.json();
    if (!data.ok) {
      throw new Error("Failed to load summary");
    }

    // Store raw data with computed total hours for sorting
    state.approved = (data.approved || []).map(e => ({
      ...e,
      hours: num(e.hoursStandard) + num(e.hours15x) + num(e.hours2x)
    }));

    state.unapproved = (data.unapproved || []).map(e => ({
      ...e,
      hours: num(e.hoursStandard) + num(e.hours15x) + num(e.hours2x)
    }));

    renderTables();
  } catch (err) {
    console.error("Error loading summary:", err);
    alert("Failed to load summary: " + err.message);
  }
}

function applyFilterAndSort(entries, tableType) {
  let rows = [...entries];

  // Apply filter
  if (state.filterText) {
    const q = state.filterText.toLowerCase();
    rows = rows.filter(e =>
      [e.name, e.summary, e.cwTicketId, e.date, e.notes, e.status]
        .map(x => String(x || "").toLowerCase())
        .some(s => s.includes(q))
    );
  }

  // Apply sort
  const sortField = state.sortField[tableType];
  const sortDir = state.sortDir[tableType];

  if (sortField) {
    rows.sort((a, b) => {
      let va = a[sortField] ?? "";
      let vb = b[sortField] ?? "";

      // For hours, sort numerically
      if (sortField === "hours") {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
        return (va - vb) * sortDir;
      }

      // For text fields, sort as strings
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });
  }

  return rows;
}

function renderTables() {
  renderTable("approved", state.approved);
  renderTable("unapproved", state.unapproved);
}

function renderTable(tableType, entries) {
  const tableBody = document.querySelector(`#${tableType}Table tbody`);
  if (!tableBody) {
    console.error(`Table body for ${tableType} not found`);
    return;
  }

  tableBody.innerHTML = "";

  const rows = applyFilterAndSort(entries, tableType);

  let totalStd = 0;
  let totalOT = 0;

  // Render data rows
  for (const e of rows) {
    const hs = num(e.hoursStandard);
    const h15 = num(e.hours15x);
    const h2 = num(e.hours2x);
    const isOT = h15 + h2 > 0;

    totalStd += hs;
    totalOT += h15 + h2;

    const tr = document.createElement("tr");
    if (isOT) tr.classList.add("overtime-row");

    if (tableType === "approved") {
      tr.innerHTML = `
        <td data-label="Employee">${escapeHtml(e.name)}</td>
        <td data-label="Date">${escapeHtml(e.date)}</td>
        <td data-label="Ticket ID">${escapeHtml(e.cwTicketId || "—")}</td>
        <td data-label="Summary">${escapeHtml(e.summary || "—")}</td>
        <td data-label="Hours"><span class="hours-group">${hs.toFixed(2)} / ${h15.toFixed(2)} / ${h2.toFixed(2)}</span></td>
        <td data-label="Notes">${escapeHtml(e.notes || "—")}</td>
      `;
    } else {
      // Add status class to row for colored border
      const statusClass = String(e.status || "").toLowerCase();
      tr.classList.add(`status-row-${statusClass}`);

      tr.innerHTML = `
        <td data-label="Employee">
          ${escapeHtml(e.name)}
          <span class="status-badge-inline status-${escapeHtml(statusClass)}">${escapeHtml(e.status)}</span>
        </td>
        <td data-label="Date">${escapeHtml(e.date)}</td>
        <td data-label="Ticket ID">${escapeHtml(e.cwTicketId || "—")}</td>
        <td data-label="Summary">${escapeHtml(e.summary || "—")}</td>
        <td data-label="Hours"><span class="hours-group">${hs.toFixed(2)} / ${h15.toFixed(2)} / ${h2.toFixed(2)}</span></td>
        <td data-label="Notes">${escapeHtml(e.notes || "—")}</td>
      `;
    }

    tableBody.appendChild(tr);
  }

  // Add totals row
  const trTotals = document.createElement("tr");
  trTotals.className = "totals-row";

  // Both tables now have same 6-column structure
  trTotals.innerHTML = `
    <td colspan="4" style="text-align:right; font-weight: 700;">Totals:</td>
    <td><span class="hours-group">Std: ${totalStd.toFixed(2)} / OT: ${totalOT.toFixed(2)}</span></td>
    <td></td>
  `;

  tableBody.appendChild(trTotals);
}

function updateSortIcons(tableType) {
  const table = document.querySelector(`#${tableType}Table`);
  if (!table) return;

  table.querySelectorAll("th[data-field]").forEach(th => {
    const field = th.getAttribute("data-field");
    const icon = th.querySelector(".sort-icon");
    if (!icon) return;

    if (field === state.sortField[tableType]) {
      icon.textContent = state.sortDir[tableType] === 1 ? "↑" : "↓";
    } else {
      icon.textContent = "⇅";
    }
  });
}

// Navigation handlers
function setupNavigation() {
  const navButtons = {
    managerBtn: "manager.html",
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
}

function setupFilterAndSort() {
  // Filter input handler
  const filterInput = document.getElementById("filterInput");
  if (filterInput) {
    filterInput.addEventListener("input", () => {
      state.filterText = filterInput.value.trim().toLowerCase();
      renderTables();
    });
  }

  // Sort button click handler
  document.addEventListener("click", (ev) => {
    const sortBtn = ev.target.closest(".sort-btn");
    if (!sortBtn) return;

    const th = sortBtn.closest("th");
    if (!th) return;

    const field = th.getAttribute("data-field");
    const tableType = sortBtn.getAttribute("data-table");

    if (!field || !tableType) return;

    // Toggle sort direction if clicking same field, otherwise reset to ascending
    if (state.sortField[tableType] === field) {
      state.sortDir[tableType] *= -1;
    } else {
      state.sortField[tableType] = field;
      state.sortDir[tableType] = 1;
    }

    updateSortIcons(tableType);
    renderTable(tableType, state[tableType]);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupFilterAndSort();
  loadSummary();
});
