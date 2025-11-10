# Route Fix Applied - Removed `/admin/` Prefix

## Problem
The frontend was calling endpoints with `/admin/` prefix:
- ❌ `GET /api/admin/pin-status` → 404 Not Found
- ❌ `POST /api/admin/reset-pin` → 404 Not Found

But the backend Azure Functions are deployed WITHOUT the `/admin/` prefix.

## Solution
Updated all frontend calls to match backend routes (without `/admin/` prefix):
- ✅ `GET /api/pin-status`
- ✅ `POST /api/reset-pin`

## Files Changed

### 1. staff.js (3 changes)

**Line 84** - Load PIN status:
```javascript
// OLD:
fetch(`${API_BASE}/admin/pin-status`, { cache: "no-store" })

// NEW:
fetch(`${API_BASE}/pin-status`, { cache: "no-store" })
```

**Line 306** - Set default PIN for new employee:
```javascript
// OLD:
await fetch(`${API_BASE}/admin/reset-pin`, {

// NEW:
await fetch(`${API_BASE}/reset-pin`, {
```

**Line 412** - Reset employee PIN:
```javascript
// OLD:
const res = await fetch(`${API_BASE}/admin/reset-pin`, {

// NEW:
const res = await fetch(`${API_BASE}/reset-pin`, {
```

**Bonus Fix** - Better error handling for 404 responses (lines 420-428):
- Now gracefully handles HTML 404 responses instead of crashing with "string did not match expected pattern"
- Shows clear error message: "Endpoint not found or invalid response. Check backend deployment."

### 2. pin-diagnostic.html

**Line 27** - Check PIN status:
```javascript
// OLD:
const res = await fetch(`${API_BASE}/admin/pin-status`);

// NEW:
const res = await fetch(`${API_BASE}/pin-status`);
```

## Expected Backend Routes

Your backend Azure Functions should have these route configurations:

### GetPinStatus.cs (or similar)
```csharp
[Function("GetPinStatus")]
public async Task<HttpResponseData> Run(
    [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "pin-status")]
    HttpRequestData req)
```

### ResetPin.cs
```csharp
[Function("ResetPin")]
public async Task<HttpResponseData> Run(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "reset-pin")]
    HttpRequestData req)
```

Note: Routes do NOT include "admin/" prefix.

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

✅ **Changed routes from `/admin/pin-status` to `/pin-status`**
✅ **Changed routes from `/admin/reset-pin` to `/reset-pin`**
✅ **Improved error handling for non-JSON 404 responses**
✅ **Updated all 3 occurrences in staff.js**
✅ **Updated pin-diagnostic.html**

These changes match the most common Azure Functions deployment pattern where routes don't include an `/admin/` prefix.
