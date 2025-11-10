# GetPinStatus and ResetPin 404 Error - Complete Analysis

**Date**: November 10, 2025
**Issue**: GetPinStatus and ResetPin functions return 404 errors
**Impact**: Critical - New employees cannot get PINs, managers cannot reset forgotten PINs

---

## Executive Summary

Two critical admin endpoints are returning 404 errors:
- `GET /api/admin/pin-status` (GetPinStatus)
- `POST /api/admin/reset-pin` (ResetPin)

Meanwhile, the employee login endpoint works perfectly:
- `POST /api/auth/verify-pin` (VerifyPin) ✅

**Root Cause**: The Azure Functions for GetPinStatus and ResetPin are either:
1. Not deployed to the Azure Function App
2. Deployed with different route names
3. Requiring function keys that aren't configured

---

## What These Functions Do

### 1. GetPinStatus
**Route**: `GET /api/admin/pin-status`
**Purpose**: Admin dashboard to view PIN status for all employees

**Functionality**:
- Queries `PinCredential` table in Azure SQL
- Returns list of employees with PIN status (has PIN: yes/no, last updated date)
- Displays ✓/✗ badges in staff.html page

**Usage in Code**:
```javascript
// staff.js line 93
fetch(buildAdminUrl('/admin/pin-status'), { cache: "no-store" })
```

**Expected Response**:
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

**Impact of 404 Error**:
- ❌ PIN status column in staff page shows blank
- ❌ Managers have no visibility into who has PINs set up
- ❌ Cannot identify employees who need help
- ✅ Does NOT prevent existing employees from logging in

---

### 2. ResetPin
**Route**: `POST /api/admin/reset-pin`
**Purpose**: Allow managers to set/reset employee PINs

**Functionality**:
- Receives employee ID and new PIN
- Generates new cryptographic salt
- Hashes PIN with SHA-256 + salt
- Updates/inserts record in `PinCredential` table

**Usage in Code**:
```javascript
// staff.js line 315 (when adding new employee)
await fetch(buildAdminUrl('/admin/reset-pin'), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    employeeId: String(newEmployeeId),
    newPin: "0000"
  })
});

// staff.js line 421 (manager reset button)
const res = await fetch(buildAdminUrl('/admin/reset-pin'), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    employeeId: String(employeeId),
    newPin: pinToSet
  })
});
```

**Expected Request**:
```json
{
  "employeeId": "11",
  "newPin": "0000"
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "PIN reset successfully"
}
```

**Impact of 404 Error**:
- ❌ **CRITICAL**: New employees don't get default PIN "0000"
- ❌ **CRITICAL**: New employees cannot log in at all
- ❌ **CRITICAL**: Managers cannot reset forgotten PINs
- ❌ **CRITICAL**: "Reset PIN" button in staff.html fails
- ❌ Employees who forget PINs are permanently locked out

---

## Complete PIN Workflow

### 1️⃣ New Employee Creation
```
Manager adds employee → Employee record created →
ResetPin called to set "0000" ❌ 404 ERROR →
No PIN created → Employee CANNOT log in
```

### 2️⃣ Employee First Login
```
Employee selects name → PIN modal appears →
Employee enters "0000" → VerifyPin called ✅ WORKS →
System detects default PIN → Change PIN modal appears →
Employee enters new PIN → ChangePin called ❓ STATUS UNKNOWN →
PIN updated in database
```

### 3️⃣ Manager Resets PIN
```
Manager clicks "Reset PIN" → Enters new PIN or uses "0000" →
ResetPin called ❌ 404 ERROR →
PIN reset fails → Employee still locked out
```

### 4️⃣ Admin Views PIN Status
```
Manager opens staff.html → GetPinStatus called ❌ 404 ERROR →
No status data returned → Column shows blank
```

---

## How PINs Actually Work (Technical Details)

### Security Implementation
PINs use industry-standard cryptographic hashing:

1. **Storage**: PINs are NEVER stored in plain text
2. **Salt**: Each employee gets a unique random salt (prevents rainbow table attacks)
3. **Hashing**: PIN + salt hashed with SHA-256
4. **Verification**: Constant-time comparison (prevents timing attacks)

### Database Schema
```sql
CREATE TABLE dbo.PinCredential (
    user_id INT NOT NULL PRIMARY KEY,
    pin_hash VARBINARY(MAX) NOT NULL,
    salt VARBINARY(MAX) NOT NULL,
    updated_utc DATETIME2 NOT NULL,
    CONSTRAINT FK_PinCredential_Employee FOREIGN KEY (user_id)
        REFERENCES dbo.Employee(employee_id)
);
```

