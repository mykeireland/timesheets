# Function Key Setup Instructions

## Problem

Your admin endpoints (`/admin/pin-status` and `/admin/reset-pin`) are deployed with **Function** authorization level instead of **Anonymous**. This means they require a function key to access.

## Solution Options

You have **two options** to fix this:

---

## Option 1: Add Function Key to Frontend (Quick Fix)

### Step 1: Get the Function Key from Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Function App: **func-timesheetsnet-api-dev**
3. Click **Functions** in the left menu
4. Click on **ResetPin** (or any admin function)
5. Click **Function Keys** in the left menu
6. Copy the **Value** under "default" key (the long string of characters)

### Step 2: Add Key to config.js

Open `config.js` and paste your function key:

```javascript
// ADMIN FUNCTION KEY
// Some admin endpoints require a function key for authorization
// Get this from Azure Portal → Function App → Functions → [Function Name] → Function Keys → default
// Leave blank if your functions use Anonymous authorization
window.ADMIN_FUNCTION_KEY = "YOUR_FUNCTION_KEY_HERE";  // Paste key here
```

Replace `"YOUR_FUNCTION_KEY_HERE"` with the actual key you copied.

### Step 3: Deploy Changes

Commit and push the changes:

```bash
git add config.js
git commit -m "Add function key for admin endpoints"
git push
```

### ✅ After Deployment

- **staff.html** PIN Status column should populate
- **Reset PIN** button should work
- All admin endpoints will include `?code=YOUR_KEY` automatically

---

## Option 2: Change Backend to Anonymous (Better Long-Term)

### Why This is Better

- No secrets in frontend code
- More secure
- Easier to maintain
- Matches your other working endpoints

### How to Do It

In your backend C# project, find these files:

**ResetPin.cs**:
```csharp
[Function("ResetPin")]
public async Task<HttpResponseData> Run(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "admin/reset-pin")]  // Change to Anonymous
    HttpRequestData req)
```

**GetPinStatus.cs** (or similar name):
```csharp
[Function("GetPinStatus")]
public async Task<HttpResponseData> Run(
    [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "admin/pin-status")]  // Change to Anonymous
    HttpRequestData req)
```

Change `AuthorizationLevel.Function` → `AuthorizationLevel.Anonymous` in both functions.

Then redeploy your backend:
```bash
func azure functionapp publish func-timesheetsnet-api-dev
```

### ✅ After Backend Redeployment

Remove the function key from `config.js`:
```javascript
window.ADMIN_FUNCTION_KEY = "";  // No key needed with Anonymous auth
```

---

## Comparison

| Aspect | Option 1: Add Key | Option 2: Anonymous |
|--------|------------------|---------------------|
| Speed | ⚡ Quick (5 min) | ⏱️ Requires backend redeploy |
| Security | ⚠️ Key visible in frontend | ✅ No secrets exposed |
| Maintenance | ❌ Key rotation requires frontend update | ✅ No key management |
| Consistency | ❌ Different from /auth/verify-pin | ✅ Matches other endpoints |

## Recommendation

**Use Option 1 now** to get things working immediately.

**Switch to Option 2 later** when you have time to update and redeploy the backend.

---

## How the Fix Works

The code now automatically appends `?code=YOUR_KEY` to admin endpoint calls when `ADMIN_FUNCTION_KEY` is set:

```javascript
// Helper function in staff.js
function buildAdminUrl(endpoint) {
  const url = `${API_BASE}${endpoint}`;
  if (window.ADMIN_FUNCTION_KEY) {
    return `${url}?code=${window.ADMIN_FUNCTION_KEY}`;  // Adds key parameter
  }
  return url;
}

// Usage
fetch(buildAdminUrl('/admin/pin-status'))
// → https://.../api/admin/pin-status?code=YOUR_KEY
```

This is applied to:
- `GET /admin/pin-status` (load PIN status in staff page)
- `POST /admin/reset-pin` (reset employee PIN)
- `POST /admin/reset-pin` (set default PIN for new employees)

---

## Security Note

⚠️ **Important**: Function keys in frontend code are visible to anyone who views your website's source code. This is acceptable for development/internal tools, but for production apps:

1. Consider using Azure AD authentication
2. Or implement a backend API layer that validates user permissions
3. Or use Option 2 (Anonymous) with proper role-based checks in the backend code

For now, the function key approach is fine for getting your timesheet system working!
