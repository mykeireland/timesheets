# Route Fix Applied - Using `/auth/` Prefix

## Problem History
The frontend initially called endpoints with `/admin/` prefix:
- ❌ `GET /api/admin/pin-status` → 404 Not Found
- ❌ `POST /api/admin/reset-pin` → 404 Not Found

First fix attempt removed `/admin/` prefix:
- ❌ `GET /api/pin-status` → Still 404 Not Found
- ❌ `POST /api/reset-pin` → Still 404 Not Found

## Current Solution
Since `/api/auth/verify-pin` works, the admin PIN endpoints are likely also under `/auth/`:
- 🔄 `GET /api/auth/pin-status` (Testing)
- 🔄 `POST /api/auth/reset-pin` (Testing)

## Files Changed

### 1. staff.js (3 changes)

**Line 84** - Load PIN status:
```javascript
// ORIGINAL:
fetch(`${API_BASE}/admin/pin-status`, { cache: "no-store" })

// NOW:
fetch(`${API_BASE}/auth/pin-status`, { cache: "no-store" })
```

**Line 306** - Set default PIN for new employee:
```javascript
// ORIGINAL:
await fetch(`${API_BASE}/admin/reset-pin`, {

// NOW:
await fetch(`${API_BASE}/auth/reset-pin`, {
```

**Line 412** - Reset employee PIN:
```javascript
// ORIGINAL:
const res = await fetch(`${API_BASE}/admin/reset-pin`, {

// NOW:
const res = await fetch(`${API_BASE}/auth/reset-pin`, {
```

**Bonus Fix** - Better error handling for 404 responses (lines 420-431):
- Fixed "Body is disturbed or locked" error by checking response status BEFORE trying to parse body
- Checks Content-Type header to determine if response is JSON or HTML
- Shows clear error message: "Endpoint not found. Route may not be deployed."

### 2. pin-diagnostic.html

**Line 27** - Check PIN status:
```javascript
// ORIGINAL:
const res = await fetch(`${API_BASE}/admin/pin-status`);

// NOW:
const res = await fetch(`${API_BASE}/auth/pin-status`);
```

## Expected Backend Routes

Your backend Azure Functions should have these route configurations:

### GetPinStatus.cs (or similar)
```csharp
[Function("GetPinStatus")]
public async Task<HttpResponseData> Run(
    [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "auth/pin-status")]
    HttpRequestData req)
```

### ResetPin.cs
```csharp
[Function("ResetPin")]
public async Task<HttpResponseData> Run(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "auth/reset-pin")]
    HttpRequestData req)
```

Note: Routes use "auth/" prefix to match the working `/auth/verify-pin` endpoint.

## Testing

After deploying these changes:

1. **Go to staff.html**
2. **Check the PIN Status column** - should show ✓ Set / ✗ Not Set instead of all "Not Set"
3. **Click "Reset PIN" button** - should successfully reset employee PIN
4. **Add a new employee** - should automatically set PIN to 0000

If you still get 404 errors, the backend routes might be different. Use the diagnostic tool (`api-route-diagnostic.html`) to test various route patterns.

## Alternative: If This Still Doesn't Work

If you still get 404 errors after this fix, your backend routes might be configured differently. Check these possibilities:

### Option A: Routes ARE under `/admin/` in backend

If backend has:
```csharp
Route = "admin/pin-status"
Route = "admin/reset-pin"
```

Then revert these changes and update backend to match frontend.

### Option B: Routes use different names

Examples:
- `pin-status` might be `pinStatus` (camelCase)
- `reset-pin` might be `resetPin` (camelCase)
- Routes might be capitalized: `PinStatus`, `ResetPin`

Use the diagnostic tool to test these variations.

### Option C: Routes require authentication keys

If backend uses `AuthorizationLevel.Function` instead of `Anonymous`, you need to add function keys:
```javascript
fetch(`${API_BASE}/reset-pin?code=YOUR_FUNCTION_KEY`, ...)
```

## Verification

Check Azure Portal:
1. Go to your Function App: `func-timesheetsNET-api-dev`
2. Click **Functions** in left menu
3. Find your PIN-related functions
4. Click each one and click **"Get Function Url"**
5. The URL will show the exact route

Example:
```
https://func-timesheetsNET-api-dev.azurewebsites.net/api/reset-pin
                                                         ^^^^^^^^^^
                                                    This is your route
```

## Summary

✅ **Changed routes from `/admin/pin-status` to `/auth/pin-status`**
✅ **Changed routes from `/admin/reset-pin` to `/auth/reset-pin`**
✅ **Fixed "Body is disturbed or locked" error**
✅ **Improved error handling for non-JSON 404 responses**
✅ **Updated all 3 occurrences in staff.js**
✅ **Updated pin-diagnostic.html**

These changes use the `/auth/` prefix to match the working `/auth/verify-pin` endpoint pattern.
