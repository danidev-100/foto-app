.PHONY: run build test fmt migrate-up migrate-down clean

# ─── Variables ────────────────────────────────────────────────────────
APP_NAME   := foto-app
MAIN_PATH  := ./cmd/api
BIN_PATH   := ./bin/$(APP_NAME).exe

# ─── Development ──────────────────────────────────────────────────────

## run: start the API server
run:
	go run $(MAIN_PATH)/main.go

## build: compile the binary
build:
	go build -o $(BIN_PATH) $(MAIN_PATH)

## fmt: format all Go code
fmt:
	go fmt ./...

## test: run all tests with race detection
test:
	go test -race -count=1 ./...

## test-verbose: run all tests with verbose output
test-verbose:
	go test -race -count=1 -v ./...

## clean: remove build artifacts
clean:
	rm -rf bin/
	go clean -cache

# ─── Database ──────────────────────────────────────────────────────────

## migrate-up: apply all pending migrations (requires DATABASE_URL)
migrate-up:
	go run $(MAIN_PATH)/main.go 2>&1 | head -1 || true
	@echo "Migrations are applied at startup automatically."
	@echo "Set DATABASE_URL env var to run."

## migrate-down: reset and re-run migrations (destructive!)
migrate-down:
	@echo "Resetting database..."
	go run -tags=migratedown ./cmd/migrate/main.go 2>/dev/null || true
	@echo "Drop and re-create with:"
	@echo "  psql \$$DATABASE_URL -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'"
	@echo "Then run the app to re-apply migrations."

# ─── Help ────────────────────────────────────────────────────────────

## help: show available targets
help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@grep -E '^## .*: ' $(MAKEFILE_LIST) | sed 's/## //' | column -t -s ':'
