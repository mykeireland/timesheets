-- =====================================================
-- SQL Script to populate PinCredential table with default PIN "0000"
-- =====================================================
-- This script will:
-- 1. Clear existing PIN credentials
-- 2. Generate a unique salt for each employee
-- 3. Hash the default PIN "0000" with each salt
-- 4. Insert records into PinCredential table
-- =====================================================

-- Clear existing PIN credentials
TRUNCATE TABLE dbo.PinCredential;

-- Insert default PIN "0000" for all active employees
-- Using CRYPT_GEN_RANDOM for cryptographically secure salt generation
-- Using HASHBYTES for SHA-256 hashing
-- Note: We use a CTE to generate the salt first, then use it for hashing
WITH EmployeeSalts AS (
    SELECT
        e.employee_id,
        CRYPT_GEN_RANDOM(16) AS salt
    FROM dbo.Employee e
    WHERE e.active = 1
)
INSERT INTO dbo.PinCredential (user_id, pin_hash, salt, updated_utc)
SELECT
    es.employee_id,
    HASHBYTES('SHA2_256', CONCAT(CAST('0000' AS VARBINARY(MAX)), es.salt)), -- Hash PIN + salt
    es.salt,
    GETUTCDATE()
FROM EmployeeSalts es;

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
