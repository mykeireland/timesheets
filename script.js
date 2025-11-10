// ===================== script.js =====================

// Use the global API_BASE defined in config.js
const API_BASE = window.API_BASE;

// Simple queue of timesheet entries before submission
let queuedEntries = [];

// Filtering and sorting state
let queueFilterText = "";
let queueSortField = null;
let queueSortDir = 1; // 1 = ascending, -1 = descending

// PIN Authentication state
let authenticatedEmployee = null; // { employeeId, employeeName }
let pendingEmployeeSelection = null; // Temporary storage during PIN verification

// ---------- POPULATE HOURS PICKERS ----------
function populateHoursPickers() {
  const hoursStd = document.getElementById("hoursStd");
  const hours15 = document.getElementById("hours15");
  const hours2 = document.getElementById("hours2");

  // Standard hours: 0 to 7.5 in 0.25 increments, plus 7.6
  populatePicker(hoursStd, 0, 7.5, 0.25);
  addMaxOption(hoursStd, 7.6);

  // 1.5x hours: 0 to 1.75 in 0.25 increments, plus 2.0
  populatePicker(hours15, 0, 1.75, 0.25);
  addMaxOption(hours15, 2.0);

  // 2x hours: 0 to 10 in 0.25 increments
  populatePicker(hours2, 0, 10, 0.25);
}

function populatePicker(select, min, max, step) {
  select.innerHTML = "";

  // Add blank/zero option
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "--";
  select.appendChild(blank);

  // Add incremental options
  for (let val = min; val <= max; val += step) {
    // Round to avoid floating point errors
    const rounded = Math.round(val * 100) / 100;
    const opt = document.createElement("option");
    opt.value = rounded;
    opt.textContent = rounded.toFixed(2);
    select.appendChild(opt);
  }
}

function addMaxOption(select, maxValue) {
  const opt = document.createElement("option");
  opt.value = maxValue;
  opt.textContent = maxValue.toFixed(2);
  select.appendChild(opt);
}

// ---------- PIN AUTHENTICATION ----------
function showPinModal(employeeId, employeeName) {
  const modal = document.getElementById("pinModal");
  const employeeNameDisplay = document.getElementById("pinEmployeeName");
  const pinInput = document.getElementById("pinInput");
  const pinError = document.getElementById("pinError");

  // Store pending selection
  pendingEmployeeSelection = { employeeId, employeeName };

  // Update modal with employee name
  employeeNameDisplay.textContent = `Authenticating: ${employeeName}`;

  // Clear previous input and errors
  pinInput.value = "";
  pinError.style.display = "none";
  pinError.textContent = "";

  // Show modal
  modal.classList.add("show");
  document.body.classList.add("modal-open");

  // Focus the PIN input
  setTimeout(() => pinInput.focus(), 100);
}

function hidePinModal() {
  const modal = document.getElementById("pinModal");
  const pinInput = document.getElementById("pinInput");
  const pinError = document.getElementById("pinError");

  modal.classList.remove("show");
  document.body.classList.remove("modal-open");
  pinInput.value = "";
  pinError.style.display = "none";
  pinError.textContent = "";
  pendingEmployeeSelection = null;
}

