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
    public class VerifyPin
    {
        private readonly ILogger _logger;

        public VerifyPin(ILoggerFactory loggerFactory) =>
            _logger = loggerFactory.CreateLogger<VerifyPin>();

        private record PinRequest(string? employeeId, string? pin);

        [Function("VerifyPin")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "auth/verify-pin")] HttpRequestData req)
        {
            _logger.LogInformation("Processing PIN verification request...");

            var cs = Environment.GetEnvironmentVariable("SqlDbConnection");
            if (string.IsNullOrWhiteSpace(cs))
            {
                return await ApiResponse.Fail(req, HttpStatusCode.InternalServerError, "SqlDbConnection not configured.", _logger);
            }

            PinRequest? payload;
            try
            {
                var body = await req.ReadAsStringAsync();
                if (string.IsNullOrWhiteSpace(body))
                    throw new Exception("Empty request body.");

                payload = JsonSerializer.Deserialize<PinRequest>(body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (payload == null)
                    throw new Exception("Invalid payload.");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Invalid payload for VerifyPin.");
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { success = false, message = "Invalid request payload." });
                return bad;
            }

            // Validate input
            if (string.IsNullOrWhiteSpace(payload.employeeId) || string.IsNullOrWhiteSpace(payload.pin))
            {
                var bad = req.CreateResponse(HttpStatusCode.BadRequest);
                await bad.WriteAsJsonAsync(new { success = false, message = "Employee ID and PIN are required" });
                return bad;
            }

            // Validate PIN format (should be numeric)
            if (!int.TryParse(payload.pin, out _))
            {
                var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
                await unauthorized.WriteAsJsonAsync(new { success = false, message = "Invalid PIN format" });
                return unauthorized;
            }

            try
            {
                await using var conn = new SqlConnection(cs);
                await conn.OpenAsync();

                // Query to get PIN credentials for the employee
                const string query = @"
                    SELECT pin_hash, salt
                    FROM dbo.PinCredential
                    WHERE user_id = @EmployeeId";

                await using var cmd = new SqlCommand(query, conn);
                cmd.Parameters.AddWithValue("@EmployeeId", payload.employeeId);

                await using var reader = await cmd.ExecuteReaderAsync();

                if (!await reader.ReadAsync())
                {
                    // No PIN credentials found for this employee
                    _logger.LogWarning("No PIN credentials found for employee {EmployeeId}", payload.employeeId);
                    var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
                    await unauthorized.WriteAsJsonAsync(new
                    {
                        success = false,
                        message = "No PIN set for this employee. Please contact your administrator."
                    });
                    return unauthorized;
                }

                // Read stored hash and salt
                byte[] storedHash = (byte[])reader["pin_hash"];
                byte[] salt = (byte[])reader["salt"];

                // Hash the provided PIN with the stored salt
                byte[] computedHash = HashPin(payload.pin, salt);

                // Compare hashes using constant-time comparison
                bool isValid = ConstantTimeEquals(storedHash, computedHash);

                if (isValid)
                {
                    _logger.LogInformation("PIN verification successful for employee {EmployeeId}", payload.employeeId);
                    var ok = req.CreateResponse(HttpStatusCode.OK);
                    await ok.WriteAsJsonAsync(new
                    {
                        success = true,
                        message = "PIN verified successfully"
                    });
                    return ok;
                }
                else
                {
                    _logger.LogWarning("Invalid PIN attempt for employee {EmployeeId}", payload.employeeId);
                    var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
                    await unauthorized.WriteAsJsonAsync(new
                    {
                        success = false,
                        message = "Invalid PIN"
                    });
                    return unauthorized;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error verifying PIN for employee {EmployeeId}", payload.employeeId);
                var err = req.CreateResponse(HttpStatusCode.InternalServerError);
                await err.WriteAsJsonAsync(new { success = false, message = "An error occurred while verifying PIN." });
                return err;
            }
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

        /// <summary>
        /// Constant-time comparison to prevent timing attacks
        /// </summary>
        private static bool ConstantTimeEquals(byte[] a, byte[] b)
        {
            if (a.Length != b.Length)
                return false;

            int result = 0;
            for (int i = 0; i < a.Length; i++)
            {
                result |= a[i] ^ b[i];
            }

            return result == 0;
        }
    }
}
