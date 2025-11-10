using System;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace Timesheets.Functions
{
    public class ResetPin
    {
        private readonly ILogger _logger;

        public ResetPin(ILoggerFactory loggerFactory) =>
            _logger = loggerFactory.CreateLogger<ResetPin>();

        private record ResetPinRequest(string? employeeId, string? newPin);

        [Function("ResetPin")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "admin/reset-pin")] HttpRequestData req)
        {
            _logger.LogInformation("Processing PIN reset request...");

            var cs = Environment.GetEnvironmentVariable("SqlDbConnection");
            if (string.IsNullOrWhiteSpace(cs))
            {
                return await ApiResponse.Fail(req, HttpStatusCode.InternalServerError, "SqlDbConnection not configured.", _logger);
            }

            ResetPinRequest? payload;
            try
            {
                var body = await req.ReadAsStringAsync();
                if (string.IsNullOrWhiteSpace(body))
                    throw new Exception("Empty request body.");

                payload = JsonSerializer.Deserialize<ResetPinRequest>(body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (payload == null)
                    throw new Exception("Invalid payload.");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Invalid payload for ResetPin.");
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { success = false, message = "Invalid request payload." });
                return bad;
            }

            // Validate employee ID
            if (string.IsNullOrWhiteSpace(payload.employeeId))
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { success = false, message = "Employee ID is required" });
                return bad;
            }

            // Default to "0000" if no PIN specified
            string newPin = string.IsNullOrWhiteSpace(payload.newPin) ? "0000" : payload.newPin;

            // Validate PIN format (must be 4 digits)
            if (!int.TryParse(newPin, out _) || newPin.Length != 4)
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { success = false, message = "PIN must be a 4-digit number" });
                return bad;
            }

            try
            {
                await using var conn = new SqlConnection(cs);
                await conn.OpenAsync();

                // Generate new salt
                byte[] salt = GenerateSalt();

                // Hash the new PIN
                byte[] pinHash = HashPin(newPin, salt);

                // Check if employee exists
                const string checkQuery = "SELECT COUNT(1) FROM dbo.Employee WHERE employee_id = @EmployeeId";
                await using var checkCmd = new SqlCommand(checkQuery, conn);
                checkCmd.Parameters.AddWithValue("@EmployeeId", payload.employeeId);
                var employeeExists = (int)await checkCmd.ExecuteScalarAsync() > 0;

                if (!employeeExists)
                {
                    _logger.LogWarning("Employee {EmployeeId} not found", payload.employeeId);
                    var notFound = req.CreateResponse(HttpStatusCode.NotFound);
                    await notFound.WriteAsJsonAsync(new { success = false, message = "Employee not found" });
                    return notFound;
                }

                // Check if PIN credential already exists
                const string existsQuery = "SELECT COUNT(1) FROM dbo.PinCredential WHERE user_id = @EmployeeId";
                await using var existsCmd = new SqlCommand(existsQuery, conn);
                existsCmd.Parameters.AddWithValue("@EmployeeId", payload.employeeId);
                var pinExists = (int)await existsCmd.ExecuteScalarAsync() > 0;

                string query;
                if (pinExists)
                {
                    // Update existing PIN
                    query = @"
                        UPDATE dbo.PinCredential
                        SET pin_hash = @PinHash, salt = @Salt, updated_utc = GETUTCDATE()
                        WHERE user_id = @EmployeeId";
                }
                else
                {
                    // Insert new PIN credential
                    query = @"
                        INSERT INTO dbo.PinCredential (user_id, pin_hash, salt, updated_utc)
                        VALUES (@EmployeeId, @PinHash, @Salt, GETUTCDATE())";
                }

                await using var cmd = new SqlCommand(query, conn);
                cmd.Parameters.AddWithValue("@EmployeeId", payload.employeeId);
                cmd.Parameters.AddWithValue("@PinHash", pinHash);
                cmd.Parameters.AddWithValue("@Salt", salt);

                int rowsAffected = await cmd.ExecuteNonQueryAsync();

                if (rowsAffected > 0)
                {
                    _logger.LogInformation("PIN reset successful for employee {EmployeeId}", payload.employeeId);
                    var ok = req.CreateResponse(HttpStatusCode.OK);
                    await ok.WriteAsJsonAsync(new
                    {
                        success = true,
                        message = $"PIN reset to {newPin} successfully"
                    });
                    return ok;
                }
                else
                {
                    _logger.LogError("No rows affected when resetting PIN for employee {EmployeeId}", payload.employeeId);
                    var err = req.CreateResponse(HttpStatusCode.InternalServerError);
                    await err.WriteAsJsonAsync(new { success = false, message = "Failed to reset PIN" });
                    return err;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resetting PIN for employee {EmployeeId}", payload.employeeId);
                var err = req.CreateResponse(HttpStatusCode.InternalServerError);
                await err.WriteAsJsonAsync(new { success = false, message = "An error occurred while resetting PIN." });
                return err;
            }
        }

        /// <summary>
        /// Generate a cryptographically secure random salt
        /// </summary>
        private static byte[] GenerateSalt()
        {
            byte[] salt = new byte[16];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(salt);
            }
            return salt;
        }

        /// <summary>
        /// Hash a PIN with the given salt using SHA256
        /// </summary>
        private static byte[] HashPin(string pin, byte[] salt)
        {
            using var sha256 = SHA256.Create();

            // Combine PIN and salt
            byte[] pinBytes = Encoding.UTF8.GetBytes(pin);
            byte[] combined = new byte[pinBytes.Length + salt.Length];
            Buffer.BlockCopy(pinBytes, 0, combined, 0, pinBytes.Length);
            Buffer.BlockCopy(salt, 0, combined, pinBytes.Length, salt.Length);

            // Hash the combined bytes
            return sha256.ComputeHash(combined);
        }
    }
}
