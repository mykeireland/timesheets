using System;
using System.IO;
using System.Threading.Tasks;
using System.Data.SqlClient;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace Timesheets.Functions
{
    public static class RejectTimesheet
    {
        [FunctionName("RejectTimesheet")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = "timesheets/reject")] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("Processing timesheet rejection...");

            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            dynamic data = JsonConvert.DeserializeObject(requestBody);

            string ticketId = data?.ticketId;
            string date = data?.date;
            string firstName = data?.firstName;
            string lastName = data?.lastName;
            string reason = data?.reason ?? "No reason provided";

            string? connectionString = Environment.GetEnvironmentVariable("SqlConnectionString");
            if (string.IsNullOrEmpty(connectionString))
                throw new InvalidOperationException("SqlConnectionString not configured.");

            using (SqlConnection conn = new SqlConnection(connectionString))
            {
                await conn.OpenAsync();

                string query = @"
                    UPDATE te
                    SET te.status = 'rejected'
                    FROM dbo.TimesheetEntry te
                    INNER JOIN dbo.Employee e ON te.employee_id = e.employee_id
                    INNER JOIN dbo.Ticket t ON te.ticket_id = t.ticket_id
                    WHERE e.first_name = @FirstName AND e.last_name = @LastName
                    AND t.cw_ticket_id = @TicketId AND te.date = @Date;
                ";

                using (SqlCommand cmd = new SqlCommand(query, conn))
                {
                    cmd.Parameters.AddWithValue("@FirstName", firstName);
                    cmd.Parameters.AddWithValue("@LastName", lastName);
                    cmd.Parameters.AddWithValue("@TicketId", ticketId);
                    cmd.Parameters.AddWithValue("@Date", date);
                    int rows = await cmd.ExecuteNonQueryAsync();
                    return new OkObjectResult(new { Updated = rows, Reason = reason });
                }
            }
        }
    }
}
