# Change PIN Backend API Endpoint

## Required Backend Endpoint

The frontend PIN change functionality requires a new backend Azure Function:

### POST /api/auth/change-pin

**Purpose:** Allow authenticated employees to change their PIN from the default to a unique personal PIN.

**Request Body:**
```json
{
  "employeeId": 123,
  "currentPin": "0000",
  "newPin": "1234"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "PIN changed successfully"
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "success": false,
  "message": "Employee ID, current PIN, and new PIN are required"
}
```

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "Current PIN is incorrect"
}
```

## Implementation Notes

The backend function should:

1. **Validate input:**
   - All fields required (employeeId, currentPin, newPin)
   - newPin must be 4 digits
   - newPin cannot be "0000" (prevent setting back to default)

2. **Verify current PIN:**
   - Query PinCredential table for user_id = employeeId
   - Hash currentPin with stored salt
   - Compare hashes (constant-time comparison)
   - Return 401 if current PIN doesn't match

3. **Update PIN:**
   - Generate NEW salt (important for security)
   - Hash newPin with new salt
   - Update PinCredential table:
     - pin_hash = new hash
     - salt = new salt
     - updated_utc = GETUTCDATE()

4. **Return success**

## Example C# Implementation Structure

```csharp
[Function("ChangePin")]
public async Task<HttpResponseData> Run(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "auth/change-pin")] HttpRequestData req)
{
    // 1. Parse request body
    var payload = await JsonSerializer.DeserializeAsync<ChangePinRequest>(req.Body);

    // 2. Validate input
    if (string.IsNullOrEmpty(payload.employeeId) ||
        string.IsNullOrEmpty(payload.currentPin) ||
        string.IsNullOrEmpty(payload.newPin))
    {
        return await ApiResponse.Fail(req, HttpStatusCode.BadRequest,
            "Employee ID, current PIN, and new PIN are required");
    }

    if (payload.newPin == "0000")
    {
        return await ApiResponse.Fail(req, HttpStatusCode.BadRequest,
            "New PIN cannot be the default value");
    }

    // 3. Verify current PIN
    // Query PinCredential for employee
    // Hash currentPin with stored salt
    // Compare with stored pin_hash
    // Return 401 if mismatch

    // 4. Generate new salt and hash
    byte[] newSalt = GenerateSalt();
    byte[] newPinHash = HashPin(payload.newPin, newSalt);

    // 5. Update PinCredential
    // UPDATE dbo.PinCredential
    // SET pin_hash = @NewPinHash, salt = @NewSalt, updated_utc = GETUTCDATE()
    // WHERE user_id = @EmployeeId

    // 6. Return success
    return await ApiResponse.Success(req, "PIN changed successfully");
}
```

## Security Considerations

- **Always generate a new salt** when changing PIN (don't reuse old salt)
- **Verify current PIN** before allowing change
- **Prevent setting PIN to "0000"** (defeats security purpose)
- **Use constant-time comparison** for PIN verification
- **Log PIN change events** for audit trail
- **Rate limit** this endpoint to prevent brute force attacks

## Frontend Workflow

1. Employee logs in with "0000"
2. Frontend detects default PIN
3. Shows "Force Change PIN" modal
4. Employee enters new unique PIN
5. Frontend calls `/auth/change-pin`
6. Backend verifies and updates
7. Employee proceeds with new PIN

## Testing

Test cases:
- ✅ Valid PIN change (0000 → 1234)
- ❌ Invalid current PIN
- ❌ New PIN = "0000" (should reject)
- ❌ New PIN not 4 digits
- ❌ Missing fields
- ❌ Employee not found
