"use strict";

// Use the global API_BASE defined in config.js
const API_BASE = window.API_BASE;

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

    const approvedBody = document.querySelector("#approvedTable tbody");
    const unapprovedBody = document.querySelector("#unapprovedTable tbody");

    if (!approvedBody || !unapprovedBody) {
      console.error("Table bodies not found");
      return;
    }

    approvedBody.innerHTML = "";
    unapprovedBody.innerHTML = "";

    let approvedStd = 0,
      approvedOT = 0;
    let unapprovedStd = 0,
      unapprovedOT = 0;

    // ---- APPROVED ENTRIES ----
    for (const e of data.approved || []) {
      const hs = num(e.hoursStandard),
        h15 = num(e.hours15x),
        h2 = num(e.hours2x);
      const isOT = h15 + h2 > 0;

      approvedStd += hs;
      approvedOT += h15 + h2;

      const tr = document.createElement("tr");
      if (isOT) tr.classList.add("overtime-row");
      tr.innerHTML = `
        <td>${escapeHtml(e.name)}</td>
        <td>${escapeHtml(e.summary || "—")}</td>
        <td>${escapeHtml(e.cwTicketId || "—")}</td>
        <td>${escapeHtml(e.date)}</td>
        <td><span class="hours-group">${hs.toFixed(2)} / ${h15.toFixed(2)} / ${h2.toFixed(2)}</span></td>
        <td>${escapeHtml(e.notes || "—")}</td>
      `;
      approvedBody.appendChild(tr);
    }

    // Add totals row to approved
    const trA = document.createElement("tr");
    trA.className = "totals-row";
    trA.innerHTML = `
      <td colspan="4" style="text-align:right;">Totals:</td>
      <td><span class="hours-group">Std: ${approvedStd.toFixed(2)} / OT: ${approvedOT.toFixed(2)}</span></td>
      <td></td>
    `;
    approvedBody.appendChild(trA);

    // ---- UNAPPROVED / REJECTED ENTRIES ----
    for (const e of data.unapproved || []) {
      const hs = num(e.hoursStandard),
        h15 = num(e.hours15x),
        h2 = num(e.hours2x);
      const isOT = h15 + h2 > 0;

      unapprovedStd += hs;
      unapprovedOT += h15 + h2;

      const tr = document.createElement("tr");
      if (isOT) tr.classList.add("overtime-row");
      tr.innerHTML = `
        <td>${escapeHtml(e.name)}</td>
        <td>${escapeHtml(e.summary || "—")}</td>
        <td>${escapeHtml(e.cwTicketId || "—")}</td>
        <td>${escapeHtml(e.date)}</td>
        <td><span class="hours-group">${hs.toFixed(2)} / ${h15.toFixed(2)} / ${h2.toFixed(2)}</span></td>
        <td><span class="status-badge status-${escapeHtml(String(e.status || "").toLowerCase())}">${escapeHtml(e.status)}</span></td>
        <td>${escapeHtml(e.notes || "—")}</td>
      `;
      unapprovedBody.appendChild(tr);
    }

    // Add totals row to unapproved
    const trU = document.createElement("tr");
    trU.className = "totals-row";
    trU.innerHTML = `
      <td colspan="4" style="text-align:right;">Totals:</td>
      <td><span class="hours-group">Std: ${unapprovedStd.toFixed(2)} / OT: ${unapprovedOT.toFixed(2)}</span></td>
      <td colspan="2"></td>
    `;
    unapprovedBody.appendChild(trU);
  } catch (err) {
    console.error("Error loading summary:", err);
    alert("Failed to load summary: " + err.message);
  }
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

window.addEventListener("DOMContentLoaded", () => {
  loadSummary();
  setupNavigation();
});
