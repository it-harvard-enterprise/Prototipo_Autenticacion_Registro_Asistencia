package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"fingerprint-backend/handlers"
	"fingerprint-backend/middleware"
	"fingerprint-backend/services"
	sfconfig "github.com/jtejido/sourceafis/config"
)

const defaultPort = "4000"

func main() {
	_ = godotenv.Load()
	sfconfig.LoadDefaultConfig()

	supabaseURL := strings.TrimSpace(os.Getenv("SUPABASE_URL"))
	serviceKey := strings.TrimSpace(os.Getenv("SUPABASE_SERVICE_ROLE_KEY"))
	if supabaseURL == "" || serviceKey == "" {
		log.Fatal("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env")
	}

	threshold := services.DefaultThreshold
	if value := strings.TrimSpace(os.Getenv("MATCH_THRESHOLD")); value != "" {
		if parsed, err := services.ParseFloatStatic(value); err == nil {
			threshold = parsed
		}
	}

	// Require biometric passphrases to be provided via env vars
	if strings.TrimSpace(os.Getenv("BIOMETRIC_PASSPHRASE_PNG")) == "" || strings.TrimSpace(os.Getenv("BIOMETRIC_PASSPHRASE_TEMPLATE")) == "" {
		log.Fatal("Missing BIOMETRIC_PASSPHRASE_PNG or BIOMETRIC_PASSPHRASE_TEMPLATE in backend/.env")
	}

	app := services.NewApp(supabaseURL, serviceKey, strings.TrimSpace(os.Getenv("FRONTEND_HEALTH_URL")), threshold)

	router := gin.Default()
	if err := router.SetTrustedProxies(nil); err != nil {
		log.Fatalf("failed to configure trusted proxies: %v", err)
	}

	frontendOrigin := strings.TrimSpace(os.Getenv("FRONTEND_ORIGIN"))
	backendAccessKey := strings.TrimSpace(os.Getenv("BIOMETRIC_BACKEND_ACCESS_KEY"))
	router.Use(middleware.CorsMiddleware(frontendOrigin))
	router.Use(middleware.FrontendOnlyMiddleware(frontendOrigin, backendAccessKey))

	router.GET("/health", func(c *gin.Context) {
		backendStatus := "ok"
		frontendStatus, frontendDetail := app.CheckFrontendHealth(c.Request.Context())
		overallStatus := "ok"
		if frontendStatus != "ok" {
			overallStatus = "degraded"
		}

		c.Header("X-Health-Backend", backendStatus)
		c.Header("X-Health-Frontend", frontendStatus)
		c.Header("X-Health-Frontend-Detail", frontendDetail)
		c.Header("X-Health-Overall", overallStatus)
		statusCode := http.StatusOK
		if overallStatus != "ok" {
			statusCode = http.StatusServiceUnavailable
		}

		c.JSON(statusCode, gin.H{
			"backend":         backendStatus,
			"frontend":        frontendStatus,
			"frontend_detail": frontendDetail,
			"overall":         overallStatus,
		})
	})

	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true, "threshold": app.Threshold})
	})
	router.HEAD("/api/health", func(c *gin.Context) { c.Status(http.StatusOK) })

	router.POST("/api/students/enroll", handlers.EnrollStudentHandler(app))
	router.POST("/api/students/update-fingerprints", handlers.UpdateStudentFingerprintsHandler(app))
	router.POST("/api/attendance/identify", handlers.IdentifyAttendanceHandler(app))
	router.POST("/api/person/identify-by-fingerprint", handlers.IdentifyPersonByFingerprintHandler(app))
	router.GET("/startService", handlers.StartServiceHandler(app))

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = defaultPort
	}
	log.Printf("Biometric backend running on http://localhost:%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
