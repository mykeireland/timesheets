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
let authenticatedEmployee = null; // { employeeId, employeeName, pin }
let pendingEmployeeSelection = null; // Temporary storage during PIN verification

// SECURITY: Rate limiting for PIN verification attempts
const pinAttempts = new Map(); // Map of employeeId -> {count, lockoutUntil}
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// ---------- SECURITY: HTML ESCAPING ----------
/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {any} unsafe - The unsafe string to escape
 * @returns {string} - The escaped string safe for HTML insertion
 */
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) {
    return "";
  }
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

  // SECURITY: Check rate limiting
  const employeeId = pendingEmployeeSelection.employeeId;
  const attemptData = pinAttempts.get(employeeId);

  if (attemptData) {
    // Check if still in lockout period
    if (attemptData.lockoutUntil && Date.now() < attemptData.lockoutUntil) {
      const remainingMinutes = Math.ceil((attemptData.lockoutUntil - Date.now()) / 60000);
      pinError.textContent = `Too many failed attempts. Please try again in ${remainingMinutes} minute(s).`;
      pinError.style.display = "block";
      return;
    }

    // Check if max attempts reached
    if (attemptData.count >= MAX_PIN_ATTEMPTS && !attemptData.lockoutUntil) {
      // Set lockout
      attemptData.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      pinAttempts.set(employeeId, attemptData);
      pinError.textContent = `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MS / 60000} minutes.`;
      pinError.style.display = "block";
      return;
    }
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
      // PIN verified successfully - clear rate limiting
      pinAttempts.delete(employeeId);

      // Store PIN for timesheet submission
      authenticatedEmployee = {
        employeeId: pendingEmployeeSelection.employeeId,
        employeeName: pendingEmployeeSelection.employeeName,
        pin: pin  // Store PIN for secure timesheet submission
      };

      // Check if PIN is default "0000" - force change on first login
      if (pin === "0000") {
        hidePinModal();
        showChangePinModal(authenticatedEmployee.employeeId, authenticatedEmployee.employeeName);
        return; // Don't proceed with authentication until PIN is changed
      }

      // Update UI to show authenticated state
      updateAuthenticatedUI();

      // Hide modal
      hidePinModal();
    } else {
      // PIN verification failed - increment attempt counter
      const currentAttempts = pinAttempts.get(employeeId) || { count: 0, lockoutUntil: null };
      currentAttempts.count += 1;

      // Clear lockout if it has expired
      if (currentAttempts.lockoutUntil && Date.now() >= currentAttempts.lockoutUntil) {
        currentAttempts.count = 1; // Reset to 1 for this new attempt
        currentAttempts.lockoutUntil = null;
      }

      pinAttempts.set(employeeId, currentAttempts);

      const remainingAttempts = MAX_PIN_ATTEMPTS - currentAttempts.count;
      if (remainingAttempts > 0) {
        pinError.textContent = `Invalid PIN. ${remainingAttempts} attempt(s) remaining.`;
      } else {
        pinError.textContent = data.message || "Invalid PIN";
      }
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
    return;
  }

  // Different employee selected, require PIN authentication
  showPinModal(selectedEmployeeId, selectedEmployeeName);
}

// ---------- CHANGE PIN (First Login) ----------
function showChangePinModal(employeeId, employeeName) {
  const modal = document.getElementById("changePinModal");
  const employeeNameDisplay = document.getElementById("changePinEmployeeName");
  const newPinInput = document.getElementById("newPinInput");
  const confirmPinInput = document.getElementById("confirmPinInput");
  const changePinError = document.getElementById("changePinError");
  const changePinSuccess = document.getElementById("changePinSuccess");

  employeeNameDisplay.textContent = `${employeeName} - You must change your PIN from the default`;

  // Clear inputs and messages
  document.getElementById("currentPinInput").value = "0000";
  document.getElementById("currentPinInput").disabled = true; // We know it's 0000
  newPinInput.value = "";
  confirmPinInput.value = "";
  changePinError.style.display = "none";
  changePinSuccess.style.display = "none";

  // Show modal
  modal.classList.add("show");
  document.body.classList.add("modal-open");

  // Focus new PIN input
  setTimeout(() => newPinInput.focus(), 100);
}

