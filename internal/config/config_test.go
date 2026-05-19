package config

import (
	"os"
	"testing"
	"time"
)

func TestLoad_Defaults(t *testing.T) {
	os.Clearenv()
	_ = os.Setenv("DATABASE_URL", "postgres://localhost:5432/test")
	_ = os.Setenv("JWT_SECRET", "test-secret")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if cfg.ServerPort != "8080" {
		t.Errorf("expected ServerPort 8080, got %s", cfg.ServerPort)
	}
	if cfg.DBMaxConns != 25 {
		t.Errorf("expected DBMaxConns 25, got %d", cfg.DBMaxConns)
	}
	if cfg.DBMinConns != 5 {
		t.Errorf("expected DBMinConns 5, got %d", cfg.DBMinConns)
	}
	if cfg.JWTExpiration != 24*time.Hour {
		t.Errorf("expected JWTExpiration 24h, got %v", cfg.JWTExpiration)
	}
	if cfg.MPSandbox != true {
		t.Errorf("expected MPSandbox true, got %v", cfg.MPSandbox)
	}
	if cfg.ShutdownTimeout != 10*time.Second {
		t.Errorf("expected ShutdownTimeout 10s, got %v", cfg.ShutdownTimeout)
	}
}

func TestLoad_RequiredFields(t *testing.T) {
	os.Clearenv()

	_, err := Load()
	if err == nil {
		t.Fatal("expected error when DATABASE_URL and JWT_SECRET are missing")
	}
}

func TestLoad_EnvOverride(t *testing.T) {
	os.Clearenv()
	_ = os.Setenv("DATABASE_URL", "postgres://localhost:5432/test")
	_ = os.Setenv("JWT_SECRET", "test-secret")
	_ = os.Setenv("SERVER_PORT", "9090")
	_ = os.Setenv("DB_MAX_CONNS", "50")
	_ = os.Setenv("DB_MIN_CONNS", "10")
	_ = os.Setenv("JWT_EXPIRATION", "1h")
	_ = os.Setenv("MP_SANDBOX", "false")
	_ = os.Setenv("SHUTDOWN_TIMEOUT", "30s")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if cfg.ServerPort != "9090" {
		t.Errorf("expected ServerPort 9090, got %s", cfg.ServerPort)
	}
	if cfg.DBMaxConns != 50 {
		t.Errorf("expected DBMaxConns 50, got %d", cfg.DBMaxConns)
	}
	if cfg.DBMinConns != 10 {
		t.Errorf("expected DBMinConns 10, got %d", cfg.DBMinConns)
	}
	if cfg.JWTExpiration != time.Hour {
		t.Errorf("expected JWTExpiration 1h, got %v", cfg.JWTExpiration)
	}
	if cfg.MPSandbox != false {
		t.Errorf("expected MPSandbox false, got %v", cfg.MPSandbox)
	}
	if cfg.ShutdownTimeout != 30*time.Second {
		t.Errorf("expected ShutdownTimeout 30s, got %v", cfg.ShutdownTimeout)
	}
}
