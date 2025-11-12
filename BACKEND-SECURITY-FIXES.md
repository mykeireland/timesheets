# Backend Security Fixes - URGENT ACTION REQUIRED

**Date:** 2025-11-12
**Priority:** CRITICAL
**Target:** Azure Functions Backend Team

---

## Executive Summary

This document outlines **critical and high-priority security fixes** required for the Timesheet Application backend (Azure Functions). The frontend has been secured with XSS protection, input validation, and CSRF token support. **The backend must now be updated to complete the security implementation.**

### Critical Issues to Address:
1. ✅ **SQL Injection Prevention** - Use parameterized queries
2. ✅ **Authentication & Authorization on Admin Endpoints** - Lock down manager/staff endpoints with Entra ID
3. ✅ **CSRF Token Validation** - Validate X-CSRF-Token header
4. ✅ **Rate Limiting on PIN Verification** - Prevent brute force attacks
5. ✅ **Input Validation & Sanitization** - Validate all user inputs server-side
6. ✅ **Security Headers** - Add security response headers
7. ✅ **Audit Logging** - Log all security-sensitive operations

---

## 1. SQL Injection Prevention (CRITICAL 🔴)

### Problem
If your Azure Functions use string concatenation or interpolation to build SQL queries, you're vulnerable to SQL injection attacks.

### ❌ VULNERABLE CODE (DO NOT USE)
```csharp
// DON'T DO THIS - Vulnerable to SQL injection!
var query = $"SELECT * FROM Employees WHERE employee_id = {employeeId}";
var results = await connection.QueryAsync(query);

// DON'T DO THIS EITHER
var query = "UPDATE Timesheets SET status = 'Approved' WHERE entry_id = " + entryId;
```

### ✅ SECURE CODE (USE THIS)

#### Option 1: Parameterized Queries with Dapper
```csharp
using Dapper;

// SAFE - Parameterized query
var query = "SELECT * FROM Employees WHERE employee_id = @EmployeeId";
var employee = await connection.QueryFirstOrDefaultAsync<Employee>(
    query,
    new { EmployeeId = employeeId }
);

// SAFE - Multiple parameters
var query = @"
    UPDATE Timesheets
    SET status = @Status,
        notes = @Notes,
        updated_at = @UpdatedAt
    WHERE entry_id = @EntryId";

await connection.ExecuteAsync(query, new {
    Status = status,
    Notes = notes,
    UpdatedAt = DateTime.UtcNow,
    EntryId = entryId
});

// SAFE - Bulk insert
var query = @"
    INSERT INTO TimesheetEntries
    (employee_id, ticket_id, date, hours_standard, hours_15x, hours_2x, notes, status)
    VALUES
    (@EmployeeId, @TicketId, @Date, @HoursStandard, @Hours15x, @Hours2x, @Notes, @Status)";

await connection.ExecuteAsync(query, entries); // Dapper handles bulk operations
```

#### Option 2: Entity Framework Core (Recommended)
```csharp
using Microsoft.EntityFrameworkCore;

// SAFE - EF Core query
var employee = await context.Employees
    .Where(e => e.EmployeeId == employeeId)
    .FirstOrDefaultAsync();

// SAFE - Update with EF Core
var timesheet = await context.Timesheets
    .FirstOrDefaultAsync(t => t.EntryId == entryId);

if (timesheet != null)
{
    timesheet.Status = "Approved";
    timesheet.UpdatedAt = DateTime.UtcNow;
    await context.SaveChangesAsync();
}

// SAFE - Insert with EF Core
var newEntry = new TimesheetEntry
{
    EmployeeId = entry.EmployeeId,
    TicketId = entry.TicketId,
    Date = entry.Date,
    HoursStandard = entry.HoursStandard,
    // ...
};
context.TimesheetEntries.Add(newEntry);
await context.SaveChangesAsync();
```

### Action Required
- [ ] Audit ALL database queries in your codebase
- [ ] Replace string concatenation with parameterized queries
- [ ] Use Dapper or Entity Framework Core
- [ ] Test with SQL injection payloads to verify protection

---

## 2. Authentication & Authorization for Manager/Admin Endpoints (CRITICAL 🔴)

### Problem
Currently, **ALL admin endpoints are publicly accessible** with `AuthorizationLevel.Anonymous`. Anyone can approve timesheets, modify employees, or reset PINs.

### Current Vulnerable Endpoints
```csharp
// ❌ NO AUTHENTICATION - Anyone can access!
[Function("ApproveTimesheet")]
[HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "timesheets/approve/{entryId}")]

[Function("RejectTimesheet")]
[HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "timesheets/reject/{entryId}")]

[Function("AddEmployee")]
[HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "employees/add")]

[Function("UpdateEmployee")]
[HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "employees/{id}")]

[Function("ResetPin")]
[HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "management/reset-pin")]

[Function("SyncTickets")]
[HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "timesheets/sync-tickets")]
```

