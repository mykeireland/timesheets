// === Config & State ===
const API_BASE = window.API_BASE || "http://localhost:7071/api";
const state = { queue: [], employeeId: null };
console.log("🔥 script.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  loadEmployees();
  loadTickets();
  setupFormHandlers();
  adjustTicketSelectWidth(); // compact “Select Ticket” width on load
});

// === Helpers ===
function unwrapArray(payload, ...arrayKeys) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of arrayKeys) if (Array.isArray(payload[k])) return payload[k];
  }
  return [];
}

function flattenValue(v) {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object") {
    for (const key of ["value", "id", "number", "$numberLong"])
      if (v[key] != null && typeof v[key] !== "object") return String(v[key]);
    try { const s = JSON.stringify(v); return s === "{}" ? "" : s; } catch { return ""; }
  }
  return "";
}

function measureTextWidth(text, refEl) {
  const span = document.createElement("span");
  span.style.visibility = "hidden";
  span.style.position = "absolute";
  span.style.whiteSpace = "nowrap";
  const cs = window.getComputedStyle(refEl);
  const font = [cs.fontStyle, cs.fontVariant, cs.fontWeight, cs.fontSize, "/", cs.lineHeight, cs.fontFamily].join(" ");
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
  const arrow = 24, buffer = 10; // tweak arrow to 28 if needed on Safari
  const currentText = select.options[select.selectedIndex]?.text || "Select Ticket";
  const minText = "Select Ticket";
  const currentW = measureTextWidth(currentText, select) + pad + border + arrow + buffer;
  const minW = measureTextWidth(minText, select) + pad + border + arrow + buffer;
  select.style.width = Math.max(currentW, minW) + "px";
}

// === Loaders ===
async function loadEmployees() {
  try {
    const res = await fetch(`${API_BASE}/employees`);
    if (!res.ok) throw new Error(`GET /employees -> ${res.status}`);
    const data = await res.json();
    const employees = unwrapArray(data, "employees", "data");
    const select = document.getElementById("employeeSelect");
    if (!select) { console.warn("#employeeSelect not found"); return; }
    select.innerHTML = "";
    employees.forEach(emp => {
      const id = emp.id ?? emp.employeeId ?? emp.EmployeeId ?? null;
      const name = emp.name ?? emp.fullName ?? emp.DisplayName ?? "Unnamed";
      if (id == null) return;
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("❌ Load employees failed:", err);
    alert("Could not load employees.");
  }
}

async function loadTickets() {
  try {
    const res = await fetch(`${API_BASE}/tickets/open`);
    if (!res.ok) throw new Error(`GET /tickets/open -> ${res.status}`);
    const data = await res.json();
    const tickets = unwrapArray(data, "tickets", "data");
    const select = document.getElementById("entryTicket");
    if (!select) { console.warn("#entryTicket not found"); return; }
    select.innerHTML = "<option value=''>Select Ticket</option>";
    tickets.forEach(ticket => {
      const ticketId   = ticket.ticketId ?? ticket.id ?? ticket.TicketId ?? ticket.ID ?? null;
      const summary    = flattenValue(ticket.summary ?? ticket.Summary);
      const company    = flattenValue(ticket.companyName ?? ticket.CompanyName);
      if (ticketId == null) return;
      const parts = [summary, company].filter(Boolean);
      const label = parts.join(" • ") || `Ticket ${ticketId}`;
      const opt = document.createElement("option");
      opt.value = String(ticketId);
      opt.textContent = label;
      select.appendChild(opt);
    });
    // compact by default
    select.selectedIndex = 0;
    adjustTicketSelectWidth();
  } catch (err) {
    console.error("❌ Load tickets failed:", err);
    alert("Could not load tickets.");
  }
}

// === Form Handlers ===
function setupFormHandlers() {
  document.getElementById("timesheetForm").addEventListener("submit", handleSubmit);
  document.getElementById("managerBtn").addEventListener("click", () => {
    window.location.href = "manager.html";
  });
  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "entryTicket") adjustTicketSelectWidth();
  });
  window.addEventListener("resize", adjustTicketSelectWidth);
}

function addToQueue() {
  const employeeSelect = document.getElementById("employeeSelect");
  const employeeId = parseInt(employeeSelect.value);
  const employeeName = employeeSelect.options[employeeSelect.selectedIndex]?.text || "";

  const date = document.getElementById("entryDate").value;
  const ticketSelect = document.getElementById("entryTicket");
  const ticketId = parseInt(ticketSelect.value);
  const ticketLabel = ticketSelect.options[ticketSelect.selectedIndex]?.text || "";

  const hoursStandard = parseFloat(document.getElementById("hoursStd").value) || 0;
  const hours15x = parseFloat(document.getElementById("hours15").value) || 0;
  const hours2x = parseFloat(document.getElementById("hours2").value) || 0;
  const notes = document.getElementById("entryNotes").value;

  if (!employeeId || !date || !ticketId) {
    alert("Missing required fields.");
    return;
  }

  const entry = {
    employeeId,
    employeeName,
    ticketId,
    ticketLabel,
    date,
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
      <td>${entry.employeeName || ""}</td>
      <td>${entry.ticketLabel || entry.ticketId}</td>
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

function clearForm() {
  document.getElementById("entryDate").value = "";
  document.getElementById("entryTicket").value = "";
  document.getElementById("hoursStd").value = "0";
  document.getElementById("hours15").value = "0";
  document.getElementById("hours2").value = "0";
  document.getElementById("entryNotes").value = "";
  adjustTicketSelectWidth();
}

// === Submission ===
async function handleSubmit(e) {
  e.preventDefault();
  if (state.queue.length === 0) return alert("Please add at least one entry before submitting.");

  let failures = 0;
  for (const entry of state.queue) {
    try {
      const res = await fetch(`${API_BASE}/timesheets/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry)
      });
      const result = await res.json().catch(() => ({ ok: false, error: "Invalid JSON" }));
      if (!res.ok || !result.ok) failures++;
    } catch { failures++; }
  }

  if (failures > 0) alert(`⚠️ ${failures} entry(ies) failed to submit.`);
  else {
    alert("✅ Timesheet submitted successfully!");
    state.queue = [];
    renderQueue();
    document.getElementById("timesheetForm").reset();
    adjustTicketSelectWidth();
  }
}
