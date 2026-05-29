package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"fingerprint-backend/models"
	"fingerprint-backend/services"
	"github.com/gin-gonic/gin"
)

func GetAcademicPeriodsHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		result, status, err := app.GetAcademicPeriods(c.Request.Context())
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
	}
}

func CreateAcademicPeriodHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.AcademicPeriodCreateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		createdBy := ""
		if req.CreatedBy != nil {
			createdBy = strings.TrimSpace(*req.CreatedBy)
		}

		result, status, err := app.CreateAcademicPeriod(c.Request.Context(), req.Year, req.Term, createdBy)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(status, gin.H{"success": true, "data": result})
	}
}

func GetGradesRosterHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		idCurso, ok := parseIntQuery(c, "id_curso")
		if !ok {
			return
		}

		periodIDValue, ok := parseIntQuery(c, "period_id")
		if !ok {
			return
		}

		result, status, err := app.GetGradesRoster(c.Request.Context(), idCurso, int64(periodIDValue))
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
	}
}

func SaveGradesHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.GradeSaveRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		result, status, err := app.SaveGrades(c.Request.Context(), req)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
	}
}

func UpdateProfessorSignatureHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.ProfessorSignatureUpdateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		result, status, err := app.UpdateProfessorSignature(c.Request.Context(), req)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
	}
}

func DownloadGradeReportHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		idCurso, ok := parseIntQuery(c, "id_curso")
		if !ok {
			return
		}

		periodIDValue, ok := parseIntQuery(c, "period_id")
		if !ok {
			return
		}

		numero := strings.TrimSpace(c.Query("numero_identificacion"))
		reportBytes, fileName, contentType, status, err := app.GenerateGradeReportPDF(
			c.Request.Context(),
			idCurso,
			int64(periodIDValue),
			numero,
		)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		safeFileName := strings.ReplaceAll(strings.TrimSpace(fileName), `"`, "")
		if safeFileName == "" {
			if strings.EqualFold(strings.TrimSpace(contentType), "application/zip") {
				safeFileName = fmt.Sprintf("boletines-curso-%d.zip", idCurso)
			} else {
				safeFileName = fmt.Sprintf("boletin-curso-%d.pdf", idCurso)
			}
		}

		if strings.TrimSpace(contentType) == "" {
			if strings.HasSuffix(strings.ToLower(safeFileName), ".zip") {
				contentType = "application/zip"
			} else {
				contentType = "application/pdf"
			}
		}

		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", safeFileName))
		c.Header("Cache-Control", "no-store")
		c.Data(http.StatusOK, contentType, reportBytes)
	}
}