function hideChangePinModal() {
  const modal = document.getElementById("changePinModal");
  modal.classList.remove("show");
  document.body.classList.remove("modal-open");

  // Clear all inputs
  document.getElementById("currentPinInput").value = "";
  document.getElementById("currentPinInput").disabled = false;
  document.getElementById("newPinInput").value = "";
  document.getElementById("confirmPinInput").value = "";
  document.getElementById("changePinError").style.display = "none";
  document.getElementById("changePinSuccess").style.display = "none";
}

async function submitPinChange() {
  const newPinInput = document.getElementById("newPinInput");
  const confirmPinInput = document.getElementById("confirmPinInput");
  const changePinError = document.getElementById("changePinError");
  const changePinSuccess = document.getElementById("changePinSuccess");
  const submitBtn = document.getElementById("changePinSubmitBtn");

  const newPin = newPinInput.value.trim();
  const confirmPin = confirmPinInput.value.trim();

  // Clear previous messages
  changePinError.style.display = "none";
  changePinSuccess.style.display = "none";

  // Validate new PIN
  if (!newPin || newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
    changePinError.textContent = "New PIN must be exactly 4 digits";
    changePinError.style.display = "block";
    return;
  }

  // Check if new PIN is same as default
  if (newPin === "0000") {
    changePinError.textContent = "New PIN cannot be 0000 (default). Please choose a unique PIN.";
    changePinError.style.display = "block";
    return;
  }

  // Validate confirmation
  if (newPin !== confirmPin) {
    changePinError.textContent = "New PIN and confirmation do not match";
    changePinError.style.display = "block";
    return;
  }

  if (!authenticatedEmployee) {
    changePinError.textContent = "No employee authenticated";
    changePinError.style.display = "block";
    return;
  }

  // Disable button during submission
  submitBtn.disabled = true;
  submitBtn.textContent = "Changing PIN...";

  try {
    const response = await fetch(`${API_BASE}/auth/change-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: authenticatedEmployee.employeeId,
        currentPin: "0000",
        newPin: newPin
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      changePinSuccess.textContent = "PIN changed successfully! You can now enter time.";
      changePinSuccess.style.display = "block";

      // IMPORTANT: Update the stored PIN to the new value
      authenticatedEmployee.pin = newPin;

      // Wait a moment then close modal and complete authentication
      setTimeout(() => {
        hideChangePinModal();
        updateAuthenticatedUI();
      }, 1500);
    } else {
      changePinError.textContent = data.message || "Failed to change PIN";
      changePinError.style.display = "block";
    }
  } catch (err) {
    console.error("❌ Error changing PIN:", err);
    changePinError.textContent = "Error changing PIN. Please try again.";
    changePinError.style.display = "block";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Change PIN";
  }
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
  const notesInput = document.getElementById("entryNotes");

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

  // SECURITY: Validate notes length (max 500 characters to prevent DoS)
  const MAX_NOTES_LENGTH = 500;
  const notes = notesInput.value.trim();
  if (notes.length > MAX_NOTES_LENGTH) {
    alert(`Notes must be ${MAX_NOTES_LENGTH} characters or less. Current length: ${notes.length}`);
    notesInput.focus();
    return;
  }

  // Get and validate hours
  const hoursStandard = Number(document.getElementById("hoursStd").value || 0);
  const hours15x = Number(document.getElementById("hours15").value || 0);
  const hours2x = Number(document.getElementById("hours2").value || 0);

  // SECURITY: Validate hours are within reasonable bounds
  if (hoursStandard < 0 || hoursStandard > 24) {
    alert("Standard hours must be between 0 and 24");
    document.getElementById("hoursStd").focus();
    return;
  }
  if (hours15x < 0 || hours15x > 24) {
    alert("1.5x hours must be between 0 and 24");
    document.getElementById("hours15").focus();
    return;
  }
  if (hours2x < 0 || hours2x > 24) {
    alert("2x hours must be between 0 and 24");
    document.getElementById("hours2").focus();
    return;
  }

  // Validate total hours per day isn't absurd (max 24 hours total)
  const totalHours = hoursStandard + hours15x + hours2x;
  if (totalHours > 24) {
    alert(`Total hours (${totalHours.toFixed(2)}) cannot exceed 24 hours per day`);
    document.getElementById("hoursStd").focus();
    return;
  }

  const entry = {
    employeeId: employeeSelect.value,
    employeeName: employeeSelect.options[employeeSelect.selectedIndex]?.textContent || "Unknown",
    ticketId: ticketSelect.value,
    ticketName: ticketSelect.options[ticketSelect.selectedIndex]?.textContent || "Unknown",
    date: dateInput.value,
    hoursStandard: hoursStandard,
    hours15x: hours15x,
    hours2x: hours2x,
    notes: notes
  };

  // Validate at least one hour type has a value
  if (entry.hoursStandard === 0 && entry.hours15x === 0 && entry.hours2x === 0) {
    alert("Please enter hours for at least one hour type (Standard, 1.5x, or 2x)");
    document.getElementById("hoursStd").focus();
    return;
  }

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

  // Render rows (with XSS protection via escapeHtml)
  displayEntries.forEach((e) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Date">${escapeHtml(e.date)}</td>
      <td data-label="Employee">${escapeHtml(e.employeeName)}</td>
      <td data-label="Ticket">${escapeHtml(e.ticketName)}</td>
      <td data-label="Std Hours">${escapeHtml(e.hoursStandard.toFixed(2))}</td>
      <td data-label="1.5x Hours">${escapeHtml(e.hours15x.toFixed(2))}</td>
      <td data-label="2x Hours">${escapeHtml(e.hours2x.toFixed(2))}</td>
      <td data-label="Notes">${escapeHtml(e.notes || "—")}</td>
      <td data-label="Action"><button class="btn light remove-btn" data-index="${escapeHtml(e.originalIndex)}">Remove</button></td>
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

  // SECURITY: Verify user is authenticated before submission
  if (!authenticatedEmployee || !authenticatedEmployee.pin) {
    alert("You must be authenticated to submit timesheets. Please select an employee and enter your PIN.");
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
  const entries = queuedEntries.map(entry => ({
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

  // NEW FORMAT: Backend requires PIN authentication
  const payload = {
    employeeId: authenticatedEmployee.employeeId,
    pin: authenticatedEmployee.pin,
    entries: entries
  };

  window.showLoading();
  try {
    const payloadString = JSON.stringify(payload);

    const res = await fetch(`${API_BASE}/timesheets/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payloadString
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Error submitting timesheets - Status:", res.status);
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    const data = await res.json();

    // Check if submission was successful
    // Backend returns {ok: true/false} with details in data.data
    if (data.ok === true || data.success === true) {
      alert("Timesheet entries submitted successfully!");
      queuedEntries = [];
      renderQueue();
    } else {
      // Backend returned errors - show detailed error message
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

  // Change PIN modal event handlers
  const changePinSubmitBtn = document.getElementById("changePinSubmitBtn");
  if (changePinSubmitBtn) {
    changePinSubmitBtn.addEventListener("click", submitPinChange);
  }

  const changePinCancelBtn = document.getElementById("changePinCancelBtn");
  if (changePinCancelBtn) {
    changePinCancelBtn.addEventListener("click", () => {
      // Cancel PIN change - logout
      const employeeSelect = document.getElementById("employeeSelect");
      employeeSelect.value = "";
      authenticatedEmployee = null;
      updateAuthenticatedUI();
      hideChangePinModal();
      alert("You must change your PIN from the default to continue. Please contact your manager if you need help.");
    });
  }

  // Change PIN inputs - numeric only and Enter key support
  const newPinInput = document.getElementById("newPinInput");
  const confirmPinInput = document.getElementById("confirmPinInput");

  if (newPinInput) {
    newPinInput.addEventListener("input", (ev) => {
      ev.target.value = ev.target.value.replace(/[^0-9]/g, "");
    });
    newPinInput.addEventListener("keypress", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        confirmPinInput.focus();
      }
    });
  }

  if (confirmPinInput) {
    confirmPinInput.addEventListener("input", (ev) => {
      ev.target.value = ev.target.value.replace(/[^0-9]/g, "");
    });
    confirmPinInput.addEventListener("keypress", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        submitPinChange();
      }
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
