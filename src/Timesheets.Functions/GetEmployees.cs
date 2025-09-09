using System;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Net;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Azure.Core;
using Azure.Identity;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

public class GetEmployees
{
    private readonly ILogger _logger;

    public GetEmployees(ILoggerFactory loggerFactory)
    {
        _logger = loggerFactory.CreateLogger<GetEmployees>();
    }

    [Function("GetEmployees")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "employees")] HttpRequestData req)
    {
        var ct = req.FunctionContext.CancellationToken;
        var response = req.CreateResponse(HttpStatusCode.OK);
        response.Headers.Add("Content-Type", "application/json");

        var employees = new List<object>();

        try
        {
            // Acquire AAD token for Azure SQL using Managed Identity (or chained Default creds).
            var credential = new DefaultAzureCredential();
            var accessToken = await credential.GetTokenAsync(
                new TokenRequestContext(new[] { "https://database.windows.net/.default" }),
                ct);

            var connectionString = Environment.GetEnvironmentVariable("SqlConnectionString");
            if (string.IsNullOrWhiteSpace(connectionString))
            {
                _logger.LogError("SqlConnectionString is not set.");
                response.StatusCode = HttpStatusCode.InternalServerError;
                await response.WriteStringAsync("{\"error\":\"Server not configured\"}");
                return response;
            }

            await using var connection = new SqlConnection
            {
                ConnectionString = connectionString,
                AccessToken = accessToken.Token
            };

            await connection.OpenAsync(ct);

            const string sql = @"
                SELECT employee_id, first_name, last_name
                FROM Employee
                WHERE active = 1";

            await using var command = new SqlCommand(sql, connection);
            await using var reader = await command.ExecuteReaderAsync(ct);

            while (await reader.ReadAsync(ct))
            {
                var id = reader["employee_id"]?.ToString() ?? "";
                var first = reader["first_name"]?.ToString() ?? "";
                var last = reader["last_name"]?.ToString() ?? "";

                employees.Add(new
                {
                    id,
                    name = $"{first} {last}".Trim()
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch employees.");
            response.StatusCode = HttpStatusCode.InternalServerError;
            await response.WriteStringAsync("{\"error\":\"Could not load employees\"}");
            return response;
        }

        await response.WriteStringAsync(JsonSerializer.Serialize(employees));
        return response;
    }
}
