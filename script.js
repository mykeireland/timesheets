(function () {
  "use strict";

  const API_BASE = (window.API_BASE || "http://localhost:7071/api").replace(/\/+$/g, "");

  const els = {
    form: document.getElementById("timesheetForm"),
    employeeSelect: document.getElementById("employeeSelect"),
    entryDate: document.getElementById("entryDate"),
    entryTicket: document.getElementById("entryTicket"),
    hoursStd: document.getElementById("hoursStd"),
    hours15: document.getElementById("hours15"),
    hours2: document.getElementById("hours2"),
    entryNotes: document.getElementById("entryNotes"),
    queuedWrap: document.getElementById("queuedEntries"),
    queueTable: document.getElementById("queueTable"),
    managerBtn: document.getElementById("managerBtn"),
  };

  const state = { employees: [], tickets: [], queue: [] };

  // ----- Helpers -----
  const asNumber = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);

  function getSelectedTime() {
    const hour = document.getElementById("entryHour").value;
    const minute = document.getElementById("entryMinute").value;
    const ampm = document.getElementById("entryAmPm").value;

    if (!hour || !minute || !ampm) return null;

    let h = parseInt(hour, 10);
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;

    return `${String(h).padStart(2, "0")}:${minute}`;
  }

  // ----- Queue & Validation -----
  function validateEntryRow() {
    const employeeId = els.employeeSelect.value;
    if (!employeeId) { alert("Select employee"); return null; }

    const date = els.entryDate.value;
    if (!date) { alert("Select date"); return null; }

    const ticketId = els.entryTicket.value;
    if (!ticketId) { alert("Select ticket"); return null; }

    const start = getSelectedTime();
    if (!start) { alert("Select start time"); return null; }

    const hoursStd = asNumber(els.hoursStd.value);
    const hours15 = asNumber(els.hours15.value);
    const hours2 = asNumber(els.hours2.value);
    if (hoursStd + hours15 + hours2 <= 0) { alert("Enter some hours"); return null; }

    return {
      employeeId: parseInt(employeeId, 10),
      date,
      ticketId: parseInt(ticketId, 10),
      start,
      hoursStd, hours15, hours2,
      notes: els.entryNotes.value.trim(),
    };
  }

  window.addToQueue = function () {
    const entry = validateEntryRow();
    if (!entry) return;

    state.queue.push(entry);
    renderQueue();

    // reset form fields (but keep employee)
    els.entryDate.value = "";
    els.entryTicket.selectedIndex = 0;
    document.getElementById("entryHour").selectedIndex = 0;
    document.getElementById("entryMinute").selectedIndex = 0;
    document.getElementById("entryAmPm").selectedIndex = 0;
    els.hoursStd.value = "0";
    els.hours15.value = "0";
    els.hours2.value = "0";
    els.entryNotes.value = "";
  };

  function renderQueue() {
    els.queueTable.innerHTML = "";
    if (state.queue.length === 0) { els.queuedWrap.style.display = "none"; return; }
    els.queuedWrap.style.display = "block";

    els.queueTable.innerHTML = state.queue.map((e, idx) => `
      <tr>
        <td>${e.date}</td>
        <td>${e.ticketId}</td>
        <td>${e.start}</td>
        <td>${e.hoursStd}</td>
        <td>${e.hours15}</td>
        <td>${e.hours2}</td>
        <td>${e.notes}</td>
        <td><button type="button" data-remove="${idx}" class="btn danger">Remove</button></td>
      </tr>
    `).join("");
  }

  document.addEventListener("click", (ev) => {
    if (ev.target.dataset.remove) {
      const idx = parseInt(ev.target.dataset.remove, 10);
      state.queue.splice(idx, 1);
      renderQueue();
    }
  });

  // ----- Submit -----
  async function submitSingleEntry(entry) {
    const payload = {
      EmployeeId: entry.employeeId,
      TicketId: entry.ticketId,
      Date: entry.date,
      Start: entry.start,     // ✅ ensures backend gets it
      HoursStandard: entry.hoursStd,
      Hours15x: entry.hours15,
      Hours2x: entry.hours2,
      Notes: entry.notes || null,
    };

    console.log("Submitting payload:", payload);

    const res = await fetch(`${API_BASE}/timesheets/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || json.ok === false) throw new Error(json.error || "Submit failed");
    return json;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (state.queue.length === 0) { alert("Add entries first"); return; }

    try {
      for (const entry of state.queue) await submitSingleEntry(entry);
      alert("Timesheet submitted successfully!");
      state.queue = [];
      renderQueue();
    } catch (err) {
      console.error("Submit failed:", err);
      alert("Submit failed: " + err.message);
    }
  }

  els.form.addEventListener("submit", handleSubmit);

  // ----- Init -----
  if (els.managerBtn) {
    els.managerBtn.addEventListener("click", () => { window.location.href = "manager.html"; });
  }
})();
