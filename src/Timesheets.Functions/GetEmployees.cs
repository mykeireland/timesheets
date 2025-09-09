using System.Data.SqlClient;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.Text.Json;

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
        var response = req.CreateResponse();
        response.Headers.Add("Content-Type", "application/json");

        var employees = new List<object>();

        try
        {
            var connection = new SqlConnection
            {
                // Use AAD auth with managed identity
                ConnectionString = Environment.GetEnvironmentVariable("SqlConnectionString"),
                AccessToken = await new Azure.Identity.DefaultAzureCredential()
                    .GetTokenAsync(new Azure.Core.TokenRequestContext(
                        new[] { "https://database.windows.net/.default" }))
                    .ContinueWith(t => t.Result.Token)
            };

            await connection.OpenAsync();

            var command = new SqlCommand("SELECT employee_id, first_name, last_name FROM Employee WHERE active = 1", connection);
            var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                employees.Add(new
                {
                    id = reader["employee_id"].ToString(),
                    name = $"{reader["first_name"]} {reader["last_name"]}"
                });
            }

            await connection.CloseAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError($"Failed to fetch employees: {ex.Message}");
            response.StatusCode = System.Net.HttpStatusCode.InternalServerError;
            await response.WriteStringAsync("{\"error\":\"Could not load employees\"}");
            return response;
        }

        await response.WriteStringAsync(JsonSerializer.Serialize(employees));
        return response;
    }
}
