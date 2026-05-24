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
	if anonKey := strings.TrimSpace(os.Getenv("SUPABASE_ANON_KEY")); anonKey != "" {
		app.AnonKey = anonKey
	}

	router := gin.New()
	router.Use(middleware.SecureRequestLogger(), gin.Recovery())
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
	router.POST("/api/students/create", handlers.CreateStudentHandler(app))
	router.GET("/api/students", handlers.ListStudentsHandler(app))
	router.GET("/api/students/:numero_identificacion", handlers.GetStudentByNumeroHandler(app))
	router.GET("/api/students/:numero_identificacion/attendance-summary", handlers.GetStudentAttendanceSummaryHandler(app))
	router.POST("/api/students/exists", handlers.StudentExistsHandler(app))
	router.POST("/api/students/update", handlers.UpdateStudentHandler(app))
	router.POST("/api/students/delete", handlers.DeleteStudentHandler(app))
	router.POST("/api/students/:numero_identificacion/profile", handlers.CreateStudentProfileHandler(app))
	router.DELETE("/api/students/:numero_identificacion/profile", handlers.DeleteStudentProfileHandler(app))
	router.POST("/api/students/update-fingerprints", handlers.UpdateStudentFingerprintsHandler(app))

	router.POST("/api/professors/create", handlers.CreateProfessorHandler(app))
	router.GET("/api/professors", handlers.ListProfessorsHandler(app))
	router.GET("/api/professors/:numero_identificacion", handlers.GetProfessorByNumeroHandler(app))
	router.POST("/api/professors/exists", handlers.ProfessorExistsHandler(app))
	router.POST("/api/professors/update", handlers.UpdateProfessorHandler(app))
	router.POST("/api/professors/delete", handlers.DeleteProfessorHandler(app))
	router.POST("/api/professors/:numero_identificacion/profile", handlers.CreateProfessorProfileHandler(app))
	router.DELETE("/api/professors/:numero_identificacion/profile", handlers.DeleteProfessorProfileHandler(app))

	router.GET("/api/courses", handlers.ListCoursesHandler(app))
	router.GET("/api/courses/options", handlers.ListCourseOptionsHandler(app))
	router.GET("/api/courses/:id_curso", handlers.GetCourseByIDHandler(app))
	router.POST("/api/courses/exists", handlers.CourseExistsHandler(app))
	router.POST("/api/courses/create", handlers.CreateCourseHandler(app))
	router.POST("/api/courses/update", handlers.UpdateCourseHandler(app))
	router.POST("/api/courses/delete", handlers.DeleteCourseHandler(app))
	router.POST("/api/courses/participants/lookup", handlers.LookupParticipantsHandler(app))
	router.POST("/api/courses/participants/associate", handlers.AssociateParticipantsHandler(app))
	router.POST("/api/courses/participants/dissociate", handlers.DissociateParticipantsHandler(app))
	router.GET("/api/courses/:id_curso/participants", handlers.GetParticipantsByCourseIDHandler(app))
	router.GET("/api/courses/:id_curso/students", handlers.GetStudentsByCourseIDHandler(app))
	router.GET("/api/course-materials/snapshot", handlers.CourseMaterialsSnapshotHandler(app))
	router.POST("/api/course-materials/folders/create", handlers.CourseMaterialsCreateFolderHandler(app))
	router.PATCH("/api/course-materials/folders/update", handlers.CourseMaterialsUpdateFolderHandler(app))
	router.POST("/api/course-materials/folders/delete", handlers.CourseMaterialsDeleteFolderHandler(app))
	router.POST("/api/course-materials/files/upload", handlers.CourseMaterialsUploadFilesHandler(app))
	router.POST("/api/course-materials/files/delete", handlers.CourseMaterialsDeleteFileHandler(app))
	router.POST("/api/course-materials/files/youtube/create", handlers.CourseMaterialsCreateYouTubeLinkHandler(app))
	router.GET("/api/course-materials/files/:id/download", handlers.CourseMaterialsDownloadFileHandler(app))
	router.POST("/api/course-materials/cover/upload", handlers.CourseMaterialsUploadCoverHandler(app))
	router.POST("/api/course-materials/cover/url", handlers.CourseMaterialsSetCoverURLHandler(app))
	router.GET("/api/course-materials/cover", handlers.CourseMaterialsCoverHandler(app))
	router.POST("/api/course-materials/folders/card/upload", handlers.CourseMaterialsUploadFolderCardHandler(app))
	router.POST("/api/course-materials/folders/card/url", handlers.CourseMaterialsSetFolderCardURLHandler(app))
	router.GET("/api/course-materials/folders/:id/card/download", handlers.CourseMaterialsFolderCardHandler(app))

	router.GET("/api/attendance/roster", handlers.GetAttendanceRosterHandler(app))
	router.POST("/api/attendance/save", handlers.SaveAttendanceHandler(app))
	router.POST("/api/attendance/delete", handlers.DeleteAttendanceHandler(app))
	router.GET("/api/attendance/export", handlers.ExportAttendanceHandler(app))
	router.GET("/api/attendance/dates", handlers.AttendanceDatesByCourseHandler(app))
	router.POST("/api/attendance/identify", handlers.IdentifyAttendanceHandler(app))
	router.GET("/api/payments/student/:numero_identificacion/status", handlers.GetStudentPaymentStatusHandler(app))
	router.POST("/api/payments/process", handlers.ProcessStudentPaymentHandler(app))
	router.POST("/api/payments/manual-status", handlers.UpdateStudentPaymentStatusManualHandler(app))
	router.GET("/api/payments/report", handlers.ListPaymentsReportHandler(app))

	router.GET("/api/dashboard/summary", handlers.DashboardSummaryHandler(app))
	router.GET("/api/person/by-id/:numero_identificacion", handlers.PersonLookupByIDHandler(app))
	router.POST("/api/person/identify-by-fingerprint", handlers.IdentifyPersonByFingerprintHandler(app))

	router.POST("/api/auth/sign-in", handlers.AuthSignInHandler(app))
	router.POST("/api/auth/sign-up", handlers.AuthSignUpHandler(app))
	router.POST("/api/auth/recover", handlers.AuthRecoverHandler(app))
	router.POST("/api/auth/verify-otp", handlers.AuthVerifyOTPHandler(app))
	router.POST("/api/auth/session-user", handlers.AuthSessionUserHandler(app))
	router.POST("/api/auth/update-password", handlers.AuthUpdatePasswordHandler(app))
	router.POST("/api/auth/sign-out", handlers.AuthSignOutHandler(app))
	router.POST("/api/auth/resolve-access", handlers.ResolveAccessHandler(app))
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
