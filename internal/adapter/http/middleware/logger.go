package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Logger returns a Fiber middleware that logs each request using zap.
// It records method, path, status, duration, and request ID if present.
func Logger(logger *zap.Logger) fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()

		// Process request
		err := c.Next()

		// Build log fields
		duration := time.Since(start)
		fields := []zapcore.Field{
			zap.String("method", c.Method()),
			zap.String("path", c.Path()),
			zap.Int("status", c.Response().StatusCode()),
			zap.Duration("duration", duration),
			zap.String("ip", c.IP()),
		}

		if reqID := c.GetRespHeader("X-Request-ID"); reqID != "" {
			fields = append(fields, zap.String("request_id", reqID))
		}

		if err != nil {
			fields = append(fields, zap.Error(err))
			logger.Error("request failed", fields...)
		} else {
			logger.Info("request completed", fields...)
		}

		return err
	}
}
