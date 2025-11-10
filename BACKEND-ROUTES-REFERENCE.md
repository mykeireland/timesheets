# Backend Routes Reference

## Expected Azure Function Routes

The frontend expects these exact routes. Ensure your backend Azure Functions match these:

### 1. Verify PIN (✅ Working)
- **Route**: `auth/verify-pin`
- **Method**: POST
- **Full URL**: `https://func-timesheetsNET-api-dev.azurewebsites.net/api/auth/verify-pin`
- **Function**: VerifyPin.cs

**C# Route Configuration**:
```csharp
[Function("VerifyPin")]
public async Task<HttpResponseData> Run(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "auth/verify-pin")]
    HttpRequestData req)
```

---

### 2. Get PIN Status (❌ Returns 404)
- **Route**: `admin/pin-status`
- **Method**: GET
- **Full URL**: `https://func-timesheetsNET-api-dev.azurewebsites.net/api/admin/pin-status`
- **Function**: GetPinStatus.cs (or similar)

**Expected C# Route Configuration**:
```csharp
[Function("GetPinStatus")]
public async Task<HttpResponseData> Run(
    [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "admin/pin-status")]
    HttpRequestData req)
{
    // Query PinCredential table
    // Return list of { employeeId, hasPin, lastUpdated }
}
```

**Expected Response Format**:
```json
{
  "success": true,
  "data": [
    {
      "employeeId": 1,
      "hasPin": true,
      "lastUpdated": "2025-11-10T10:30:00Z"
    },
    {
      "employeeId": 2,
      "hasPin": false,
      "lastUpdated": null
    }
  ]
}
```

---

### 3. Reset PIN (❌ Returns 404)
- **Route**: `admin/reset-pin`
- **Method**: POST
- **Full URL**: `https://func-timesheetsNET-api-dev.azurewebsites.net/api/admin/reset-pin`
- **Function**: ResetPin.cs

**Expected C# Route Configuration**:
```csharp
[Function("ResetPin")]
public async Task<HttpResponseData> Run(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "admin/reset-pin")]
    HttpRequestData req)
{
    // Parse request body
    var payload = await JsonSerializer.DeserializeAsync<ResetPinRequest>(req.Body);

    // Generate new salt
    // Hash new PIN with salt
    // Update or insert PinCredential record

    return await ApiResponse.Success(req, "PIN reset successfully");
}
```

**Expected Request Body**:
```json
{
  "employeeId": "11",
  "newPin": "0000"
}
```

**Expected Response Format**:
```json
{
  "success": true,
  "message": "PIN reset successfully"
}
```

---

### 4. Change PIN (❓ Not tested yet)
- **Route**: `auth/change-pin`
- **Method**: POST
- **Full URL**: `https://func-timesheetsNET-api-dev.azurewebsites.net/api/auth/change-pin`
- **Function**: ChangePin.cs

**Expected C# Route Configuration**:
```csharp
[Function("ChangePin")]
public async Task<HttpResponseData> Run(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "auth/change-pin")]
    HttpRequestData req)
{
    // Verify current PIN
    // Validate new PIN (must not be "0000")
    // Generate new salt
    // Hash new PIN
    // Update PinCredential

    return await ApiResponse.Success(req, "PIN changed successfully");
}
```

**Expected Request Body**:
```json
{
  "employeeId": 123,
  "currentPin": "0000",
  "newPin": "1234"
}
```

---

## Common Backend Issues

### Issue 1: Missing `/admin/` Prefix

**Wrong**:
```csharp
Route = "reset-pin"  // Creates /api/reset-pin
```

**Correct**:
```csharp
Route = "admin/reset-pin"  // Creates /api/admin/reset-pin
```

### Issue 2: Wrong HTTP Method

**Wrong**:
```csharp
[HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "admin/reset-pin")]  // GET
```

**Correct**:
```csharp
[HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "admin/reset-pin")]  // POST
```

### Issue 3: Function Not Deployed

Check your `.csproj` file includes all function files:
```xml
<ItemGroup>
  <Compile Include="VerifyPin.cs" />
  <Compile Include="ResetPin.cs" />
  <Compile Include="GetPinStatus.cs" />
  <Compile Include="ChangePin.cs" />
</ItemGroup>
```

### Issue 4: Authorization Level

If using `AuthorizationLevel.Function`, you need function keys:
```csharp
[HttpTrigger(AuthorizationLevel.Function, "post", Route = "admin/reset-pin")]
```

Requires:
```javascript
fetch(`${API_BASE}/admin/reset-pin?code=FUNCTION_KEY`, ...)
```

**Recommendation**: Use `AuthorizationLevel.Anonymous` for now, add proper authentication later.

---

## Verification Checklist

- [ ] All function files compiled in backend project
- [ ] Routes match frontend expectations exactly
- [ ] HTTP methods (GET/POST) match frontend calls
- [ ] AuthorizationLevel set to Anonymous
- [ ] Functions deployed successfully to Azure
- [ ] No deployment errors in Azure logs
- [ ] Function App is running (not stopped)

---

## Testing Backend Routes

Use the diagnostic tool or test manually:

### Test GET /admin/pin-status
```bash
curl https://func-timesheetsNET-api-dev.azurewebsites.net/api/admin/pin-status
```

**Expected**: HTTP 200 with JSON data
**Getting 404?**: Route is wrong or function not deployed

### Test POST /admin/reset-pin
```bash
curl -X POST https://func-timesheetsNET-api-dev.azurewebsites.net/api/admin/reset-pin \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"1","newPin":"0000"}'
```

**Expected**: HTTP 200 with `{"success":true}`
**Getting 404?**: Route is wrong or function not deployed

---

## Quick Fix Commands

### Redeploy Azure Functions
```bash
# From your backend project directory
func azure functionapp publish func-timesheetsNET-api-dev
```

### View Deployed Functions
```bash
# List all functions in your app
az functionapp function list \
  --resource-group <your-resource-group> \
  --name func-timesheetsNET-api-dev \
  --output table
```

This will show the exact function names and routes deployed.

---

## Summary

**The frontend calls these routes:**
1. ✅ `POST /api/auth/verify-pin` (working)
2. ❌ `GET /api/admin/pin-status` (404)
3. ❌ `POST /api/admin/reset-pin` (404)
4. ❓ `POST /api/auth/change-pin` (not tested)

**Ensure your backend Azure Functions have:**
- Correct `Route` attributes matching above
- Correct HTTP methods (GET/POST)
- `AuthorizationLevel.Anonymous`
- Successfully deployed to Azure
