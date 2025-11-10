using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Timesheets.Functions
{
    /// <summary>
    /// Helper class for creating standardized API responses
    /// </summary>
    public static class ApiResponse
    {
        /// <summary>
        /// Creates a failure response with the specified status code and message
        /// </summary>
        public static async Task<HttpResponseData> Fail(
            HttpRequestData req,
            HttpStatusCode statusCode,
            string message,
            ILogger logger)
        {
            logger.LogError("API Error: {StatusCode} - {Message}", statusCode, message);

            var response = req.CreateResponse(statusCode);
            await response.WriteAsJsonAsync(new
            {
                success = false,
                message = message
            });

            return response;
        }

        /// <summary>
        /// Creates a success response with optional data
        /// </summary>
        public static async Task<HttpResponseData> Success(
            HttpRequestData req,
            string message,
            object? data = null)
        {
            var response = req.CreateResponse(HttpStatusCode.OK);

            if (data != null)
            {
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    message = message,
                    data = data
                });
            }
            else
            {
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    message = message
                });
            }

            return response;
        }
    }
}
