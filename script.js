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
  // initial width for compact placeholder
  adjustTicketSelectWidth();
});

// === Generic helpers ===
function unwrapArray(payload, ...arrayKeysInOrderOfPreference) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of arrayKeysInOrderOfPreference) {
      if (Array.isArray(payload[k])) return payload[k];
    }
  }
  return [];
}

function flattenValue(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object") {
    for (const key of ["value", "id", "number", "$numberLong"]) {
      if (v[key] != null && typeof v[key] !== "object") return String(v[key]);
    }
    // last resort: readable JSON, but avoid "{}"
    try {
      const s = JSON.stringify(v);
      return s === "{}" ? "" : s;
    } catch { return ""; }
  }
  return "";
}

// --- measure text using the select's font ---
function measureTextWidth(text, refEl) {
  const span = document.createElement("span");
  span.style.visibility = "hidden";
  span.style.position = "absolute";
  span.style.whiteSpace = "nowrap";

  const cs = window.getComputedStyle(refEl);
  const font = [
    cs.fontStyle, cs.fontVariant, cs.fontWeight,
    cs.fontSize, "/", cs.lineHeight, cs.fontFamily
  ].join(" ");
  span.style.font = font;

  span.textContent = text || "";
  document.body.appendChild(span);
  const w = span.offsetWidth;
  document.body.removeChild(span);
  return w;
}

function adjustTicketSelectWidth() {
  const select = document.getElementById("entryTicket");
  if (!select) return;

  const cs = window.getComputedStyle(select);
  const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const border = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  const arrow = 24;   // native arrow width (tweak to 28 if you want extra room)
  const buffer = 10;

  const currentText = select.options[select.selectedIndex]?.text || "Select Ticket";
  const minText = "Select Ticket";

  const currentW = measureTextWidth(currentText, select) + pad + border + arrow + buffer;
  const minW = measureTextWidth(minText, select) + pad + border + arrow + buffer;

  select.style.width = Math.max(currentW, minW) + "px";
}

// === Loaders ===
async function loadEmployees() {
  try {
    console.log("👤 Loading employees...");
    const res = await fetch(`${API_BASE}/employees`);
    if (!res.ok) throw new Error(`GET /employees -> ${res.status}`);
    const data = await res.json();

    const employees = unwrapArray(data, "employees", "data");
    const select = document.getElementById("employeeSelect");
    select.innerHTML = ""; // reset

    employees.forEach(emp => {
      const id = emp.id ?? emp.employeeId ?? emp.EmployeeId ?? null;
      const name = emp.name ?? emp.fullName ?? emp.DisplayName ?? "Unnamed";
      if (id == null) return;
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = name;
      select.appendChild(opt);
    });

    console.log(`✅ Loaded ${employees.length} employees.`);
  } catch (err) {
    console.error("❌ Failed to load employees:", err.message);
    alert("Could not load employees. Please refresh or try again later.");
  }
}

async function loadTickets() {
  try {
    console.log("🎫 Loading tickets...");
    const res = await fetch(`${API_BASE}/tickets/open`);
    if (!res.ok) throw new Error(`GET /tickets/open -> ${res.status}`);
    const data = await res.json();

    const tickets = unwrapArray(data, "tickets", "data");
    const select = document.getElementById("entryTicket");
    select.innerHTML = "<option value=''>Select Ticket</option>";

    tickets.forEach(ticket => {
      // DB key for value (used by submit)
      const ticketId   = ticket.ticketId ?? ticket.id ?? ticket.TicketId ?? ticket.ID ?? null;
      // Display wants: CW Ticket ID • Summary • Company
      const cwTicketId = flattenValue(ticket.cwTicketId ?? ticket.CwTicketId ?? ticket.ID ?? ticket.cw_id);
      const summary    = flattenValue(ticket.summary ?? ticket.Summary);
      const company    = flattenValue(ticket.companyName ?? ticket.CompanyName);

      if (ticketId == null) return;

      const parts = [cwTicketId, summary, company].filter(Boolean);
      const label = parts.join(" • ");

      const opt = document.createElement("option");
      opt.value = String(ticketId);
      opt.textContent = label;
      select.appendChild(opt);
    });

    console.log(`✅ Loaded ${tickets.length} tickets.`);
    // set compact width initially
    select.selectedIndex = 0;
    adjustTicketSelectWidth();
  } catch (err) {
    console.error("❌ Failed to load tickets:", err.message);
    alert("Could not load tickets. Please refresh or try again later.");
  }
}

// === Helpers ===
function convertTo24Hour(hour, minute, ampm) {
  hour = hour || "00";
  minute = minute || "00";
  ampm = ampm || "AM";

  let h = parseInt(hour, 10);
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;

  const final = `${h.toString().padStart(2, '0')}:${minute || "00"}`;
  console.log("⏱️ Resolved start time:", final);
  return final;
}

function clearForm() {
  document.getElementById("entryDate").value = "";
  document.getElementById("entryHour").value = "";
  document.getElementById("entryMinute").value = "";
  document.getElementById("entryAmPm").value = "";
  const ticketSel = document.getElementById("entryTicket");
  ticketSel.value = "";
  document.getElementById("hoursStd").value = "0";
  document.getElementById("hours15").value = "0";
  document.getElementById("hours2").value = "0";
  document.getElementById("entryNotes").value = "";

  // restore compact width after clearing
  adjustTicketSelectWidth();
}

// === Form Handlers ===
function setupFormHandlers() {
  document.getElementById("timesheetForm").addEventListener("submit", handleSubmit);
  document.getElementById("managerBtn").addEventListener("click", () => {
    window.location.href = "manager.html";
  });

  // resize select width on change + window resize
  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "entryTicket") adjustTicketSelectWidth();
  });
  window.addEventListener("resize", () => adjustTicketSelectWidth());
}

function addToQueue() {
  const employeeId = parseInt(document.getElementById("employeeSelect").value);
  const date = document.getElementById("entryDate").value;
  const ticketId = parseInt(document.getElementById("entryTicket").value);
  const hour = document.getElementById("entryHour")?.value;
  const minute = document.getElementById("entryMinute")?.value;
  const ampm = document.getElementById("entryAmPm")?.value;
  const start = convertTo24Hour(hour, minute, ampm);
  const hoursStandard = parseFloat(document.getElementById("hoursStd").value) || 0;
  const hours15x = parseFloat(document.getElementById("hours15").value) || 0;
  const hours2x = parseFloat(document.getElementById("hours2").value) || 0;
  const notes = document.getElementById("entryNotes").value;

  if (!employeeId || !date || !ticketId) {
    alert("Missing required fields.");
    return;
  }

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
      console.log("📤 Payload being submitted:", JSON.stringify(entry, null, 2));

      const res = await fetch(`${API_BASE}/timesheets/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry)
      });

      const result = await res.json();
      console.log("📥 API response:", result);

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
    adjustTicketSelectWidth(); // keep compact after submit
  }
}
