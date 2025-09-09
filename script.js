document.addEventListener("DOMContentLoaded", () => {
  const empSelect = document.getElementById("employeeName");
  EMPLOYEES.forEach(name => {
    let opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    empSelect.appendChild(opt);
  });

  const mgrSelect = document.getElementById("managerName");
  MANAGERS.forEach(name => {
    let opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    mgrSelect.appendChild(opt);
  });

  document.getElementById("timesheetForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    console.log("Submitted Timesheet:", data);
    alert("Timesheet submitted! (check console)");
    e.target.reset();
  });
});
