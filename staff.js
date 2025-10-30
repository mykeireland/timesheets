"use strict";

/**
 * staff.js — Manage Casual Staff (diagnostic build)
 * UI requirements:
 *  - <table id="staffTable"><tbody>…</tbody></table>
 *  - <button id="addBtn">…</button>
 *  - <input id="staffFilter">
 *  - window.API_BASE configured via <script> on the page
 */

const API_BASE = (window.API_BASE || "http://localhost:7071/api").replace(/\/+$/g, "");

// DOM elements
const els = {
  tableBody: null,
  addBtn: null,
  staffFilter: null,
  debug: null, // inline debug slot
};

// state
let employees = [];
let filterText = "";

// ---------- Utilities ----------
function toNullableInt(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function cmp(a, b) {
  const aa = String(a ?? "").toLowerCase();
  const bb = String(b ?? "").toLowerCase();
  return aa < bb ? -1 : aa > bb ? 1 : 0;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setTableMessage(msg) {
  els.tableBody.innerHTML = `<tr><td colspan="9">${escapeHtml(msg)}</td></tr>`;
}

function ensureDebugDiv() {
  if (els.debug) return;
  const container = document.querySelector(".container") || document.body;
  const d = document.createElement("pre");
  d.id = "staff-debug";
  d.style.cssText = "margin:12px 0;padding:10px;background:#f9fbff;border:1px dashed #bcd;color:#334;white-space:pre-wrap;display:none;";
  container.prepend(d);
  els.debug = d;
}

function debugShow(title, obj) {
  ensureDebugDiv();
  els.debug.style.display = "block";
  const text = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  els.debug.textContent = `[${title}]\n${text}`;
  console.groupCollapsed(`🧪 Staff Debug: ${title}`);
  console.log(obj);
  console.groupEnd();
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  els.tableBody = document.querySelector("#staffTable tbody");
  els.addBtn = document.getElementById("addBtn");
  els.staffFilter = document.getElementById("staffFilter");

  if (!els.tableBody) {
    console.error("❌ #staffTable tbody not found.");
    return;
  }
  if (!els.addBtn) {
    console.error("❌ #addBtn not found.");
    setTableMessage("UI error: Add button not found (#addBtn).");
    return;
  }

  // wire events
  els.addBtn.addEventListener("click", onAddClick);
  if (els.staffFilter) {
    els.staffFilter.addEventListener("input", () => {
      filterText = els.staffFilter.value.trim().toLowerCase();
      renderTable();
    });
  }

  // Display API base for sanity
  debugShow("API_BASE", API_BASE);

  loadEmployees();
});

// ---------- Load & Render ----------
async function loadEmployees() {
  setTableMessage("Loading…");

  try {
    // Fetch as text first so we can show raw body if not JSON
    const resp = await fetch(`${API_BASE}/employees`, { cache: "no-store" });
    const rawText = await resp.text();

    debugShow("Raw /employees response", { status: resp.status, body: rawText });

    if (!resp.ok) {
      setTableMessage(`API error (${resp.status}). See debug above.`);
      return;
    }

    // Try to parse JSON
    let data;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (e) {
      setTableMessage("Response is not valid JSON. See debug above.");
      return;
    }

    // Accept array or { results: [...] }
    const raw = Array.isArray(data) ? data : (Array.isArray(data?.results) ? data.results : null);
    if (!raw) {
      setTableMessage("Unexpected JSON shape from /employees. See debug above.");
      return;
    }

    // Normalize
    employees = raw.map(e => ({
      employee_id: e.employee_id ?? e.id,
      first_name: e.first_name ?? "",
      last_name: e.last_name ?? "",
      email: e.email ?? "",
      type: e.type ?? "",
      active: e.active === undefined ? true : !!e.active,
      manager_employee_id: toNullableInt(e.manager_employee_id),
      cw_member_id: toNullableInt(e.cw_member_id),
      created_utc: e.created_utc,
      updated_utc: e.updated_utc
    }));

    // If normalization produced no IDs, show warning
    if (!employees.length) {
      setTableMessage("No employees returned.");
      return;
    }

    // Active first, then by name
    employees.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return cmp((a.last_name || "") + (a.first_name || ""), (b.last_name || "") + (b.first_name || ""));
    });

    renderTable();
  } catch (err) {
    console.error("❌ Failed to load employees:", err);
    debugShow("Load error", String(err));
    setTableMessage("Network error loading employees. See debug above.");
  }
}

function renderTable() {
  let rows = employees;

  if (filterText) {
    rows = rows.filter(e => {
      const hay = [
        e.first_name, e.last_name, e.email, e.type,
        e.manager_employee_id, e.cw_member_id
      ].map(x => (x ?? "").toString().toLowerCase()).join(" ");
      return hay.includes(filterText);
    });
  }

  if (!rows.length) {
    setTableMessage("No employees match your filter.");
    return;
  }

  els.tableBody.innerHTML = rows.map(rowHtml).join("");
  wireRowButtons();
}

function rowHtml(emp) {
  const muted = emp.active ? "" : ` class="muted"`;
  return `
    <tr data-id="${emp.employee_id}"${muted}>
      <td>${emp.employee_id ?? ""}</td>
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

// ---------- Add New Employee ----------
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
    const rawText = await res.text();
    debugShow("Add /employees/add response", { status: res.status, body: rawText });

    let result = null;
    try { result = rawText ? JSON.parse(rawText) : null; } catch {}

    if (!res.ok || !result?.ok) {
      alert("❌ Error adding employee. See debug above.");
      return;
    }

    alert("✅ Employee added successfully!");
    tr.remove();
    loadEmployees();
  } catch (err) {
    console.error("Network error:", err);
    debugShow("Add error", String(err));
    alert("❌ Network error adding employee.");
  }
}

// ---------- Edit / Save Existing ----------
function onEditClick(btn) {
  const tr = btn.closest("tr");
  tr.classList.add("editing");
  for (let i = 1; i <= 4; i++) tr.cells[i].contentEditable = "true"; // first,last,email,type
  tr.querySelector('input[type="checkbox"]').disabled = false;
  tr.querySelector(".edit").style.display = "none";
  tr.querySelector(".save").style.display = "inline-block";
  tr.cells[6].contentEditable = "true"; // manager id
  tr.cells[7].contentEditable = "true"; // cw id
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
    const rawText = await res.text();
    debugShow("Update /employees/{id} response", { status: res.status, body: rawText });

    let result = null;
    try { result = rawText ? JSON.parse(rawText) : null; } catch {}

    if (!res.ok || !result?.ok) {
      alert("❌ Error updating employee. See debug above.");
      return;
    }

    alert("✅ Employee updated");
    tr.classList.remove("editing");
    for (let i = 1; i <= 4; i++) tr.cells[i].contentEditable = "false";
    tr.querySelector('input[type="checkbox"]').disabled = true;
    tr.querySelector(".save").style.display = "none";
    tr.querySelector(".edit").style.display = "inline-block";
    tr.cells[6].contentEditable = "false";
    tr.cells[7].contentEditable = "false";

    loadEmployees();
  } catch (err) {
    console.error("Network error:", err);
    debugShow("Update error", String(err));
    alert("❌ Network error updating employee.");
  }
}
