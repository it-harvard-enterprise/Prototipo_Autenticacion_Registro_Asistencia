package middleware

import (
	"fmt"
	"regexp"
	"time"

	"github.com/gin-gonic/gin"
)

var numericIdentifierPattern = regexp.MustCompile(`\d{6,}`)

func sanitizeLogPath(path string) string {
	if path == "" {
		return "/"
	}

	// Hide long numeric identifiers (IDs, document numbers) from request logs.
	return numericIdentifierPattern.ReplaceAllString(path, "[REDACTED]")
}

func SecureRequestLogger() gin.HandlerFunc {
	return gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		statusColor := param.StatusCodeColor()
		methodColor := param.MethodColor()
		resetColor := param.ResetColor()
		safePath := sanitizeLogPath(param.Path)

		return fmt.Sprintf(
			"[GIN] %v |%s %3d %s| %13v | %15s |%s %-7s %s| %s\n",
			param.TimeStamp.Format("2006/01/02 - 15:04:05"),
			statusColor,
			param.StatusCode,
			resetColor,
			param.Latency.Truncate(time.Microsecond),
			param.ClientIP,
			methodColor,
			param.Method,
			resetColor,
			safePath,
		)
	})
}
