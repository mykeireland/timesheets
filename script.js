// ===================== script.js =====================

// Use the global API_BASE defined in config.js
const API_BASE = window.API_BASE;

// Simple queue of timesheet entries before submission
let queuedEntries = [];

// Filtering and sorting state
let queueFilterText = "";
let queueSortField = null;
let queueSortDir = 1; // 1 = ascending, -1 = descending

// ---------- LOAD EMPLOYEES ----------
async function loadEmployees() {
  const select = document.getElementById("employeeSelect");
  try {
    const res = await fetch(`${API_BASE}/employees`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const employees = await res.json();

    select.innerHTML = "";

    // Add default placeholder option
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "-- Please select an employee --";
    placeholder.selected = true;
    select.appendChild(placeholder);

    if (!Array.isArray(employees) || employees.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "(no employees found)";
      select.appendChild(opt);
      return;
    }

    for (const e of employees) {
      const opt = document.createElement("option");
      opt.value = e.employee_id;
      opt.textContent = `${e.first_name} ${e.last_name}`;
      select.appendChild(opt);
    }
  } catch (err) {
    console.error("❌ Failed to load employees:", err);
    select.innerHTML = '<option value="">(Error loading employees)</option>';
    alert("Failed to load employees. Please refresh the page or contact support.");
  }
}

// ---------- LOAD TICKETS ----------
async function loadTickets() {
  const select = document.getElementById("entryTicket");
  try {
    const res = await fetch(`${API_BASE}/tickets/open`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const tickets = await res.json();

    select.innerHTML = "";

    // Add default placeholder option
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "-- Please select a ticket --";
    placeholder.selected = true;
    select.appendChild(placeholder);

    if (!Array.isArray(tickets) || tickets.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "(no tickets found)";
      select.appendChild(opt);
      return;
    }

    // Map new backend field names to what your old code expected
    tickets.forEach(t => {
      const mapped = {
        ticketId: t.ticket_id,
        ticketName: t.summary || t.name || "(no summary)",
        companyName: t.company_name || "",
        siteName: t.site_name || ""
      };

      const opt = document.createElement("option");
      opt.value = mapped.ticketId;
      opt.textContent = `${mapped.ticketName}`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("❌ Failed to load tickets:", err);
    select.innerHTML = '<option value="">(Error loading tickets)</option>';
    alert("Failed to load tickets. Please refresh the page or contact support.");
  }
}

// ---------- ADD ENTRY TO QUEUE ----------
function addToQueue() {
  const employeeSelect = document.getElementById("employeeSelect");
  const ticketSelect = document.getElementById("entryTicket");
  const dateInput = document.getElementById("entryDate");

  // Validate employee selection first
  if (!employeeSelect.value || employeeSelect.value.trim() === "") {
    alert("Please select an employee first");
    employeeSelect.focus();
    return;
  }

  // Validate ticket selection
  if (!ticketSelect.value || ticketSelect.value.trim() === "") {
    alert("Please select a ticket");
    ticketSelect.focus();
    return;
  }

  // Validate date
  if (!dateInput.value || dateInput.value.trim() === "") {
    alert("Please select a date");
    dateInput.focus();
    return;
  }

  const entry = {
    employeeId: employeeSelect.value,
    employeeName: employeeSelect.options[employeeSelect.selectedIndex]?.textContent || "Unknown",
    ticketId: ticketSelect.value,
    ticketName: ticketSelect.options[ticketSelect.selectedIndex]?.textContent || "Unknown",
    date: dateInput.value,
    hoursStandard: Number(document.getElementById("hoursStd").value || 0),
    hours15x: Number(document.getElementById("hours15").value || 0),
    hours2x: Number(document.getElementById("hours2").value || 0),
    notes: document.getElementById("entryNotes").value.trim()
  };

  // Validate at least one hour type has a value
  if (entry.hoursStandard === 0 && entry.hours15x === 0 && entry.hours2x === 0) {
    alert("Please enter hours for at least one hour type (Standard, 1.5x, or 2x)");
    document.getElementById("hoursStd").focus();
    return;
  }

  console.log("Adding entry to queue:", entry);
  queuedEntries.push(entry);
  renderQueue();
}

// ---------- REMOVE ENTRY FROM QUEUE ----------
function removeFromQueue(index) {
  queuedEntries.splice(index, 1);
  renderQueue();
}

// ---------- RENDER QUEUE TABLE ----------
function renderQueue() {
  const queueDiv = document.getElementById("queuedEntries");
  const tbody = document.getElementById("queueTable");
  tbody.innerHTML = "";

  if (queuedEntries.length === 0) {
    queueDiv.style.display = "none";
    return;
  }

  // Apply filtering and sorting
  let displayEntries = queuedEntries.map((e, i) => ({ ...e, originalIndex: i }));

  // Filter
  if (queueFilterText) {
    const q = queueFilterText.toLowerCase();
    displayEntries = displayEntries.filter(e =>
      [e.date, e.employeeName, e.ticketName, e.notes]
        .map(x => String(x || "").toLowerCase())
        .some(s => s.includes(q))
    );
  }

  // Sort
  if (queueSortField) {
    displayEntries.sort((a, b) => {
      let va = a[queueSortField];
      let vb = b[queueSortField];

      // Handle null/undefined
      if (va === null || va === undefined) va = "";
      if (vb === null || vb === undefined) vb = "";

      // Numeric fields
      if (queueSortField === "hoursStandard" || queueSortField === "hours15x" || queueSortField === "hours2x") {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
        return (va - vb) * queueSortDir;
      }

      // Text fields
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return -1 * queueSortDir;
      if (va > vb) return 1 * queueSortDir;
      return 0;
    });
  }

  // Render rows
  displayEntries.forEach((e) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Date">${e.date}</td>
      <td data-label="Employee">${e.employeeName}</td>
      <td data-label="Ticket">${e.ticketName}</td>
      <td data-label="Std Hours">${e.hoursStandard.toFixed(2)}</td>
      <td data-label="1.5x Hours">${e.hours15x.toFixed(2)}</td>
      <td data-label="2x Hours">${e.hours2x.toFixed(2)}</td>
      <td data-label="Notes">${e.notes || "—"}</td>
      <td data-label="Action"><button class="btn light remove-btn" data-index="${e.originalIndex}">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });

  queueDiv.style.display = "block";
}

// ---------- UPDATE SORT ICONS ----------
function updateQueueSortIcons() {
  document.querySelectorAll("#queuedEntries th[data-field]").forEach(th => {
    const field = th.getAttribute("data-field");
    const icon = th.querySelector(".sort-icon");
    if (!icon) return;

    if (field === queueSortField) {
      icon.textContent = queueSortDir === 1 ? "↑" : "↓";
    } else {
      icon.textContent = "⇅";
    }
  });
}

// ---------- SUBMIT QUEUED ENTRIES ----------
async function submitTimesheets() {
  if (queuedEntries.length === 0) {
    alert("No entries to submit.");
    return;
  }

  // Validate all entries before submission
  for (let i = 0; i < queuedEntries.length; i++) {
    const entry = queuedEntries[i];
    if (!entry.employeeId || entry.employeeId.trim() === "") {
      alert(`Entry #${i + 1} is missing an employee ID. Please remove and re-add this entry.`);
      console.error("Invalid entry found:", entry);
      return;
    }
    if (!entry.ticketId || entry.ticketId.trim() === "") {
      alert(`Entry #${i + 1} is missing a ticket ID. Please remove and re-add this entry.`);
      console.error("Invalid entry found:", entry);
      return;
    }
    if (!entry.date || entry.date.trim() === "") {
      alert(`Entry #${i + 1} is missing a date. Please remove and re-add this entry.`);
      console.error("Invalid entry found:", entry);
      return;
    }
  }

  // Transform queued entries to match backend expected format (camelCase)
  const payload = queuedEntries.map(entry => ({
    employeeId: parseInt(entry.employeeId, 10),
    employeeName: entry.employeeName,
    ticketId: parseInt(entry.ticketId, 10),
    ticketName: entry.ticketName,
    date: entry.date,
    hoursStandard: entry.hoursStandard,
    hours15x: entry.hours15x,
    hours2x: entry.hours2x,
    notes: entry.notes || ""
  }));

  console.log("📤 Submitting timesheets:", payload);

  window.showLoading();
  try {
    const res = await fetch(`${API_BASE}/timesheets/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    console.log("📥 Response status:", res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Error response:", errorText);
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    console.log("📥 Response data:", data);

    // Check if submission was successful
    // Backend returns {ok: true/false} with details in data.data
    if (data.ok === true || data.success === true) {
      alert("Timesheet entries submitted successfully!");
      queuedEntries = [];
      renderQueue();
    } else {
      // Backend returned errors - show detailed error message
      const errors = data.data?.errors || [];
      const errorMessage = errors.length > 0
        ? `Failed to submit:\n\n${errors.join('\n')}`
        : (data.message || "Unknown error from server");
      throw new Error(errorMessage);
    }
  } catch (err) {
    console.error("❌ Error submitting timesheets:", err);
    alert(`Failed to submit timesheets: ${err.message}`);
  } finally {
    window.hideLoading();
  }
}

// ---------- INITIALIZE ----------
window.addEventListener("DOMContentLoaded", () => {
  loadEmployees();
  loadTickets();

  // Form submit handler
  document.getElementById("timesheetForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    submitTimesheets();
  });

  // Add to queue button
  const addBtn = document.getElementById("addToQueueBtn");
  if (addBtn) {
    addBtn.addEventListener("click", addToQueue);
  }

  // Print button
  const printBtn = document.getElementById("printBtn");
  if (printBtn) {
    printBtn.addEventListener("click", () => {
      window.print();
    });
  }

  // Manager view button
  const managerBtn = document.getElementById("managerBtn");
  if (managerBtn) {
    managerBtn.addEventListener("click", () => {
      window.location.href = "manager.html";
    });
  }

  // Event delegation for remove buttons in queue
  document.getElementById("queueTable").addEventListener("click", (ev) => {
    if (ev.target.classList.contains("remove-btn")) {
      const index = parseInt(ev.target.dataset.index, 10);
      removeFromQueue(index);
    }
  });

  // Queue filter input handler
  const queueFilter = document.getElementById("queueFilter");
  if (queueFilter) {
    queueFilter.addEventListener("input", () => {
      queueFilterText = queueFilter.value.trim().toLowerCase();
      renderQueue();
    });
  }

  // Queue sort button click handler
  document.addEventListener("click", (ev) => {
    const sortBtn = ev.target.closest(".sort-btn");
    if (!sortBtn) return;

    const th = sortBtn.closest("th");
    if (!th) return;

    // Only handle queue table sorts
    const isQueueTable = th.closest("#queuedEntries");
    if (!isQueueTable) return;

    const field = th.getAttribute("data-field");
    if (!field) return;

    // Toggle sort direction if clicking same field, otherwise reset to ascending
    if (queueSortField === field) {
      queueSortDir *= -1;
    } else {
      queueSortField = field;
      queueSortDir = 1;
    }

    updateQueueSortIcons();
    renderQueue();
  });
});
