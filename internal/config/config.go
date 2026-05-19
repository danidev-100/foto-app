package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	ServerPort      string
	DatabaseURL     string
	DBMaxConns      int
	DBMinConns      int
	JWTSecret       string
	JWTExpiration   time.Duration
	MPAccessToken   string
	MPSandbox       bool
	LogLevel        string
	ShutdownTimeout time.Duration
}

// Load reads configuration from environment variables, with optional .env file support.
// It returns an error if any required field is missing or invalid.
func Load() (*Config, error) {
	// Attempt to load .env file; ignore error if file doesn't exist
	_ = godotenv.Load()

	cfg := &Config{
		ServerPort:      getEnv("SERVER_PORT", "8080"),
		DatabaseURL:     getEnv("DATABASE_URL", ""),
		DBMaxConns:      getEnvInt("DB_MAX_CONNS", 25),
		DBMinConns:      getEnvInt("DB_MIN_CONNS", 5),
		JWTSecret:       getEnv("JWT_SECRET", ""),
		JWTExpiration:   getEnvDuration("JWT_EXPIRATION", 24*time.Hour),
		MPAccessToken:   getEnv("MP_ACCESS_TOKEN", ""),
		MPSandbox:       getEnvBool("MP_SANDBOX", true),
		LogLevel:        getEnv("LOG_LEVEL", "info"),
		ShutdownTimeout: getEnvDuration("SHUTDOWN_TIMEOUT", 10*time.Second),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return n
}

func getEnvBool(key string, fallback bool) bool {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	b, err := strconv.ParseBool(val)
	if err != nil {
		return fallback
	}
	return b
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	d, err := time.ParseDuration(val)
	if err != nil {
		return fallback
	}
	return d
}
