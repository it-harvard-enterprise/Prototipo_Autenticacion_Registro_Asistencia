package services

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"strings"
	"time"
)

const (
	maxCourseMaterialFileBytes       int64 = 25 * 1024 * 1024
	maxCourseMaterialCoverBytes      int64 = 10 * 1024 * 1024
	maxCourseMaterialFolderCardBytes int64 = 10 * 1024 * 1024
	youtubeMaterialBucket                  = "youtube_link"
	youtubeMaterialContentType             = "video/youtube"
)

type CourseMaterialUploadInput struct {
	FileName    string
	ContentType string
	Data        []byte
}

type CourseMaterialObject struct {
	Bytes       []byte
	ContentType string
	FileName    string
}

func normalizeCourseMaterialFileName(name string, fallback string) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		trimmed = fallback
	}

	base := trimmed
	ext := ""
	if dot := strings.LastIndex(trimmed, "."); dot > 0 {
		base = trimmed[:dot]
		ext = strings.ToLower(trimmed[dot:])
	}

	safeBase := sanitizeCourseMaterialToken(base)
	if safeBase == "" {
		safeBase = fallback
	}
	if len(safeBase) > 80 {
		safeBase = safeBase[:80]
	}

	safeExt := sanitizeCourseMaterialExt(ext)
	return safeBase + safeExt
}

func sanitizeCourseMaterialToken(value string) string {
	var builder strings.Builder
	lastUnderscore := false

	for _, r := range value {
		isLetter := (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z')
		isNumber := r >= '0' && r <= '9'
		isAllowed := isLetter || isNumber || r == '_' || r == '-'

		if isAllowed {
			builder.WriteRune(r)
			lastUnderscore = false
			continue
		}

		if !lastUnderscore {
			builder.WriteByte('_')
			lastUnderscore = true
		}
	}

	return strings.Trim(builder.String(), "_")
}

func sanitizeCourseMaterialExt(value string) string {
	if value == "" {
		return ""
	}

	var builder strings.Builder
	builder.WriteByte('.')
	for _, r := range strings.TrimPrefix(value, ".") {
		isLetter := (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z')
		isNumber := r >= '0' && r <= '9'
		if isLetter || isNumber {
			builder.WriteRune(r)
		}
	}

	ext := builder.String()
	if ext == "." {
		return ""
	}
	if len(ext) > 12 {
		return ext[:12]
	}

	return strings.ToLower(ext)
}

func randomCourseMaterialSuffix() string {
	raw := make([]byte, 4)
	if _, err := rand.Read(raw); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}

	return hex.EncodeToString(raw)
}

func escapeStoragePath(storagePath string) string {
	parts := strings.Split(strings.Trim(storagePath, "/"), "/")
	for index := range parts {
		parts[index] = url.PathEscape(parts[index])
	}
	return strings.Join(parts, "/")
}

func getCourseMaterialsBucketName() (string, error) {
	bucket := strings.TrimSpace(os.Getenv("SUPABASE_MATERIALS_BUCKET"))
	if bucket == "" {
		bucket = strings.TrimSpace(os.Getenv("NEXT_PUBLIC_SUPABASE_MATERIALS_BUCKET"))
	}
	if bucket == "" {
		return "", errors.New("Falta configurar SUPABASE_MATERIALS_BUCKET en el backend")
	}

	return bucket, nil
}

func (a *App) resolveCourseMaterialsAccess(ctx context.Context, userID string, requireManage bool) (string, int, error) {
	resolvedUserID := strings.TrimSpace(userID)
	if resolvedUserID == "" {
		return "", http.StatusBadRequest, errors.New("user_id es requerido")
	}

	query := url.Values{}
	query.Set("select", "role,approved")
	query.Set("id", fmt.Sprintf("eq.%s", resolvedUserID))

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/profiles", query, nil, false)
	if err != nil {
		return "", status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return "", http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return "", http.StatusForbidden, errors.New("No existe un perfil autorizado para este usuario")
	}

	role, _ := asString(rows[0]["role"])
	role = strings.ToLower(strings.TrimSpace(role))
	approved, _ := asBool(rows[0]["approved"])

	if !approved {
		return "", http.StatusForbidden, errors.New("Su usuario no esta aprobado para esta funcionalidad")
	}

	if role != "administrador" && role != "profesor" && role != "estudiante" {
		return "", http.StatusForbidden, errors.New("Rol no autorizado para consultar materiales")
	}

	if requireManage && role != "administrador" && role != "profesor" {
		return "", http.StatusForbidden, errors.New("No tiene permisos para gestionar materiales")
	}

	if role == "estudiante" {
		studentQuery := url.Values{}
		studentQuery.Set("select", "numero_identificacion,saldo_estudiantes(clases_adeudadas)")
		studentQuery.Set("auth_user_id", fmt.Sprintf("eq.%s", resolvedUserID))
		studentQuery.Set("deleted_at", "is.null")

		studentBody, studentStatus, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/estudiantes", studentQuery, nil, false)
		if err != nil {
			return "", studentStatus, err
		}

		studentRows, err := unmarshalRows(studentBody)
		if err != nil {
			return "", http.StatusInternalServerError, err
		}
		if len(studentRows) == 0 {
			return "", http.StatusForbidden, errors.New("No existe un estudiante asociado a este usuario")
		}

		saldoRow := extractEmbeddedRow(studentRows[0]["saldo_estudiantes"])
		clasesAdeudadas, ok := asInt(saldoRow["clases_adeudadas"])
		if !ok || clasesAdeudadas < 0 {
			clasesAdeudadas = 0
		}

		if clasesAdeudadas > 0 {
			return "", http.StatusForbidden, errors.New("Acceso bloqueado a materiales del curso por deuda pendiente")
		}
	}

	return role, http.StatusOK, nil
}

func (a *App) callSupabaseStorage(
	ctx context.Context,
	method string,
	pathWithPrefix string,
	body []byte,
	contentType string,
	extraHeaders map[string]string,
) ([]byte, http.Header, int, error) {
	requestURL := a.SupabaseURL + "/storage/v1" + pathWithPrefix

	var bodyReader io.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, method, requestURL, bodyReader)
	if err != nil {
		return nil, nil, http.StatusInternalServerError, err
	}

	req.Header.Set("apikey", a.ServiceKey)
	req.Header.Set("Authorization", "Bearer "+a.ServiceKey)
	if strings.TrimSpace(contentType) != "" {
		req.Header.Set("Content-Type", contentType)
	}
	for key, value := range extraHeaders {
		req.Header.Set(key, value)
	}

	resp, err := a.HTTPClient.Do(req)
	if err != nil {
		return nil, nil, http.StatusBadGateway, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, http.StatusBadGateway, err
	}

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return respBody, resp.Header, resp.StatusCode, nil
	}

	var storageErr supabaseError
	_ = json.Unmarshal(respBody, &storageErr)
	if storageErr.Message != "" {
		return nil, nil, resp.StatusCode, fmt.Errorf("supabase storage error: %s", storageErr.Message)
	}

	return nil, nil, resp.StatusCode, fmt.Errorf("supabase storage request failed with status %d", resp.StatusCode)
}

