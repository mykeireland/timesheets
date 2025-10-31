"use strict";

const API_BASE = (window.API_BASE || "http://localhost:7071/api").replace(/\/+$/g, "");

document.getElementById("filterInput").addEventListener("input", (e) => {
  const keyword = e.target.value.toLowerCase().trim();

  const rows = document.querySelectorAll("table tbody tr");
  rows.forEach(row => {
    const nameCell = row.querySelector("td");
    if (!nameCell) return;

    const name = nameCell.textContent.toLowerCase();
    row.style.display = name.includes(keyword) ? "" : "none";
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch(`${API_BASE}/timesheets/summary`);
    const data = await res.json();

    if (!data.ok) throw new Error(data.error || "Unknown error");

    renderTable(document.querySelector("#approvedTable tbody"), data.approved);
    renderTable(document.querySelector("#unapprovedTable tbody"), data.unapproved, true);
  } catch (err) {
    alert("❌ Failed to load summary report: " + err.message);
  }
});

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
