// === Globals ===
const API_BASE = window.API_BASE || "http://localhost:7071/api";
let ticketList = [];
let queue = [];

document.addEventListener("DOMContentLoaded", () => {
  loadEmployees();
  loadTickets();
  setupFormHandlers();
});

// === Load Dropdowns ===
async function loadEmployees() {
  const res = await fetch(`${API_BASE}/employees`);
  const data = await res.json();
  const select = document.getElementById("employeeSelect");
  data.forEach(emp => {
    const opt = document.createElement("option");
    opt.value = emp.id;
    opt.textContent = emp.name;
    select.appendChild(opt);
  });
}

async function loadTickets() {
  const res = await fetch(`${API_BASE}/tickets/open`);
  ticketList = await res.json();
  const select = document.getElementById("entryTicket");
  ticketList.forEach(ticket => {
    const opt = document.createElement("option");
    opt.value = ticket.ticketId;
    opt.textContent = `${ticket.ticketId} (${ticket.siteName})`;
    select.appendChild(opt);
  });
}

// === Time Conversion ===
function convertTo24Hr(hour, minute, ampm) {
  if (!hour || !minute || !ampm) return null;
  let hr = parseInt(hour, 10);
  if (ampm === "PM" && hr < 12) hr += 12;
  if (ampm === "AM" && hr === 12) hr = 0;
  return `${hr.toString().padStart(2, "0")}:${minute}`;
}

// === Add Entry to Queue ===
function addToQueue() {
  const date = document.getElementById("entryDate").value;
  const ticketId = document.getElementById("entryTicket").value;
  const hour = document.getElementById("entryHour").value;
  const minute = document.getElementById("entryMinute").value;
  const ampm = document.getElementById("entryAmPm").value;
  const hoursStd = parseFloat(document.getElementById("hoursStd").value) || 0;
  const hours15 = parseFloat(document.getElementById("hours15").value) || 0;
  const hours2x = parseFloat(document.getElementById("hours2").value) || 0;
  const notes = document.getElementById("entryNotes").value;
  const start = convertTo24Hr(hour, minute, ampm);

  if (!date || !ticketId || !start) {
    alert("Please complete all required fields (date, ticket, and start time).");
    return;
  }

  const ticketLabel = ticketList.find(t => t.ticketId == ticketId)?.ticketName || ticketId;

  const entry = {
    date,
    ticketId: parseInt(ticketId),
    start,
    hoursStandard: hoursStd,
    hours15x: hours15,
    hours2x: hours2x,
    notes,
    ticketLabel
  };

  queue.push(entry);
  renderQueue();
}

// === Render Queue Table ===
function renderQueue() {
  const queueTable = document.getElementById("queueTable");
  queueTable.innerHTML = "";

  if (queue.length === 0) {
    document.getElementById("queuedEntries").style.display = "none";
    return;
  }

  document.getElementById("queuedEntries").style.display = "block";

  queue.forEach((entry, i) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${entry.date}</td>
      <td>${entry.ticketLabel}</td>
      <td>${entry.start}</td>
      <td>${entry.hoursStandard}</td>
      <td>${entry.hours15x}</td>
      <td>${entry.hours2x}</td>
      <td>${entry.notes || ""}</td>
      <td><button class="btn danger" onclick="removeFromQueue(${i})">X</button></td>
    `;

    queueTable.appendChild(row);
  });
}

function removeFromQueue(index) {
  queue.splice(index, 1);
  renderQueue();
}

// === Setup Event Listeners ===
function setupFormHandlers() {
  document.getElementById("timesheetForm").addEventListener("submit", async e => {
    e.preventDefault();

    const employeeId = parseInt(document.getElementById("employeeSelect").value);
    if (!employeeId || queue.length === 0) {
      alert("Please select an employee and add at least one entry.");
      return;
    }

    const errors = [];
    for (const [i, entry] of queue.entries()) {
      const body = {
        employeeId,
        ticketId: entry.ticketId,
        date: entry.date,
        start: entry.start,
        hoursStandard: entry.hoursStandard,
        hours15x: entry.hours15x,
        hours2x: entry.hours2x,
        notes: entry.notes
      };

      console.log("Submitting queue payload:", JSON.stringify(state.queue, null, 2));

      try {
        const res = await fetch(`${API_BASE}/timesheets/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        const result = await res.json();
        if (!result.ok) {
          console.error("Submit failed:", result.error);
          errors.push(`Entry ${i + 1}: ${result.error}`);
        }
      } catch (err) {
        console.error("Submit failed:", err);
        errors.push(`Entry ${i + 1}: ${err.message}`);
      }
    }

    if (errors.length > 0) {
      alert("Some entries failed:\n" + errors.join("\n"));
    } else {
      alert("Timesheet submitted successfully!");
      queue = [];
      renderQueue();
      document.getElementById("timesheetForm").reset();
    }
  });

  document.getElementById("managerBtn").addEventListener("click", () => {
    window.location.href = "manager.html";
  });
}