func (a *App) uploadStorageObject(ctx context.Context, bucket string, storagePath string, contentType string, data []byte) (int, error) {
	apiPath := fmt.Sprintf("/object/%s/%s", url.PathEscape(bucket), escapeStoragePath(storagePath))
	_, _, status, err := a.callSupabaseStorage(ctx, http.MethodPost, apiPath, data, contentType, map[string]string{
		"x-upsert": "false",
	})
	return status, err
}

func (a *App) deleteStorageObject(ctx context.Context, bucket string, storagePath string) (int, error) {
	apiPath := fmt.Sprintf("/object/%s/%s", url.PathEscape(bucket), escapeStoragePath(storagePath))
	_, _, status, err := a.callSupabaseStorage(ctx, http.MethodDelete, apiPath, nil, "", nil)
	return status, err
}

func (a *App) downloadStorageObject(ctx context.Context, bucket string, storagePath string) ([]byte, string, int, error) {
	apiPath := fmt.Sprintf("/object/%s/%s", url.PathEscape(bucket), escapeStoragePath(storagePath))
	body, headers, status, err := a.callSupabaseStorage(ctx, http.MethodGet, apiPath, nil, "", nil)
	if err != nil {
		return nil, "", status, err
	}

	return body, headers.Get("Content-Type"), status, nil
}