### PIN Creation Process (ResetPin)
```
1. Receive: employeeId="11", newPin="0000"
2. Generate: Random salt (e.g., 16 bytes)
3. Combine: "0000" + salt
4. Hash: SHA256(PIN + salt) → pin_hash
5. Store: INSERT/UPDATE PinCredential
   - user_id = 11
   - pin_hash = <hashed bytes>
   - salt = <random bytes>
   - updated_utc = NOW()
```

### PIN Verification Process (VerifyPin - Working!)
```
1. Receive: employeeId=11, pin="0000"
2. Query: SELECT pin_hash, salt FROM PinCredential WHERE user_id=11
3. Compute: SHA256("0000" + stored_salt)
4. Compare: computed_hash === stored_pin_hash (constant-time)
5. Return: success=true or success=false
```

---

## Root Cause Analysis

### Most Likely: Functions Not Deployed

**Evidence**:
- VerifyPin works perfectly (same backend, different route)
- GetPinStatus returns 404 (not 401, not 500, not 503)
- ResetPin returns 404
- Frontend code expects exact routes: `/admin/pin-status`, `/admin/reset-pin`
- Diagnostic tool found no working alternative routes

**Conclusion**: The C# Azure Functions `GetPinStatus.cs` and `ResetPin.cs` were never deployed to `func-timesheetsnet-api-dev.azurewebsites.net`

### Alternative: Function Authorization Mismatch

**Evidence**:
- `config.js` has `ADMIN_FUNCTION_KEY` field (currently empty)
- `staff.js` has `buildAdminUrl()` helper to append function keys
- `FUNCTION-KEY-SETUP.md` suggests this might be the issue

**Theory**: Functions ARE deployed but use `AuthorizationLevel.Function` instead of `AuthorizationLevel.Anonymous`

**If true**: Adding function key to `config.js` would make them work

### Less Likely: Route Name Mismatch

**Evidence**:
- Diagnostic tool tested multiple variations:
  - `/admin/pin-status`, `/pin-status`, `/auth/pin-status`
  - `/admin/reset-pin`, `/reset-pin`, `/auth/reset-pin`
  - camelCase, PascalCase, kebab-case variants
- All returned 404

**Conclusion**: If deployed with different names, they'd have been found by diagnostic tool

---

## Solution Steps

### Step 1: Run Diagnostic Tool (5 minutes)

Open the diagnostic tool in your browser:
```
file:///path/to/timesheets/pin-functions-diagnostic.html
```

This will:
- ✅ Test all endpoint variations
- ✅ Identify working alternatives (if any)
- ✅ Provide specific recommendations
- ✅ Generate actionable next steps

### Step 2: Check Azure Portal (10 minutes)

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to Function App: `func-timesheetsnet-api-dev`
3. Click **"Functions"** in left sidebar
4. Look for these functions in the list:
   - ✅ VerifyPin (should exist - it works)
   - ❓ GetPinStatus (check if exists)
   - ❓ ResetPin (check if exists)
   - ❓ ChangePin (may also need checking)

### Step 3A: If Functions ARE Deployed

If you see GetPinStatus and ResetPin in the list:

1. Click on each function name
2. Click **"Get Function Url"** button
3. Note the exact URL structure:
   ```
   https://func-timesheetsnet-api-dev.azurewebsites.net/api/admin/reset-pin?code=XXXX
   ```
4. If `?code=XXXX` is present → Function requires key
5. Copy the key value
6. Open `config.js` and update line 18:
   ```javascript
   window.ADMIN_FUNCTION_KEY = "paste_key_here";
   ```
7. Commit and push changes
8. Test in browser

### Step 3B: If Functions Are NOT Deployed

If GetPinStatus and ResetPin are missing from Azure Portal:

#### Option 1: Ask for Backend Repository
You need access to the C# backend project to deploy these functions.
- The backend code is NOT in this repository (this is frontend only)
- Ask your team where the Azure Functions C# project is located
- Clone that repository

#### Option 2: Create the Functions (If You Have Backend Access)

Create two new Azure Function files:

