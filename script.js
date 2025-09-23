// === Globals ===
// === Config & State ===
const API_BASE = window.API_BASE || "http://localhost:7071/api";
const state = {
  queue: [],
  employeeId: null
};
console.log("🔥 script.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  loadEmployees();
  loadTickets();
  setupFormHandlers();
});

// === Loaders ===
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
  const data = await res.json();
  const select = document.getElementById("entryTicket");
  data.forEach(ticket => {
    const opt = document.createElement("option");
    opt.value = ticket.ticketId;
    opt.textContent = `${ticket.ticketId} - ${ticket.siteName}`;
    select.appendChild(opt);
  });
}

// === Helpers ===
function convertTo24Hour(hour, minute, ampm) {
  if (!hour || !minute || !ampm) return null;
  let h = parseInt(hour, 10);
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${minute}`;
}

function clearForm() {
  document.getElementById("entryDate").value = "";
  document.getElementById("entryHour").value = "";
  document.getElementById("entryMinute").value = "";
  document.getElementById("entryAmPm").value = "";
  document.getElementById("entryTicket").value = "";
  document.getElementById("hoursStd").value = "0";
  document.getElementById("hours15").value = "0";
  document.getElementById("hours2").value = "0";
  document.getElementById("entryNotes").value = "";
}

// === Form Handlers ===
function setupFormHandlers() {
  document.getElementById("timesheetForm").addEventListener("submit", handleSubmit);
  document.getElementById("managerBtn").addEventListener("click", () => {
    window.location.href = "manager.html";
  });
}

function addToQueue() {
  const employeeId = parseInt(document.getElementById("employeeSelect").value);
  const date = document.getElementById("entryDate").value;
  const ticketId = parseInt(document.getElementById("entryTicket").value);
  const hour = document.getElementById("entryHour").value;
  const minute = document.getElementById("entryMinute").value;
  const ampm = document.getElementById("entryAmPm").value;
  const start = convertTo24Hour(hour, minute, ampm);
  const hoursStandard = parseFloat(document.getElementById("hoursStd").value) || 0;
  const hours15x = parseFloat(document.getElementById("hours15").value) || 0;
  const hours2x = parseFloat(document.getElementById("hours2").value) || 0;
  const notes = document.getElementById("entryNotes").value;

  if (!employeeId || !date || !ticketId || !start) {
    alert("Missing required fields.");
    return;
  }

  // Store once per session
  state.employeeId = employeeId;

  const entry = {
    employeeId,
    ticketId,
    date,
    start,
    hoursStandard,
    hours15x,
    hours2x,
    notes
  };

  state.queue.push(entry);
  renderQueue();
  clearForm();
}

function renderQueue() {
  const tbody = document.getElementById("queueTable");
  tbody.innerHTML = "";

  if (state.queue.length === 0) {
    document.getElementById("queuedEntries").style.display = "none";
    return;
  }

  document.getElementById("queuedEntries").style.display = "block";

  state.queue.forEach((entry, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${entry.date}</td>
      <td>${entry.ticketId}</td>
      <td>${entry.start}</td>
      <td>${entry.hoursStandard}</td>
      <td>${entry.hours15x}</td>
      <td>${entry.hours2x}</td>
      <td>${entry.notes || ""}</td>
      <td><button class="btn danger" onclick="removeFromQueue(${i})">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function removeFromQueue(index) {
  state.queue.splice(index, 1);
  renderQueue();
}

// === Submission ===
async function handleSubmit(e) {
  e.preventDefault();
  if (state.queue.length === 0) {
    alert("Please add at least one entry before submitting.");
    return;
  }

  console.log("🚀 Submitting entries:", JSON.stringify(state.queue, null, 2));

  let failures = 0;

  for (const entry of state.queue) {
    try {
      const res = await fetch(`${API_BASE}/timesheets/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry)
      });

      const result = await res.json();
      if (!res.ok || !result.ok) {
        console.error("❌ Submission failed:", result.error || res.statusText);
        failures++;
      }
    } catch (err) {
      console.error("❌ Network error:", err.message);
      failures++;
    }
  }

  if (failures > 0) {
    alert(`⚠️ ${failures} entry(ies) failed to submit.`);
  } else {
    alert("✅ Timesheet submitted successfully!");
    state.queue = [];
    renderQueue();
    document.getElementById("timesheetForm").reset();
  }
}
