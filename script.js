document.addEventListener("DOMContentLoaded", async () => {
  await loadDropdowns();
  addRow();

  document.getElementById("addRow").addEventListener("click", addRow);
  document.getElementById("printForm").addEventListener("click", () => window.print());
  document.getElementById("managerView").addEventListener("click", () => {
    window.location.href = "manager.html";
  });

  document.getElementById("timesheetForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const data = collectFormData();
      const res = await fetch("/api/timesheets/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Submission failed");
      alert("Timesheet submitted successfully!");
      e.target.reset();
      document.querySelector("#timesheetTable tbody").innerHTML = "";
      addRow();
    } catch (err) {
      console.error(err);
      alert(err.message || "Error submitting timesheet");
    }
  });
});

async function loadDropdowns() {
  try {
    const [employeesRes, managersRes, sitesRes] = await Promise.all([
      fetch("/api/employees"),
      fetch("/api/managers"),
      fetch("/api/sites"),
    ]);

    const [employees, managers, sites] = await Promise.all([
      employeesRes.json(),
      managersRes.json(),
      sitesRes.json(),
    ]);

    populateDropdown("employee", employees, "employeeId", "fullName");
    populateDropdown("manager", managers, "managerId", "fullName");
    window.sites = sites; // store for later row adds
  } catch (err) {
    console.error(err);
    alert("Data invalid, or could not load data.");
  }
}

function populateDropdown(id, data, valueKey, textKey) {
  const select = document.getElementById(id);
  select.innerHTML = `<option value="">Select</option>`;
  data.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item[valueKey];
    opt.textContent = item[textKey];
    select.appendChild(opt);
  });
}

function addRow() {
  const tbody = document.querySelector("#timesheetTable tbody");
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td><input type="date" required></td>
    <td>
      <select required>
        <option value="">Select</option>
        ${window.sites ? window.sites.map(s => `<option value="${s.siteId}">${s.name}</option>`).join("") : ""}
      </select>
    </td>
    <td><input type="number" min="0" value="0" required></td>
    <td><input type="number" min="0" value="0" required></td>
    <td><input type="number" min="0" value="0" required></td>
    <td><input type="text" placeholder="Notes (optional)"></td>
    <td><button type="button" onclick="this.closest('tr').remove()">Remove</button></td>
  `;

  tbody.appendChild(tr);
}

function collectFormData() {
  const employeeId = document.getElementById("employee").value;
  const managerId = document.getElementById("manager").value;
  const rows = [...document.querySelectorAll("#timesheetTable tbody tr")];

  return {
    employeeId,
    managerId,
    entries: rows.map(tr => {
      const [date, ticket, standard, ot15, ot2, notes] = tr.querySelectorAll("input, select");
      return {
        date: date.value,
        ticketId: ticket.value,
        hoursStandard: parseFloat(standard.value),
        hours15x: parseFloat(ot15.value),
        hours2x: parseFloat(ot2.value),
        notes: notes.value,
      };
    }),
  };
}
