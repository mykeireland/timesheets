// Apply sorting
if (currentSort.col) {
  data.sort((a, b) => {
    let valA, valB;

    switch (currentSort.col) {
      case "employee":
        valA = (a.firstName + " " + a.lastName).toLowerCase();
        valB = (b.firstName + " " + b.lastName).toLowerCase();
        break;
      case "site":
        valA = a.siteName.toLowerCase();
        valB = b.siteName.toLowerCase();
        break;
      case "ticket":
        valA = a.ticketId.toString();
        valB = b.ticketId.toString();
        break;
      case "date":
        valA = new Date(a.date);
        valB = new Date(b.date);
        break;
      case "hours":
        valA = parseFloat(a.hours);
        valB = parseFloat(b.hours);
        break;
      case "status":
        valA = a.status.toLowerCase();
        valB = b.status.toLowerCase();
        break;
    }

    // Numeric/date vs string comparison
    if (valA < valB) return currentSort.asc ? -1 : 1;
    if (valA > valB) return currentSort.asc ? 1 : -1;
    return 0;
  });
}
