package jwt

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims extends jwt.RegisteredClaims with application-specific fields.
type Claims struct {
	StudentID string `json:"student_id"`
	Email     string `json:"email"`
	CourseID  string `json:"course_id"`
	IsAdmin   bool   `json:"is_admin"`
	jwt.RegisteredClaims
}

// CreateToken generates a signed JWT token for the given user claims.
// It uses HMAC-SHA256 with the provided secret and sets the expiration.
func CreateToken(studentID, email, courseID string, isAdmin bool, secret string, expiration time.Duration) (string, error) {
	now := time.Now()
	claims := &Claims{
		StudentID: studentID,
		Email:     email,
		CourseID:  courseID,
		IsAdmin:   isAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(expiration)),
			IssuedAt:  jwt.NewNumericDate(now),
			Subject:   studentID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", fmt.Errorf("sign jwt: %w", err)
	}
	return signed, nil
}

// ValidateToken parses and validates a JWT token string.
// It returns the Claims if the token is valid, or an error otherwise.
func ValidateToken(tokenStr, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("validate jwt: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid jwt claims")
	}

	return claims, nil
}
