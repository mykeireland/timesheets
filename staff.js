document.addEventListener("DOMContentLoaded", () => {
  const addBtn = document.getElementById("addBtn");
  const table = document.getElementById("staffTable");

  // Ensure both button and table exist
  if (!addBtn || !table) {
    console.warn("⚠️ Add button or staff table not found in DOM.");
    return;
  }

  addBtn.addEventListener("click", () => {
    const tbody = table.querySelector("tbody");
    if (!tbody) {
      console.error("⚠️ staffTable has no <tbody>");
      return;
    }

    // Prevent adding multiple new rows at once
    if (tbody.querySelector(".new-row")) return;

    const tr = document.createElement("tr");
    tr.classList.add("new-row");

    tr.innerHTML = `
      <td>New</td>
      <td><input type="text" placeholder="First Name" required></td>
      <td><input type="text" placeholder="Last Name" required></td>
      <td><input type="email" placeholder="Email" required></td>
      <td>
        <select>
          <option value="Casual">Casual</option>
          <option value="FTE">FTE</option>
          <option value="Contractor">Contractor</option>
        </select>
      </td>
      <td><input type="number" placeholder="Manager ID" min="1"></td>
      <td><input type="number" placeholder="CW Member ID" min="0"></td>
      <td><input type="checkbox" checked></td>
      <td>—</td>
      <td>
        <button class="btn primary save-new">💾 Save</button>
        <button class="btn danger cancel-new">✖ Cancel</button>
      </td>
    `;

    tbody.prepend(tr);

    // Cancel button
    tr.querySelector(".cancel-new").addEventListener("click", () => tr.remove());

    // Save button
    tr.querySelector(".save-new").addEventListener("click", async () => {
      const inputs = tr.querySelectorAll("input, select");
      const [firstName, lastName, email, typeSel, mgrInput, cwInput, activeChk] = inputs;

      const newEmp = {
        first_name: firstName.value.trim(),
        last_name: lastName.value.trim(),
        email: email.value.trim(),
        type: typeSel.value,
        manager_employee_id: mgrInput.value ? parseInt(mgrInput.value, 10) : null,
        cw_member_id: cwInput.value ? parseInt(cwInput.value, 10) : null,
        active: activeChk.checked
      };

      if (!newEmp.first_name || !newEmp.last_name || !newEmp.email) {
        alert("⚠️ First name, last name, and email are required.");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/employees/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newEmp)
        });
        const result = await res.json();

        if (!res.ok || !result.ok) {
          console.error("❌ Add failed:", result);
          alert("Error adding employee: " + (result.error || res.statusText));
          return;
        }

        alert("✅ Employee added successfully!");
        tr.remove();
        loadEmployees(); // Refresh list after adding
      } catch (err) {
        console.error("Network error:", err);
        alert("❌ Network error while adding employee.");
      }
    });
  });
});


  // Cancel button
  tr.querySelector("#cancelNewBtn").addEventListener("click", () => tr.remove());

  // Save button
  tr.querySelector("#saveNewBtn").addEventListener("click", async () => {
    const cells = tr.querySelectorAll("td");
    const newEmp = {
      first_name: cells[1].querySelector("input").value.trim(),
      last_name: cells[2].querySelector("input").value.trim(),
      email: cells[3].querySelector("input").value.trim(),
      type: cells[4].querySelector("select").value,
      manager_employee_id: parseInt(cells[5].querySelector("input").value || 0, 10) || null,
      cw_member_id: parseInt(cells[6].querySelector("input").value || 0, 10) || null,
      active: cells[7].querySelector("input").checked
    };

    // Basic validation
    if (!newEmp.first_name || !newEmp.last_name || !newEmp.email) {
      alert("⚠️ First name, last name, and email are required.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/employees/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEmp)
      });

      const result = await res.json();
      if (!res.ok || !result.ok) {
        console.error("Add failed:", result);
        alert("❌ Error adding employee: " + (result.error || res.statusText));
        return;
      }

      alert("✅ Employee added successfully!");
      tr.remove();
      loadEmployees(); // reload list
    } catch (err) {
      console.error("Network error:", err);
      alert("❌ Network error adding employee.");
    }
  });
});