### ✅ SECURE IMPLEMENTATION with Entra ID

Since manager.html and staff.html will be behind Entra ID at the infrastructure level, you still need backend validation to ensure only authenticated managers can perform admin operations.

#### Step 1: Configure Azure AD Authentication

```csharp
// In your Azure Function startup or configuration
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddMicrosoftIdentityWebApi(options =>
    {
        Configuration.Bind("AzureAd", options);
        options.TokenValidationParameters.NameClaimType = "name";
        options.TokenValidationParameters.RoleClaimType = "roles";
    }, options =>
    {
        Configuration.Bind("AzureAd", options);
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("ManagerOnly", policy =>
        policy.RequireRole("Manager", "Admin"));
});
```

#### Step 2: Protect Admin Endpoints

```csharp
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Identity.Web.Resource;

[Function("ApproveTimesheet")]
public async Task<HttpResponseData> ApproveTimesheet(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "timesheets/approve/{entryId}")]
    HttpRequestData req,
    string entryId)
{
    // ✅ VALIDATE AUTHENTICATION & AUTHORIZATION
    var principal = await ValidateTokenAndGetUser(req);
    if (principal == null)
    {
        return await CreateUnauthorizedResponse(req, "Authentication required");
    }

    // ✅ CHECK MANAGER ROLE
    if (!principal.IsInRole("Manager") && !principal.IsInRole("Admin"))
    {
        return await CreateForbiddenResponse(req, "Manager role required");
    }

    // ✅ LOG AUDIT TRAIL
    var userId = principal.FindFirst("oid")?.Value; // Azure AD Object ID
    var userName = principal.Identity?.Name;
    await LogAuditEvent(new AuditLog
    {
        UserId = userId,
        UserName = userName,
        Action = "APPROVE_TIMESHEET",
        ResourceId = entryId,
        Timestamp = DateTime.UtcNow,
        IpAddress = req.Headers.GetValues("X-Forwarded-For").FirstOrDefault(),
        Success = true
    });

    // ✅ VALIDATE INPUT
    if (!int.TryParse(entryId, out var parsedEntryId) || parsedEntryId <= 0)
    {
        return await CreateBadRequestResponse(req, "Invalid entry ID");
    }

    // Process approval...
    var result = await ApproveTimesheetEntry(parsedEntryId);

    return await CreateJsonResponse(req, HttpStatusCode.OK, new {
        success = true,
        message = "Timesheet approved"
    });
}

// Helper method to validate JWT token from Entra ID
private async Task<ClaimsPrincipal> ValidateTokenAndGetUser(HttpRequestData req)
{
    // Extract Authorization header
    if (!req.Headers.TryGetValues("Authorization", out var authHeaders))
    {
        return null;
    }

    var authHeader = authHeaders.FirstOrDefault();
    if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
    {
        return null;
    }

    var token = authHeader.Substring("Bearer ".Length).Trim();

    try
    {
        // Validate JWT token from Azure AD
        var validationParams = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = $"https://sts.windows.net/{_azureAdTenantId}/",
            ValidateAudience = true,
            ValidAudience = _azureAdClientId,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            // Get signing keys from Azure AD
            IssuerSigningKeyResolver = (token, securityToken, kid, parameters) =>
            {
                return GetSigningKeysAsync().Result;
            }
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var principal = tokenHandler.ValidateToken(token, validationParams, out var validatedToken);

        return principal;
    }
    catch (Exception ex)
    {
        _logger.LogWarning($"Token validation failed: {ex.Message}");
        return null;
    }
}
```

#### Step 3: Apply to ALL Admin Endpoints

```csharp
// Update ALL these functions with authentication checks:
[Function("ApproveTimesheet")] // ✅ Add auth check
[Function("RejectTimesheet")]  // ✅ Add auth check
[Function("AddEmployee")]      // ✅ Add auth check
[Function("UpdateEmployee")]   // ✅ Add auth check
[Function("ResetPin")]         // ✅ Add auth check
[Function("SyncTickets")]      // ✅ Add auth check
[Function("GetPendingTimesheets")] // ✅ Add auth check
[Function("GetPinStatus")]     // ✅ Add auth check
```

### Alternative: If Entra ID is ONLY at Infrastructure Level

If you're handling Entra ID authentication at the Azure Static Web Apps or App Service level (not in the Function code), then your functions will receive authenticated user information via headers:

