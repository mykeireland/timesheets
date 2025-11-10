using System;
using System.Collections.Generic;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace Timesheets.Functions
{
    public class GetPinStatus
    {
        private readonly ILogger _logger;

        public GetPinStatus(ILoggerFactory loggerFactory) =>
            _logger = loggerFactory.CreateLogger<GetPinStatus>();

        public record PinStatusInfo(
            int EmployeeId,
            bool HasPin,
            DateTime? LastUpdated
        );

        [Function("GetPinStatus")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "admin/pin-status")] HttpRequestData req)
        {
            _logger.LogInformation("Processing PIN status request...");

            var cs = Environment.GetEnvironmentVariable("SqlDbConnection");
            if (string.IsNullOrWhiteSpace(cs))
            {
                return await ApiResponse.Fail(req, HttpStatusCode.InternalServerError, "SqlDbConnection not configured.", _logger);
            }

            try
            {
                await using var conn = new SqlConnection(cs);
                await conn.OpenAsync();

                // Get PIN status for all employees
                const string query = @"
                    SELECT
                        e.employee_id,
                        CASE WHEN pc.user_id IS NOT NULL THEN 1 ELSE 0 END AS has_pin,
                        pc.updated_utc
                    FROM dbo.Employee e
                    LEFT JOIN dbo.PinCredential pc ON e.employee_id = pc.user_id
                    ORDER BY e.employee_id";

                await using var cmd = new SqlCommand(query, conn);
                await using var reader = await cmd.ExecuteReaderAsync();

                var pinStatuses = new List<PinStatusInfo>();

                while (await reader.ReadAsync())
                {
                    pinStatuses.Add(new PinStatusInfo(
                        EmployeeId: reader.GetInt32(0),
                        HasPin: reader.GetInt32(1) == 1,
                        LastUpdated: reader.IsDBNull(2) ? null : reader.GetDateTime(2)
                    ));
                }

                _logger.LogInformation("Retrieved PIN status for {Count} employees", pinStatuses.Count);

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    data = pinStatuses
                }, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                });

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving PIN status");
                var err = req.CreateResponse(HttpStatusCode.InternalServerError);
                await err.WriteAsJsonAsync(new { success = false, message = "An error occurred while retrieving PIN status." });
                return err;
            }
        }
    }
}
