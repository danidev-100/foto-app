package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"foto-app/internal/domain/model"
	"foto-app/internal/domain/port"
	jwtpkg "foto-app/pkg/jwt"
)

// ---------- Request / Response types ----------

// RegisterRequest carries the fields needed to create a new student account.
type RegisterRequest struct {
	Name     string  `json:"name"`
	Email    string  `json:"email"`
	Password string  `json:"password"`
	Phone    *string `json:"phone,omitempty"`
	CourseID string  `json:"course_id"`
}

// LoginRequest carries the credentials for authentication.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginResponse is returned on successful authentication.
type LoginResponse struct {
	Token   string         `json:"token"`
	Student *model.Student `json:"student"`
}

// ---------- AuthService ----------

// AuthService implements registration and login business logic.
type AuthService struct {
	studentRepo port.StudentRepository
	jwtSecret   string
	jwtExpiry   time.Duration
}

// NewAuthService creates an AuthService with its dependencies.
func NewAuthService(studentRepo port.StudentRepository, jwtSecret string, jwtExpiry time.Duration) *AuthService {
	return &AuthService{
		studentRepo: studentRepo,
		jwtSecret:   jwtSecret,
		jwtExpiry:   jwtExpiry,
	}
}

// Register creates a new student with a bcrypt-hashed password (cost factor 12).
// Returns model.ErrConflict if the email is already registered.
// Returns a LoginResponse with JWT token on success.
func (s *AuthService) Register(ctx context.Context, req RegisterRequest) (*LoginResponse, error) {
	// Check for existing email
	existing, err := s.studentRepo.FindByEmail(ctx, req.Email)
	if err != nil && err != model.ErrNotFound {
		return nil, err
	}
	if existing != nil {
		return nil, model.ErrConflict
	}

	// Parse course_id
	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		return nil, model.ErrValidation
	}

	// Hash password with bcrypt cost 12
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return nil, err
	}

	student := &model.Student{
		ID:           uuid.New(),
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Phone:        req.Phone,
		CourseID:     courseID,
		IsAdmin:      false,
		IsActive:     true,
	}

	if err := s.studentRepo.Create(ctx, student); err != nil {
		return nil, err
	}

	// Generate JWT token
	token, err := jwtpkg.CreateToken(
		student.ID.String(),
		student.Email,
		student.CourseID.String(),
		student.IsAdmin,
		s.jwtSecret,
		s.jwtExpiry,
	)
	if err != nil {
		return nil, err
	}

	return &LoginResponse{
		Token:   token,
		Student: student,
	}, nil
}

// Login authenticates a student by email and password.
// Returns model.ErrInvalidCredentials if the email or password is wrong.
func (s *AuthService) Login(ctx context.Context, req LoginRequest) (*LoginResponse, error) {
	student, err := s.studentRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		if err == model.ErrNotFound {
			return nil, model.ErrInvalidCredentials
		}
		return nil, err
	}

	// Compare password with stored hash
	if err := bcrypt.CompareHashAndPassword([]byte(student.PasswordHash), []byte(req.Password)); err != nil {
		return nil, model.ErrInvalidCredentials
	}

	// Generate JWT
	token, err := jwtpkg.CreateToken(
		student.ID.String(),
		student.Email,
		student.CourseID.String(),
		student.IsAdmin,
		s.jwtSecret,
		s.jwtExpiry,
	)
	if err != nil {
		return nil, err
	}

	return &LoginResponse{
		Token:   token,
		Student: student,
	}, nil
}
