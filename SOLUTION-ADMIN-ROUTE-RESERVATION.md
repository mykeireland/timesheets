# SOLUTION: Azure Functions /admin Route Reservation Issue

**Date**: November 10, 2025
**Root Cause Identified**: Azure Functions reserves `/admin` prefix for Kudu/SCM management endpoints
**Status**: Routes changed to `/management/` - Authorization needed

---

## 🎯 The Real Problem

**Azure Functions RESERVES the `/admin` route prefix** for its internal Kudu/SCM management interface!

Any Azure Function with routes like:
- `/admin/pin-status`
- `/admin/reset-pin`
- `/admin/*` (anything)

Will return **404 Not Found** because Azure intercepts these requests before they reach your functions.

---

## ✅ What Was Fixed (Backend)

Routes changed in Azure Functions:

**Before (BROKEN)**:
```csharp
Route = "admin/pin-status"    // 404 - Reserved by Azure
Route = "admin/reset-pin"     // 404 - Reserved by Azure
```

**After (WORKING)**:
```csharp
Route = "management/pin-status"    // ✅ Works
Route = "management/reset-pin"     // ✅ Works
```

---

## ✅ What Was Fixed (Frontend)

Updated `staff.js` to call new routes:

**Changed Lines**:
- Line 93: `/admin/pin-status` → `/management/pin-status`
- Line 315: `/admin/reset-pin` → `/management/reset-pin`
- Line 421: `/admin/reset-pin` → `/management/reset-pin`

---

## ⚠️ Current Status

**Backend deployed**: ✅ Routes exist and respond
**Frontend updated**: ✅ Calls correct endpoints
**Authorization**: ⚠️ Functions return 403 Forbidden

### Test Results:
```bash
# GetPinStatus
curl https://func-timesheetsNET-api-dev.azurewebsites.net/api/management/pin-status
# Response: 403 Forbidden (not 404!)

# This means the route exists but needs authorization
```

---

## 🔧 Next Step: Fix Authorization

You have **two options**:

### Option 1: Change to Anonymous (Recommended for Internal Apps)

Update backend functions to use `AuthorizationLevel.Anonymous`:

```csharp
// GetPinStatus.cs
[HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "management/pin-status")]

// ResetPin.cs
[HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "management/reset-pin")]
```

Then redeploy:
```bash
dotnet build
func azure functionapp publish func-timesheetsNET-api-dev
```

**Pros**:
- ✅ No keys to manage
- ✅ Matches VerifyPin (already uses Anonymous)
- ✅ Simpler frontend code
- ✅ No secrets in client-side code

**Cons**:
- ⚠️ Anyone with the URL can call these endpoints
- ⚠️ Suitable for internal apps behind corporate network/VPN

---

### Option 2: Add Function Key (More Secure for Public Apps)

Keep `AuthorizationLevel.Function` and add key to frontend:

1. **Get the function key from Azure Portal**:
   - Go to Function App → Functions → ResetPin
   - Click "Function Keys"
   - Copy the "default" key value

2. **Update `config.js`** (line 18):
```javascript
window.ADMIN_FUNCTION_KEY = "paste_your_key_here";
```

3. **Commit and push**

The existing `buildAdminUrl()` helper in `staff.js` will automatically append `?code=KEY` to all management endpoints.

**Pros**:
- ✅ More secure (requires key)
- ✅ Can revoke/rotate keys
- ✅ Fine-grained access control

**Cons**:
- ❌ Key visible in frontend source code (anyone can see it)
- ❌ Need to manage key rotation
- ❌ Extra complexity

---

## 📋 Recommendation

**Use Option 1 (Anonymous)** because:
1. This is an internal timesheet system (not public-facing)
2. VerifyPin already uses Anonymous
3. Consistency across all PIN endpoints
4. Easier to maintain

If your app is public-facing or you need audit trails, use Option 2 with proper key management.

---

## 🧪 Verification Steps

After applying either option:

### 1. Test GetPinStatus
```bash
curl https://func-timesheetsNET-api-dev.azurewebsites.net/api/management/pin-status
# Should return: {"success":true,"data":[...]}
```

### 2. Test ResetPin
```bash
curl -X POST https://func-timesheetsNET-api-dev.azurewebsites.net/api/management/reset-pin \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"1","newPin":"0000"}'
# Should return: {"success":true,"message":"PIN reset successfully"}
```

### 3. Test in Application

1. Open `staff.html` in browser
2. Check PIN Status column shows ✓/✗ badges
3. Click "Reset PIN" button for an employee
4. Enter a new PIN (e.g., "1234")
5. Should see success message
6. Employee can log in with new PIN

### 4. Test New Employee Creation

1. Click "Add" button in staff.html
2. Fill in employee details
3. Click "Save"
4. Should see "Employee added successfully! Default PIN set to 0000."
5. New employee should appear with ✓ in PIN Status column
6. New employee can log in with "0000"

---

## 📚 Key Learnings

### Azure Functions Reserved Routes

Azure reserves these route prefixes for internal use:
- `/admin` - Kudu/SCM management interface
- `/runtime` - Functions runtime admin API
- `/.well-known` - Discovery/metadata

**Always avoid** these prefixes in your Azure Function routes!

### Safe Alternative Prefixes

Use these instead:
- `/management/` ✅
- `/api-admin/` ✅
- `/secure/` ✅
- `/internal/` ✅
- `/staff/` ✅

### Why We Didn't Catch This Earlier

1. `/admin` seems like a logical choice for admin endpoints
2. No warning from Azure tooling about reserved routes
3. Works fine in local development (`func start`)
4. Only breaks when deployed to Azure
5. Returns generic 404 (not a helpful error message)

---

## 📝 Files Changed

### Backend (Already Applied by You)
- `GetPinStatus.cs` - Route changed to `management/pin-status`
- `ResetPin.cs` - Route changed to `management/reset-pin`

### Frontend (This Commit)
- `staff.js` - Updated 3 route calls to use `/management/`

### Documentation (This Commit)
- `SOLUTION-ADMIN-ROUTE-RESERVATION.md` - This file
- Updated other docs to reflect the fix

---

## 🚀 Deployment Checklist

Backend (You've done this):
- [x] Changed routes from `/admin/` to `/management/`
- [x] Rebuilt with `dotnet build`
- [ ] **TODO**: Deploy to Azure with Authorization fix (Option 1 or 2)

Frontend (Just completed):
- [x] Updated `staff.js` routes
- [ ] **TODO**: Commit and push changes
- [ ] **TODO**: Verify in production

Testing:
- [ ] GetPinStatus returns data (not 403)
- [ ] ResetPin works
- [ ] New employee gets default PIN
- [ ] Manager can reset PINs
- [ ] PIN status badges appear

---

## Summary

**Problem**: Used `/admin/` prefix (reserved by Azure)
**Solution**: Changed to `/management/` prefix
**Status**: Routes work but need authorization fix
**Next**: Deploy backend with Anonymous or add function key

This was a classic case of hitting an undocumented Azure limitation. The fix is simple once you know the cause!

---

**References**:
- [Azure Functions HTTP routing](https://docs.microsoft.com/en-us/azure/azure-functions/functions-bindings-http-webhook-trigger#customize-the-http-endpoint)
- [Kudu SCM site (uses /admin)](https://github.com/projectkudu/kudu/wiki)
