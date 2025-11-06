// ===================== script.js =====================

// Use the global API_BASE defined in index.html
const API_BASE = window.API_BASE;

// Simple queue of timesheet entries before submission
let queuedEntries = [];

// ---------- LOAD EMPLOYEES ----------
async function loadEmployees() {
  try {
    const res = await fetch(`${API_BASE}/employees`);
    const employees = await res.json();

    const select = document.getElementById("employeeSelect");
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
  }
}

// === Replace ONLY the contents of your loadTickets() ===
async function loadTickets() {
  try {
    const res = await fetch(`${window.API_BASE}/tickets/open`);
    const tickets = await res.json();

    const select = document.getElementById("entryTicket");
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
      // Preserve your original visual format and scaling behaviour
      opt.value = mapped.ticketId;
      opt.textContent = `${mapped.ticketName}`; // exactly as original did
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("❌ Failed to load tickets:", err);
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
      <td><button class="btn light" onclick="removeFromQueue(${i})">🗑 Remove</button></td>
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

  try {
    const res = await fetch(`${API_BASE}/timesheets/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(queuedEntries)
    });

    const data = await res.json();
    if (data.ok) {
      alert("✅ Timesheet entries submitted successfully!");
      queuedEntries = [];
      renderQueue();
    } else {
      console.error("❌ Submission failed:", data);
      alert("Submission failed. Check console for details.");
    }
  } catch (err) {
    console.error("❌ Error submitting timesheets:", err);
    alert("Error submitting timesheets.");
  }
}

// ---------- INITIALIZE ----------
window.addEventListener("DOMContentLoaded", () => {
  loadEmployees();
  loadTickets();

  document.getElementById("timesheetForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    submitTimesheets();
  });

  document.getElementById("managerBtn").addEventListener("click", () => {
    window.location.href = "manager.html";
  });
});
