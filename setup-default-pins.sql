-- =====================================================
-- SQL Script to populate PinCredential table with default PIN "0000"
-- =====================================================
-- This script will:
-- 1. Update existing PIN credentials OR insert new ones
-- 2. Generate a unique salt for each employee
-- 3. Hash the default PIN "0000" with each salt
-- 4. Works with existing PinCredential table
-- =====================================================

-- OPTION 1: Clear all existing PIN credentials first (CAUTION: Deletes all PINs)
-- Uncomment the next line if you want to reset ALL employee PINs
-- DELETE FROM dbo.PinCredential;

-- OPTION 2: Use MERGE to update existing and insert new (Recommended)
-- This preserves the table and handles both updates and inserts
WITH EmployeeSalts AS (
    SELECT
        e.employee_id,
        CRYPT_GEN_RANDOM(16) AS salt
    FROM dbo.Employee e
    WHERE e.active = 1
)
MERGE dbo.PinCredential AS target
USING EmployeeSalts AS source
ON target.user_id = source.employee_id
WHEN MATCHED THEN
    UPDATE SET
        pin_hash = HASHBYTES('SHA2_256', CONCAT(CAST('0000' AS VARBINARY(MAX)), source.salt)),
        salt = source.salt,
        updated_utc = GETUTCDATE()
WHEN NOT MATCHED BY TARGET THEN
    INSERT (user_id, pin_hash, salt, updated_utc)
    VALUES (
        source.employee_id,
        HASHBYTES('SHA2_256', CONCAT(CAST('0000' AS VARBINARY(MAX)), source.salt)),
        source.salt,
        GETUTCDATE()
    );

-- Verify the results
SELECT
    pc.user_id,
    e.first_name,
    e.last_name,
    e.email,
    pc.updated_utc
FROM dbo.PinCredential pc
INNER JOIN dbo.Employee e ON pc.user_id = e.employee_id
ORDER BY e.last_name, e.first_name;

-- Display count of employees with PINs
SELECT COUNT(*) AS 'Total Employees with Default PIN'
FROM dbo.PinCredential;

PRINT '✅ Default PIN "0000" has been set for all active employees';
PRINT '⚠️  IMPORTANT: Employees should change their PIN from the default as soon as possible';