```csharp
[Function("ApproveTimesheet")]
public async Task<HttpResponseData> ApproveTimesheet(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "timesheets/approve/{entryId}")]
    HttpRequestData req,
    string entryId)
{
    // ✅ When using Azure Static Web Apps or EasyAuth, user info comes in headers
    var userIdHeader = req.Headers.GetValues("X-MS-CLIENT-PRINCIPAL-ID").FirstOrDefault();
    var userRolesHeader = req.Headers.GetValues("X-MS-CLIENT-PRINCIPAL").FirstOrDefault();

    if (string.IsNullOrEmpty(userIdHeader))
    {
        return await CreateUnauthorizedResponse(req, "Authentication required");
    }

    // Decode and validate user roles from X-MS-CLIENT-PRINCIPAL header
    var principal = ParseClientPrincipal(userRolesHeader);
    if (!principal.IsInRole("Manager"))
    {
        return await CreateForbiddenResponse(req, "Manager role required");
    }

    // Continue with authorization checks and business logic...
}

private ClaimsPrincipal ParseClientPrincipal(string clientPrincipalHeader)
{
    if (string.IsNullOrEmpty(clientPrincipalHeader))
        return null;

    var decoded = Convert.FromBase64String(clientPrincipalHeader);
    var json = Encoding.UTF8.GetString(decoded);
    var principal = JsonSerializer.Deserialize<ClientPrincipal>(json);

    var claims = new List<Claim>();
    foreach (var role in principal.UserRoles ?? Array.Empty<string>())
    {
        claims.Add(new Claim(ClaimTypes.Role, role));
    }

    var identity = new ClaimsIdentity(claims, "StaticWebApp");
    return new ClaimsPrincipal(identity);
}

public class ClientPrincipal
{
    public string IdentityProvider { get; set; }
    public string UserId { get; set; }
    public string UserDetails { get; set; }
    public string[] UserRoles { get; set; }
}
```

### Action Required
- [ ] Choose your authentication strategy (JWT validation in function vs. infrastructure auth)
- [ ] Implement authentication checks on ALL admin endpoints
- [ ] Test that unauthenticated requests are rejected (401)
- [ ] Test that non-manager users are rejected (403)
- [ ] Add audit logging for all admin operations

---

## 3. CSRF Token Validation (HIGH 🔴)

### Problem
Frontend now sends `X-CSRF-Token` header, but backend doesn't validate it. Attackers can still perform CSRF attacks.

### ✅ IMPLEMENTATION

```csharp
[Function("SubmitTimesheet")]
public async Task<HttpResponseData> SubmitTimesheet(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "timesheets/submit")]
    HttpRequestData req)
{
    // ✅ VALIDATE CSRF TOKEN for state-changing operations
    if (!await ValidateCsrfToken(req))
    {
        return await CreateBadRequestResponse(req, "Invalid or missing CSRF token");
    }

    // Continue with request processing...
}

private async Task<bool> ValidateCsrfToken(HttpRequestData req)
{
    // For now, just check that token exists and is non-empty
    // In production, you might validate against a stored session token
    if (!req.Headers.TryGetValues("X-CSRF-Token", out var tokens))
    {
        return false;
    }

    var token = tokens.FirstOrDefault();
    if (string.IsNullOrWhiteSpace(token))
    {
        return false;
    }

    // Token should be a valid UUID or similar format
    // You can add more validation here (e.g., check length, format)
    if (token.Length < 16) // Minimum reasonable token length
    {
        return false;
    }

    return true;
}
```

### Apply to ALL State-Changing Endpoints

```csharp
// Add CSRF validation to:
[Function("SubmitTimesheet")]     // ✅ Add CSRF check
[Function("ApproveTimesheet")]    // ✅ Add CSRF check
[Function("RejectTimesheet")]     // ✅ Add CSRF check
[Function("AddEmployee")]         // ✅ Add CSRF check
[Function("UpdateEmployee")]      // ✅ Add CSRF check
[Function("ResetPin")]            // ✅ Add CSRF check
[Function("ChangePin")]           // ✅ Add CSRF check
[Function("SyncTickets")]         // ✅ Add CSRF check
```

### Action Required
- [ ] Implement CSRF token validation on all POST/PUT/DELETE endpoints
- [ ] Test that requests without CSRF token are rejected
- [ ] Document CSRF requirement in API documentation

---

## 4. Rate Limiting on PIN Verification (HIGH 🔴)

### Problem
Users can attempt unlimited PIN guesses. With only 10,000 possible 4-digit PINs, brute force attacks are trivial.

### ✅ IMPLEMENTATION