func (a *App) GetCourseMaterialsSnapshot(ctx context.Context, idCurso int, userID string) (map[string]any, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso invalido")
	}

	if _, status, err := a.resolveCourseMaterialsAccess(ctx, userID, false); err != nil {
		return nil, status, err
	}

	foldersQuery := url.Values{}
	foldersQuery.Set("select", "id,id_curso,parent_folder_id,name,created_at,updated_at,card_storage_bucket,card_storage_path")
	foldersQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
	foldersQuery.Set("order", "created_at.asc")

	foldersBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/course_material_folders", foldersQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	filesQuery := url.Values{}
	filesQuery.Set("select", "id,id_curso,folder_id,file_name,content_type,file_size,created_at,storage_path")
	filesQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
	filesQuery.Set("order", "created_at.desc")

	filesBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/course_material_files", filesQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	settingsQuery := url.Values{}
	settingsQuery.Set("select", "cover_storage_bucket,cover_storage_path,updated_at")
	settingsQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
	settingsBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/course_material_course_settings", settingsQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	folderRows, err := unmarshalRows(foldersBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	fileRows, err := unmarshalRows(filesBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	settingsRows, err := unmarshalRows(settingsBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	filesCountByFolder := map[int]int{}
	files := make([]map[string]any, 0, len(fileRows))
	for _, row := range fileRows {
		fileID, _ := asInt(row["id"])
		rowIDCurso, _ := asInt(row["id_curso"])
		folderID, _ := asInt(row["folder_id"])
		fileName, _ := asString(row["file_name"])
		contentType, _ := asString(row["content_type"])
		fileSize, _ := asInt(row["file_size"])
		createdAt, _ := asString(row["created_at"])
		storagePath, _ := asString(row["storage_path"])

		filesCountByFolder[folderID] = filesCountByFolder[folderID] + 1

		youtubeURL := ""
		if strings.TrimSpace(contentType) == youtubeMaterialContentType {
			youtubeURL = strings.TrimSpace(storagePath)
		}

		files = append(files, map[string]any{
			"id":           fileID,
			"id_curso":     rowIDCurso,
			"folder_id":    folderID,
			"file_name":    fileName,
			"content_type": nullableString(contentType),
			"file_size":    fileSize,
			"created_at":   createdAt,
			"youtube_url":  nullableString(youtubeURL),
		})
	}

	folders := make([]map[string]any, 0, len(folderRows))
	for _, row := range folderRows {
		folderID, _ := asInt(row["id"])
		rowIDCurso, _ := asInt(row["id_curso"])
		parentFolderID, _ := asInt(row["parent_folder_id"])
		name, _ := asString(row["name"])
		createdAt, _ := asString(row["created_at"])
		updatedAt, _ := asString(row["updated_at"])
		cardBucket, _ := asString(row["card_storage_bucket"])
		cardPath, _ := asString(row["card_storage_path"])

		cardUpdatedAt := ""
		if strings.TrimSpace(cardBucket) != "" && strings.TrimSpace(cardPath) != "" {
			cardUpdatedAt = updatedAt
		}

		folders = append(folders, map[string]any{
			"id":       folderID,
			"id_curso": rowIDCurso,
			"parent_folder_id": func() any {
				if parentFolderID <= 0 {
					return nil
				}
				return parentFolderID
			}(),
			"name":            name,
			"created_at":      createdAt,
			"updated_at":      updatedAt,
			"card_updated_at": nullableString(cardUpdatedAt),
			"files_count":     filesCountByFolder[folderID],
		})
	}

	coverUpdatedAt := ""
	if len(settingsRows) > 0 {
		coverBucket, _ := asString(settingsRows[0]["cover_storage_bucket"])
		coverPath, _ := asString(settingsRows[0]["cover_storage_path"])
		if strings.TrimSpace(coverBucket) != "" && strings.TrimSpace(coverPath) != "" {
			coverUpdatedAt, _ = asString(settingsRows[0]["updated_at"])
		}
	}

	return map[string]any{
		"cover_updated_at": nullableString(coverUpdatedAt),
		"folders":          folders,
		"files":            files,
	}, http.StatusOK, nil
}

