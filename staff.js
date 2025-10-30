"use strict";

const API_BASE = (window.API_BASE || "http://localhost:7071/api").replace(/\/+$/g, "");
const els = {
  tableBody: null,
  addBtn: null,
};
let employees = [];

document.addEventListener("DOMContentLoaded", () => {
  els.tableBody = document.querySelector("#staffTable tbody");
  els.addBtn = document.getElementById("addBtn");

  if (!els.tableBody) {
    console.error("❌ #staffTable tbody not found.");
    return;
  }
  if (!els.addBtn) {
    console.error("❌ #addBtn not found.");
    return;
  }

  els.addBtn.addEventListener("click", onAddClick);
  loadEmployees();
});

// ===================== Load & Render =====================

async function loadEmployees() {
  els.tableBody.innerHTML = `<tr><td colspan="9">Loading…</td></tr>`;
  try {
    const res = await fetch(`${API_BASE}/employees`);
    const data = await res.json();

    // Accept both array or wrapped payloads
    const raw = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
    // Normalize just in case
    employees = raw.map(e => ({
      employee_id: e.employee_id ?? e.id,
      first_name: e.first_name ?? "",
      last_name: e.last_name ?? "",
      email: e.email ?? "",
      type: e.type ?? "",
      active: !!e.active,
      manager_employee_id: toNullableInt(e.manager_employee_id),
      cw_member_id: toNullableInt(e.cw_member_id),
      created_utc: e.created_utc,
      updated_utc: e.updated_utc
    }));

    // Show active first
    employees.sort((a, b) => (b.active === a.active) ? cmp((a.last_name||"") + (a.first_name||""), (b.last_name||"") + (b.first_name||"")) : (b.active - a.active));

    renderTable();
  } catch (err) {
    console.error("❌ Failed to load employees:", err);
    els.tableBody.innerHTML = `<tr><td colspan="9">Error loading employees.</td></tr>`;
  }
}

function renderTable() {
  if (!employees.length) {
    els.tableBody.innerHTML = `<tr><td colspan="9">No employees found.</td></tr>`;
    return;
  }
  els.tableBody.innerHTML = employees.map(rowHtml).join("");
  wireRowButtons();
}

function rowHtml(emp) {
  const muted = emp.active ? "" : ` class="muted"`;
  return `
    <tr data-id="${emp.employee_id}"${muted}>
      <td>${emp.employee_id}</td>
      <td contenteditable="false">${escapeHtml(emp.first_name)}</td>
      <td contenteditable="false">${escapeHtml(emp.last_name)}</td>
      <td contenteditable="false">${escapeHtml(emp.email)}</td>
      <td contenteditable="false">${escapeHtml(emp.type)}</td>
      <td style="text-align:center">
        <input type="checkbox" ${emp.active ? "checked" : ""} disabled />
      </td>
      <td contenteditable="false" class="muted">${emp.manager_employee_id ?? ""}</td>
      <td contenteditable="false" class="muted">${emp.cw_member_id ?? ""}</td>
      <td>
        <button class="btn small edit">Edit</button>
        <button class="btn primary small save" style="display:none;">Save</button>
      </td>
    </tr>
  `;
}

function wireRowButtons() {
  document.querySelectorAll("#staffTable .edit").forEach(btn => {
    btn.addEventListener("click", () => onEditClick(btn));
  });
  document.querySelectorAll("#staffTable .save").forEach(btn => {
    btn.addEventListener("click", () => onSaveClick(btn));
  });
}

// ===================== Add New Employee =====================

