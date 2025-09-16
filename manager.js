async function approveTimesheet(ticketId, date, firstName, lastName) {
  try {
    const res = await fetch("/api/timesheets/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, date, firstName, lastName })
    });
    if (!res.ok) throw new Error("Failed to approve timesheet");
    alert(await res.text());
    await loadPendingTimesheets(); // refresh table
  } catch (err) {
    showError(err);
  }
}

async function rejectTimesheet(ticketId, date, firstName, lastName) {
  try {
    const res = await fetch("/api/timesheets/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, date, firstName, lastName })
    });
    if (!res.ok) throw new Error("Failed to reject timesheet");
    alert(await res.text());
    await loadPendingTimesheets(); // refresh table
  } catch (err) {
    showError(err);
  }
}