func (a *App) CreateCourseMaterialFolder(ctx context.Context, idCurso int, parentFolderID *int, name string, userID string) (map[string]any, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso invalido")
	}

	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return nil, http.StatusBadRequest, errors.New("El nombre de la carpeta es obligatorio")
	}

	resolvedUserID := strings.TrimSpace(userID)
	if _, status, err := a.resolveCourseMaterialsAccess(ctx, resolvedUserID, true); err != nil {
		return nil, status, err
	}

	var normalizedParentFolderID any = nil
	if parentFolderID != nil {
		if *parentFolderID <= 0 {
			return nil, http.StatusBadRequest, errors.New("parent_folder_id invalido")
		}
		if status, err := a.validateCourseMaterialFolder(ctx, idCurso, *parentFolderID); err != nil {
			return nil, status, err
		}
		normalizedParentFolderID = *parentFolderID
	}

	query := url.Values{}
	query.Set("select", "id,id_curso,parent_folder_id,name,created_at,updated_at")
	payload := map[string]any{
		"id_curso":         idCurso,
		"parent_folder_id": normalizedParentFolderID,
		"name":             trimmedName,
		"created_by":       resolvedUserID,
	}

	body, status, err := a.CallSupabase(ctx, http.MethodPost, "/rest/v1/course_material_folders", query, payload, true)
	if err != nil {
		if status == http.StatusConflict {
			return nil, http.StatusConflict, errors.New("Ya existe una carpeta con ese nombre en el mismo nivel")
		}
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return nil, http.StatusInternalServerError, errors.New("No se pudo crear la carpeta")
	}

	return rows[0], http.StatusCreated, nil
}

func (a *App) validateCourseMaterialFolder(ctx context.Context, idCurso int, folderID int) (int, error) {
	query := url.Values{}
	query.Set("select", "id")
	query.Set("id", fmt.Sprintf("eq.%d", folderID))
	query.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/course_material_folders", query, nil, false)
	if err != nil {
		return status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return http.StatusNotFound, errors.New("La carpeta no existe o no pertenece al curso")
	}

	return http.StatusOK, nil
}

func resolveYouTubeVideoID(rawURL string) (string, error) {
	trimmedURL := strings.TrimSpace(rawURL)
	if trimmedURL == "" {
		return "", errors.New("Debe enviar un enlace de YouTube")
	}

	parsedURL, err := url.Parse(trimmedURL)
	if err != nil || parsedURL.Host == "" {
		return "", errors.New("El enlace de YouTube es invalido")
	}

	host := strings.ToLower(strings.TrimPrefix(parsedURL.Host, "www."))
	pathValue := strings.Trim(parsedURL.Path, "/")
	videoID := ""

	switch host {
	case "youtu.be":
		if pathValue != "" {
			videoID = strings.Split(pathValue, "/")[0]
		}
	case "youtube.com", "m.youtube.com", "music.youtube.com":
		if strings.HasPrefix(pathValue, "watch") {
			videoID = strings.TrimSpace(parsedURL.Query().Get("v"))
		} else if strings.HasPrefix(pathValue, "shorts/") {
			videoID = strings.TrimSpace(strings.Split(strings.TrimPrefix(pathValue, "shorts/"), "/")[0])
		} else if strings.HasPrefix(pathValue, "embed/") {
			videoID = strings.TrimSpace(strings.Split(strings.TrimPrefix(pathValue, "embed/"), "/")[0])
		}
	default:
		return "", errors.New("Solo se permiten enlaces de YouTube")
	}

	if videoID == "" {
		return "", errors.New("No se pudo identificar el video de YouTube")
	}

	for _, char := range videoID {
		isLetter := (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z')
		isNumber := char >= '0' && char <= '9'
		if !isLetter && !isNumber && char != '-' && char != '_' {
			return "", errors.New("El identificador del video de YouTube es invalido")
		}
	}

	if len(videoID) < 6 {
		return "", errors.New("El identificador del video de YouTube es invalido")
	}

	return videoID, nil
}

func (a *App) CreateCourseMaterialYouTubeLink(ctx context.Context, idCurso int, folderID int, rawURL string, title string, userID string) (map[string]any, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso invalido")
	}
	if folderID <= 0 {
		return nil, http.StatusBadRequest, errors.New("folder_id invalido")
	}

	resolvedUserID := strings.TrimSpace(userID)
	if _, status, err := a.resolveCourseMaterialsAccess(ctx, resolvedUserID, true); err != nil {
		return nil, status, err
	}

	if status, err := a.validateCourseMaterialFolder(ctx, idCurso, folderID); err != nil {
		return nil, status, err
	}

	videoID, err := resolveYouTubeVideoID(rawURL)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}

	canonicalURL := fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID)
	resolvedTitle := strings.TrimSpace(title)
	if resolvedTitle == "" {
		resolvedTitle = fmt.Sprintf("YouTube: %s", videoID)
	}

	insertQuery := url.Values{}
	insertQuery.Set("select", "id,folder_id,file_name,content_type,file_size,created_at,storage_path")
	insertPayload := map[string]any{
		"id_curso":       idCurso,
		"folder_id":      folderID,
		"file_name":      resolvedTitle,
		"storage_bucket": youtubeMaterialBucket,
		"storage_path":   canonicalURL,
		"content_type":   youtubeMaterialContentType,
		"file_size":      1,
		"uploaded_by":    resolvedUserID,
	}

	insertBody, status, err := a.CallSupabase(ctx, http.MethodPost, "/rest/v1/course_material_files", insertQuery, insertPayload, true)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(insertBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return nil, http.StatusInternalServerError, errors.New("No se pudo guardar el enlace de YouTube")
	}

	row := rows[0]
	row["youtube_url"] = canonicalURL
	return row, http.StatusCreated, nil
}