```csharp
using System.Collections.Concurrent;

public class PinVerificationRateLimiter
{
    private static readonly ConcurrentDictionary<string, FailedAttemptInfo> _failedAttempts = new();
    private const int MAX_ATTEMPTS = 5;
    private static readonly TimeSpan LOCKOUT_DURATION = TimeSpan.FromMinutes(5);

    public class FailedAttemptInfo
    {
        public int Count { get; set; }
        public DateTime? LockoutUntil { get; set; }
        public DateTime LastAttempt { get; set; }
    }

    public static async Task<bool> IsLockedOut(string employeeId)
    {
        if (!_failedAttempts.TryGetValue(employeeId, out var info))
        {
            return false;
        }

        // Check if lockout has expired
        if (info.LockoutUntil.HasValue && DateTime.UtcNow >= info.LockoutUntil.Value)
        {
            // Reset attempts after lockout expires
            _failedAttempts.TryRemove(employeeId, out _);
            return false;
        }

        return info.LockoutUntil.HasValue && DateTime.UtcNow < info.LockoutUntil.Value;
    }

    public static async Task<int> GetRemainingAttempts(string employeeId)
    {
        if (!_failedAttempts.TryGetValue(employeeId, out var info))
        {
            return MAX_ATTEMPTS;
        }

        return Math.Max(0, MAX_ATTEMPTS - info.Count);
    }

    public static async Task RecordFailedAttempt(string employeeId)
    {
        _failedAttempts.AddOrUpdate(
            employeeId,
            new FailedAttemptInfo
            {
                Count = 1,
                LastAttempt = DateTime.UtcNow
            },
            (key, existing) =>
            {
                existing.Count++;
                existing.LastAttempt = DateTime.UtcNow;

                // Lock out if max attempts reached
                if (existing.Count >= MAX_ATTEMPTS)
                {
                    existing.LockoutUntil = DateTime.UtcNow.Add(LOCKOUT_DURATION);
                }

                return existing;
            }
        );
    }

    public static async Task ClearAttempts(string employeeId)
    {
        _failedAttempts.TryRemove(employeeId, out _);
    }
}

[Function("VerifyPin")]
public async Task<HttpResponseData> VerifyPin(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "auth/verify-pin")]
    HttpRequestData req)
{
    var payload = await req.ReadFromJsonAsync<VerifyPinRequest>();

    // ✅ CHECK RATE LIMITING
    if (await PinVerificationRateLimiter.IsLockedOut(payload.EmployeeId))
    {
        var response = req.CreateResponse(HttpStatusCode.TooManyRequests);
        await response.WriteAsJsonAsync(new
        {
            success = false,
            message = "Too many failed attempts. Account temporarily locked. Please try again in 5 minutes."
        });
        return response;
    }

    // Verify PIN against database
    var isValid = await VerifyPinAgainstDatabase(payload.EmployeeId, payload.Pin);

    if (isValid)
    {
        // ✅ CLEAR FAILED ATTEMPTS ON SUCCESS
        await PinVerificationRateLimiter.ClearAttempts(payload.EmployeeId);

        // ✅ LOG SUCCESSFUL LOGIN
        await LogAuditEvent(new AuditLog
        {
            UserId = payload.EmployeeId,
            Action = "PIN_LOGIN_SUCCESS",
            Timestamp = DateTime.UtcNow,
            IpAddress = req.Headers.GetValues("X-Forwarded-For").FirstOrDefault()
        });

        var successResponse = req.CreateResponse(HttpStatusCode.OK);
        await successResponse.WriteAsJsonAsync(new { success = true });
        return successResponse;
    }
    else
    {
        // ✅ RECORD FAILED ATTEMPT
        await PinVerificationRateLimiter.RecordFailedAttempt(payload.EmployeeId);

        var remaining = await PinVerificationRateLimiter.GetRemainingAttempts(payload.EmployeeId);

        // ✅ LOG FAILED LOGIN ATTEMPT
        await LogAuditEvent(new AuditLog
        {
            UserId = payload.EmployeeId,
            Action = "PIN_LOGIN_FAILED",
            Timestamp = DateTime.UtcNow,
            IpAddress = req.Headers.GetValues("X-Forwarded-For").FirstOrDefault(),
            Details = $"Remaining attempts: {remaining}"
        });

        var failResponse = req.CreateResponse(HttpStatusCode.Unauthorized);
        await failResponse.WriteAsJsonAsync(new
        {
            success = false,
            message = remaining > 0
                ? $"Invalid PIN. {remaining} attempt(s) remaining."
                : "Too many failed attempts. Account locked for 5 minutes."
        });
        return failResponse;
    }
}
```

### Production Note: Use Distributed Cache
For production with multiple function instances, use Azure Cache for Redis:

```csharp
using Microsoft.Extensions.Caching.Distributed;

public class PinVerificationRateLimiter
{
    private readonly IDistributedCache _cache;

    public PinVerificationRateLimiter(IDistributedCache cache)
    {
        _cache = cache;
    }

    public async Task<bool> IsLockedOut(string employeeId)
    {
        var key = $"pin_attempts:{employeeId}";
        var json = await _cache.GetStringAsync(key);

        if (string.IsNullOrEmpty(json))
            return false;

        var info = JsonSerializer.Deserialize<FailedAttemptInfo>(json);
        return info.LockoutUntil.HasValue && DateTime.UtcNow < info.LockoutUntil.Value;
    }

    // Similar pattern for other methods using IDistributedCache
}
```

