"use strict";

/**
 * staff.js — Manage Casual Staff (final clean build)
 */

const API_BASE = (window.API_BASE || "http://localhost:7071/api").replace(/\/+$/g, "");

let employees = [];
let filterText = "";

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.querySelector("#staffTable tbody");
  const addBtn = document.getElementById("addBtn");
  const staffFilter = document.getElementById("staffFilter");

  if (!tableBody) {
    console.error("❌ #staffTable tbody not found");
    return;
  }

  if (addBtn) addBtn.addEventListener("click", () => onAddClick(tableBody));
  else console.warn("⚠️ #addBtn missing — Add feature disabled.");

  if (staffFilter) {
    staffFilter.addEventListener("input", () => {
      filterText = staffFilter.value.trim().toLowerCase();
      renderTable(tableBody);
    });
  }

  loadEmployees(tableBody);
});

async function loadEmployees(tbody) {
  tbody.innerHTML = `<tr><td colspan="9">Loading…</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/employees`, { cache: "no-store" });
    const rawText = await res.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("Invalid JSON:", rawText);
      tbody.innerHTML = `<tr><td colspan="9">Invalid JSON from API</td></tr>`;
      return;
    }

    const raw = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
    if (!raw.length) {
      tbody.innerHTML = `<tr><td colspan="9">No employees found.</td></tr>`;
      return;
    }

    employees = raw.map(e => ({
      employee_id: e.employee_id ?? e.id,
      first_name: e.first_name ?? "",
      last_name: e.last_name ?? "",
      email: e.email ?? "",
      type: e.type ?? "",
      active: e.active === undefined ? true : !!e.active,
      manager_employee_id: toNullableInt(e.manager_employee_id),
      cw_member_id: toNullableInt(e.cw_member_id)
    }));

    renderTable(tbody);
  } catch (err) {
    console.error("Load error:", err);
    tbody.innerHTML = `<tr><td colspan="9">Error loading employees</td></tr>`;
  }
}

function renderTable(tbody) {
  let rows = employees;
  if (filterText) {
    rows = rows.filter(e =>
      [e.first_name, e.last_name, e.email, e.type]
        .map(x => (x ?? "").toLowerCase())
        .join(" ")
        .includes(filterText)
    );
  }

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9">No employees match your filter</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(
      e => `
      <tr data-id="${e.employee_id}">
        <td>${e.employee_id}</td>
        <td contenteditable="false">${escapeHtml(e.first_name)}</td>
        <td contenteditable="false">${escapeHtml(e.last_name)}</td>
        <td contenteditable="false">${escapeHtml(e.email)}</td>
        <td contenteditable="false">${escapeHtml(e.type)}</td>
        <td style="text-align:center">
          <input type="checkbox" ${e.active ? "checked" : ""} disabled>
        </td>
        <td contenteditable="false">${e.manager_employee_id ?? ""}</td>
        <td contenteditable="false">${e.cw_member_id ?? ""}</td>
        <td>
          <button class="btn small edit">Edit</button>
          <button class="btn primary small save" style="display:none;">Save</button>
        </td>
      </tr>`
    )
    .join("");

  wireRowButtons(tbody);
}

function wireRowButtons(tbody) {
  tbody.querySelectorAll(".edit").forEach(btn =>
    btn.addEventListener("click", () => onEditClick(btn))
  );
  tbody.querySelectorAll(".save").forEach(btn =>
    btn.addEventListener("click", () => onSaveClick(btn))
  );
}

function onAddClick(tbody) {
  if (tbody.querySelector(".new-row")) return;
  const tr = document.createElement("tr");
  tr.className = "new-row";
  tr.innerHTML = `
    <td>New</td>
    <td><input type="text" placeholder="First Name"></td>
    <td><input type="text" placeholder="Last Name"></td>
    <td><input type="email" placeholder="Email"></td>
    <td>
      <select>
        <option value="Casual">Casual</option>
        <option value="FTE">FTE</option>
        <option value="Contractor">Contractor</option>
      </select>
    </td>
    <td style="text-align:center"><input type="checkbox" checked></td>
    <td><input type="number" placeholder="Mgr ID"></td>
    <td><input type="number" placeholder="CW ID"></td>
    <td>
      <button class="btn primary small save-new">💾 Save</button>
      <button class="btn danger small cancel-new">✖ Cancel</button>
    </td>`;
  tbody.prepend(tr);

  tr.querySelector(".cancel-new").addEventListener("click", () => tr.remove());
  tr.querySelector(".save-new").addEventListener("click", () => saveNewRow(tr, tbody));
}

async function saveNewRow(tr, tbody) {
  const [first, last, email, typeSel, activeChk, mgr, cw] = tr.querySelectorAll("input, select");
  const payload = {
    first_name: first.value.trim(),
    last_name: last.value.trim(),
    email: email.value.trim(),
    type: typeSel.value,
    active: activeChk.checked,
    manager_employee_id: toNullableInt(mgr.value),
    cw_member_id: toNullableInt(cw.value)
  };

  if (!payload.first_name || !payload.last_name) {
    alert("⚠️ First and Last name required.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/employees/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    alert("✅ Employee added.");
    tr.remove();
    loadEmployees(tbody);
  } catch (err) {
    console.error(err);
    alert("❌ Error adding employee.");
  }
}

function onEditClick(btn) {
  const tr = btn.closest("tr");
  for (let i = 1; i <= 4; i++) tr.cells[i].contentEditable = "true";
  tr.querySelector("input[type=checkbox]").disabled = false;
  tr.cells[6].contentEditable = "true";
  tr.cells[7].contentEditable = "true";
  tr.querySelector(".edit").style.display = "none";
  tr.querySelector(".save").style.display = "inline-block";
}

async function onSaveClick(btn) {
  const tr = btn.closest("tr");
  const id = parseInt(tr.dataset.id, 10);
  const payload = {
    first_name: tr.cells[1].textContent.trim(),
    last_name: tr.cells[2].textContent.trim(),
    email: tr.cells[3].textContent.trim(),
    type: tr.cells[4].textContent.trim(),
    active: tr.querySelector("input[type=checkbox]").checked,
    manager_employee_id: toNullableInt(tr.cells[6].textContent.trim()),
    cw_member_id: toNullableInt(tr.cells[7].textContent.trim())
  };

  try {
    const res = await fetch(`${API_BASE}/employees/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    alert("✅ Updated.");
    for (let i = 1; i <= 4; i++) tr.cells[i].contentEditable = "false";
    tr.cells[6].contentEditable = "false";
    tr.cells[7].contentEditable = "false";
    tr.querySelector("input[type=checkbox]").disabled = true;
    tr.querySelector(".edit").style.display = "inline-block";
    tr.querySelector(".save").style.display = "none";
  } catch (err) {
    console.error(err);
    alert("❌ Error updating employee.");
  }
}

// helpers
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function toNullableInt(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
