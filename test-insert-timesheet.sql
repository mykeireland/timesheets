-- Test SQL script to manually insert a timesheet entry
-- This will help diagnose if the issue is with the database schema or the backend code

-- First, let's check if the employee exists
SELECT employee_id, first_name, last_name
FROM dbo.Employee
WHERE employee_id = 4;

-- Check if the ticket exists
SELECT ticket_id, cw_ticket_id, summary
FROM dbo.Ticket
WHERE cw_ticket_id = 252688;

-- Now let's try to insert a test timesheet entry
-- Using the data from your example: Matthew Bullock, ticket 252688, 2025-11-03, 5 hours standard

INSERT INTO dbo.TimesheetEntry (
    employee_id,
    ticket_id,
    date,
    hours_standard,
    hours_15x,
    hours_2x,
    notes,
    status
)
VALUES (
    4,                              -- employee_id (Matthew Bullock)
    (SELECT ticket_id FROM dbo.Ticket WHERE cw_ticket_id = 252688),  -- Get the internal ticket_id from cw_ticket_id
    '2025-11-03',                   -- date
    5.0,                            -- hours_standard
    0.0,                            -- hours_15x
    0.0,                            -- hours_2x
    '',                             -- notes
    'pending'                       -- status (default to pending)
);

-- Verify the insert
SELECT TOP 1
    te.timesheet_entry_id,
    e.first_name + ' ' + e.last_name as employee_name,
    t.cw_ticket_id,
    t.summary as ticket_name,
    te.date,
    te.hours_standard,
    te.hours_15x,
    te.hours_2x,
    te.notes,
    te.status
FROM dbo.TimesheetEntry te
INNER JOIN dbo.Employee e ON te.employee_id = e.employee_id
INNER JOIN dbo.Ticket t ON te.ticket_id = t.ticket_id
WHERE e.employee_id = 4
  AND t.cw_ticket_id = 252688
  AND te.date = '2025-11-03'
ORDER BY te.timesheet_entry_id DESC;
