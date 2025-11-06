// ===================== script.js =====================

// Use the global API_BASE defined in config.js
const API_BASE = window.API_BASE;

// Simple queue of timesheet entries before submission
let queuedEntries = [];

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

    if (!Array.isArray(employees) || employees.length === 0) {
      const opt = document.createElement("option");
      opt.textContent = "(no employees found)";
      select.appendChild(opt);
      return;
    }

    for (const e of employees) {
      const opt = document.createElement("option");
      opt.value = e.employee_id;
      opt.textContent = `${e.first_name} ${e.last_name} (${e.email})`;
      select.appendChild(opt);
    }
  } catch (err) {
    console.error("❌ Failed to load employees:", err);
    select.innerHTML = '<option>(Error loading employees)</option>';
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

    if (!Array.isArray(tickets) || tickets.length === 0) {
      const opt = document.createElement("option");
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
    select.innerHTML = '<option>(Error loading tickets)</option>';
    alert("Failed to load tickets. Please refresh the page or contact support.");
  }
}

// ---------- ADD ENTRY TO QUEUE ----------
function addToQueue() {
  const employeeSelect = document.getElementById("employeeSelect");
  const ticketSelect = document.getElementById("entryTicket");

  const entry = {
    employeeId: employeeSelect.value,
    employeeName: employeeSelect.options[employeeSelect.selectedIndex]?.textContent || "Unknown",
    ticketId: ticketSelect.value,
    ticketName: ticketSelect.options[ticketSelect.selectedIndex]?.textContent || "Unknown",
    date: document.getElementById("entryDate").value,
    hoursStandard: Number(document.getElementById("hoursStd").value || 0),
    hours15x: Number(document.getElementById("hours15").value || 0),
    hours2x: Number(document.getElementById("hours2").value || 0),
    notes: document.getElementById("entryNotes").value.trim()
  };

  if (!entry.date || !entry.employeeId || !entry.ticketId) {
    alert("Please select an employee, ticket, and date.");
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

  queuedEntries.forEach((e, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${e.date}</td>
      <td>${e.employeeName}</td>
      <td>${e.ticketName}</td>
      <td>${e.hoursStandard.toFixed(2)}</td>
      <td>${e.hours15x.toFixed(2)}</td>
      <td>${e.hours2x.toFixed(2)}</td>
      <td>${e.notes || "—"}</td>
      <td><button class="btn light remove-btn" data-index="${i}">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });

  queueDiv.style.display = "block";
}

// ---------- SUBMIT QUEUED ENTRIES ----------
async function submitTimesheets() {
  if (queuedEntries.length === 0) {
    alert("No entries to submit.");
    return;
  }

  window.showLoading();
  try {
    const res = await fetch(`${API_BASE}/timesheets/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queuedEntries)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    if (data.ok) {
      alert("Timesheet entries submitted successfully!");
      queuedEntries = [];
      renderQueue();
    } else {
      throw new Error(data.error || "Unknown error from server");
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
});
