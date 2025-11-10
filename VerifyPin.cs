using System;
using System.IO;
using System.Threading.Tasks;
using System.Data.SqlClient;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace Timesheets.Functions
{
    public static class VerifyPin
    {
        [FunctionName("VerifyPin")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = "auth/verify-pin")] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("Processing PIN verification request...");

            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            dynamic data = JsonConvert.DeserializeObject(requestBody);

            string employeeId = data?.employeeId;
            string pin = data?.pin;

            // Validate input
            if (string.IsNullOrEmpty(employeeId) || string.IsNullOrEmpty(pin))
            {
                return new BadRequestObjectResult(new {
                    success = false,
                    message = "Employee ID and PIN are required"
                });
            }

            // Validate PIN format (should be numeric)
            if (!int.TryParse(pin, out _))
            {
                return new UnauthorizedObjectResult(new {
                    success = false,
                    message = "Invalid PIN format"
                });
            }

            string? connectionString = Environment.GetEnvironmentVariable("SqlConnectionString");
            if (string.IsNullOrEmpty(connectionString))
            {
                log.LogError("SqlConnectionString not configured");
                return new StatusCodeResult(500);
            }

            try
            {
                using (SqlConnection conn = new SqlConnection(connectionString))
                {
                    await conn.OpenAsync();

                    // Query to get PIN credentials for the employee
                    string query = @"
                        SELECT pin_hash, salt
                        FROM dbo.PinCredential
                        WHERE user_id = @EmployeeId";

                    using (SqlCommand cmd = new SqlCommand(query, conn))
                    {
                        cmd.Parameters.AddWithValue("@EmployeeId", employeeId);

                        using (SqlDataReader reader = await cmd.ExecuteReaderAsync())
                        {
                            if (!await reader.ReadAsync())
                            {
                                // No PIN credentials found for this employee
                                log.LogWarning($"No PIN credentials found for employee {employeeId}");
                                return new UnauthorizedObjectResult(new {
                                    success = false,
                                    message = "No PIN set for this employee. Please contact your administrator."
                                });
                            }

                            // Read stored hash and salt
                            byte[] storedHash = (byte[])reader["pin_hash"];
                            byte[] salt = (byte[])reader["salt"];

                            // Hash the provided PIN with the stored salt
                            byte[] computedHash = HashPin(pin, salt);

                            // Compare hashes using constant-time comparison
                            bool isValid = ConstantTimeEquals(storedHash, computedHash);

                            if (isValid)
                            {
                                log.LogInformation($"PIN verification successful for employee {employeeId}");
                                return new OkObjectResult(new {
                                    success = true,
                                    message = "PIN verified successfully"
                                });
                            }
                            else
                            {
                                log.LogWarning($"Invalid PIN attempt for employee {employeeId}");
                                return new UnauthorizedObjectResult(new {
                                    success = false,
                                    message = "Invalid PIN"
                                });
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                log.LogError($"Error verifying PIN: {ex.Message}");
                return new StatusCodeResult(500);
            }
        }

        /// <summary>
        /// Hash a PIN with the given salt using SHA256
        /// </summary>
        private static byte[] HashPin(string pin, byte[] salt)
        {
            using (var sha256 = SHA256.Create())
            {
                // Combine PIN and salt
                byte[] pinBytes = Encoding.UTF8.GetBytes(pin);
                byte[] combined = new byte[pinBytes.Length + salt.Length];
                Buffer.BlockCopy(pinBytes, 0, combined, 0, pinBytes.Length);
                Buffer.BlockCopy(salt, 0, combined, pinBytes.Length, salt.Length);

                // Hash the combined bytes
                return sha256.ComputeHash(combined);
            }
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
