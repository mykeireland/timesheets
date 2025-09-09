// data.js - all API calls live here
(() => {
  const API_BASE = 'https://func-timesheets-api-dev-e5aqerg4d0dadwf7.australiaeast-01.azurewebsites.net/api';

  async function get(path) {
    const url = `${API_BASE}/${path}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GET ${url} -> ${res.status} ${text}`);
    }
    return res.json();
  }

  window.Data = {
    async employees() {
      const list = await get('employees');
      return list.map(e => ({
        id: Number(e.id ?? e.employeeId ?? e.employee_id),
        name: e.name ?? `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim()
      }));
    },

    async tickets(employeeId) {
      if (!employeeId) throw new Error('employeeId required');
      const list = await get(`tickets?employeeId=${encodeURIComponent(employeeId)}`);
      return list.map(t => ({
        id: t.ticketId ?? t.id ?? t.ticket_id,
        name: t.name ?? t.cwTicketId ?? 'Ticket'
      }));
    },

    async submitEntry(payload) {
      const url = `${API_BASE}/timesheet-entry`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`POST ${url} -> ${res.status} ${text}`);
      }
      return res.json();
    }
  };
})();
