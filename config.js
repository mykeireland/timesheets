// ===================== CONFIG.JS =====================
// Centralized API configuration

// Set your API base URL here
// For production: use Azure Function App URL
// For local development: use http://localhost:7071/api
// For Static Web Apps: use /api (proxy)

window.API_BASE = window.API_BASE || "https://func-timesheetsnet-api-dev.azurewebsites.net/api";

// Remove trailing slashes for consistency
window.API_BASE = window.API_BASE.replace(/\/+$/, "");

console.info("🔗 API_BASE configured:", window.API_BASE);

// ===================== LOADING INDICATOR =====================
// Create loading overlay on page load
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("loadingOverlay")) {
    const overlay = document.createElement("div");
    overlay.id = "loadingOverlay";
    overlay.className = "loading-overlay";
    overlay.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(overlay);
  }
});

// Loading state management
window.showLoading = function() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.classList.add("active");
};

window.hideLoading = function() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.classList.remove("active");
};

// ===================== CSRF PROTECTION =====================
// CSRF token management to prevent Cross-Site Request Forgery attacks
// Note: This is a client-side implementation. For full security, backend must validate tokens.

/**
 * Generates or retrieves the CSRF token for the current session
 * @returns {string} - The CSRF token
 */
window.getCsrfToken = function() {
  let token = sessionStorage.getItem('csrf_token');
  if (!token) {
    // Generate a random token using crypto API
    if (window.crypto && window.crypto.randomUUID) {
      token = window.crypto.randomUUID();
    } else {
      // Fallback for older browsers
      token = 'csrf_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
    sessionStorage.setItem('csrf_token', token);
  }
  return token;
};

/**
 * Enhanced fetch wrapper that automatically includes CSRF token
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise} - Fetch promise
 */
window.secureFetch = function(url, options = {}) {
  // Add CSRF token to headers for state-changing operations
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    options.headers = options.headers || {};
    options.headers['X-CSRF-Token'] = window.getCsrfToken();
  }

  return fetch(url, options);
};

// Initialize CSRF token on page load
document.addEventListener("DOMContentLoaded", () => {
  window.getCsrfToken();
  console.info("🔒 CSRF protection initialized");
});
