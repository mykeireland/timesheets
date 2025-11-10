"use strict";

/**
 * staff.js — Manage Casual Staff (final clean build)
 */

// Use the global API_BASE defined in config.js
const API_BASE = window.API_BASE;

let employees = [];
let pinStatuses = {}; // Map of employee_id -> { hasPin, lastUpdated }
let filterText = "";
let sortField = null;
let sortDir = 1; // 1 = ascending, -1 = descending

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.querySelector("#staffTable tbody");
  const addBtn = document.getElementById("addBtn");
  const staffFilter = document.getElementById("staffFilter");
  const managerBtn = document.getElementById("managerBtn");
  const homeBtn = document.getElementById("homeBtn");

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

  // Navigation buttons
  if (managerBtn) {
    managerBtn.addEventListener("click", () => {
      window.location.href = "manager.html";
    });
  }

  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  // Sort button click handler
  document.addEventListener("click", (ev) => {
    const sortBtn = ev.target.closest(".sort-btn");
    if (!sortBtn) return;

    const th = sortBtn.closest("th");
    if (!th) return;

    const field = th.getAttribute("data-field");
    if (!field) return;

    // Toggle sort direction if clicking same field, otherwise reset to ascending
    if (sortField === field) {
      sortDir *= -1;
    } else {
      sortField = field;
      sortDir = 1;
    }

    updateSortIcons();
    renderTable(tableBody);
  });

  loadEmployees(tableBody);
});

async function loadEmployees(tbody) {
  tbody.innerHTML = `<tr><td colspan="10">Loading…</td></tr>`;

  try {
    // Load employees and PIN status in parallel
    const [employeesRes, pinStatusRes] = await Promise.all([
      fetch(`${API_BASE}/employees`, { cache: "no-store" }),
      fetch(`${API_BASE}/admin/pin-status`, { cache: "no-store" })
    ]);

    if (!employeesRes.ok) {
      throw new Error(`HTTP ${employeesRes.status}: ${employeesRes.statusText}`);
    }

    const rawText = await employeesRes.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("Invalid JSON:", rawText);
      tbody.innerHTML = `<tr><td colspan="10">Invalid JSON from API</td></tr>`;
      alert("Received invalid data from server. Please contact support.");
      return;
    }

    const raw = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
    if (!raw.length) {
      tbody.innerHTML = `<tr><td colspan="10">No employees found.</td></tr>`;
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

    // Load PIN status data
    if (pinStatusRes.ok) {
      try {
        const pinData = await pinStatusRes.json();
        if (pinData.success && Array.isArray(pinData.data)) {
          pinStatuses = {};
          pinData.data.forEach(status => {
            pinStatuses[status.employeeId] = {
              hasPin: status.hasPin,
              lastUpdated: status.lastUpdated
            };
          });
        }
      } catch (err) {
        console.warn("Failed to load PIN status:", err);
      }
    }

    renderTable(tbody);
  } catch (err) {
    console.error("Load error:", err);
    tbody.innerHTML = `<tr><td colspan="10">Error: ${err.message}</td></tr>`;
    alert("Failed to load employees. Please refresh the page.");
  }
}

function renderTable(tbody) {
  let rows = employees;

  // Apply filter
  if (filterText) {
    rows = rows.filter(e =>
      [e.first_name, e.last_name, e.email, e.type]
        .map(x => (x ?? "").toLowerCase())
        .join(" ")
        .includes(filterText)
    );
  }

  // Apply sort
  if (sortField) {
    rows.sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];

      // Handle null/undefined values
      if (va === null || va === undefined) va = "";
      if (vb === null || vb === undefined) vb = "";

      // For numeric fields, compare as numbers
      if (sortField === "employee_id" || sortField === "manager_employee_id" || sortField === "cw_member_id") {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
        return (va - vb) * sortDir;
      }

      // For boolean (active, has_pin)
      if (sortField === "active" || sortField === "has_pin") {
        return (Number(va) - Number(vb)) * sortDir;
      }

      // For text fields, compare as strings
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });
  }

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10">No employees match your filter</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(
      e => {
        const pinStatus = pinStatuses[e.employee_id];
        const hasPinBadge = pinStatus?.hasPin
          ? `<span class="status-badge success" title="Last updated: ${formatDate(pinStatus.lastUpdated)}">✓ Set</span>`
          : `<span class="status-badge danger">✗ Not Set</span>`;

        return `
      <tr data-id="${e.employee_id}">
        <td data-label="ID">${e.employee_id}</td>
        <td data-label="First Name" contenteditable="false">${escapeHtml(e.first_name)}</td>
        <td data-label="Last Name" contenteditable="false">${escapeHtml(e.last_name)}</td>
        <td data-label="Email" contenteditable="false">${escapeHtml(e.email)}</td>
        <td data-label="Type" contenteditable="false">${escapeHtml(e.type)}</td>
        <td data-label="Active" style="text-align:center">
          <input type="checkbox" ${e.active ? "checked" : ""} disabled>
        </td>
        <td data-label="PIN Status" style="text-align:center">${hasPinBadge}</td>
        <td data-label="Manager ID" contenteditable="false">${e.manager_employee_id ?? ""}</td>
        <td data-label="CW Member ID" contenteditable="false">${e.cw_member_id ?? ""}</td>
        <td data-label="Action">
          <button class="btn secondary small edit">Edit</button>
          <button class="btn primary small save" style="display:none;">Save</button>
          <button class="btn danger small reset-pin" title="Reset PIN to 0000">Reset PIN</button>
        </td>
      </tr>`;
      }
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
  tbody.querySelectorAll(".reset-pin").forEach(btn =>
    btn.addEventListener("click", () => onResetPinClick(btn, tbody))
  );
}