func (a *App) UploadCourseMaterialFiles(
	ctx context.Context,
	idCurso int,
	folderID int,
	userID string,
	uploads []CourseMaterialUploadInput,
) ([]map[string]any, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso invalido")
	}
	if folderID <= 0 {
		return nil, http.StatusBadRequest, errors.New("folder_id invalido")
	}
	if len(uploads) == 0 {
		return nil, http.StatusBadRequest, errors.New("Debe enviar al menos un archivo")
	}

	resolvedUserID := strings.TrimSpace(userID)
	if _, status, err := a.resolveCourseMaterialsAccess(ctx, resolvedUserID, true); err != nil {
		return nil, status, err
	}

	if status, err := a.validateCourseMaterialFolder(ctx, idCurso, folderID); err != nil {
		return nil, status, err
	}

	bucket, err := getCourseMaterialsBucketName()
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	inserted := make([]map[string]any, 0, len(uploads))
	for _, upload := range uploads {
		originalName := strings.TrimSpace(upload.FileName)
		if originalName == "" {
			originalName = "archivo"
		}

		fileSize := int64(len(upload.Data))
		if fileSize <= 0 {
			return nil, http.StatusBadRequest, fmt.Errorf("El archivo %s no contiene datos", originalName)
		}
		if fileSize > maxCourseMaterialFileBytes {
			return nil, http.StatusBadRequest, fmt.Errorf("El archivo %s supera el limite de 25 MB", originalName)
		}

		safeName := normalizeCourseMaterialFileName(originalName, "archivo")
		uniquePrefix := fmt.Sprintf("%d-%s", time.Now().UnixMilli(), randomCourseMaterialSuffix())
		storagePath := fmt.Sprintf("courses/%d/folders/%d/%s-%s", idCurso, folderID, uniquePrefix, safeName)

		contentType := strings.TrimSpace(upload.ContentType)
		if contentType == "" {
			contentType = "application/octet-stream"
		}

		if status, err := a.uploadStorageObject(ctx, bucket, storagePath, contentType, upload.Data); err != nil {
			return nil, status, err
		}

		insertQuery := url.Values{}
		insertQuery.Set("select", "id,folder_id,file_name,content_type,file_size,created_at")
		insertPayload := map[string]any{
			"id_curso":       idCurso,
			"folder_id":      folderID,
			"file_name":      originalName,
			"storage_bucket": bucket,
			"storage_path":   storagePath,
			"content_type":   nullableString(contentType),
			"file_size":      fileSize,
			"uploaded_by":    resolvedUserID,
		}

		insertBody, status, err := a.CallSupabase(ctx, http.MethodPost, "/rest/v1/course_material_files", insertQuery, insertPayload, true)
		if err != nil {
			_, _ = a.deleteStorageObject(ctx, bucket, storagePath)
			return nil, status, err
		}

		rows, err := unmarshalRows(insertBody)
		if err != nil {
			_, _ = a.deleteStorageObject(ctx, bucket, storagePath)
			return nil, http.StatusInternalServerError, err
		}
		if len(rows) == 0 {
			_, _ = a.deleteStorageObject(ctx, bucket, storagePath)
			return nil, http.StatusInternalServerError, errors.New("No se pudo guardar el registro del archivo")
		}

		inserted = append(inserted, rows[0])
	}

	return inserted, http.StatusOK, nil
}

