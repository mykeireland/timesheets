# Troubleshooting 404 Errors for Admin Endpoints

## Current Issue

The frontend is calling these endpoints:
- `GET /api/admin/pin-status` → **404 Not Found**
- `POST /api/admin/reset-pin` → **404 Not Found**

But these endpoints ARE deployed in the backend (ResetPin.cs, GetPinStatus.cs).

Meanwhile, this endpoint works:
- `POST /api/auth/verify-pin` → ✅ **Working**

## Using the Diagnostic Tool

1. **Open `api-route-diagnostic.html` in your browser**
2. **Click "Test All Admin Routes"** to try common route patterns
3. **Look for HTTP 200 or 401 responses** (not 404) - these indicate the endpoint exists
4. **Note the working route pattern**

The diagnostic tool will test:
- Current routes: `/admin/pin-status`, `/admin/reset-pin`
- Without prefix: `/pin-status`, `/reset-pin`
- Under auth: `/auth/pin-status`, `/auth/reset-pin`
- Different casing: `/admin/pinStatus`, `/admin/resetPin`, etc.

## Common Causes of 404 Errors

### 1. Route Name Mismatch

**Problem**: Azure Functions C# route attribute doesn't match frontend calls.

**Example Backend**:
```csharp
[Function("ResetPin")]
public async Task<HttpResponseData> Run(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "reset-pin")] HttpRequestData req)
```

This creates route: `/api/reset-pin` (NOT `/api/admin/reset-pin`)

**Solution**: Check your Azure Function's `Route` parameter in each function.

### 2. Missing Route Prefix

**Problem**: Azure Functions may not include the `/admin/` prefix.

**Check**: Look at `host.json` in your backend project:
```json
{
  "extensions": {
    "http": {
      "routePrefix": "api"  // This is prepended to all routes
    }
  }
}
```

If `Route = "admin/reset-pin"`, the full route is `/api/admin/reset-pin`.
If `Route = "reset-pin"`, the full route is `/api/reset-pin`.

### 3. Deployment Not Complete

**Problem**: Functions deployed but not yet propagated or failed silently.

**Verification**:
1. Go to Azure Portal → Your Function App
2. Click "Functions" in left sidebar
3. Verify you see:
   - `ResetPin`
   - `GetPinStatus` (or similar names)
4. Click each function and check the "Get Function Url" to see exact routes

### 4. Case Sensitivity

**Problem**: Route casing doesn't match.

Azure Functions routes are typically case-insensitive, but worth checking:
- `/admin/reset-pin` vs `/Admin/Reset-Pin`
- `/admin/resetPin` (camelCase)
- `/admin/ResetPin` (PascalCase)

### 5. Authorization Level

**Problem**: Function requires authentication that's not being sent.

**Check** your Azure Function's `AuthorizationLevel`:
```csharp
[HttpTrigger(AuthorizationLevel.Function, "post", Route = "admin/reset-pin")]
// vs
[HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "admin/reset-pin")]
```

If `AuthorizationLevel.Function`, you need to include function key in URL:
```javascript
fetch(`${API_BASE}/admin/reset-pin?code=YOUR_FUNCTION_KEY`, ...)
```

## Quick Fix: Update Frontend Routes

Once you identify the correct routes using the diagnostic tool, update these files:

### staff.js

**Line 84** - Change from:
```javascript
fetch(`${API_BASE}/admin/pin-status`, { cache: "no-store" })
```

To (example if route is `/pin-status`):
```javascript
fetch(`${API_BASE}/pin-status`, { cache: "no-store" })
```

**Line 306 and 412** - Change from:
```javascript
await fetch(`${API_BASE}/admin/reset-pin`, {
```

To:
```javascript
await fetch(`${API_BASE}/reset-pin`, {
```

## Verification Steps

### Step 1: Check Azure Portal

1. Open Azure Portal
2. Navigate to your Function App: `func-timesheetsNET-api-dev`
3. Click **Functions** in left menu
4. Look for your admin functions in the list
5. Click each one and note the exact function name

### Step 2: Check Function URLs

For each function:
1. Click the function name
2. Click **"Get Function Url"** button
3. Copy the URL - it will look like:
   ```
   https://func-timesheetsNET-api-dev.azurewebsites.net/api/reset-pin
   ```
4. The part after `/api/` is your route

### Step 3: Test with curl

Test from command line:
```bash
# Test PIN status
curl https://func-timesheetsNET-api-dev.azurewebsites.net/api/admin/pin-status

# Test reset PIN
curl -X POST https://func-timesheetsNET-api-dev.azurewebsites.net/api/admin/reset-pin \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"1","newPin":"0000"}'
```

### Step 4: Check Deployment Logs

1. Azure Portal → Function App
2. **Deployment Center** → View logs
3. Check for deployment errors or warnings
4. Look for function registration messages

## Example: Correct Route Configuration

If your backend C# files have:

**ResetPin.cs**:
```csharp
Route = "admin/reset-pin"
```

**GetPinStatus.cs**:
```csharp
Route = "admin/pin-status"
```

Then the full URLs should be:
- `https://func-timesheetsNET-api-dev.azurewebsites.net/api/admin/reset-pin`
- `https://func-timesheetsNET-api-dev.azurewebsites.net/api/admin/pin-status`

And your JavaScript is already correct!

## If Routes ARE Different

If the diagnostic tool reveals the routes are actually (for example):
- `/reset-pin` (no admin prefix)
- `/pin-status` (no admin prefix)

Then you have two options:

### Option A: Update Backend (Recommended)

Add `/admin/` prefix to match frontend:
```csharp
Route = "admin/reset-pin"  // Add admin/ prefix
```

Redeploy backend.

### Option B: Update Frontend

Change all frontend calls to match backend routes.

## Need More Help?

1. **Run the diagnostic tool** (`api-route-diagnostic.html`)
2. **Share the results** showing which routes return 200/401 (not 404)
3. **Check Azure Portal** for exact function names and URLs
4. **Verify deployment logs** for any errors

## Quick Reference: Files to Update

| File | Line(s) | Endpoint |
|------|---------|----------|
| `staff.js` | 84 | `/admin/pin-status` |
| `staff.js` | 306, 412 | `/admin/reset-pin` |
| `pin-diagnostic.html` | 27 | `/admin/pin-status` |
| `script.js` | 311 | `/auth/change-pin` (also may need checking) |