function onAddClick() {
  // Prevent multiple new rows
  if (els.tableBody.querySelector(".new-row")) return;

  const tr = document.createElement("tr");
  tr.className = "new-row";
  tr.innerHTML = `
    <td>New</td>
    <td><input type="text" placeholder="First Name" required></td>
    <td><input type="text" placeholder="Last Name" required></td>
    <td><input type="email" placeholder="Email" required></td>
    <td>
      <select>
        <option value="Casual">Casual</option>
        <option value="FTE">FTE</option>
        <option value="Contractor">Contractor</option>
      </select>
    </td>
    <td style="text-align:center"><input type="checkbox" checked></td>
    <td class="muted"><input type="number" placeholder="Mgr ID" min="1"></td>
    <td class="muted"><input type="number" placeholder="CW ID" min="0"></td>
    <td>
      <button class="btn primary small save-new">💾 Save</button>
      <button class="btn danger small cancel-new">✖ Cancel</button>
    </td>
  `;
  els.tableBody.prepend(tr);

  tr.querySelector(".cancel-new").addEventListener("click", () => tr.remove());
  tr.querySelector(".save-new").addEventListener("click", () => saveNewRow(tr));
}

async function saveNewRow(tr) {
  const inputs = tr.querySelectorAll("input, select");
  const [first, last, email, typeSel, activeChk, mgr, cw] = [
    inputs[0], inputs[1], inputs[2], inputs[3], inputs[4], inputs[5], inputs[6]
  ];

  const payload = {
    first_name: first.value.trim(),
    last_name: last.value.trim(),
    email: email.value.trim(),
    type: typeSel.value,
    manager_employee_id: toNullableInt(mgr.value),
    cw_member_id: toNullableInt(cw.value),
    active: activeChk.checked
  };

  if (!payload.first_name || !payload.last_name || !payload.email) {
    alert("⚠️ First name, last name and email are required.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/employees/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (!res.ok || !result.ok) {
      console.error("Add failed:", result);
      alert("❌ Error adding employee: " + (result.error || res.statusText));
      return;
    }

    alert("✅ Employee added successfully!");
    tr.remove();
    loadEmployees();
  } catch (err) {
    console.error("Network error:", err);
    alert("❌ Network error adding employee.");
  }
}

// ===================== Edit / Save Existing =====================

function onEditClick(btn) {
  const tr = btn.closest("tr");
  tr.classList.add("editing");
  [...tr.cells].slice(1, 5).forEach(td => td.contentEditable = "true"); // first,last,email,type
  tr.querySelector('input[type="checkbox"]').disabled = false;
  tr.querySelectorAll(".edit")[0].style.display = "none";
  tr.querySelectorAll(".save")[0].style.display = "inline-block";
  // manager & cw columns editable (optional)
  tr.cells[6].contentEditable = "true";
  tr.cells[7].contentEditable = "true";
}

async function onSaveClick(btn) {
  const tr = btn.closest("tr");
  const id = parseInt(tr.dataset.id, 10);

  const payload = {
    first_name: tr.cells[1].textContent.trim(),
    last_name: tr.cells[2].textContent.trim(),
    email: tr.cells[3].textContent.trim(),
    type: tr.cells[4].textContent.trim(),
    active: tr.querySelector('input[type="checkbox"]').checked,
    manager_employee_id: toNullableInt(tr.cells[6].textContent.trim()),
    cw_member_id: toNullableInt(tr.cells[7].textContent.trim())
  };

  if (!payload.first_name || !payload.last_name || !payload.email) {
    alert("⚠️ First name, last name and email are required.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/employees/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (!res.ok || !result.ok) {
      console.error("Update failed:", result);
      alert("❌ Error updating employee: " + (result.error || res.statusText));
      return;
    }

    alert("✅ Employee updated");
    tr.classList.remove("editing");
    [...tr.cells].slice(1, 5).forEach(td => td.contentEditable = "false");
    tr.querySelector('input[type="checkbox"]').disabled = true;
    tr.querySelectorAll(".save")[0].style.display = "none";
    tr.querySelectorAll(".edit")[0].style.display = "inline-block";
    tr.cells[6].contentEditable = "false";
    tr.cells[7].contentEditable = "false";

    loadEmployees();
  } catch (err) {
    console.error("Network error:", err);
    alert("❌ Network error updating employee.");
  }
}

// ===================== Helpers =====================

function toNullableInt(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function cmp(a, b) {
  const aa = String(a).toLowerCase(), bb = String(b).toLowerCase();
  return aa < bb ? -1 : aa > bb ? 1 : 0;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
