"use strict";

const API_BASE = (window.API_BASE || "http://localhost:7071/api").replace(/\/+$/g, "");
let currentNameFilter = "";
let sortOrders = {
  approved: 1,
  unapproved: 1
};

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch(`${API_BASE}/timesheets/summary`);
    const data = await res.json();

    if (!data.ok) throw new Error(data.error || "Unknown error");

    window.allRows = {
      approved: data.approved,
      unapproved: data.unapproved
    };

    setupTextFilter();
    applyFilters();
  } catch (err) {
    alert("❌ Failed to load summary report: " + err.message);
  }
});

function setupTextFilter() {
  const input = document.getElementById("filterInput");
  input.addEventListener("input", () => {
    currentNameFilter = input.value.toLowerCase().trim();
    applyFilters();
  });
}

function applyFilters() {
  const { approved, unapproved } = window.allRows;

  const filterFn = row => {
    const name = row.name.toLowerCase();
    return !currentNameFilter || name.includes(currentNameFilter);
  };

  renderTable(document.querySelector("#approvedTable tbody"), approved.filter(filterFn));
  renderTable(document.querySelector("#unapprovedTable tbody"), unapproved.filter(filterFn), true);
}

function renderTable(tbody, rows, showStatus = false) {
  tbody.innerHTML = "";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="${showStatus ? 6 : 5}">No data found</td></tr>`;
    return;
  }

  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.name}</td>
      <td>${r.standard?.toFixed(2) ?? "0.00"}</td>
      <td>${r.hours_15x?.toFixed(2) ?? "0.00"}</td>
      <td>${r.hours_2x?.toFixed(2) ?? "0.00"}</td>
      <td>${r.total?.toFixed(2) ?? "0.00"}</td>
      ${showStatus ? `<td>${r.status}</td>` : ""}
    `;
    tbody.appendChild(tr);
  });
}

function sortBySurname(section) {
  const rows = window.allRows[section];
  const order = sortOrders[section];
  rows.sort((a, b) => {
    const aSurname = a.name.split(" ").slice(-1)[0].toLowerCase();
    const bSurname = b.name.split(" ").slice(-1)[0].toLowerCase();
    return order * aSurname.localeCompare(bSurname);
  });
  sortOrders[section] *= -1;
  applyFilters();
}
