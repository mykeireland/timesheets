// ===================== CONFIG.JS =====================
// Centralized API configuration

// Set your API base URL here
// For production: use Azure Function App URL
// For local development: use http://localhost:7071/api
// For Static Web Apps: use /api (proxy)

window.API_BASE = window.API_BASE || "https://func-timesheetsNET-api-dev.azurewebsites.net/api";

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