function onAddClick(tbody) {
  if (tbody.querySelector(".new-row")) return;
  const tr = document.createElement("tr");
  tr.className = "new-row";
  tr.innerHTML = `
    <td data-label="ID">New</td>
    <td data-label="First Name"><input type="text" placeholder="First Name"></td>
    <td data-label="Last Name"><input type="text" placeholder="Last Name"></td>
    <td data-label="Email"><input type="email" placeholder="Email"></td>
    <td data-label="Type">
      <select>
        <option value="Casual">Casual</option>
        <option value="FTE">FTE</option>
        <option value="Contractor">Contractor</option>
      </select>
    </td>
    <td data-label="Active" style="text-align:center"><input type="checkbox" checked></td>
    <td data-label="PIN Status" style="text-align:center"><span class="status-badge" style="opacity:0.5;">Will be set to 0000</span></td>
    <td data-label="Manager ID"><input type="number" placeholder="Mgr ID"></td>
    <td data-label="CW Member ID"><input type="number" placeholder="CW ID"></td>
    <td data-label="Action">
      <button class="btn primary small save-new">Save</button>
      <button class="btn secondary small cancel-new">Cancel</button>
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
    alert("First and Last name required.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/employees/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    const result = await res.json();
    const newEmployeeId = result.employee_id || result.id || result.data?.employee_id;

    // Automatically set default PIN (0000) for new employee
    if (newEmployeeId) {
      try {
        await fetch(`${API_BASE}/admin/reset-pin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employeeId: String(newEmployeeId),
            newPin: "0000"
          })
        });
        console.log(`Default PIN set for new employee ${newEmployeeId}`);
      } catch (pinErr) {
        console.warn("Failed to set default PIN for new employee:", pinErr);
        // Don't fail the whole operation if PIN setting fails
      }
    }

    alert("Employee added successfully! Default PIN set to 0000.");
    tr.remove();
    loadEmployees(tbody);
  } catch (err) {
    console.error("Add employee error:", err);
    alert(`Failed to add employee: ${err.message}`);
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

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    alert("Employee updated successfully!");
    for (let i = 1; i <= 4; i++) tr.cells[i].contentEditable = "false";
    tr.cells[6].contentEditable = "false";
    tr.cells[7].contentEditable = "false";
    tr.querySelector("input[type=checkbox]").disabled = true;
    tr.querySelector(".edit").style.display = "inline-block";
    tr.querySelector(".save").style.display = "none";
  } catch (err) {
    console.error("Update employee error:", err);
    alert(`Failed to update employee: ${err.message}`);
  }
}

async function onResetPinClick(btn, tbody) {
  const tr = btn.closest("tr");
  const employeeId = parseInt(tr.dataset.id, 10);
  const employeeName = `${tr.cells[1].textContent} ${tr.cells[2].textContent}`;

  // Prompt manager for custom PIN or use default
  const customPin = prompt(
    `Set PIN for ${employeeName}\n\n` +
    `Enter a 4-digit PIN (or leave blank for default "0000"):\n\n` +
    `Note: Employee will be required to change from "0000" on first login.`,
    "0000"
  );

  // User cancelled
  if (customPin === null) return;

  // Validate PIN
  const pinToSet = customPin.trim() || "0000";
  if (!/^\d{4}$/.test(pinToSet)) {
    alert("PIN must be exactly 4 digits (0-9 only)");
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = "Setting PIN...";

    const payload = {
      employeeId: String(employeeId),  // Convert to string for backend
      newPin: pinToSet
    };

    console.log("🔍 Reset PIN Request:", payload);

    const res = await fetch(`${API_BASE}/admin/reset-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    console.log("📥 Response status:", res.status);

    // Handle non-JSON responses (like 404 HTML pages)
    if (!res.ok) {
      let errorMsg;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await res.json();
        errorMsg = errorData.message || `HTTP ${res.status}`;
      } else {
        errorMsg = `HTTP ${res.status}: Endpoint not found. Route may not be deployed.`;
      }
      throw new Error(errorMsg);
    }

    const data = await res.json();
    console.log("📥 Response data:", data);

    if (!data.success) {
      throw new Error(data.message || "Unknown error");
    }

    if (pinToSet === "0000") {
      alert(`PIN reset to default for ${employeeName}!\n\nEmployee will be required to change PIN on first login.`);
    } else {
      alert(`Custom PIN set for ${employeeName}!\n\nNew PIN: ${pinToSet}\n\nPlease share this PIN with the employee securely.`);
    }

    // Reload employees to refresh PIN status
    await loadEmployees(tbody);
  } catch (err) {
    console.error("Reset PIN error:", err);
    alert(`Failed to set PIN: ${err.message}`);
    btn.disabled = false;
    btn.textContent = "Reset PIN";
  }
}

function updateSortIcons() {
  document.querySelectorAll("#staffTable th[data-field]").forEach(th => {
    const field = th.getAttribute("data-field");
    const icon = th.querySelector(".sort-icon");
    if (!icon) return;

    if (field === sortField) {
      icon.textContent = sortDir === 1 ? "↑" : "↓";
    } else {
      icon.textContent = "⇅";
    }
  });
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

function formatDate(dateString) {
  if (!dateString) return "Never";
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return "Invalid date";
  }
}
