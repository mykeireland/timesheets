/**
 * Authentication Configuration Template
 *
 * This is a template file. To use it:
 * 1. Copy this file to `auth-config.js`
 * 2. Replace 'REPLACE_WITH_YOUR_API_KEY' with your actual API key from Azure
 * 3. DO NOT commit auth-config.js to git (it's in .gitignore)
 *
 * To generate an API key:
 *   Mac/Linux: openssl rand -base64 32
 *   Online: https://www.random.org/strings/
 *
 * To configure the API key in Azure:
 *   1. Go to Azure Portal → Function Apps → [Your Function App]
 *   2. Click Configuration (under Settings)
 *   3. Add new application setting:
 *      Name: ManagementApiKey
 *      Value: [your generated API key]
 *   4. Save and restart the Function App
 *
 * SECURITY WARNING:
 * - DO NOT commit the actual API key to git
 * - Share the API key only with authorized staff via secure channels
 * - Rotate the key periodically (every 90 days recommended)
 */

// Replace this with your actual API key from Azure Function App Configuration
const MANAGEMENT_API_KEY = 'REPLACE_WITH_YOUR_API_KEY';

/**
 * AuthFetch Helper
 *
 * A wrapper around fetch() that automatically includes the API key
 * in the X-API-Key header for management endpoints.
 *
 * Usage:
 *   const data = await AuthFetch.get('/api/timesheets/summary');
 *   await AuthFetch.post('/api/timesheets/approve/123', { reason: 'Approved' });
 *   await AuthFetch.put('/api/employees/5', { active: true });
 *   await AuthFetch.delete('/api/employees/5');
 */
window.AuthFetch = {
  /**
   * Internal fetch wrapper that adds authentication headers
   */
  _fetch: async function(url, options = {}) {
    // Ensure we have a valid API key
    if (!MANAGEMENT_API_KEY || MANAGEMENT_API_KEY === 'REPLACE_WITH_YOUR_API_KEY') {
      throw new Error('API key not configured. Please update auth-config.js with your API key.');
    }

    // Build full URL if relative path provided
    const fullUrl = url.startsWith('http') ? url : `${window.API_BASE}${url}`;

    // Add authentication headers
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': MANAGEMENT_API_KEY,
      ...options.headers
    };

    // Add CSRF token for state-changing requests if available
    const method = (options.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && window.getCsrfToken) {
      headers['X-CSRF-Token'] = window.getCsrfToken();
    }

    // Make the request
    const response = await fetch(fullUrl, {
      ...options,
      headers
    });

    // Handle authentication errors
    if (response.status === 401) {
      throw new Error('Authentication failed. Please check your API key configuration.');
    }

    if (response.status === 403) {
      throw new Error('Access forbidden. You do not have permission to access this resource.');
    }

    // Handle other errors
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`);
    }

    // Parse JSON response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    // Return text for non-JSON responses
    return await response.text();
  },

  /**
   * GET request
   * @param {string} url - API endpoint URL
   * @param {object} options - Additional fetch options
   * @returns {Promise} Response data
   */
  get: async function(url, options = {}) {
    return await this._fetch(url, {
      ...options,
      method: 'GET'
    });
  },

  /**
   * POST request
   * @param {string} url - API endpoint URL
   * @param {object} data - Request body data
   * @param {object} options - Additional fetch options
   * @returns {Promise} Response data
   */
  post: async function(url, data = null, options = {}) {
    return await this._fetch(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  },

  /**
   * PUT request
   * @param {string} url - API endpoint URL
   * @param {object} data - Request body data
   * @param {object} options - Additional fetch options
   * @returns {Promise} Response data
   */
  put: async function(url, data = null, options = {}) {
    return await this._fetch(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  },

  /**
   * DELETE request
   * @param {string} url - API endpoint URL
   * @param {object} options - Additional fetch options
   * @returns {Promise} Response data
   */
  delete: async function(url, options = {}) {
    return await this._fetch(url, {
      ...options,
      method: 'DELETE'
    });
  },

  /**
   * PATCH request
   * @param {string} url - API endpoint URL
   * @param {object} data - Request body data
   * @param {object} options - Additional fetch options
   * @returns {Promise} Response data
   */
  patch: async function(url, data = null, options = {}) {
    return await this._fetch(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
  }
};
