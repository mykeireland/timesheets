# PIN Authentication System

## Overview

This system adds secure PIN-based authentication for employee time entry. When an employee is selected from the dropdown, they must enter their 4-digit PIN before they can add time entries.

## Components

### Backend
- **VerifyPin.cs**: Azure Function that verifies PIN credentials
  - Endpoint: `POST /api/auth/verify-pin`
  - Uses SHA-256 hashing with unique salts for each employee
  - Implements constant-time comparison to prevent timing attacks

### Frontend
- **index.html**: PIN modal dialog
- **script.js**: PIN authentication logic and UI handling
- **style.css**: Modal styling with animations

### Database
- **PinCredential Table**: Stores hashed PINs and salts
  - `user_id`: Employee ID (foreign key to Employee table)
  - `pin_hash`: SHA-256 hash of PIN + salt
  - `salt`: Unique random salt for each employee
  - `updated_utc`: Last update timestamp

## Setup Instructions

### 1. Deploy Backend Function

Deploy the `VerifyPin.cs` Azure Function to your Azure Functions app:

```bash
# Ensure VerifyPin.cs is in your Azure Functions project
# Deploy using Azure CLI or Visual Studio
```

### 2. Initialize Default PINs

Run the provided SQL script to set up default PINs (0000) for all active employees:

```sql
-- Execute setup-default-pins.sql against your Azure SQL database
-- This will populate the PinCredential table with default PIN "0000"
```

**⚠️ IMPORTANT SECURITY NOTE:**
- The default PIN "0000" should be changed by each employee immediately
- Consider implementing a "force PIN change on first login" feature
- Regularly audit and rotate PINs

### 3. Deploy Frontend

The frontend changes are automatically deployed via Azure Static Web Apps when pushed to the repository.

## Usage

### For Employees

1. Open the Time Entry page
2. Select your name from the "Employee" dropdown
3. A PIN entry modal will appear
4. Enter your 4-digit PIN
5. Click "Verify PIN" or press Enter
6. If correct, the modal closes and you can proceed with time entry
7. The employee dropdown will show a green border when authenticated

### PIN Entry Features

- **Auto-focus**: PIN input field is automatically focused
- **Numeric-only**: Only numbers 0-9 are accepted
- **4-digit limit**: Maximum 4 digits
- **Enter key support**: Press Enter to submit
- **Cancel option**: Click Cancel to change employee selection
- **Visual feedback**: Green border indicates authenticated employee
- **Error messages**: Clear feedback for invalid PINs

### Security Features

1. **Hashed Storage**: PINs are never stored in plain text
2. **Unique Salts**: Each employee has a unique salt for their PIN hash
3. **Constant-Time Comparison**: Prevents timing attacks
4. **Client-Side Validation**: Basic validation before API call
5. **Session State**: Authentication persists until employee changes or page reloads
6. **No Bypass**: Time entries cannot be added without valid PIN

## API Endpoint

### POST /api/auth/verify-pin

**Request Body:**
```json
{
  "employeeId": "123",
  "pin": "0000"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "PIN verified successfully"
}
```

**Error Responses:**

**401 Unauthorized** - Invalid PIN:
```json
{
  "success": false,
  "message": "Invalid PIN"
}
```

**401 Unauthorized** - No PIN set:
```json
{
  "success": false,
  "message": "No PIN set for this employee. Please contact your administrator."
}
```

**400 Bad Request** - Missing data:
```json
{
  "success": false,
  "message": "Employee ID and PIN are required"
}
```

## Future Enhancements

Consider implementing:

1. **PIN Change Functionality**: Allow employees to change their own PIN
2. **Admin PIN Reset**: Allow managers to reset employee PINs
3. **PIN Complexity Rules**: Enforce stronger PINs (no sequential, no repeated digits)
4. **Failed Attempt Lockout**: Lock account after X failed attempts
5. **PIN Expiration**: Force PIN changes every X days
6. **Audit Logging**: Log all PIN verification attempts
7. **Two-Factor Authentication**: Add additional security layer

## Troubleshooting

### PIN Not Working

1. Verify the employee has a record in the PinCredential table
2. Check that the Azure Function is deployed and running
3. Verify the API_BASE URL in config.js is correct
4. Check browser console for error messages

### Modal Not Appearing

1. Check that the modal HTML is present in index.html
2. Verify CSS is loaded correctly
3. Check for JavaScript errors in browser console

### Authentication State Lost

- Authentication is session-based (in-memory only)
- Refreshing the page will require re-authentication
- This is by design for security

## Database Schema

```sql
CREATE TABLE dbo.PinCredential (
    user_id INT NOT NULL,
    pin_hash VARBINARY(MAX) NOT NULL,
    salt VARBINARY(MAX) NOT NULL,
    updated_utc DATETIME2 NOT NULL,
    CONSTRAINT PK_PinCredential PRIMARY KEY (user_id),
    CONSTRAINT FK_PinCredential_Employee FOREIGN KEY (user_id)
        REFERENCES dbo.Employee(employee_id)
);
```

## Security Best Practices

1. **Never log PINs**: Ensure PINs are never written to logs
2. **Use HTTPS**: Always use HTTPS in production
3. **Regular audits**: Review failed authentication attempts
4. **Employee training**: Educate employees on PIN security
5. **Secure defaults**: Consider requiring PIN change from default on first use