### Action Required
- [ ] Implement rate limiting on PIN verification endpoint
- [ ] Test lockout after 5 failed attempts
- [ ] Verify lockout expires after 5 minutes
- [ ] For production: Use Redis distributed cache

---

## 5. Input Validation & Sanitization (HIGH 🔴)

### Problem
Backend must validate ALL user inputs server-side. Never trust client-side validation.

### ✅ IMPLEMENTATION

```csharp
using System.ComponentModel.DataAnnotations;

// Create DTOs with validation attributes
public class SubmitTimesheetRequest
{
    [Required]
    [RegularExpression(@"^\d+$", ErrorMessage = "Employee ID must be numeric")]
    public string EmployeeId { get; set; }

    [Required]
    [StringLength(4, MinimumLength = 4, ErrorMessage = "PIN must be exactly 4 digits")]
    [RegularExpression(@"^\d{4}$", ErrorMessage = "PIN must be 4 digits")]
    public string Pin { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "At least one timesheet entry required")]
    [MaxLength(100, ErrorMessage = "Maximum 100 entries per submission")]
    public List<TimesheetEntryDto> Entries { get; set; }
}

public class TimesheetEntryDto
{
    [Required]
    [RegularExpression(@"^\d+$")]
    public string EmployeeId { get; set; }

    [Required]
    [RegularExpression(@"^\d+$")]
    public string TicketId { get; set; }

    [Required]
    [DataType(DataType.Date)]
    public DateTime Date { get; set; }

    [Range(0, 24, ErrorMessage = "Hours must be between 0 and 24")]
    public decimal HoursStandard { get; set; }

    [Range(0, 24, ErrorMessage = "Hours must be between 0 and 24")]
    public decimal Hours15x { get; set; }

    [Range(0, 24, ErrorMessage = "Hours must be between 0 and 24")]
    public decimal Hours2x { get; set; }

    [StringLength(500, ErrorMessage = "Notes must be 500 characters or less")]
    public string Notes { get; set; }
}

// Validation helper
public class ValidationHelper
{
    public static (bool IsValid, List<string> Errors) ValidateModel<T>(T model)
    {
        var context = new ValidationContext(model);
        var results = new List<ValidationResult>();
        var isValid = Validator.TryValidateObject(model, context, results, true);

        var errors = results.Select(r => r.ErrorMessage).ToList();
        return (isValid, errors);
    }
}

[Function("SubmitTimesheet")]
public async Task<HttpResponseData> SubmitTimesheet(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "timesheets/submit")]
    HttpRequestData req)
{
    // ✅ PARSE AND VALIDATE REQUEST
    SubmitTimesheetRequest payload;
    try
    {
        payload = await req.ReadFromJsonAsync<SubmitTimesheetRequest>();
    }
    catch (Exception ex)
    {
        return await CreateBadRequestResponse(req, "Invalid JSON payload");
    }

    // ✅ VALIDATE MODEL
    var (isValid, errors) = ValidationHelper.ValidateModel(payload);
    if (!isValid)
    {
        return await CreateBadRequestResponse(req, $"Validation failed: {string.Join(", ", errors)}");
    }

    // ✅ BUSINESS LOGIC VALIDATION
    foreach (var entry in payload.Entries)
    {
        // Validate total hours per day
        var totalHours = entry.HoursStandard + entry.Hours15x + entry.Hours2x;
        if (totalHours > 24)
        {
            return await CreateBadRequestResponse(req,
                $"Total hours ({totalHours}) cannot exceed 24 hours per day");
        }

        // Validate date not in future
        if (entry.Date > DateTime.UtcNow.Date)
        {
            return await CreateBadRequestResponse(req,
                "Cannot submit timesheet entries for future dates");
        }

        // Validate date not too old (e.g., more than 90 days)
        if (entry.Date < DateTime.UtcNow.Date.AddDays(-90))
        {
            return await CreateBadRequestResponse(req,
                "Cannot submit timesheet entries older than 90 days");
        }

        // Sanitize notes to prevent XSS (although frontend should already handle this)
        entry.Notes = SanitizeHtmlInput(entry.Notes);
    }

    // ✅ VERIFY PIN BEFORE PROCESSING
    var isPinValid = await VerifyPinAgainstDatabase(payload.EmployeeId, payload.Pin);
    if (!isPinValid)
    {
        return await CreateUnauthorizedResponse(req, "Invalid PIN");
    }

    // Process timesheet submission...
}

// HTML Sanitization helper
private string SanitizeHtmlInput(string input)
{
    if (string.IsNullOrEmpty(input))
        return input;

    // Use HtmlEncoder to sanitize
    return System.Net.WebUtility.HtmlEncode(input);
}
```

### Validation for Employee Updates

