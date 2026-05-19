package handlers

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"fingerprint-backend/models"
	"fingerprint-backend/services"
	"github.com/gin-gonic/gin"
)

func CourseMaterialsSnapshotHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		idCurso, ok := parseIntQuery(c, "id_curso")
		if !ok {
			return
		}

		userID := strings.TrimSpace(c.Query("user_id"))
		if userID == "" {
			jsonError(c, http.StatusBadRequest, "user_id es requerido")
			return
		}

		data, status, err := app.GetCourseMaterialsSnapshot(c.Request.Context(), idCurso, userID)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
	}
}

func CourseMaterialsCreateFolderHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.CourseMaterialCreateFolderRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		data, status, err := app.CreateCourseMaterialFolder(c.Request.Context(), req.IDCurso, req.ParentFolderID, req.Name, req.UserID)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(status, gin.H{"success": true, "data": data})
	}
}

func CourseMaterialsUploadFilesHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		idCurso, err := strconv.Atoi(strings.TrimSpace(c.PostForm("id_curso")))
		if err != nil || idCurso <= 0 {
			jsonError(c, http.StatusBadRequest, "id_curso invalido")
			return
		}

		folderID, err := strconv.Atoi(strings.TrimSpace(c.PostForm("folder_id")))
		if err != nil || folderID <= 0 {
			jsonError(c, http.StatusBadRequest, "folder_id invalido")
			return
		}

		userID := strings.TrimSpace(c.PostForm("user_id"))
		if userID == "" {
			jsonError(c, http.StatusBadRequest, "user_id es requerido")
			return
		}

		multipartForm, err := c.MultipartForm()
		if err != nil {
			jsonError(c, http.StatusBadRequest, "No se recibieron archivos validos")
			return
		}

		files := multipartForm.File["files"]
		if len(files) == 0 {
			jsonError(c, http.StatusBadRequest, "Debe enviar al menos un archivo")
			return
		}

		uploads := make([]services.CourseMaterialUploadInput, 0, len(files))
		for _, fileHeader := range files {
			uploadedFile, err := fileHeader.Open()
			if err != nil {
				jsonError(c, http.StatusBadRequest, fmt.Sprintf("No se pudo leer el archivo %s", fileHeader.Filename))
				return
			}

			data, readErr := io.ReadAll(uploadedFile)
			_ = uploadedFile.Close()
			if readErr != nil {
				jsonError(c, http.StatusBadRequest, fmt.Sprintf("No se pudo procesar el archivo %s", fileHeader.Filename))
				return
			}

			uploads = append(uploads, services.CourseMaterialUploadInput{
				FileName:    fileHeader.Filename,
				ContentType: fileHeader.Header.Get("Content-Type"),
				Data:        data,
			})
		}

		data, status, err := app.UploadCourseMaterialFiles(c.Request.Context(), idCurso, folderID, userID, uploads)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
	}
}

func CourseMaterialsDeleteFileHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.CourseMaterialDeleteFileRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		status, err := app.DeleteCourseMaterialFile(c.Request.Context(), req.ID, req.UserID)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func CourseMaterialsCreateYouTubeLinkHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.CourseMaterialCreateYouTubeLinkRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		data, status, err := app.CreateCourseMaterialYouTubeLink(
			c.Request.Context(),
			req.IDCurso,
			req.FolderID,
			req.URL,
			req.Title,
			req.UserID,
		)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(status, gin.H{"success": true, "data": data})
	}
}

func CourseMaterialsDownloadFileHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		fileID, ok := parseIntParam(c, "id")
		if !ok {
			return
		}

		userID := strings.TrimSpace(c.Query("user_id"))
		if userID == "" {
			jsonError(c, http.StatusBadRequest, "user_id es requerido")
			return
		}

		fileObject, status, err := app.DownloadCourseMaterialFile(c.Request.Context(), fileID, userID)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		fileName := strings.ReplaceAll(strings.TrimSpace(fileObject.FileName), "\"", "")
		if fileName == "" {
			fileName = "archivo"
		}

		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileName))
		c.Data(http.StatusOK, fileObject.ContentType, fileObject.Bytes)
	}
}

func CourseMaterialsUploadCoverHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		idCurso, err := strconv.Atoi(strings.TrimSpace(c.PostForm("id_curso")))
		if err != nil || idCurso <= 0 {
			jsonError(c, http.StatusBadRequest, "id_curso invalido")
			return
		}

		userID := strings.TrimSpace(c.PostForm("user_id"))
		if userID == "" {
			jsonError(c, http.StatusBadRequest, "user_id es requerido")
			return
		}

		imageHeader, err := c.FormFile("image")
		if err != nil {
			jsonError(c, http.StatusBadRequest, "Debe seleccionar una imagen")
			return
		}

		imageFile, err := imageHeader.Open()
		if err != nil {
			jsonError(c, http.StatusBadRequest, "No se pudo abrir la imagen")
			return
		}

		imageData, readErr := io.ReadAll(imageFile)
		_ = imageFile.Close()
		if readErr != nil {
			jsonError(c, http.StatusBadRequest, "No se pudo procesar la imagen")
			return
		}

		data, status, err := app.UploadCourseMaterialCover(c.Request.Context(), idCurso, userID, services.CourseMaterialUploadInput{
			FileName:    imageHeader.Filename,
			ContentType: imageHeader.Header.Get("Content-Type"),
			Data:        imageData,
		})
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
	}
}

func CourseMaterialsCoverHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		idCurso, ok := parseIntQuery(c, "id_curso")
		if !ok {
			return
		}

		userID := strings.TrimSpace(c.Query("user_id"))
		if userID == "" {
			jsonError(c, http.StatusBadRequest, "user_id es requerido")
			return
		}

		coverObject, status, err := app.DownloadCourseMaterialCover(c.Request.Context(), idCurso, userID)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.Header("Cache-Control", "no-store")
		c.Data(http.StatusOK, coverObject.ContentType, coverObject.Bytes)
	}
}

func CourseMaterialsUploadFolderCardHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		idCurso, err := strconv.Atoi(strings.TrimSpace(c.PostForm("id_curso")))
		if err != nil || idCurso <= 0 {
			jsonError(c, http.StatusBadRequest, "id_curso invalido")
			return
		}

		folderID, err := strconv.Atoi(strings.TrimSpace(c.PostForm("folder_id")))
		if err != nil || folderID <= 0 {
			jsonError(c, http.StatusBadRequest, "folder_id invalido")
			return
		}

		userID := strings.TrimSpace(c.PostForm("user_id"))
		if userID == "" {
			jsonError(c, http.StatusBadRequest, "user_id es requerido")
			return
		}

		imageHeader, err := c.FormFile("image")
		if err != nil {
			jsonError(c, http.StatusBadRequest, "Debe seleccionar una imagen")
			return
		}

		imageFile, err := imageHeader.Open()
		if err != nil {
			jsonError(c, http.StatusBadRequest, "No se pudo abrir la imagen")
			return
		}

		imageData, readErr := io.ReadAll(imageFile)
		_ = imageFile.Close()
		if readErr != nil {
			jsonError(c, http.StatusBadRequest, "No se pudo procesar la imagen")
			return
		}

		data, status, err := app.UploadCourseMaterialFolderCard(c.Request.Context(), idCurso, folderID, userID, services.CourseMaterialUploadInput{
			FileName:    imageHeader.Filename,
			ContentType: imageHeader.Header.Get("Content-Type"),
			Data:        imageData,
		})
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
	}
}

func CourseMaterialsFolderCardHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		folderID, ok := parseIntParam(c, "id")
		if !ok {
			return
		}

		userID := strings.TrimSpace(c.Query("user_id"))
		if userID == "" {
			jsonError(c, http.StatusBadRequest, "user_id es requerido")
			return
		}

		imageObject, status, err := app.DownloadCourseMaterialFolderCard(c.Request.Context(), folderID, userID)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.Header("Cache-Control", "no-store")
		c.Data(http.StatusOK, imageObject.ContentType, imageObject.Bytes)
	}
}
