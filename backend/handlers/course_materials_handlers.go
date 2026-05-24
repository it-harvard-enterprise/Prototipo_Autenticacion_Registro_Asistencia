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

func resolveCourseMaterialsUserID(c *gin.Context) string {
	if userID := strings.TrimSpace(c.GetHeader("X-Materials-User-Id")); userID != "" {
		return userID
	}
	if userID := strings.TrimSpace(c.PostForm("user_id")); userID != "" {
		return userID
	}
	return strings.TrimSpace(c.Query("user_id"))
}

func CourseMaterialsSnapshotHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		idCurso, ok := parseIntQuery(c, "id_curso")
		if !ok {
			return
		}

		userID := resolveCourseMaterialsUserID(c)
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

func CourseMaterialsUpdateFolderHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.CourseMaterialUpdateFolderRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		data, status, err := app.UpdateCourseMaterialFolder(
			c.Request.Context(),
			req.IDCurso,
			req.FolderID,
			req.Name,
			req.UserID,
		)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(status, gin.H{"success": true, "data": data})
	}
}

func CourseMaterialsDeleteFolderHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.CourseMaterialDeleteFolderRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		status, err := app.DeleteCourseMaterialFolder(
			c.Request.Context(),
			req.IDCurso,
			req.FolderID,
			req.UserID,
		)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func CourseMaterialsUploadFilesHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := resolveCourseMaterialsUserID(c)
		if userID == "" {
			jsonError(c, http.StatusBadRequest, "user_id es requerido")
			return
		}

		reader, err := c.Request.MultipartReader()
		if err != nil {
			jsonError(c, http.StatusRequestEntityTooLarge, "No fue posible procesar los archivos enviados. Verifique el tamano del archivo y vuelva a intentarlo")
			return
		}

		idCurso := 0
		folderID := 0
		inserted := make([]map[string]any, 0)

		for {
			part, nextErr := reader.NextPart()
			if nextErr == io.EOF {
				break
			}
			if nextErr != nil {
				jsonError(c, http.StatusRequestEntityTooLarge, "No fue posible procesar los archivos enviados. Verifique el tamano del archivo y vuelva a intentarlo")
				return
			}

			if part.FileName() == "" {
				valueBytes, readErr := io.ReadAll(io.LimitReader(part, 4096))
				_ = part.Close()
				if readErr != nil {
					jsonError(c, http.StatusBadRequest, "No se pudo leer uno de los campos del formulario")
					return
				}

				value := strings.TrimSpace(string(valueBytes))
				switch part.FormName() {
				case "id_curso":
					parsed, convErr := strconv.Atoi(value)
					if convErr != nil || parsed <= 0 {
						jsonError(c, http.StatusBadRequest, "id_curso inválido")
						return
					}
					idCurso = parsed
				case "folder_id":
					parsed, convErr := strconv.Atoi(value)
					if convErr != nil || parsed <= 0 {
						jsonError(c, http.StatusBadRequest, "folder_id inválido")
						return
					}
					folderID = parsed
				}
				continue
			}

			if part.FormName() != "files" {
				_ = part.Close()
				continue
			}

			if idCurso <= 0 {
				_ = part.Close()
				jsonError(c, http.StatusBadRequest, "id_curso inválido")
				return
			}
			if folderID <= 0 {
				_ = part.Close()
				jsonError(c, http.StatusBadRequest, "folder_id inválido")
				return
			}

			data, status, uploadErr := app.UploadCourseMaterialFileStream(
				c.Request.Context(),
				idCurso,
				folderID,
				userID,
				part.FileName(),
				part.Header.Get("Content-Type"),
				part,
			)
			_ = part.Close()
			if uploadErr != nil {
				jsonError(c, status, uploadErr.Error())
				return
			}

			inserted = append(inserted, data)
		}

		if idCurso <= 0 {
			jsonError(c, http.StatusBadRequest, "id_curso inválido")
			return
		}
		if folderID <= 0 {
			jsonError(c, http.StatusBadRequest, "folder_id inválido")
			return
		}
		if len(inserted) == 0 {
			jsonError(c, http.StatusBadRequest, "Debe enviar al menos un archivo")
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true, "data": inserted})
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
			jsonError(c, http.StatusBadRequest, "id_curso inválido")
			return
		}

		userID := resolveCourseMaterialsUserID(c)
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

func CourseMaterialsSetCoverURLHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			IDCurso  int    `json:"id_curso"`
			ImageURL string `json:"image_url"`
			UserID   string `json:"user_id"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		resolvedUserID := strings.TrimSpace(req.UserID)
		if resolvedUserID == "" {
			resolvedUserID = resolveCourseMaterialsUserID(c)
		}
		if resolvedUserID == "" {
			jsonError(c, http.StatusBadRequest, "user_id es requerido")
			return
		}

		data, status, err := app.SetCourseMaterialCoverURL(
			c.Request.Context(),
			req.IDCurso,
			resolvedUserID,
			req.ImageURL,
		)
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

		userID := resolveCourseMaterialsUserID(c)
		if userID == "" {
			jsonError(c, http.StatusBadRequest, "user_id es requerido")
			return
		}

		coverObject, status, err := app.DownloadCourseMaterialCover(c.Request.Context(), idCurso, userID)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		if strings.TrimSpace(coverObject.SourceURL) != "" {
			c.Redirect(http.StatusTemporaryRedirect, coverObject.SourceURL)
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
			jsonError(c, http.StatusBadRequest, "id_curso inválido")
			return
		}

		folderID, err := strconv.Atoi(strings.TrimSpace(c.PostForm("folder_id")))
		if err != nil || folderID <= 0 {
			jsonError(c, http.StatusBadRequest, "folder_id inválido")
			return
		}

		userID := resolveCourseMaterialsUserID(c)
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

func CourseMaterialsSetFolderCardURLHandler(app *services.App) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			IDCurso  int    `json:"id_curso"`
			FolderID int    `json:"folder_id"`
			ImageURL string `json:"image_url"`
			UserID   string `json:"user_id"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			jsonError(c, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		resolvedUserID := strings.TrimSpace(req.UserID)
		if resolvedUserID == "" {
			resolvedUserID = resolveCourseMaterialsUserID(c)
		}
		if resolvedUserID == "" {
			jsonError(c, http.StatusBadRequest, "user_id es requerido")
			return
		}

		data, status, err := app.SetCourseMaterialFolderCardURL(
			c.Request.Context(),
			req.IDCurso,
			req.FolderID,
			resolvedUserID,
			req.ImageURL,
		)
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

		userID := resolveCourseMaterialsUserID(c)
		if userID == "" {
			jsonError(c, http.StatusBadRequest, "user_id es requerido")
			return
		}

		imageObject, status, err := app.DownloadCourseMaterialFolderCard(c.Request.Context(), folderID, userID)
		if err != nil {
			jsonError(c, status, err.Error())
			return
		}

		if strings.TrimSpace(imageObject.SourceURL) != "" {
			c.Redirect(http.StatusTemporaryRedirect, imageObject.SourceURL)
			return
		}

		c.Header("Cache-Control", "no-store")
		c.Data(http.StatusOK, imageObject.ContentType, imageObject.Bytes)
	}
}