async function verifyPin() {
  const pinInput = document.getElementById("pinInput");
  const pinError = document.getElementById("pinError");
  const submitBtn = document.getElementById("pinSubmitBtn");

  const pin = pinInput.value.trim();

  // Validate PIN format
  if (!pin || pin.length !== 4) {
    pinError.textContent = "Please enter a 4-digit PIN";
    pinError.style.display = "block";
    return;
  }

  if (!/^\d{4}$/.test(pin)) {
    pinError.textContent = "PIN must contain only numbers";
    pinError.style.display = "block";
    return;
  }

  if (!pendingEmployeeSelection) {
    pinError.textContent = "No employee selected";
    pinError.style.display = "block";
    return;
  }

  // Disable submit button during verification
  submitBtn.disabled = true;
  submitBtn.textContent = "Verifying...";

  try {
    const response = await fetch(`${API_BASE}/auth/verify-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: pendingEmployeeSelection.employeeId,
        pin: pin
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      // PIN verified successfully
      authenticatedEmployee = {
        employeeId: pendingEmployeeSelection.employeeId,
        employeeName: pendingEmployeeSelection.employeeName
      };

      console.log(`✅ Employee authenticated: ${authenticatedEmployee.employeeName}`);

      // Update UI to show authenticated state
      updateAuthenticatedUI();

      // Hide modal
      hidePinModal();
    } else {
      // PIN verification failed
      pinError.textContent = data.message || "Invalid PIN";
      pinError.style.display = "block";
      pinInput.value = "";
      pinInput.focus();
    }
  } catch (err) {
    console.error("❌ Error verifying PIN:", err);
    pinError.textContent = "Error verifying PIN. Please try again.";
    pinError.style.display = "block";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Verify PIN";
  }
}

function updateAuthenticatedUI() {
  const employeeSelect = document.getElementById("employeeSelect");

  if (authenticatedEmployee) {
    // Set the employee select to the authenticated employee
    employeeSelect.value = authenticatedEmployee.employeeId;

    // Add visual indicator that employee is authenticated
    employeeSelect.style.borderColor = "#10b981"; // Green border
    employeeSelect.style.borderWidth = "2px";
  } else {
    // Reset to default state
    employeeSelect.style.borderColor = "";
    employeeSelect.style.borderWidth = "";
  }
}

function handleEmployeeSelectionChange() {
  const employeeSelect = document.getElementById("employeeSelect");
  const selectedEmployeeId = employeeSelect.value;

  // If no employee selected (placeholder), clear authentication
  if (!selectedEmployeeId || selectedEmployeeId.trim() === "") {
    authenticatedEmployee = null;
    updateAuthenticatedUI();
    return;
  }

  const selectedEmployeeName = employeeSelect.options[employeeSelect.selectedIndex]?.textContent || "Unknown";

  // If same employee is already authenticated, no need to re-authenticate
  if (authenticatedEmployee && authenticatedEmployee.employeeId === selectedEmployeeId) {
    console.log("✅ Employee already authenticated");
    return;
  }

  // Different employee selected, require PIN authentication
  console.log(`🔐 Requesting PIN for employee: ${selectedEmployeeName}`);
  showPinModal(selectedEmployeeId, selectedEmployeeName);
}

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
        ticketId: t.cw_ticket_id,  // Use ConnectWise ticket ID (7-digit), not auto-increment ticket_id
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

  // Check if employee is authenticated
  if (!authenticatedEmployee || authenticatedEmployee.employeeId !== employeeSelect.value) {
    alert("Please authenticate with your PIN before adding time entries");
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
    employeeId: String(entry.employeeId),          // Backend expects string
    employeeName: entry.employeeName,
    ticketId: String(entry.ticketId),              // Backend expects string (ConnectWise ID)
    ticketName: entry.ticketName,
    date: entry.date,
    hoursStandard: entry.hoursStandard,
    hours15x: entry.hours15x,
    hours2x: entry.hours2x,
    notes: entry.notes || ""
  }));

  console.log("📤 Submitting timesheets:");
  console.log("   Endpoint:", `${API_BASE}/timesheets/submit`);
  console.log("   Payload:", JSON.stringify(payload, null, 2));

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
    console.log("📥 Response received:");
    console.log("   Status:", res.status);
    console.log("   Data:", JSON.stringify(data, null, 2));

    // Check if submission was successful
    // Backend returns {ok: true/false} with details in data.data
    if (data.ok === true || data.success === true) {
      alert("Timesheet entries submitted successfully!");
      queuedEntries = [];
      renderQueue();
    } else {
      // Backend returned errors - show detailed error message
      console.error("❌ Backend returned failure response:", data);

      // Try multiple possible error message locations in the response
      let errorMessage = "Unknown error from server";

      if (data.data?.errors && Array.isArray(data.data.errors) && data.data.errors.length > 0) {
        errorMessage = `Failed to submit:\n\n${data.data.errors.join('\n')}`;
      } else if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        errorMessage = `Failed to submit:\n\n${data.errors.join('\n')}`;
      } else if (data.message) {
        errorMessage = data.message;
      } else if (data.error) {
        errorMessage = data.error;
      } else if (data.data?.message) {
        errorMessage = data.data.message;
      } else {
        // Show the full response to help debug
        errorMessage = `Server returned an error. Response: ${JSON.stringify(data)}`;
      }

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
  populateHoursPickers();
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

  // Employee selection change handler
  const employeeSelect = document.getElementById("employeeSelect");
  if (employeeSelect) {
    employeeSelect.addEventListener("change", handleEmployeeSelectionChange);
  }

  // PIN modal event handlers
  const pinSubmitBtn = document.getElementById("pinSubmitBtn");
  if (pinSubmitBtn) {
    pinSubmitBtn.addEventListener("click", verifyPin);
  }

  const pinCancelBtn = document.getElementById("pinCancelBtn");
  if (pinCancelBtn) {
    pinCancelBtn.addEventListener("click", () => {
      // Reset employee selection to placeholder
      const employeeSelect = document.getElementById("employeeSelect");
      employeeSelect.value = "";
      authenticatedEmployee = null;
      updateAuthenticatedUI();
      hidePinModal();
    });
  }

  const pinInput = document.getElementById("pinInput");
  if (pinInput) {
    // Submit PIN on Enter key
    pinInput.addEventListener("keypress", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        verifyPin();
      }
    });

    // Allow only numeric input
    pinInput.addEventListener("input", (ev) => {
      ev.target.value = ev.target.value.replace(/[^0-9]/g, "");
    });
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

  // Preset button handlers
  document.addEventListener("click", (ev) => {
    const target = ev.target;

    // Handle preset buttons (Max buttons under each picker)
    if (target.classList.contains("preset-btn-single")) {
      ev.preventDefault();

      // Check if it's the Clear button
      if (target.getAttribute("data-clear") === "true") {
        // Clear all time fields
        document.getElementById("hoursStd").value = "";
        document.getElementById("hours15").value = "";
        document.getElementById("hours2").value = "";

        // Trigger change events
        ["hoursStd", "hours15", "hours2"].forEach(id => {
          const input = document.getElementById(id);
          if (input) input.dispatchEvent(new Event("change", { bubbles: true }));
        });
      } else {
        // Handle Max buttons
        const targetFieldId = target.getAttribute("data-target");
        const hours = parseFloat(target.getAttribute("data-hours"));

        const targetField = document.getElementById(targetFieldId);
        if (targetField) {
          targetField.value = hours;
          targetField.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }
  });
});
