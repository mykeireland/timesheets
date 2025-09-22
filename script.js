// script.js
// Timesheet entry + queue flow with clean separation of validations.
// - "Add": validates entry row (employee, date, ticket, start, hours>0), pushes to queue
// - "Submit": validates ONLY queue length (>0), posts each entry to API

(function () {
  "use strict";

  // ---------- Utilities ----------
  const byId = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
  const asNumber = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0);

  const API_BASE = (window.API_BASE || "http://localhost:7071/api").replace(/\/+$/g, "");

  const els = {
    form: /** @type {HTMLFormElement} */ (byId("timesheetForm")),
    employeeSelect: /** @type {HTMLSelectElement} */ (byId("employeeSelect")),
    entryDate: /** @type {HTMLInputElement} */ (byId("entryDate")),
    entryTicket: /** @type {HTMLSelectElement} */ (byId("entryTicket")),
    entryStart: /** @type {HTMLInputElement} */ (byId("entryStart")),
    hoursStd: /** @type {HTMLInputElement} */ (byId("hoursStd")),
    hours15: /** @type {HTMLInputElement} */ (byId("hours15")),
    hours2: /** @type {HTMLInputElement} */ (byId("hours2")),
    entryNotes: /** @type {HTMLInputElement} */ (byId("entryNotes")),
    queuedWrap: byId("queuedEntries"),
    queueTable: /** @type {HTMLTableSectionElement} */ (byId("queueTable")),
    managerBtn: /** @type {HTMLButtonElement} */ (byId("managerBtn")),
  };

  // Will be resolved after DOMContentLoaded for disabling text on submit button
  let submitBtn /** @type {HTMLButtonElement | null} */ = null;

  const state = {
    employees: /** @type {{id:number, name:string}[]} */ ([]),
    tickets: /** @type {{ticketId:number, cwTicketId?:string, ticketName?:string, siteName?:string}[]} */ ([]),
    queue: /** @type {QueueEntry[]} */ ([]),
    lastEmployeeIdSelected: null,
  };

  /**
   * @typedef {Object} QueueEntry
   * @property {number} employeeId
   * @property {string} employeeName
   * @property {string} date // yyyy-mm-dd
   * @property {number} ticketId
   * @property {string} ticketLabel
   * @property {string} start // HH:mm
   * @property {number} hoursStd
   * @property {number} hours15
   * @property {number} hours2
   * @property {string} notes
   */

  // ---------- Fetch helpers ----------
  async function fetchJSON(url, options = {}) {
    const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* keep data as null */ }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  // ---------- Data loading ----------
  async function loadEmployees() {
    try {
      const data = await fetchJSON(`${API_BASE}/employees`);
      // expected: [{ id, name }]
      state.employees = Array.isArray(data) ? data : [];
      populateEmployeeSelect();
    } catch (err) {
      console.error("Employees load failed:", err);
      fillSelectWithError(els.employeeSelect, "Failed to load employees");
    }
  }

  async function loadTickets() {
    try {
      const data = await fetchJSON(`${API_BASE}/tickets/open`);
      // expected: [{ ticketId, cwTicketId, ticketName, siteName }]
      state.tickets = Array.isArray(data) ? data : [];
      populateTicketSelect();
    } catch (err) {
      console.error("Tickets load failed:", err);
      fillSelectWithError(els.entryTicket, "Failed to load tickets");
    }
  }

  function populateEmployeeSelect() {
    const sel = els.employeeSelect;
    sel.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Select employee…";
    opt0.disabled = true;
    opt0.selected = true;
    sel.appendChild(opt0);

    for (const e of state.employees) {
      const opt = document.createElement("option");
      opt.value = String(e.id);
      opt.textContent = e.name;
      sel.appendChild(opt);
    }
  }

  function populateTicketSelect() {
    const sel = els.entryTicket;
    sel.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Select ticket…";
    opt0.disabled = true;
    opt0.selected = true;
    sel.appendChild(opt0);

    for (const t of state.tickets) {
      const opt = document.createElement("option");
      opt.value = String(t.ticketId);
      // Prefer CW ID if present, then name + site
      const left = t.cwTicketId ? `#${t.cwTicketId}` : `Ticket ${t.ticketId}`;
      const right = [t.ticketName, t.siteName].filter(Boolean).join(" — ");
      opt.textContent = right ? `${left} · ${right}` : left;
      sel.appendChild(opt);
    }
  }

  function fillSelectWithError(sel, message) {
    sel.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = message;
    opt.disabled = true;
    opt.selected = true;
    sel.appendChild(opt);
  }

  // ---------- Validation (entry row ONLY for Add) ----------
  function validateEntryRow() {
    // order matters for "remind the next required field"
    const employeeId = els.employeeSelect.value.trim();
    if (!employeeId) {
      alert("Please select an employee.");
      els.employeeSelect.focus();
      return null;
    }

    const date = els.entryDate.value.trim();
    if (!date) {
      alert("Please select a date.");
      els.entryDate.focus();
      return null;
    }

    const ticketId = els.entryTicket.value.trim();
    if (!ticketId) {
      alert("Please select a ticket.");
      els.entryTicket.focus();
      return null;
    }

   const start = getSelectedTime();
    if (!start) {
      alert("Please select a start time (hours, minutes, AM/PM).");
      return null;
  }

  // ---------- Hour and Minute Pickers ----------
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
    
    const hoursStd = asNumber(els.hoursStd.value);
    const hours15 = asNumber(els.hours15.value);
    const hours2 = asNumber(els.hours2.value);
    const total = hoursStd + hours15 + hours2;

    if (total <= 0) {
      alert("Please enter at least one hour (Std / 1.5x / 2x).");
      (hoursStd ? els.hours15 : els.hoursStd).focus();
      return null;
    }

    // build the entry (notes optional)
    /** @type {QueueEntry} */
    const entry = {
      employeeId: parseInt(employeeId, 10),
      employeeName: getEmployeeNameById(parseInt(employeeId, 10)),
      date,
      ticketId: parseInt(ticketId, 10),
      ticketLabel: getTicketLabelById(parseInt(ticketId, 10)),
      start,
      hoursStd,
      hours15,
      hours2,
      notes: (els.entryNotes.value || "").trim(),
    };

    return entry;
  }

  function getEmployeeNameById(id) {
    const found = state.employees.find((e) => e.id === id);
    return found ? found.name : `Employee ${id}`;
  }

  function getTicketLabelById(id) {
    const found = state.tickets.find((t) => t.ticketId === id);
    if (!found) return `Ticket ${id}`;
    const left = found.cwTicketId ? `#${found.cwTicketId}` : `Ticket ${id}`;
    const right = [found.ticketName, found.siteName].filter(Boolean).join(" — ");
    return right ? `${left} · ${right}` : left;
  }

  // ---------- Queue operations ----------
  function addToQueue() {
    const entry = validateEntryRow();
    if (!entry) return;

    // If queue has entries for a different employee, block or offer to clear
    if (state.queue.length > 0 && state.queue[0].employeeId !== entry.employeeId) {
      const proceed = confirm(
        "Your queue contains entries for a different employee.\n" +
          "Submitting mixed employees is not supported.\n\n" +
          "Clear queue and add this entry?"
      );
      if (!proceed) return;
      state.queue = [];
    }

    state.queue.push(entry);
    renderQueue();

    // Reset only the entry inputs (not employee)
    els.entryDate.value = "";
    els.entryTicket.selectedIndex = 0;
    els.entryStart.value = "";
    els.hoursStd.value = "0";
    els.hours15.value = "0";
    els.hours2.value = "0";
    els.entryNotes.value = "";
    els.entryDate.focus();
  }
  
  document.getElementById("entryHour").selectedIndex = 0;
  document.getElementById("entryMinute").selectedIndex = 0;
  document.getElementById("entryAmPm").selectedIndex = 0;

  function renderQueue() {
    const q = state.queue;
    els.queueTable.innerHTML = "";

    if (q.length === 0) {
      els.queuedWrap.style.display = "none";
      return;
    }

    els.queuedWrap.style.display = "block";

    const rows = q
      .map((e, idx) => {
        return `
          <tr data-idx="${idx}">
            <td>${e.date}</td>
            <td title="${escapeHtml(e.ticketLabel)}">${escapeHtml(shorten(e.ticketLabel, 64))}</td>
            <td>${e.start}</td>
            <td>${e.hoursStd}</td>
            <td>${e.hours15}</td>
            <td>${e.hours2}</td>
            <td>${escapeHtml(e.notes || "")}</td>
            <td><button type="button" class="btn danger" data-remove="${idx}">Remove</button></td>
          </tr>
        `;
      })
      .join("");

    els.queueTable.insertAdjacentHTML("beforeend", rows);
  }

  function removeFromQueueByIndex(idx) {
    if (idx < 0 || idx >= state.queue.length) return;
    state.queue.splice(idx, 1);
    renderQueue();
  }

  // ---------- Submit flow (ONLY validates queue length) ----------
  async function handleSubmit(e) {
    e.preventDefault();

    if (state.queue.length === 0) {
      alert("Please add at least one entry before submitting.");
      return;
    }

    // (Optional) hard-guard: ensure all entries share the same employee
    const empId = state.queue[0].employeeId;
    if (!state.queue.every((x) => x.employeeId === empId)) {
      alert("All queued entries must belong to the same employee.");
      return;
    }

    setSubmitting(true);

    try {
      // Submit each entry sequentially (preserves order and easy error handling)
      for (const entry of state.queue) {
        await submitSingleEntry(entry);
      }

      alert("Timesheet submitted successfully!");
      state.queue = [];
      renderQueue();
    } catch (err) {
      console.error("Submit failed:", err);
      alert("Failed to submit timesheet: " + (err && err.message ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSingleEntry(entry) {
    const payload = {
      EmployeeId: entry.employeeId,
      TicketId: entry.ticketId,
      Date: entry.date,
      HoursStandard: entry.hoursStd,
      Hours15x: entry.hours15,
      Hours2x: entry.hours2,
      Notes: entry.notes || null,
    };

    const res = await fetchJSON(`${API_BASE}/timesheets/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // The Azure Function typically returns { ok: true, entry_id, ... }
    if (res && res.ok === false) {
      throw new Error(res.error || "Server rejected the entry.");
    }
    return res;
  }

  function setSubmitting(isSubmitting) {
    if (!submitBtn) submitBtn = els.form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = isSubmitting;
      submitBtn.textContent = isSubmitting ? "Submitting…" : "Submit";
    }
    // You can also disable Add while submitting if you want:
    const addBtn = document.querySelector('button.btn.light[onclick="addToQueue()"]');
    if (addBtn instanceof HTMLButtonElement) addBtn.disabled = isSubmitting;
  }

  // ---------- Small helpers ----------
  function escapeHtml(s) {
    return (s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function shorten(s, max) {
    return s && s.length > max ? s.slice(0, max - 1) + "…" : s;
  }

  // ---------- Global functions for inline handlers ----------
  // index.html calls: onclick="addToQueue()"
  window.addToQueue = addToQueue;

  // We render Remove buttons with data-remove and delegate clicks:
  document.addEventListener("click", (ev) => {
    const btn = ev.target;
    if (btn && btn instanceof HTMLElement && btn.hasAttribute("data-remove")) {
      const idx = parseInt(btn.getAttribute("data-remove") || "-1", 10);
      removeFromQueueByIndex(idx);
    }
  });

  // ---------- Init ----------
  function attachEmployeeChangeGuard() {
    // Ask before switching employee when queue has items
    state.lastEmployeeIdSelected = els.employeeSelect.value || null;
    els.employeeSelect.addEventListener("change", () => {
      if (state.queue.length > 0 && state.lastEmployeeIdSelected && els.employeeSelect.value !== state.lastEmployeeIdSelected) {
        const proceed = confirm(
          "Changing the employee will clear the current queue.\nDo you want to continue?"
        );
        if (!proceed) {
          // revert
          els.employeeSelect.value = state.lastEmployeeIdSelected;
          return;
        }
        state.queue = [];
        renderQueue();
      }
      state.lastEmployeeIdSelected = els.employeeSelect.value || null;
    });
  }

  function wireManagerButton() {
    if (els.managerBtn) {
      els.managerBtn.addEventListener("click", () => {
        window.location.href = "manager.html";
      });
    }
  }

  async function init() {
    wireManagerButton();
    attachEmployeeChangeGuard();
    els.form.addEventListener("submit", handleSubmit);

    await Promise.all([loadEmployees(), loadTickets()]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
