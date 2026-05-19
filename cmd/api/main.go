package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"foto-app/internal/adapter/http"
	"foto-app/internal/adapter/http/handler"
	"foto-app/internal/adapter/payment"
	"foto-app/internal/adapter/repository"
	"foto-app/internal/config"
	"foto-app/internal/domain/service"
	"foto-app/pkg/database"
)

func main() {
	// ── Config ──────────────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	// ── Logger ──────────────────────────────────────────────────────────
	zapCfg := zap.NewProductionConfig()
	zapCfg.Level = parseLogLevel(cfg.LogLevel)
	logger, err := zapCfg.Build()
	if err != nil {
		log.Fatalf("failed to build logger: %v", err)
	}
	defer logger.Sync() //nolint:errcheck

	// ── Context (cancelled on shutdown signal) ─────────────────────────
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// ── Database pool ──────────────────────────────────────────────────
	pool, err := database.NewPool(ctx, cfg.DatabaseURL, cfg.DBMaxConns, cfg.DBMinConns)
	if err != nil {
		logger.Fatal("failed to create database pool", zap.Error(err))
	}
	defer pool.Close()

	// ── Migrations ─────────────────────────────────────────────────────
	if err := database.RunMigrations(ctx, pool); err != nil {
		logger.Fatal("failed to run migrations", zap.Error(err))
	}
	logger.Info("database migrations applied successfully")

	// ── Fiber app ──────────────────────────────────────────────────────
	app := fiber.New(fiber.Config{
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
		DisableStartupMessage: false,
	})

	// ── Repositories ───────────────────────────────────────────────────
	studentRepo := repository.NewStudentRepo(pool)
	courseRepo := repository.NewCourseRepo(pool)
	divisionRepo := repository.NewDivisionRepo(pool)
	bookletRepo := repository.NewBookletRepo(pool)
	cartRepo := repository.NewCartRepo(pool)
	orderRepo := repository.NewOrderRepo(pool)
	paymentRepo := repository.NewPaymentRepo(pool)

	// ── Payment Gateway ────────────────────────────────────────────────
	mpGateway, err := payment.NewMercadoPago(cfg.MPAccessToken, cfg.MPSandbox)
	if err != nil {
		logger.Fatal("failed to create Mercado Pago gateway", zap.Error(err))
	}

	// ── Services ───────────────────────────────────────────────────────
	authService := service.NewAuthService(studentRepo, cfg.JWTSecret, cfg.JWTExpiration)
	catalogService := service.NewCatalogService(courseRepo, divisionRepo, bookletRepo)
	cartService := service.NewCartService(cartRepo, bookletRepo)
	orderService := service.NewOrderService(pool, orderRepo, cartRepo, bookletRepo)
	paymentService := service.NewPaymentService(paymentRepo, orderRepo, mpGateway)

	// ── Handlers ───────────────────────────────────────────────────────
	authHandler := handler.NewAuthHandler(authService)
	catalogHandler := handler.NewCatalogHandler(catalogService)
	cartHandler := handler.NewCartHandler(cartService)
	orderHandler := handler.NewOrderHandler(orderService)
	paymentHandler := handler.NewPaymentHandler(paymentService)

	// ── Routes ─────────────────────────────────────────────────────────
	http.SetupRoutes(app, logger, authHandler, catalogHandler, cartHandler, orderHandler, paymentHandler, cfg.JWTSecret)

	// ── Graceful shutdown ──────────────────────────────────────────────
	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		s := <-sig
		logger.Info("shutdown signal received", zap.String("signal", s.String()))
		cancel()

		shutdownCtx, shutdownCancel := context.WithTimeout(
			context.Background(), cfg.ShutdownTimeout,
		)
		defer shutdownCancel()

		if err := app.ShutdownWithContext(shutdownCtx); err != nil {
			logger.Error("fiber shutdown error", zap.Error(err))
		}

		pool.Close()
		logger.Info("graceful shutdown complete")
	}()

	// ── Start server ───────────────────────────────────────────────────
	logger.Info("starting server", zap.String("port", cfg.ServerPort))
	if err := app.Listen(":" + cfg.ServerPort); err != nil {
		logger.Fatal("server error", zap.Error(err))
	}
}

func parseLogLevel(level string) zap.AtomicLevel {
	switch level {
	case "debug":
		return zap.NewAtomicLevelAt(zap.DebugLevel)
	case "info":
		return zap.NewAtomicLevelAt(zap.InfoLevel)
	case "warn":
		return zap.NewAtomicLevelAt(zap.WarnLevel)
	case "error":
		return zap.NewAtomicLevelAt(zap.ErrorLevel)
	default:
		return zap.NewAtomicLevelAt(zap.InfoLevel)
	}
}