```csharp
public class UpdateEmployeeRequest
{
    [Required]
    [StringLength(100, ErrorMessage = "First name must be 100 characters or less")]
    public string FirstName { get; set; }

    [Required]
    [StringLength(100, ErrorMessage = "Last name must be 100 characters or less")]
    public string LastName { get; set; }

    [Required]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    [StringLength(255)]
    public string Email { get; set; }

    [Required]
    [RegularExpression(@"^(Casual|FTE|Contractor)$", ErrorMessage = "Invalid employee type")]
    public string Type { get; set; }

    public bool Active { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "Manager ID must be a positive number")]
    public int? ManagerEmployeeId { get; set; }

    [Range(1, int.MaxValue, ErrorMessage = "CW Member ID must be a positive number")]
    public int? CwMemberId { get; set; }
}
```

### Action Required
- [ ] Create DTO classes with validation attributes for ALL endpoints
- [ ] Implement server-side validation on all inputs
- [ ] Sanitize HTML in text fields
- [ ] Add business logic validation (date ranges, hour limits, etc.)
- [ ] Return clear error messages for validation failures

---

## 6. Security Response Headers (MEDIUM 🟡)

### Problem
Backend should return security headers to help prevent attacks.

### ✅ IMPLEMENTATION

```csharp
// Create a middleware or helper to add security headers
public static class SecurityHeaders
{
    public static async Task<HttpResponseData> AddSecurityHeaders(HttpResponseData response)
    {
        // Prevent MIME type sniffing
        response.Headers.Add("X-Content-Type-Options", "nosniff");

        // Prevent clickjacking
        response.Headers.Add("X-Frame-Options", "DENY");

        // Prevent XSS in older browsers
        response.Headers.Add("X-XSS-Protection", "1; mode=block");

        // Force HTTPS
        response.Headers.Add("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

        // Referrer policy
        response.Headers.Add("Referrer-Policy", "strict-origin-when-cross-origin");

        // Permissions policy
        response.Headers.Add("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

        return response;
    }
}

// Use in every function response
[Function("GetEmployees")]
public async Task<HttpResponseData> GetEmployees(
    [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "employees")]
    HttpRequestData req)
{
    var employees = await GetEmployeesFromDatabase();

    var response = req.CreateResponse(HttpStatusCode.OK);
    await response.WriteAsJsonAsync(employees);

    // ✅ ADD SECURITY HEADERS
    response = await SecurityHeaders.AddSecurityHeaders(response);

    return response;
}
```

### Alternative: Use Middleware (Azure Functions v4+)

```csharp
public class SecurityHeadersMiddleware : IFunctionsWorkerMiddleware
{
    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        await next(context);

        var response = context.GetHttpResponseData();
        if (response != null)
        {
            response.Headers.Add("X-Content-Type-Options", "nosniff");
            response.Headers.Add("X-Frame-Options", "DENY");
            response.Headers.Add("X-XSS-Protection", "1; mode=block");
            response.Headers.Add("Strict-Transport-Security", "max-age=31536000");
        }
    }
}

// Register in Program.cs or Startup.cs
builder.Services.AddSingleton<IFunctionsWorkerMiddleware, SecurityHeadersMiddleware>();
```

### Action Required
- [ ] Add security headers to all HTTP responses
- [ ] Test headers are present in responses
- [ ] Configure HSTS properly (only in production/HTTPS)

---

## 7. Audit Logging (MEDIUM 🟡)

### Problem
No audit trail exists for security-sensitive operations. You need to log who did what and when.

### ✅ IMPLEMENTATION