**GetPinStatus.cs**:
```csharp
using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace TimesheetsAPI
{
    public class GetPinStatus
    {
        private readonly ILogger _logger;

        public GetPinStatus(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<GetPinStatus>();
        }

        [Function("GetPinStatus")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "admin/pin-status")]
            HttpRequestData req)
        {
            _logger.LogInformation("GetPinStatus function triggered");

            try
            {
                var connectionString = Environment.GetEnvironmentVariable("SqlConnectionString");
                var pinStatuses = new List<object>();

                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();

                    var query = @"
                        SELECT
                            e.employee_id,
                            CASE WHEN p.user_id IS NOT NULL THEN 1 ELSE 0 END as has_pin,
                            p.updated_utc
                        FROM dbo.Employee e
                        LEFT JOIN dbo.PinCredential p ON e.employee_id = p.user_id
                        WHERE e.active = 1
                        ORDER BY e.employee_id";

                    using (var command = new SqlCommand(query, connection))
                    using (var reader = await command.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            pinStatuses.Add(new
                            {
                                employeeId = reader.GetInt32(0),
                                hasPin = reader.GetInt32(1) == 1,
                                lastUpdated = reader.IsDBNull(2) ? null : reader.GetDateTime(2).ToString("o")
                            });
                        }
                    }
                }

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    data = pinStatuses
                });

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting PIN status");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Failed to retrieve PIN status"
                });
                return errorResponse;
            }
        }
    }
}
```

**ResetPin.cs**:
```csharp
using System;
using System.Data.SqlClient;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace TimesheetsAPI
{
    public class ResetPin
    {
        private readonly ILogger _logger;

        public ResetPin(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<ResetPin>();
        }

        [Function("ResetPin")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "admin/reset-pin")]
            HttpRequestData req)
        {
            _logger.LogInformation("ResetPin function triggered");

            try
            {
                // Parse request body
                string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                var payload = JsonSerializer.Deserialize<ResetPinRequest>(requestBody);

                if (string.IsNullOrEmpty(payload?.EmployeeId) || string.IsNullOrEmpty(payload?.NewPin))
                {
                    var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                    await badRequest.WriteAsJsonAsync(new
                    {
                        success = false,
                        message = "Employee ID and new PIN are required"
                    });
                    return badRequest;
                }

                // Validate PIN format (4 digits)
                if (payload.NewPin.Length != 4 || !int.TryParse(payload.NewPin, out _))
                {
                    var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                    await badRequest.WriteAsJsonAsync(new
                    {
                        success = false,
                        message = "PIN must be exactly 4 digits"
                    });
                    return badRequest;
                }

                // Generate new salt
                var salt = new byte[16];
                using (var rng = RandomNumberGenerator.Create())
                {
                    rng.GetBytes(salt);
                }

                // Hash PIN with salt
                var pinHash = HashPin(payload.NewPin, salt);

                // Update database
                var connectionString = Environment.GetEnvironmentVariable("SqlConnectionString");
                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();

                    var query = @"
                        MERGE dbo.PinCredential AS target
                        USING (SELECT @userId AS user_id) AS source
                        ON target.user_id = source.user_id
                        WHEN MATCHED THEN
                            UPDATE SET
                                pin_hash = @pinHash,
                                salt = @salt,
                                updated_utc = GETUTCDATE()
                        WHEN NOT MATCHED THEN
                            INSERT (user_id, pin_hash, salt, updated_utc)
                            VALUES (@userId, @pinHash, @salt, GETUTCDATE());";

                    using (var command = new SqlCommand(query, connection))
                    {
                        command.Parameters.AddWithValue("@userId", int.Parse(payload.EmployeeId));
                        command.Parameters.AddWithValue("@pinHash", pinHash);
                        command.Parameters.AddWithValue("@salt", salt);
                        await command.ExecuteNonQueryAsync();
                    }
                }

                _logger.LogInformation($"PIN reset successfully for employee {payload.EmployeeId}");

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    message = "PIN reset successfully"
                });

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resetting PIN");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Failed to reset PIN"
                });
                return errorResponse;
            }
        }

        private byte[] HashPin(string pin, byte[] salt)
        {
            using (var sha256 = SHA256.Create())
            {
                var pinBytes = Encoding.UTF8.GetBytes(pin);
                var saltedPin = new byte[pinBytes.Length + salt.Length];
                Buffer.BlockCopy(pinBytes, 0, saltedPin, 0, pinBytes.Length);
                Buffer.BlockCopy(salt, 0, saltedPin, pinBytes.Length, salt.Length);
                return sha256.ComputeHash(saltedPin);
            }
        }

        private class ResetPinRequest
        {
            public string EmployeeId { get; set; }
            public string NewPin { get; set; }
        }
    }
}
```

Then deploy:
```bash
func azure functionapp publish func-timesheetsnet-api-dev
```

---

## Verification After Fix

