// data.js — all API calls live her
(() => {
  // EXACT Function App URL from Azure Portal → Overview
  const API_BASE = 'https://func-timesheets-api-dev-e5aqerg4d0dadwf7.australiaeast-01.azurewebsites.net/api';
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