```csharp
public class AuditLog
{
    public string UserId { get; set; }
    public string UserName { get; set; }
    public string Action { get; set; }
    public string ResourceId { get; set; }
    public DateTime Timestamp { get; set; }
    public string IpAddress { get; set; }
    public bool Success { get; set; }
    public string Details { get; set; }
    public string ErrorMessage { get; set; }
}

public class AuditLogger
{
    private readonly ILogger _logger;
    private readonly YourDbContext _context;

    public AuditLogger(ILogger logger, YourDbContext context)
    {
        _logger = logger;
        _context = context;
    }

    public async Task LogEvent(AuditLog auditLog)
    {
        // Log to Application Insights / Azure Monitor
        _logger.LogInformation(
            "AUDIT: User {UserId} performed {Action} on {ResourceId} at {Timestamp}. Success: {Success}",
            auditLog.UserId,
            auditLog.Action,
            auditLog.ResourceId,
            auditLog.Timestamp,
            auditLog.Success
        );

        // ALSO persist to database for long-term audit trail
        try
        {
            var dbLog = new AuditLogEntry
            {
                UserId = auditLog.UserId,
                UserName = auditLog.UserName,
                Action = auditLog.Action,
                ResourceId = auditLog.ResourceId,
                Timestamp = auditLog.Timestamp,
                IpAddress = auditLog.IpAddress,
                Success = auditLog.Success,
                Details = auditLog.Details,
                ErrorMessage = auditLog.ErrorMessage
            };

            _context.AuditLogs.Add(dbLog);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to persist audit log to database");
        }
    }
}

// Use in functions
[Function("ApproveTimesheet")]
public async Task<HttpResponseData> ApproveTimesheet(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "timesheets/approve/{entryId}")]
    HttpRequestData req,
    string entryId)
{
    var principal = await ValidateTokenAndGetUser(req);
    var userId = principal?.FindFirst("oid")?.Value;
    var userName = principal?.Identity?.Name;

    try
    {
        // Perform approval
        await ApproveTimesheetEntry(entryId);

        // ✅ LOG SUCCESS
        await _auditLogger.LogEvent(new AuditLog
        {
            UserId = userId,
            UserName = userName,
            Action = "APPROVE_TIMESHEET",
            ResourceId = entryId,
            Timestamp = DateTime.UtcNow,
            IpAddress = req.Headers.GetValues("X-Forwarded-For").FirstOrDefault(),
            Success = true
        });

        return await CreateSuccessResponse(req);
    }
    catch (Exception ex)
    {
        // ✅ LOG FAILURE
        await _auditLogger.LogEvent(new AuditLog
        {
            UserId = userId,
            UserName = userName,
            Action = "APPROVE_TIMESHEET",
            ResourceId = entryId,
            Timestamp = DateTime.UtcNow,
            IpAddress = req.Headers.GetValues("X-Forwarded-For").FirstOrDefault(),
            Success = false,
            ErrorMessage = ex.Message
        });

        throw;
    }
}
```

### Events to Audit

Log these security-sensitive events:

```
✅ PIN_LOGIN_SUCCESS - Employee logs in with PIN
✅ PIN_LOGIN_FAILED - Failed PIN attempt
✅ PIN_CHANGED - Employee changes PIN
✅ PIN_RESET - Manager resets employee PIN
✅ APPROVE_TIMESHEET - Manager approves timesheet
✅ REJECT_TIMESHEET - Manager rejects timesheet
✅ EMPLOYEE_CREATED - New employee added
✅ EMPLOYEE_UPDATED - Employee record modified
✅ EMPLOYEE_DELETED - Employee deleted
✅ SYNC_TICKETS - Tickets synced from ConnectWise
✅ TIMESHEET_SUBMITTED - Employee submits timesheet
```

### Create AuditLogs table in database

```sql
CREATE TABLE AuditLogs (
    audit_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id NVARCHAR(100),
    user_name NVARCHAR(255),
    action NVARCHAR(50) NOT NULL,
    resource_id NVARCHAR(50),
    timestamp DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    ip_address NVARCHAR(45),
    success BIT NOT NULL,
    details NVARCHAR(MAX),
    error_message NVARCHAR(MAX),
    INDEX IX_AuditLogs_UserId (user_id),
    INDEX IX_AuditLogs_Action (action),
    INDEX IX_AuditLogs_Timestamp (timestamp)
);
```

### Action Required
- [ ] Create AuditLogs database table
- [ ] Implement AuditLogger service
- [ ] Add audit logging to all security-sensitive operations
- [ ] Set up Azure Monitor alerts for suspicious activity

---

## 8. Additional Security Best Practices

### Hash and Salt PINs in Database

```csharp
using System.Security.Cryptography;

public class PinHasher
{
    private const int SaltSize = 16;
    private const int HashSize = 32;
    private const int Iterations = 10000;

    public static string HashPin(string pin)
    {
        // Generate salt
        var salt = new byte[SaltSize];
        using (var rng = RandomNumberGenerator.Create())
        {
            rng.GetBytes(salt);
        }

        // Hash PIN with salt
        var hash = HashPinWithSalt(pin, salt);

        // Combine salt and hash
        var combined = new byte[SaltSize + HashSize];
        Array.Copy(salt, 0, combined, 0, SaltSize);
        Array.Copy(hash, 0, combined, SaltSize, HashSize);

        return Convert.ToBase64String(combined);
    }

    public static bool VerifyPin(string pin, string hashedPin)
    {
        // Decode stored hash
        var combined = Convert.FromBase64String(hashedPin);

        // Extract salt and hash
        var salt = new byte[SaltSize];
        var storedHash = new byte[HashSize];
        Array.Copy(combined, 0, salt, 0, SaltSize);
        Array.Copy(combined, SaltSize, storedHash, 0, HashSize);

        // Hash input PIN with same salt
        var inputHash = HashPinWithSalt(pin, salt);

        // Compare hashes (constant-time comparison)
        return CryptographicOperations.FixedTimeEquals(storedHash, inputHash);
    }

    private static byte[] HashPinWithSalt(string pin, byte[] salt)
    {
        using var pbkdf2 = new Rfc2898DeriveBytes(pin, salt, Iterations, HashAlgorithmName.SHA256);
        return pbkdf2.GetBytes(HashSize);
    }
}

// Usage in database
// Store: hashed_pin = PinHasher.HashPin(pin)
// Verify: bool isValid = PinHasher.VerifyPin(inputPin, storedHashedPin)
```