func (a *App) DeleteCourseMaterialFile(ctx context.Context, fileID int, userID string) (int, error) {
	if fileID <= 0 {
		return http.StatusBadRequest, errors.New("id de archivo invalido")
	}

	if _, status, err := a.resolveCourseMaterialsAccess(ctx, userID, true); err != nil {
		return status, err
	}

	lookupQuery := url.Values{}
	lookupQuery.Set("select", "id,storage_bucket,storage_path,content_type")
	lookupQuery.Set("id", fmt.Sprintf("eq.%d", fileID))

	lookupBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/course_material_files", lookupQuery, nil, false)
	if err != nil {
		return status, err
	}

	rows, err := unmarshalRows(lookupBody)
	if err != nil {
		return http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return http.StatusNotFound, errors.New("Archivo no encontrado")
	}

	bucket, _ := asString(rows[0]["storage_bucket"])
	storagePath, _ := asString(rows[0]["storage_path"])
	contentType, _ := asString(rows[0]["content_type"])
	isYouTube := strings.TrimSpace(bucket) == youtubeMaterialBucket || strings.TrimSpace(contentType) == youtubeMaterialContentType
	if !isYouTube && strings.TrimSpace(bucket) != "" && strings.TrimSpace(storagePath) != "" {
		storageStatus, storageErr := a.deleteStorageObject(ctx, bucket, storagePath)
		if storageErr != nil && storageStatus != http.StatusNotFound {
			return storageStatus, storageErr
		}
	}

	deleteQuery := url.Values{}
	deleteQuery.Set("id", fmt.Sprintf("eq.%d", fileID))
	_, status, err = a.CallSupabase(ctx, http.MethodDelete, "/rest/v1/course_material_files", deleteQuery, nil, false)
	if err != nil {
		return status, err
	}

	return http.StatusOK, nil
}

func (a *App) DownloadCourseMaterialFile(ctx context.Context, fileID int, userID string) (*CourseMaterialObject, int, error) {
	if fileID <= 0 {
		return nil, http.StatusBadRequest, errors.New("id de archivo invalido")
	}

	if _, status, err := a.resolveCourseMaterialsAccess(ctx, userID, false); err != nil {
		return nil, status, err
	}

	query := url.Values{}
	query.Set("select", "file_name,storage_bucket,storage_path,content_type")
	query.Set("id", fmt.Sprintf("eq.%d", fileID))

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/course_material_files", query, nil, false)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return nil, http.StatusNotFound, errors.New("Archivo no encontrado")
	}

	fileName, _ := asString(rows[0]["file_name"])
	bucket, _ := asString(rows[0]["storage_bucket"])
	storagePath, _ := asString(rows[0]["storage_path"])
	dbContentType, _ := asString(rows[0]["content_type"])
	isYouTube := strings.TrimSpace(bucket) == youtubeMaterialBucket || strings.TrimSpace(dbContentType) == youtubeMaterialContentType
	if isYouTube {
		return nil, http.StatusBadRequest, errors.New("Este enlace de YouTube se visualiza desde la pagina de carpeta")
	}

	if strings.TrimSpace(bucket) == "" || strings.TrimSpace(storagePath) == "" {
		return nil, http.StatusInternalServerError, errors.New("El archivo no tiene ruta de almacenamiento valida")
	}

	bytes, storageContentType, status, err := a.downloadStorageObject(ctx, bucket, storagePath)
	if err != nil {
		return nil, status, err
	}

	contentType := strings.TrimSpace(storageContentType)
	if contentType == "" {
		contentType = strings.TrimSpace(dbContentType)
	}
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	return &CourseMaterialObject{
		Bytes:       bytes,
		ContentType: contentType,
		FileName:    fileName,
	}, http.StatusOK, nil
}

