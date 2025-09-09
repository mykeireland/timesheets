(() => {
  // EXACT Function Ap URL from Azure Portal → Overview
  const API_BASE = '/api';   // use SWA proxy;
  console.info('API_BASE (data.js) =', API_BASE);

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
      return await get(`tickets?employeeId=${encodeURIComponent(employeeId)}`);
    },

    async submitEntry(payload) {
      const url = `${API_BASE}/timesheet-entry`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`POST ${url} failed`);
      return res.json();
    }
  };
})();