**Important:** Update your database schema:
- Add column `pin_hash NVARCHAR(100)`
- Remove or deprecate any plain-text PIN storage
- Migrate existing PINs to hashed format

### Implement Token-Based Session Management

Replace PIN-in-every-request with JWT tokens:

```csharp
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;

[Function("VerifyPin")]
public async Task<HttpResponseData> VerifyPin(...)
{
    // After PIN verification succeeds...
    var isValid = PinHasher.VerifyPin(payload.Pin, employee.PinHash);

    if (isValid)
    {
        // ✅ ISSUE JWT TOKEN instead of returning success
        var token = GenerateJwtToken(employee.EmployeeId, employee.FirstName, employee.LastName);

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new
        {
            success = true,
            token = token,
            expiresAt = DateTime.UtcNow.AddHours(8)
        });

        return response;
    }
}

private string GenerateJwtToken(string employeeId, string firstName, string lastName)
{
    var tokenHandler = new JwtSecurityTokenHandler();
    var key = Encoding.UTF8.GetBytes(_jwtSecretKey); // Store in Azure Key Vault!

    var tokenDescriptor = new SecurityTokenDescriptor
    {
        Subject = new ClaimsIdentity(new[]
        {
            new Claim("employee_id", employeeId),
            new Claim("name", $"{firstName} {lastName}"),
            new Claim("role", "Employee")
        }),
        Expires = DateTime.UtcNow.AddHours(8),
        SigningCredentials = new SigningCredentials(
            new SymmetricSecurityKey(key),
            SecurityAlgorithms.HmacSha256Signature
        ),
        Issuer = "TimesheetApp",
        Audience = "TimesheetApp"
    };

    var token = tokenHandler.CreateToken(tokenDescriptor);
    return tokenHandler.WriteToken(token);
}
```

Then validate JWT on subsequent requests:

```csharp
[Function("SubmitTimesheet")]
public async Task<HttpResponseData> SubmitTimesheet(...)
{
    // ✅ VALIDATE JWT TOKEN instead of PIN
    var principal = await ValidateJwtToken(req);
    if (principal == null)
    {
        return await CreateUnauthorizedResponse(req, "Invalid or expired session token");
    }

    var employeeId = principal.FindFirst("employee_id")?.Value;
    // Process timesheet...
}
```

---

## Testing Checklist

### SQL Injection Testing
- [ ] Test with payload: `'; DROP TABLE Employees--`
- [ ] Test with payload: `1' OR '1'='1`
- [ ] Verify all queries use parameterized queries

### Authentication Testing
- [ ] Test admin endpoints without authentication (should fail with 401)
- [ ] Test admin endpoints as non-manager user (should fail with 403)
- [ ] Test admin endpoints as manager (should succeed)

### CSRF Testing
- [ ] Test POST request without CSRF token (should fail)
- [ ] Test POST request with invalid CSRF token (should fail)
- [ ] Test POST request with valid CSRF token (should succeed)

### Rate Limiting Testing
- [ ] Attempt 5 failed PIN logins (should lock account)
- [ ] Verify lockout message is displayed
- [ ] Wait 5 minutes and verify account is unlocked

### Input Validation Testing
- [ ] Submit timesheet with notes > 500 chars (should fail)
- [ ] Submit timesheet with hours > 24 (should fail)
- [ ] Submit timesheet with negative hours (should fail)
- [ ] Submit timesheet with XSS payload in notes (should be sanitized)

### Security Headers Testing
```bash
curl -I https://your-function-app.azurewebsites.net/api/employees
# Should see:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Strict-Transport-Security: max-age=31536000
```

---

## Priority Implementation Order

### Week 1 (CRITICAL)
1. ✅ SQL Injection Prevention - Audit all queries
2. ✅ Authentication on Admin Endpoints - Add Entra ID checks
3. ✅ PIN Hashing - Hash all PINs in database

### Week 2 (HIGH)
4. ✅ Rate Limiting - Implement on PIN verification
5. ✅ Input Validation - Add validation to all endpoints
6. ✅ CSRF Validation - Check X-CSRF-Token header

### Week 3 (MEDIUM)
7. ✅ Audit Logging - Log security events
8. ✅ Security Headers - Add to all responses
9. ✅ JWT Token Sessions - Replace PIN-in-every-request

---

## Contact & Questions

If you have questions about any of these implementations, please reach out to the security team or the frontend developer who prepared this document.

**Remember:** Security is not optional. These fixes must be implemented before going to production.
