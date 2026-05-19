package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	jwtpkg "foto-app/pkg/jwt"
	"foto-app/pkg/response"
)

// AuthMiddleware returns a Fiber handler that validates a Bearer JWT token.
// On success it sets c.Locals("student_id"), c.Locals("email"),
// c.Locals("course_id"), and c.Locals("is_admin").
// Returns 401 AUTH_001 if the token is missing, malformed, or expired.
func AuthMiddleware(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return response.ErrorJSON(c, fiber.StatusUnauthorized, "AUTH_001", "authentication required", nil)
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			return response.ErrorJSON(c, fiber.StatusUnauthorized, "AUTH_001", "invalid authorization header format", nil)
		}

		claims, err := jwtpkg.ValidateToken(parts[1], jwtSecret)
		if err != nil {
			return response.ErrorJSON(c, fiber.StatusUnauthorized, "AUTH_001", "invalid or expired token", nil)
		}

		c.Locals("student_id", claims.StudentID)
		c.Locals("email", claims.Email)
		c.Locals("course_id", claims.CourseID)
		c.Locals("is_admin", claims.IsAdmin)

		return c.Next()
	}
}

// AdminMiddleware restricts access to users with admin role.
// Must be used AFTER AuthMiddleware so that c.Locals("is_admin") is populated.
// Returns 403 AUTH_002 if the user is not an admin.
func AdminMiddleware(c *fiber.Ctx) error {
	isAdmin, ok := c.Locals("is_admin").(bool)
	if !ok || !isAdmin {
		return response.ErrorJSON(c, fiber.StatusForbidden, "AUTH_002", "insufficient permissions", nil)
	}
	return c.Next()
}