func (a *App) UploadCourseMaterialCover(ctx context.Context, idCurso int, userID string, image CourseMaterialUploadInput) (map[string]any, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso invalido")
	}

	if _, status, err := a.resolveCourseMaterialsAccess(ctx, userID, true); err != nil {
		return nil, status, err
	}

	if len(image.Data) == 0 {
		return nil, http.StatusBadRequest, errors.New("Debe enviar una imagen")
	}
	if int64(len(image.Data)) > maxCourseMaterialCoverBytes {
		return nil, http.StatusBadRequest, errors.New("La imagen supera el limite de 10 MB")
	}

	contentType := strings.TrimSpace(image.ContentType)
	if !strings.HasPrefix(contentType, "image/") {
		return nil, http.StatusBadRequest, errors.New("El archivo debe ser una imagen")
	}

	bucket, err := getCourseMaterialsBucketName()
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	lookupQuery := url.Values{}
	lookupQuery.Set("select", "id_curso,cover_storage_bucket,cover_storage_path")
	lookupQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))

	lookupBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/course_material_course_settings", lookupQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	settingsRows, err := unmarshalRows(lookupBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	oldBucket := ""
	oldPath := ""
	if len(settingsRows) > 0 {
		oldBucket, _ = asString(settingsRows[0]["cover_storage_bucket"])
		oldPath, _ = asString(settingsRows[0]["cover_storage_path"])
	}

	safeName := normalizeCourseMaterialFileName(strings.TrimSpace(image.FileName), "portada")
	uniquePrefix := fmt.Sprintf("%d-%s", time.Now().UnixMilli(), randomCourseMaterialSuffix())
	storagePath := fmt.Sprintf("courses/%d/cover/%s-%s", idCurso, uniquePrefix, safeName)

	if status, err := a.uploadStorageObject(ctx, bucket, storagePath, contentType, image.Data); err != nil {
		return nil, status, err
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)
	payload := map[string]any{
		"cover_storage_bucket": bucket,
		"cover_storage_path":   storagePath,
		"updated_by":           strings.TrimSpace(userID),
		"updated_at":           now,
	}

	var writeBody []byte
	if len(settingsRows) > 0 {
		updateQuery := url.Values{}
		updateQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
		updateQuery.Set("select", "updated_at")

		writeBody, status, err = a.CallSupabase(ctx, http.MethodPatch, "/rest/v1/course_material_course_settings", updateQuery, payload, true)
		if err != nil {
			_, _ = a.deleteStorageObject(ctx, bucket, storagePath)
			return nil, status, err
		}
	} else {
		insertQuery := url.Values{}
		insertQuery.Set("select", "updated_at")
		insertPayload := map[string]any{
			"id_curso":             idCurso,
			"cover_storage_bucket": bucket,
			"cover_storage_path":   storagePath,
			"updated_by":           strings.TrimSpace(userID),
			"updated_at":           now,
		}

		writeBody, status, err = a.CallSupabase(ctx, http.MethodPost, "/rest/v1/course_material_course_settings", insertQuery, insertPayload, true)
		if err != nil {
			_, _ = a.deleteStorageObject(ctx, bucket, storagePath)
			return nil, status, err
		}
	}

	if strings.TrimSpace(oldBucket) != "" && strings.TrimSpace(oldPath) != "" && oldPath != storagePath {
		_, _ = a.deleteStorageObject(ctx, oldBucket, oldPath)
	}

	updatedAt := now
	rows, err := unmarshalRows(writeBody)
	if err == nil && len(rows) > 0 {
		if parsed, ok := asString(rows[0]["updated_at"]); ok && strings.TrimSpace(parsed) != "" {
			updatedAt = parsed
		}
	}

	return map[string]any{
		"cover_updated_at": updatedAt,
	}, http.StatusOK, nil
}

func (a *App) DownloadCourseMaterialCover(ctx context.Context, idCurso int, userID string) (*CourseMaterialObject, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso invalido")
	}

	if _, status, err := a.resolveCourseMaterialsAccess(ctx, userID, false); err != nil {
		return nil, status, err
	}

	query := url.Values{}
	query.Set("select", "cover_storage_bucket,cover_storage_path")
	query.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/course_material_course_settings", query, nil, false)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return nil, http.StatusNotFound, errors.New("El curso no tiene portada configurada")
	}

	bucket, _ := asString(rows[0]["cover_storage_bucket"])
	storagePath, _ := asString(rows[0]["cover_storage_path"])
	if strings.TrimSpace(bucket) == "" || strings.TrimSpace(storagePath) == "" {
		return nil, http.StatusNotFound, errors.New("El curso no tiene portada configurada")
	}

	coverBytes, contentType, status, err := a.downloadStorageObject(ctx, bucket, storagePath)
	if err != nil {
		return nil, status, err
	}

	if strings.TrimSpace(contentType) == "" {
		contentType = "image/jpeg"
	}

	return &CourseMaterialObject{
		Bytes:       coverBytes,
		ContentType: contentType,
		FileName:    path.Base(storagePath),
	}, http.StatusOK, nil
}