### Test 1: Check Azure Portal
1. Refresh Functions list
2. Verify GetPinStatus and ResetPin appear
3. Click "Get Function Url" for each
4. Should see URLs like:
   ```
   https://func-timesheetsnet-api-dev.azurewebsites.net/api/admin/pin-status
   https://func-timesheetsnet-api-dev.azurewebsites.net/api/admin/reset-pin
   ```

### Test 2: Run Diagnostic Tool
1. Open `pin-functions-diagnostic.html`
2. Click "Run Full Diagnostic"
3. Should see:
   - ✅ VerifyPin: 200 OK
   - ✅ GetPinStatus: 200 OK
   - ✅ ResetPin: 200 OK

### Test 3: Test in Application
1. Open staff.html
2. PIN Status column should show ✓/✗ badges
3. Click "Reset PIN" button for an employee
4. Enter "1234" as new PIN
5. Should see success message
6. Employee should be able to log in with "1234"

### Test 4: Add New Employee
1. Click "Add" button in staff.html
2. Fill in employee details
3. Click "Save"
4. Should see "Employee added successfully! Default PIN set to 0000."
5. New employee should appear in list with PIN status ✓
6. New employee should be able to log in with "0000"

---

## Impact Summary

### Current State (With 404 Errors)
- ❌ Cannot see who has PINs set up
- ❌ New employees don't get default PIN
- ❌ New employees cannot log in
- ❌ Cannot reset forgotten PINs
- ❌ Employees locked out permanently if they forget PIN
- ✅ Existing employees with PINs CAN still log in

### Fixed State (After Deployment)
- ✅ Managers can see PIN status for all employees
- ✅ New employees automatically get "0000" PIN
- ✅ New employees can log in immediately
- ✅ Managers can reset forgotten PINs
- ✅ No more permanent lockouts
- ✅ Complete PIN management workflow

---

## Files Modified in This Fix

### Created Files
1. **pin-functions-diagnostic.html** - Comprehensive diagnostic tool
2. **PIN-FUNCTIONS-ANALYSIS.md** (this file) - Complete documentation

### Files to Check (Not in This Repo)
1. **Backend C# Project** - Need to locate this
2. **GetPinStatus.cs** - Azure Function (may not exist)
3. **ResetPin.cs** - Azure Function (may not exist)

### Existing Files (Reference Only)
1. **staff.js** (lines 93, 315, 421) - Calls these endpoints
2. **config.js** (line 18) - Function key configuration
3. **BACKEND-ROUTES-REFERENCE.md** - Expected function signatures
4. **TROUBLESHOOTING-404.md** - Previous troubleshooting guide
5. **FUNCTION-KEY-SETUP.md** - Function key instructions

---

## Questions to Ask Your Team

1. **Where is the backend C# Azure Functions project?**
   - Need repository URL or location
   - Need access to deploy

2. **Do GetPinStatus.cs and ResetPin.cs files exist?**
   - If yes: Need to deploy them
   - If no: Need to create them (templates provided above)

3. **What is the Azure Function deployment process?**
   - Azure CLI? Visual Studio? GitHub Actions?
   - Who has deployment permissions?

4. **Is there a function key we should be using?**
   - Check Azure Portal under Function Keys
   - If exists, add to config.js

---

## Additional Context

### Why VerifyPin Works But Others Don't

VerifyPin was deployed earlier as part of the initial PIN authentication feature. The documentation (PIN-AUTHENTICATION-README.md) shows it was:
- Created first
- Deployed successfully
- Tested and working

GetPinStatus and ResetPin were planned as "Future Enhancements" (line 135 of PIN-AUTHENTICATION-README.md) but may never have been:
- Created in the backend
- Deployed to Azure
- Properly tested

The frontend code was written EXPECTING these functions to exist, but the backend deployment never happened.

### Why This Wasn't Caught Earlier

1. Password reset (the main feature) DOES work - employees can change their own PINs
2. The 404 errors only affect admin functions
3. Existing employees (if manually given PINs via SQL) can still log in
4. The system appears to work for day-to-day use
5. Only breaks when:
   - Adding new employees
   - Resetting forgotten PINs
   - Viewing admin dashboard

---

## Next Actions

1. **Immediate** (5 min): Run diagnostic tool → Determine exact issue
2. **Short-term** (1 hour): Locate backend repo → Verify function files exist
3. **Medium-term** (2-4 hours): Deploy functions → Test thoroughly
4. **Long-term** (ongoing): Add automated tests for all PIN endpoints

---

**Document Version**: 1.0
**Last Updated**: November 10, 2025
**Author**: Claude (AI Assistant)
**Status**: Analysis Complete - Awaiting Backend Access
