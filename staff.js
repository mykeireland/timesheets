const API_BASE = window.API_BASE || "http://localhost:7071/api";
const tableBody = document.querySelector("#employeeTable tbody");
let employees = [];

document.addEventListener("DOMContentLoaded", loadEmployees);

// === Load All Employees ===
async function loadEmployees() {
  try {
    const res = await fetch(`${API_BASE}/employees`);
    const data = await res.json();
    employees = Array.isArray(data) ? data : data.results || [];
    renderTable();
  } catch (err) {
    console.error("Failed to load employees:", err);
    tableBody.innerHTML = `<tr><td colspan="7">Error loading employees.</td></tr>`;
  }
}

// === Render Table ===
function renderTable() {
  tableBody.innerHTML = "";

  employees.sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0)); // active first

  employees.forEach(emp => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${emp.employee_id}</td>
      <td contenteditable="false">${emp.first_name || ""}</td>
      <td contenteditable="false">${emp.last_name || ""}</td>
      <td contenteditable="false">${emp.email || ""}</td>
      <td contenteditable="false">${emp.type || ""}</td>
      <td style="text-align:center">
        <input type="checkbox" ${emp.active ? "checked" : ""} disabled />
      </td>
      <td>
        <button class="btn small" onclick="enableEdit(this, ${emp.employee_id})">Edit</button>
        <button class="btn primary small" onclick="saveEmployee(${emp.employee_id}, this)" style="display:none;">Save</button>
      </td>
    `;
    if (!emp.active) tr.style.opacity = 0.5;
    tableBody.appendChild(tr);
  });
}

// === Enable Editing ===
function enableEdit(btn, id) {
  const row = btn.closest("tr");
  row.querySelectorAll("[contenteditable]").forEach(td => (td.contentEditable = "true"));
  row.querySelector("input[type=checkbox]").disabled = false;
  btn.style.display = "none";
  row.querySelector(".btn.primary").style.display = "inline-block";
  row.classList.add("editing");
}

// === Save Changes ===
async function saveEmployee(id, btn) {
  const row = btn.closest("tr");
  const updated = {
    first_name: row.cells[1].textContent.trim(),
    last_name: row.cells[2].textContent.trim(),
    email: row.cells[3].textContent.trim(),
    type: row.cells[4].textContent.trim(),
    active: row.querySelector("input[type=checkbox]").checked,
  };

  try {
    const res = await fetch(`${API_BASE}/employees/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });

    const result = await res.json();
    if (result.ok) {
      alert("✅ Employee updated successfully!");
      loadEmployees();
    } else {
      alert("❌ Failed to update employee: " + (result.error || "Unknown error"));
    }
  } catch (err) {
    alert("❌ Network error: " + err.message);
  }
}

// === Add New Employee ===
function addEmployee() {
  const newRow = {
    first_name: "New",
    last_name: "Employee",
    email: "new@example.com",
    type: "Casual",
    active: true,
  };

  fetch(`${API_BASE}/employees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newRow),
  })
    .then(r => r.json())
    .then(result => {
      if (result.ok) {
        alert("✅ Employee added!");
        loadEmployees();
      } else {
        alert("❌ Failed to add employee: " + result.error);
      }
    })
    .catch(err => {
      alert("❌ Error adding employee: " + err.message);
    });
}