func (a *App) UploadCourseMaterialFolderCard(ctx context.Context, idCurso int, folderID int, userID string, image CourseMaterialUploadInput) (map[string]any, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso invalido")
	}
	if folderID <= 0 {
		return nil, http.StatusBadRequest, errors.New("folder_id invalido")
	}

	if _, status, err := a.resolveCourseMaterialsAccess(ctx, userID, true); err != nil {
		return nil, status, err
	}

	if len(image.Data) == 0 {
		return nil, http.StatusBadRequest, errors.New("Debe enviar una imagen")
	}
	if int64(len(image.Data)) > maxCourseMaterialFolderCardBytes {
		return nil, http.StatusBadRequest, errors.New("La imagen supera el limite de 10 MB")
	}

	contentType := strings.TrimSpace(image.ContentType)
	if !strings.HasPrefix(contentType, "image/") {
		return nil, http.StatusBadRequest, errors.New("El archivo debe ser una imagen")
	}

	folderQuery := url.Values{}
	folderQuery.Set("select", "id,id_curso,card_storage_bucket,card_storage_path")
	folderQuery.Set("id", fmt.Sprintf("eq.%d", folderID))
	folderQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))

	folderBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/course_material_folders", folderQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	folderRows, err := unmarshalRows(folderBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(folderRows) == 0 {
		return nil, http.StatusNotFound, errors.New("La carpeta no existe o no pertenece al curso")
	}

	oldBucket, _ := asString(folderRows[0]["card_storage_bucket"])
	oldPath, _ := asString(folderRows[0]["card_storage_path"])

	bucket, err := getCourseMaterialsBucketName()
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	safeName := normalizeCourseMaterialFileName(strings.TrimSpace(image.FileName), "carpeta")
	uniquePrefix := fmt.Sprintf("%d-%s", time.Now().UnixMilli(), randomCourseMaterialSuffix())
	storagePath := fmt.Sprintf("courses/%d/folders/%d/card/%s-%s", idCurso, folderID, uniquePrefix, safeName)

	if status, err := a.uploadStorageObject(ctx, bucket, storagePath, contentType, image.Data); err != nil {
		return nil, status, err
	}

	updateQuery := url.Values{}
	updateQuery.Set("id", fmt.Sprintf("eq.%d", folderID))
	updateQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
	updateQuery.Set("select", "updated_at")

	updatePayload := map[string]any{
		"card_storage_bucket": bucket,
		"card_storage_path":   storagePath,
	}

	updateBody, status, err := a.CallSupabase(ctx, http.MethodPatch, "/rest/v1/course_material_folders", updateQuery, updatePayload, true)
	if err != nil {
		_, _ = a.deleteStorageObject(ctx, bucket, storagePath)
		return nil, status, err
	}

	if strings.TrimSpace(oldBucket) != "" && strings.TrimSpace(oldPath) != "" && oldPath != storagePath {
		_, _ = a.deleteStorageObject(ctx, oldBucket, oldPath)
	}

	updatedAt := time.Now().UTC().Format(time.RFC3339Nano)
	updatedRows, err := unmarshalRows(updateBody)
	if err == nil && len(updatedRows) > 0 {
		if parsed, ok := asString(updatedRows[0]["updated_at"]); ok && strings.TrimSpace(parsed) != "" {
			updatedAt = parsed
		}
	}

	return map[string]any{
		"folder_id":       folderID,
		"card_updated_at": updatedAt,
	}, http.StatusOK, nil
}

func (a *App) DownloadCourseMaterialFolderCard(ctx context.Context, folderID int, userID string) (*CourseMaterialObject, int, error) {
	if folderID <= 0 {
		return nil, http.StatusBadRequest, errors.New("folder_id invalido")
	}

	if _, status, err := a.resolveCourseMaterialsAccess(ctx, userID, false); err != nil {
		return nil, status, err
	}

	query := url.Values{}
	query.Set("select", "name,card_storage_bucket,card_storage_path")
	query.Set("id", fmt.Sprintf("eq.%d", folderID))

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/course_material_folders", query, nil, false)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return nil, http.StatusNotFound, errors.New("Carpeta no encontrada")
	}

	bucket, _ := asString(rows[0]["card_storage_bucket"])
	storagePath, _ := asString(rows[0]["card_storage_path"])
	if strings.TrimSpace(bucket) == "" || strings.TrimSpace(storagePath) == "" {
		return nil, http.StatusNotFound, errors.New("La carpeta no tiene imagen de tarjeta configurada")
	}

	imageBytes, contentType, status, err := a.downloadStorageObject(ctx, bucket, storagePath)
	if err != nil {
		return nil, status, err
	}

	if strings.TrimSpace(contentType) == "" {
		contentType = "image/jpeg"
	}

	return &CourseMaterialObject{
		Bytes:       imageBytes,
		ContentType: contentType,
		FileName:    path.Base(storagePath),
	}, http.StatusOK, nil
}
