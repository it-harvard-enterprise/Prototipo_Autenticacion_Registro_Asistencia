package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"fingerprint-backend/models"
)

var bogotaTZ = time.FixedZone("America/Bogota", -5*60*60)

func normalizeUpper(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func normalizeLower(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func normalizeOptionalUpper(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return strings.ToUpper(trimmed)
}

func normalizeOptionalTrim(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func normalizeOptionalLower(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return strings.ToLower(trimmed)
}

func asString(value any) (string, bool) {
	s, ok := value.(string)
	if !ok {
		return "", false
	}
	return s, true
}

func asInt(value any) (int, bool) {
	switch typed := value.(type) {
	case float64:
		return int(typed), true
	case int:
		return typed, true
	case int64:
		return int(typed), true
	case json.Number:
		parsed, err := typed.Int64()
		if err != nil {
			return 0, false
		}
		return int(parsed), true
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(typed))
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}

func asFloat(value any) (float64, bool) {
	switch typed := value.(type) {
	case float64:
		return typed, true
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case json.Number:
		parsed, err := typed.Float64()
		if err != nil {
			return 0, false
		}
		return parsed, true
	case string:
		parsed, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}

func asBool(value any) (bool, bool) {
	switch typed := value.(type) {
	case bool:
		return typed, true
	case string:
		lower := strings.ToLower(strings.TrimSpace(typed))
		if lower == "true" {
			return true, true
		}
		if lower == "false" {
			return false, true
		}
		return false, false
	default:
		return false, false
	}
}

func unmarshalRows(body []byte) ([]map[string]any, error) {
	rows := make([]map[string]any, 0)
	if len(body) == 0 {
		return rows, nil
	}
	if err := json.Unmarshal(body, &rows); err != nil {
		return nil, err
	}
	return rows, nil
}

func normalizeIdentificationIDs(ids []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		normalized := normalizeUpper(id)
		if normalized == "" || seen[normalized] {
			continue
		}
		seen[normalized] = true
		out = append(out, normalized)
	}
	return out
}

func buildStringInFilter(values []string) string {
	quoted := make([]string, 0, len(values))
	for _, value := range values {
		escaped := strings.ReplaceAll(value, `"`, `\\"`)
		quoted = append(quoted, fmt.Sprintf(`"%s"`, escaped))
	}
	return fmt.Sprintf("in.(%s)", strings.Join(quoted, ","))
}

func getBogotaDayBounds(date string) (string, string, error) {
	parsed, err := time.Parse("2006-01-02", strings.TrimSpace(date))
	if err != nil {
		return "", "", err
	}

	start := time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 0, 0, 0, 0, bogotaTZ)
	end := start.Add(24 * time.Hour)
	return start.UTC().Format(time.RFC3339), end.UTC().Format(time.RFC3339), nil
}

func getBogotaTimestampForDate(date string) string {
	parsed, err := time.Parse("2006-01-02", strings.TrimSpace(date))
	if err != nil {
		return time.Now().UTC().Format(time.RFC3339Nano)
	}

	nowBogota := time.Now().In(bogotaTZ)
	timestamp := time.Date(
		parsed.Year(),
		parsed.Month(),
		parsed.Day(),
		nowBogota.Hour(),
		nowBogota.Minute(),
		nowBogota.Second(),
		0,
		bogotaTZ,
	)

	return timestamp.Format("2006-01-02T15:04:05.000-07:00")
}

func (a *App) callSupabaseAuthAdmin(ctx context.Context, method, path string, payload any) ([]byte, int, error) {
	requestURL := a.SupabaseURL + "/auth/v1/admin" + path

	var body io.Reader
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return nil, http.StatusInternalServerError, err
		}
		body = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, requestURL, body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	req.Header.Set("apikey", a.ServiceKey)
	req.Header.Set("Authorization", "Bearer "+a.ServiceKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.HTTPClient.Do(req)
	if err != nil {
		return nil, http.StatusBadGateway, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, http.StatusBadGateway, err
	}

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return respBody, resp.StatusCode, nil
	}

	var sbErr supabaseError
	_ = json.Unmarshal(respBody, &sbErr)
	if sbErr.Message != "" {
		return nil, resp.StatusCode, errors.New(sbErr.Message)
	}

	var authErr supabaseAuthErrorPayload
	_ = json.Unmarshal(respBody, &authErr)

	message := strings.TrimSpace(authErr.ErrorDescription)
	if message == "" {
		message = strings.TrimSpace(authErr.Message)
	}
	if message == "" {
		message = strings.TrimSpace(authErr.Msg)
	}
	if message == "" {
		message = strings.TrimSpace(authErr.Error)
	}
	if message != "" {
		return nil, resp.StatusCode, errors.New(message)
	}

	return nil, resp.StatusCode, fmt.Errorf("supabase auth admin request failed with status %d", resp.StatusCode)
}

type supabaseAuthErrorPayload struct {
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
	Msg              string `json:"msg"`
	Message          string `json:"message"`
	Code             string `json:"code"`
}

func (a *App) resolveAuthAPIKey() string {
	if anonKey := strings.TrimSpace(a.AnonKey); anonKey != "" {
		return anonKey
	}

	return strings.TrimSpace(a.ServiceKey)
}

func decodeAuthResponse(body []byte) (map[string]any, error) {
	if len(body) == 0 {
		return map[string]any{}, nil
	}

	parsed := map[string]any{}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}

	return parsed, nil
}

func (a *App) callSupabaseAuth(ctx context.Context, method, path string, query url.Values, payload any, accessToken string) ([]byte, int, error) {
	requestURL := a.SupabaseURL + "/auth/v1" + path
	if len(query) > 0 {
		requestURL += "?" + query.Encode()
	}

	var body io.Reader
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return nil, http.StatusInternalServerError, err
		}
		body = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, method, requestURL, body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	authAPIKey := a.resolveAuthAPIKey()
	if authAPIKey == "" {
		return nil, http.StatusInternalServerError, errors.New("supabase auth key is not configured")
	}

	req.Header.Set("apikey", authAPIKey)
	req.Header.Set("Content-Type", "application/json")
	if token := strings.TrimSpace(accessToken); token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := a.HTTPClient.Do(req)
	if err != nil {
		return nil, http.StatusBadGateway, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, http.StatusBadGateway, err
	}

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return respBody, resp.StatusCode, nil
	}

	var sbErr supabaseAuthErrorPayload
	_ = json.Unmarshal(respBody, &sbErr)

	message := strings.TrimSpace(sbErr.ErrorDescription)
	if message == "" {
		message = strings.TrimSpace(sbErr.Message)
	}
	if message == "" {
		message = strings.TrimSpace(sbErr.Msg)
	}
	if message == "" {
		message = strings.TrimSpace(sbErr.Error)
	}
	if message != "" {
		return nil, resp.StatusCode, errors.New(message)
	}

	return nil, resp.StatusCode, fmt.Errorf("supabase auth request failed with status %d", resp.StatusCode)
}

func (a *App) AuthSignIn(ctx context.Context, req models.AuthSignInRequest) (map[string]any, int, error) {
	email := normalizeLower(req.Email)
	password := strings.TrimSpace(req.Password)

	if email == "" || password == "" {
		return nil, http.StatusBadRequest, errors.New("email y password son requeridos")
	}

	query := url.Values{}
	query.Set("grant_type", "password")

	body, status, err := a.callSupabaseAuth(ctx, http.MethodPost, "/token", query, map[string]any{
		"email":    email,
		"password": password,
	}, "")
	if err != nil {
		return nil, status, err
	}

	parsed, err := decodeAuthResponse(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	return parsed, http.StatusOK, nil
}

func (a *App) AuthSignUp(ctx context.Context, req models.AuthSignUpRequest) (map[string]any, int, error) {
	email := normalizeLower(req.Email)
	password := strings.TrimSpace(req.Password)

	if email == "" || password == "" {
		return nil, http.StatusBadRequest, errors.New("email y password son requeridos")
	}

	payload := map[string]any{
		"email":    email,
		"password": password,
	}
	if len(req.Metadata) > 0 {
		payload["data"] = req.Metadata
	}

	query := url.Values{}
	if req.EmailRedirectTo != nil {
		redirectTo := strings.TrimSpace(*req.EmailRedirectTo)
		if redirectTo != "" {
			query.Set("redirect_to", redirectTo)
			payload["email_redirect_to"] = redirectTo
		}
	}

	body, status, err := a.callSupabaseAuth(ctx, http.MethodPost, "/signup", query, payload, "")
	if err != nil {
		return nil, status, err
	}

	parsed, err := decodeAuthResponse(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	return parsed, http.StatusOK, nil
}

func (a *App) AuthRecover(ctx context.Context, req models.AuthRecoverRequest) (map[string]any, int, error) {
	email := normalizeLower(req.Email)
	if email == "" {
		return nil, http.StatusBadRequest, errors.New("email es requerido")
	}

	query := url.Values{}
	if req.RedirectTo != nil {
		redirectTo := strings.TrimSpace(*req.RedirectTo)
		if redirectTo != "" {
			query.Set("redirect_to", redirectTo)
		}
	}

	body, status, err := a.callSupabaseAuth(ctx, http.MethodPost, "/recover", query, map[string]any{
		"email": email,
	}, "")
	if err != nil {
		return nil, status, err
	}

	parsed, err := decodeAuthResponse(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	return parsed, http.StatusOK, nil
}

func (a *App) AuthVerifyOTP(ctx context.Context, req models.AuthVerifyOTPRequest) (map[string]any, int, error) {
	otpType := strings.TrimSpace(req.Type)
	tokenHash := strings.TrimSpace(req.TokenHash)
	if otpType == "" || tokenHash == "" {
		return nil, http.StatusBadRequest, errors.New("type y token_hash son requeridos")
	}

	body, status, err := a.callSupabaseAuth(ctx, http.MethodPost, "/verify", nil, map[string]any{
		"type":       otpType,
		"token_hash": tokenHash,
	}, "")
	if err != nil {
		return nil, status, err
	}

	parsed, err := decodeAuthResponse(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	return parsed, http.StatusOK, nil
}

func (a *App) AuthSessionUser(ctx context.Context, accessToken string) (map[string]any, int, error) {
	token := strings.TrimSpace(accessToken)
	if token == "" {
		return nil, http.StatusBadRequest, errors.New("access_token es requerido")
	}

	body, status, err := a.callSupabaseAuth(ctx, http.MethodGet, "/user", nil, nil, token)
	if err != nil {
		return nil, status, err
	}

	parsed, err := decodeAuthResponse(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	return parsed, http.StatusOK, nil
}

func (a *App) AuthUpdatePassword(ctx context.Context, req models.AuthUpdatePasswordRequest) (map[string]any, int, error) {
	token := strings.TrimSpace(req.AccessToken)
	password := strings.TrimSpace(req.Password)
	if token == "" {
		return nil, http.StatusBadRequest, errors.New("access_token es requerido")
	}
	if password == "" {
		return nil, http.StatusBadRequest, errors.New("password es requerido")
	}

	payload := map[string]any{
		"password": password,
	}
	if len(req.Data) > 0 {
		payload["data"] = req.Data
	}

	body, status, err := a.callSupabaseAuth(ctx, http.MethodPut, "/user", nil, payload, token)
	if err != nil {
		return nil, status, err
	}

	parsed, err := decodeAuthResponse(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	return parsed, http.StatusOK, nil
}

func (a *App) AuthSignOut(ctx context.Context, accessToken string) (map[string]any, int, error) {
	token := strings.TrimSpace(accessToken)
	if token == "" {
		return nil, http.StatusBadRequest, errors.New("access_token es requerido")
	}

	body, status, err := a.callSupabaseAuth(ctx, http.MethodPost, "/logout", nil, nil, token)
	if err != nil {
		return nil, status, err
	}

	parsed, err := decodeAuthResponse(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	return parsed, http.StatusOK, nil
}

func (a *App) CreateManagedAuthUser(ctx context.Context, params models.ManagedAuthUserParams) (string, bool, error) {
	email := normalizeLower(params.Email)
	password := strings.TrimSpace(params.Password)

	if email == "" {
		return "", false, errors.New("el correo electrónico es obligatorio")
	}
	if password == "" {
		return "", false, errors.New("la contraseña inicial es obligatoria")
	}

	payload := map[string]any{
		"email":         email,
		"password":      password,
		"email_confirm": true,
		"user_metadata": map[string]any{
			"rol":                   params.Role,
			"role":                  params.Role,
			"nombres":               normalizeUpper(params.Nombres),
			"apellidos":             normalizeUpper(params.Apellidos),
			"tipo_identificacion":   normalizeUpper(params.TipoIdentificacion),
			"numero_identificacion": normalizeUpper(params.NumeroIdentificacion),
			"must_change_password":  strings.EqualFold(params.Role, "administrador"),
			"approved_by_admin":     params.ApprovedByAdmin,
		},
	}

	body, status, err := a.callSupabaseAuthAdmin(ctx, http.MethodPost, "/users", payload)
	if err != nil {
		lowerErr := strings.ToLower(err.Error())
		alreadyRegistered := strings.Contains(lowerErr, "already") && strings.Contains(lowerErr, "register")
		if !alreadyRegistered {
			alreadyRegistered = strings.Contains(lowerErr, "already exists") ||
				(strings.Contains(lowerErr, "email") && strings.Contains(lowerErr, "exists")) ||
				(strings.Contains(lowerErr, "email") && strings.Contains(lowerErr, "registered"))
		}
		if status == http.StatusConflict || status == http.StatusUnprocessableEntity {
			return "", alreadyRegistered, err
		}
		return "", false, err
	}

	var parsed map[string]any
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", false, err
	}

	if id, ok := parsed["id"].(string); ok && strings.TrimSpace(id) != "" {
		return id, false, nil
	}

	if userMap, ok := parsed["user"].(map[string]any); ok {
		if id, ok := userMap["id"].(string); ok && strings.TrimSpace(id) != "" {
			return id, false, nil
		}
	}

	return "", false, errors.New("supabase no devolvió user id")
}

func (a *App) DeleteManagedAuthUser(ctx context.Context, userID string) error {
	normalized := strings.TrimSpace(userID)
	if normalized == "" {
		return errors.New("user id is required")
	}

	_, status, err := a.callSupabaseAuthAdmin(ctx, http.MethodDelete, "/users/"+normalized, nil)
	if err != nil {
		message := strings.ToLower(strings.TrimSpace(err.Error()))
		if status == http.StatusNotFound || strings.Contains(message, "not found") {
			return nil
		}
	}

	return err
}

func extractEmbeddedRow(raw any) map[string]any {
	if raw == nil {
		return map[string]any{}
	}

	switch typed := raw.(type) {
	case map[string]any:
		return typed
	case []any:
		if len(typed) == 0 {
			return map[string]any{}
		}
		if first, ok := typed[0].(map[string]any); ok {
			return first
		}
	}

	return map[string]any{}
}

func attachPaymentStatusFields(student map[string]any) {
	saldoRow := extractEmbeddedRow(student["saldo_estudiantes"])

	clasesAdelantadas, ok := asInt(saldoRow["clases_adelantadas"])
	if !ok || clasesAdelantadas < 0 {
		clasesAdelantadas = 0
	}

	clasesAdeudadas, ok := asInt(saldoRow["clases_adeudadas"])
	if !ok || clasesAdeudadas < 0 {
		clasesAdeudadas = 0
	}

	totalPagado, ok := asFloat(saldoRow["total_pagado"])
	if !ok || totalPagado < 0 {
		totalPagado = 0
	}

	valorApoyoSemanal, ok := asFloat(student["valor_apoyo_semanal"])
	if !ok || valorApoyoSemanal < 0 {
		valorApoyoSemanal = 0
	}

	deudaActual := float64(clasesAdeudadas) * valorApoyoSemanal

	estadoPago := "AL_DIA"
	if clasesAdeudadas > 0 {
		estadoPago = "DEBE"
	} else if clasesAdelantadas > 0 {
		estadoPago = "ADELANTADO"
	}

	student["clases_adelantadas"] = clasesAdelantadas
	student["clases_adeudadas"] = clasesAdeudadas
	student["total_pagado"] = totalPagado
	student["deuda_actual"] = deudaActual
	student["estado_pago"] = estadoPago

	if ultimaActualizacion, ok := asString(saldoRow["ultima_actualizacion"]); ok {
		student["ultima_actualizacion_saldo"] = nullableString(ultimaActualizacion)
	} else {
		student["ultima_actualizacion_saldo"] = nil
	}

	delete(student, "saldo_estudiantes")
}

func (a *App) fillStudentEmailFromProfile(ctx context.Context, student map[string]any) {
	email, _ := asString(student["email"])
	if strings.TrimSpace(email) != "" {
		return
	}

	authUserID, _ := asString(student["auth_user_id"])
	if strings.TrimSpace(authUserID) == "" {
		return
	}

	query := url.Values{}
	query.Set("select", "email")
	query.Set("id", fmt.Sprintf("eq.%s", strings.TrimSpace(authUserID)))
	query.Set("limit", "1")

	body, _, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/profiles", query, nil, false)
	if err != nil {
		return
	}

	rows, err := unmarshalRows(body)
	if err != nil || len(rows) == 0 {
		return
	}

	resolvedEmail, _ := asString(rows[0]["email"])
	if strings.TrimSpace(resolvedEmail) == "" {
		return
	}

	student["email"] = strings.TrimSpace(resolvedEmail)
}

func (a *App) ListStudents(ctx context.Context) ([]map[string]any, error) {
	query := url.Values{}
	query.Set("select", "*,saldo_estudiantes(clases_adelantadas,clases_adeudadas,total_pagado,ultima_actualizacion)")
	query.Set("deleted_at", "is.null")
	query.Set("order", "apellidos.asc")

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/estudiantes", query, nil, false)
	if err != nil {
		if status != http.StatusBadRequest {
			return nil, err
		}

		fallbackQuery := url.Values{}
		fallbackQuery.Set("select", "*")
		fallbackQuery.Set("deleted_at", "is.null")
		fallbackQuery.Set("order", "apellidos.asc")

		body, _, err = a.CallSupabase(ctx, http.MethodGet, "/rest/v1/estudiantes", fallbackQuery, nil, false)
		if err != nil {
			return nil, err
		}
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		attachPaymentStatusFields(row)
	}

	profilesByID, profilesByEmail, err := a.loadProfileIndexByRole(ctx, "estudiante")
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		attachProfileStatus(row, profilesByID, profilesByEmail)
	}

	attendedCounts := a.loadAttendedCountsIndex(ctx)
	for _, row := range rows {
		numero, _ := asString(row["numero_identificacion"])
		row["attended_count"] = attendedCounts[normalizeUpper(numero)]
	}

	return rows, nil
}

// loadAttendedCountsIndex returns a map of numero_identificacion (UPPER) to the
// total number of confirmed attendance rows (asistio=true) for that student.
// It performs a single lightweight read against registro_asistencia. Errors are
// swallowed by design: enrichment is best-effort and must NOT break /api/students.
// When the lookup fails, every student gets attended_count=0 (and the frontend
// filter degrades gracefully to "Todos").
func (a *App) loadAttendedCountsIndex(ctx context.Context) map[string]int {
	counts := map[string]int{}

	query := url.Values{}
	query.Set("asistio", "eq.true")
	query.Set("select", "numero_identificacion")

	body, _, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/registro_asistencia", query, nil, false)
	if err != nil {
		return counts
	}

	var rows []struct {
		NumeroIdentificacion string `json:"numero_identificacion"`
	}
	if err := json.Unmarshal(body, &rows); err != nil {
		return counts
	}

	for _, row := range rows {
		key := normalizeUpper(row.NumeroIdentificacion)
		if key == "" {
			continue
		}
		counts[key]++
	}

	return counts
}

// resolveAdminNames returns a map from auth user UUID to a display label.
// Resolution strategy (per UUID), in priority order:
//  1. profiles.nombre + " " + profiles.apellido (if non-empty)
//  2. profiles.email (if profiles row exists but name is empty)
//  3. administrador.nombres + " " + administrador.apellidos (if non-empty)
//  4. administrador.email (final fallback)
// UUIDs that cannot be resolved at all are simply absent from the map; the
// callers translate that to a null `registrado_por_nombre`. Errors against
// either table are swallowed by design: enrichment is best-effort and must
// never break the payment endpoints.
func (a *App) resolveAdminNames(ctx context.Context, uuids []string) map[string]string {
	names := map[string]string{}
	if len(uuids) == 0 {
		return names
	}

	uniq := map[string]bool{}
	for _, u := range uuids {
		trimmed := strings.TrimSpace(u)
		if trimmed != "" {
			uniq[trimmed] = true
		}
	}
	if len(uniq) == 0 {
		return names
	}

	list := make([]string, 0, len(uniq))
	for u := range uniq {
		list = append(list, u)
	}

	profileQuery := url.Values{}
	profileQuery.Set("id", buildStringInFilter(list))
	profileQuery.Set("select", "id,nombre,apellido,email")
	if body, _, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/profiles", profileQuery, nil, false); err == nil {
		var rows []struct {
			ID       string `json:"id"`
			Nombre   string `json:"nombre"`
			Apellido string `json:"apellido"`
			Email    string `json:"email"`
		}
		if err := json.Unmarshal(body, &rows); err == nil {
			for _, row := range rows {
				if label := pickAdminLabel(row.Nombre, row.Apellido, row.Email); label != "" {
					names[strings.TrimSpace(row.ID)] = label
				}
			}
		}
	}

	missing := make([]string, 0)
	for _, u := range list {
		if _, ok := names[u]; !ok {
			missing = append(missing, u)
		}
	}
	if len(missing) > 0 {
		adminQuery := url.Values{}
		adminQuery.Set("id", buildStringInFilter(missing))
		adminQuery.Set("select", "id,nombres,apellidos,email")
		if body, _, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/administrador", adminQuery, nil, false); err == nil {
			var rows []struct {
				ID        string `json:"id"`
				Nombres   string `json:"nombres"`
				Apellidos string `json:"apellidos"`
				Email     string `json:"email"`
			}
			if err := json.Unmarshal(body, &rows); err == nil {
				for _, row := range rows {
					if label := pickAdminLabel(row.Nombres, row.Apellidos, row.Email); label != "" {
						names[strings.TrimSpace(row.ID)] = label
					}
				}
			}
		}
	}

	return names
}

// pickAdminLabel collapses the (nombre, apellido, email) triple of an admin
// row into a single display label. Prefers the full name when present, falls
// back to email when the name fields are empty. Returns "" if nothing usable.
func pickAdminLabel(nombre, apellido, email string) string {
	full := strings.TrimSpace(strings.TrimSpace(nombre) + " " + strings.TrimSpace(apellido))
	if full != "" {
		return full
	}
	return strings.TrimSpace(email)
}

func (a *App) GetStudentByNumero(ctx context.Context, numeroIdentificacion string) (map[string]any, int, error) {
	numero := normalizeUpper(numeroIdentificacion)
	if numero == "" {
		return nil, http.StatusBadRequest, errors.New("numero_identificacion es requerido")
	}

	query := url.Values{}
	query.Set("select", "*,saldo_estudiantes(clases_adelantadas,clases_adeudadas,total_pagado,ultima_actualizacion)")
	query.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))
	query.Set("deleted_at", "is.null")

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/estudiantes", query, nil, false)
	if err != nil {
		if status != http.StatusBadRequest {
			return nil, status, err
		}

		fallbackQuery := url.Values{}
		fallbackQuery.Set("select", "*")
		fallbackQuery.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))
		fallbackQuery.Set("deleted_at", "is.null")

		body, status, err = a.CallSupabase(ctx, http.MethodGet, "/rest/v1/estudiantes", fallbackQuery, nil, false)
		if err != nil {
			return nil, status, err
		}
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return nil, http.StatusNotFound, errors.New("no se encontró el estudiante")
	}

	student := rows[0]
	attachPaymentStatusFields(student)
	a.fillStudentEmailFromProfile(ctx, student)

	profilesByID, profilesByEmail, err := a.loadProfileIndexByRole(ctx, "estudiante")
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	attachProfileStatus(student, profilesByID, profilesByEmail)

	return student, http.StatusOK, nil
}

func (a *App) StudentExists(ctx context.Context, numeroIdentificacion string) (bool, error) {
	numero := normalizeUpper(numeroIdentificacion)
	if numero == "" {
		return false, errors.New("numero_identificacion es requerido")
	}

	query := url.Values{}
	query.Set("select", "numero_identificacion")
	query.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))
	query.Set("limit", "1")

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/estudiantes", query, nil, false)
	if err != nil {
		return false, fmt.Errorf("error consultando estudiante (status %d): %w", status, err)
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return false, err
	}

	return len(rows) > 0, nil
}

func (a *App) ensureSaldoEstudiante(ctx context.Context, numeroIdentificacion string) error {
	numero := normalizeUpper(numeroIdentificacion)
	if numero == "" {
		return errors.New("numero_identificacion es requerido")
	}

	payload := map[string]any{
		"numero_identificacion": numero,
	}

	_, status, err := a.CallSupabase(ctx, http.MethodPost, "/rest/v1/saldo_estudiantes", nil, payload, false)
	if err != nil && status != http.StatusConflict {
		return err
	}

	return nil
}

func (a *App) getSaldoEstudiante(ctx context.Context, numeroIdentificacion string) (map[string]any, int, error) {
	numero := normalizeUpper(numeroIdentificacion)
	if numero == "" {
		return nil, http.StatusBadRequest, errors.New("numero_identificacion es requerido")
	}

	query := url.Values{}
	query.Set("select", "numero_identificacion,clases_adelantadas,clases_adeudadas,total_pagado,ultima_actualizacion")
	query.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/saldo_estudiantes", query, nil, false)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return map[string]any{
			"numero_identificacion": numero,
			"clases_adelantadas":    0,
			"clases_adeudadas":      0,
			"total_pagado":          0,
			"ultima_actualizacion":  nil,
		}, http.StatusOK, nil
	}

	return rows[0], http.StatusOK, nil
}

func normalizeMetodoPagoValue(value string) (string, error) {
	trimmed := normalizeUpper(value)
	allowed := map[string]bool{
		"EFECTIVO":      true,
		"TRANSFERENCIA": true,
		"NEQUI":         true,
		"DAVIPLATA":     true,
		"OTRO":          true,
	}

	if !allowed[trimmed] {
		return "", errors.New("metodo_pago inválido")
	}

	return trimmed, nil
}

func normalizePaymentMode(value string) (string, error) {
	mode := normalizeUpper(value)
	switch mode {
	case "DEUDA_TOTAL", "DEUDA_PARCIAL", "ADELANTO":
		return mode, nil
	default:
		return "", errors.New("modalidad de pago inválida")
	}
}

type PaymentReportFilters struct {
	NumeroIdentificacion string
	Limit                int
	FromDate             string
	ToDate               string
	Scope                string
}

func normalizePaymentReportScope(value string) string {
	switch normalizeUpper(value) {
	case "ASISTENCIA":
		return "asistencia"
	case "PROCESADOR":
		return "procesador"
	default:
		return ""
	}
}

func (a *App) GetStudentPaymentStatus(ctx context.Context, numeroIdentificacion string) (map[string]any, int, error) {
	student, status, err := a.GetStudentByNumero(ctx, numeroIdentificacion)
	if err != nil {
		return nil, status, err
	}

	recentPayments, status, err := a.ListPaymentsReport(ctx, PaymentReportFilters{
		NumeroIdentificacion: numeroIdentificacion,
		Limit:                10,
		Scope:                "AMBOS",
	})
	if err != nil {
		return nil, status, err
	}

	return map[string]any{
		"student":         student,
		"recent_payments": recentPayments,
	}, http.StatusOK, nil
}

func (a *App) ProcessStudentPayment(ctx context.Context, req models.ProcessStudentPaymentRequest) (map[string]any, int, error) {
	numero := normalizeUpper(req.NumeroIdentificacion)
	if numero == "" {
		return nil, http.StatusBadRequest, errors.New("numero_identificacion es requerido")
	}

	registradoPor := strings.TrimSpace(req.RegistradoPor)
	if registradoPor == "" {
		return nil, http.StatusBadRequest, errors.New("registrado_por es requerido")
	}

	metodoPago, err := normalizeMetodoPagoValue(req.MetodoPago)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}

	modalidad, err := normalizePaymentMode(req.Modalidad)
	if err != nil {
		return nil, http.StatusBadRequest, err
	}

	student, status, err := a.GetStudentByNumero(ctx, numero)
	if err != nil {
		return nil, status, err
	}

	valorApoyoSemanal, ok := asFloat(student["valor_apoyo_semanal"])
	if !ok || valorApoyoSemanal <= 0 {
		return nil, http.StatusBadRequest, errors.New("el estudiante no tiene un valor_apoyo_semanal válido")
	}

	if err := a.ensureSaldoEstudiante(ctx, numero); err != nil {
		return nil, http.StatusInternalServerError, err
	}

	saldo, status, err := a.getSaldoEstudiante(ctx, numero)
	if err != nil {
		return nil, status, err
	}

	clasesAdeudadas, ok := asInt(saldo["clases_adeudadas"])
	if !ok || clasesAdeudadas < 0 {
		clasesAdeudadas = 0
	}

	clases := req.Clases
	tipoPago := "pago_deuda"
	clasesAdelantadas := 0
	autoNotas := ""

	switch modalidad {
	case "DEUDA_TOTAL":
		if clasesAdeudadas <= 0 {
			return nil, http.StatusBadRequest, errors.New("el estudiante no tiene clases adeudadas")
		}
		clases = clasesAdeudadas
		autoNotas = fmt.Sprintf("PAGO DE DEUDA TOTAL (%d CLASES)", clases)
	case "DEUDA_PARCIAL":
		if clasesAdeudadas <= 0 {
			return nil, http.StatusBadRequest, errors.New("el estudiante no tiene clases adeudadas")
		}
		if clases <= 0 {
			return nil, http.StatusBadRequest, errors.New("debe indicar cuantas clases adeudadas desea pagar")
		}
		if clases > clasesAdeudadas {
			return nil, http.StatusBadRequest, errors.New("no puede pagar mas clases de las adeudadas")
		}
		autoNotas = fmt.Sprintf("PAGO DE DEUDA PARCIAL (%d CLASES)", clases)
	case "ADELANTO":
		if clases <= 0 {
			return nil, http.StatusBadRequest, errors.New("debe indicar cuantas clases desea adelantar")
		}
		tipoPago = "adelanto"
		clasesAdelantadas = clases
		autoNotas = fmt.Sprintf("PAGO ADELANTADO (%d CLASES)", clases)
	}

	valor := float64(clases) * valorApoyoSemanal

	notasUsuario := ""
	if req.Notas != nil {
		notasUsuario = strings.TrimSpace(*req.Notas)
	}

	notas := autoNotas
	if notasUsuario != "" {
		notas = notas + " | " + notasUsuario
	}

	pagoPayload := map[string]any{
		"numero_identificacion": numero,
		"registrado_por":        registradoPor,
		"origen_pago":           "procesador",
		"tipo_pago":             tipoPago,
		"metodo_pago":           metodoPago,
		"valor":                 valor,
		"clases_adelantadas":    clasesAdelantadas,
		"notas":                 notas,
	}

	if req.IDCurso != nil && *req.IDCurso > 0 {
		pagoPayload["id_curso"] = *req.IDCurso
	}

	pagoQuery := url.Values{}
	pagoQuery.Set("select", "*")

	pagoBody, status, err := a.CallSupabase(ctx, http.MethodPost, "/rest/v1/pagos", pagoQuery, pagoPayload, true)
	if err != nil {
		return nil, status, err
	}

	pagoRows, err := unmarshalRows(pagoBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	var pago map[string]any
	if len(pagoRows) > 0 {
		pago = pagoRows[0]
		if uid, ok := asString(pago["registrado_por"]); ok && strings.TrimSpace(uid) != "" {
			adminNames := a.resolveAdminNames(ctx, []string{uid})
			if name, ok := adminNames[strings.TrimSpace(uid)]; ok {
				pago["registrado_por_nombre"] = name
			} else {
				pago["registrado_por_nombre"] = nil
			}
		}
	}

	if modalidad == "DEUDA_TOTAL" || modalidad == "DEUDA_PARCIAL" {
		nuevoSaldoAdeudado := clasesAdeudadas - clases
		if nuevoSaldoAdeudado < 0 {
			nuevoSaldoAdeudado = 0
		}

		updatePayload := map[string]any{
			"clases_adeudadas":     nuevoSaldoAdeudado,
			"ultima_actualizacion": time.Now().UTC().Format(time.RFC3339Nano),
		}

		updateQuery := url.Values{}
		updateQuery.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))

		_, status, err = a.CallSupabase(ctx, http.MethodPatch, "/rest/v1/saldo_estudiantes", updateQuery, updatePayload, false)
		if err != nil {
			return nil, status, err
		}
	}

	updatedStudent, status, err := a.GetStudentByNumero(ctx, numero)
	if err != nil {
		return nil, status, err
	}

	return map[string]any{
		"payment": pago,
		"student": updatedStudent,
	}, http.StatusOK, nil
}

func (a *App) UpdateStudentPaymentStatusManual(ctx context.Context, req models.ManualStudentPaymentStatusUpdateRequest) (map[string]any, int, error) {
	numero := normalizeUpper(req.NumeroIdentificacion)
	if numero == "" {
		return nil, http.StatusBadRequest, errors.New("numero_identificacion es requerido")
	}

	if req.ClasesAdeudadas < 0 {
		return nil, http.StatusBadRequest, errors.New("clases_adeudadas no puede ser negativa")
	}

	if req.ClasesAdelantadas < 0 {
		return nil, http.StatusBadRequest, errors.New("clases_adelantadas no puede ser negativa")
	}

	if _, status, err := a.GetStudentByNumero(ctx, numero); err != nil {
		return nil, status, err
	}

	if err := a.ensureSaldoEstudiante(ctx, numero); err != nil {
		return nil, http.StatusInternalServerError, err
	}

	payload := map[string]any{
		"clases_adeudadas":     req.ClasesAdeudadas,
		"clases_adelantadas":   req.ClasesAdelantadas,
		"ultima_actualizacion": time.Now().UTC().Format(time.RFC3339Nano),
	}

	query := url.Values{}
	query.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))
	query.Set("select", "*")

	body, status, err := a.CallSupabase(ctx, http.MethodPatch, "/rest/v1/saldo_estudiantes", query, payload, true)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	updatedStudent, status, err := a.GetStudentByNumero(ctx, numero)
	if err != nil {
		return nil, status, err
	}

	var saldoActualizado map[string]any
	if len(rows) > 0 {
		saldoActualizado = rows[0]
	}

	return map[string]any{
		"student":           updatedStudent,
		"saldo_actualizado": saldoActualizado,
	}, http.StatusOK, nil
}

func (a *App) ListPaymentsReport(ctx context.Context, filters PaymentReportFilters) ([]map[string]any, int, error) {
	limit := filters.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 5000 {
		limit = 5000
	}

	query := url.Values{}
	query.Set("select", "*")
	query.Set("order", "fecha_pago.desc")
	query.Set("limit", strconv.Itoa(limit))

	numero := normalizeUpper(filters.NumeroIdentificacion)
	if numero != "" {
		query.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))
	}

	scope := normalizePaymentReportScope(filters.Scope)
	if scope != "" {
		query.Set("origen_pago", fmt.Sprintf("eq.%s", scope))
	}

	fromDate := strings.TrimSpace(filters.FromDate)
	toDate := strings.TrimSpace(filters.ToDate)
	if fromDate == "" && toDate != "" {
		fromDate = toDate
	}
	if toDate == "" && fromDate != "" {
		toDate = fromDate
	}

	if fromDate != "" {
		startISO, _, err := getBogotaDayBounds(fromDate)
		if err != nil {
			return nil, http.StatusBadRequest, errors.New("fecha inicial inválida")
		}

		_, endISO, err := getBogotaDayBounds(toDate)
		if err != nil {
			return nil, http.StatusBadRequest, errors.New("fecha final inválida")
		}

		query.Set("fecha_pago", fmt.Sprintf("gte.%s", startISO))
		query.Add("fecha_pago", fmt.Sprintf("lt.%s", endISO))
	}

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/vista_reporte_pagos", query, nil, false)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	// vista_reporte_pagos hides the admin UUID and exposes
	// `registrado_por` as a pre-joined name string from `profiles` (empty
	// when no profile row exists). To resolve the admin reliably we need
	// the real UUID, so we hit the pagos table directly with the row ids
	// we just got from the view.
	pagoIDToUUID := a.loadPagoRegistradoPorIndex(ctx, rows)

	uniqUUIDs := map[string]bool{}
	for _, uid := range pagoIDToUUID {
		uid = strings.TrimSpace(uid)
		if uid != "" {
			uniqUUIDs[uid] = true
		}
	}
	uuidList := make([]string, 0, len(uniqUUIDs))
	for uid := range uniqUUIDs {
		uuidList = append(uuidList, uid)
	}
	adminNames := a.resolveAdminNames(ctx, uuidList)

	for _, row := range rows {
		pagoID, _ := asString(row["id"])
		uid := strings.TrimSpace(pagoIDToUUID[pagoID])

		if uid != "" {
			row["registrado_por_id"] = uid
		} else {
			row["registrado_por_id"] = nil
		}

		if name, ok := adminNames[uid]; ok && name != "" {
			row["registrado_por_nombre"] = name
		} else {
			// Last-resort: the view's pre-joined string. It can carry a
			// usable name even when our lookup misses (e.g. RLS lets the
			// view see profile rows that our query cannot). Empty
			// strings collapse to null so the UI shows the "—" fallback.
			viewLabel, _ := asString(row["registrado_por"])
			viewLabel = strings.TrimSpace(viewLabel)
			if viewLabel != "" {
				row["registrado_por_nombre"] = viewLabel
			} else {
				row["registrado_por_nombre"] = nil
			}
		}
	}

	return rows, http.StatusOK, nil
}

// loadPagoRegistradoPorIndex fetches `registrado_por` (UUID) for each pago id
// in the supplied view rows. Returns a map pagoID -> UUID. Errors are
// swallowed; on failure the returned map is empty and callers fall back to
// the view's pre-joined name.
func (a *App) loadPagoRegistradoPorIndex(
	ctx context.Context,
	rows []map[string]any,
) map[string]string {
	out := map[string]string{}
	if len(rows) == 0 {
		return out
	}

	ids := make([]string, 0, len(rows))
	seen := map[string]bool{}
	for _, row := range rows {
		if id, ok := asString(row["id"]); ok {
			trimmed := strings.TrimSpace(id)
			if trimmed != "" && !seen[trimmed] {
				seen[trimmed] = true
				ids = append(ids, trimmed)
			}
		}
	}
	if len(ids) == 0 {
		return out
	}

	query := url.Values{}
	query.Set("id", buildStringInFilter(ids))
	query.Set("select", "id,registrado_por")

	body, _, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/pagos", query, nil, false)
	if err != nil {
		return out
	}

	var pagoRows []struct {
		ID            string `json:"id"`
		RegistradoPor string `json:"registrado_por"`
	}
	if err := json.Unmarshal(body, &pagoRows); err != nil {
		return out
	}

	for _, row := range pagoRows {
		out[strings.TrimSpace(row.ID)] = strings.TrimSpace(row.RegistradoPor)
	}
	return out
}

func buildStudentUpdatePayload(data map[string]any) map[string]any {
	payload := map[string]any{
		"updated_at": time.Now().UTC().Format(time.RFC3339Nano),
	}

	if value, ok := data["tipo_identificacion"]; ok {
		if s, ok := asString(value); ok {
			payload["tipo_identificacion"] = normalizeUpper(s)
		}
	}
	if value, ok := data["numero_identificacion"]; ok {
		if s, ok := asString(value); ok {
			payload["numero_identificacion"] = normalizeUpper(s)
		}
	}
	if value, ok := data["no_matricula"]; ok {
		if value == nil {
			payload["no_matricula"] = nil
		} else if s, ok := asString(value); ok {
			payload["no_matricula"] = normalizeOptionalUpper(s)
		}
	}
	if value, ok := data["nombres"]; ok {
		if s, ok := asString(value); ok {
			payload["nombres"] = normalizeUpper(s)
		}
	}
	if value, ok := data["apellidos"]; ok {
		if s, ok := asString(value); ok {
			payload["apellidos"] = normalizeUpper(s)
		}
	}
	if value, ok := data["email"]; ok {
		if value == nil {
			payload["email"] = nil
		} else if s, ok := asString(value); ok {
			payload["email"] = normalizeOptionalLower(s)
		}
	}
	if value, ok := data["grado"]; ok {
		if s, ok := asString(value); ok {
			payload["grado"] = normalizeUpper(s)
		}
	}
	if value, ok := data["telefono"]; ok {
		if s, ok := asString(value); ok {
			payload["telefono"] = normalizeUpper(s)
		}
	}
	if value, ok := data["direccion"]; ok {
		if s, ok := asString(value); ok {
			payload["direccion"] = normalizeUpper(s)
		}
	}
	if value, ok := data["barrio"]; ok {
		if s, ok := asString(value); ok {
			payload["barrio"] = normalizeUpper(s)
		}
	}
	if value, ok := data["nombre_acudiente"]; ok {
		if s, ok := asString(value); ok {
			payload["nombre_acudiente"] = normalizeUpper(s)
		}
	}
	if value, ok := data["telefono_acudiente"]; ok {
		if s, ok := asString(value); ok {
			payload["telefono_acudiente"] = normalizeUpper(s)
		}
	}
	if value, ok := data["eps"]; ok {
		if s, ok := asString(value); ok {
			payload["eps"] = normalizeUpper(s)
		}
	}
	if value, ok := data["coordinador_academico"]; ok {
		if s, ok := asString(value); ok {
			payload["coordinador_academico"] = strings.TrimSpace(s)
		}
	}
	if value, ok := data["programa"]; ok {
		if s, ok := asString(value); ok {
			payload["programa"] = normalizeUpper(s)
		}
	}
	if value, ok := data["fecha_inicio"]; ok {
		if s, ok := asString(value); ok {
			payload["fecha_inicio"] = normalizeOptionalTrim(s)
		}
	}
	if value, ok := data["fecha_matricula"]; ok {
		if s, ok := asString(value); ok {
			payload["fecha_matricula"] = normalizeOptionalTrim(s)
		}
	}
	if value, ok := data["valor_matricula"]; ok {
		if f, ok := asFloat(value); ok {
			payload["valor_matricula"] = f
		}
	}
	if value, ok := data["medio_pago_matricula"]; ok {
		if s, ok := asString(value); ok {
			payload["medio_pago_matricula"] = normalizeUpper(s)
		}
	}
	if value, ok := data["valor_apoyo_semanal"]; ok {
		if f, ok := asFloat(value); ok {
			payload["valor_apoyo_semanal"] = f
		}
	}

	return payload
}

func (a *App) studentEmailExistsInAnotherRecord(ctx context.Context, email, numeroIdentificacion string) (bool, int, error) {
	normalizedEmail := normalizeLower(email)
	normalizedNumero := normalizeUpper(numeroIdentificacion)
	if normalizedEmail == "" || normalizedNumero == "" {
		return false, http.StatusBadRequest, errors.New("email y numero_identificacion son requeridos")
	}

	query := url.Values{}
	query.Set("select", "numero_identificacion")
	query.Set("email", fmt.Sprintf("eq.%s", normalizedEmail))
	query.Set("numero_identificacion", fmt.Sprintf("neq.%s", normalizedNumero))
	query.Set("deleted_at", "is.null")
	query.Set("limit", "1")

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/estudiantes", query, nil, false)
	if err != nil {
		return false, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return false, http.StatusInternalServerError, err
	}

	return len(rows) > 0, http.StatusOK, nil
}

func (a *App) UpdateStudentRecord(ctx context.Context, numeroIdentificacion string, data map[string]any) (map[string]any, int, error) {
	numero := normalizeUpper(numeroIdentificacion)
	if numero == "" {
		return nil, http.StatusBadRequest, errors.New("numero_identificacion es requerido")
	}

	payload := buildStudentUpdatePayload(data)

	if emailValue, ok := payload["email"]; ok && emailValue != nil {
		if email, ok := emailValue.(string); ok && strings.TrimSpace(email) != "" {
			exists, status, err := a.studentEmailExistsInAnotherRecord(ctx, email, numero)
			if err != nil {
				return nil, status, err
			}
			if exists {
				return nil, http.StatusConflict, errors.New("Ya existe un usuario con el mismo correo electrónico. Use un correo diferente.")
			}
		}
	}

	query := url.Values{}
	query.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))
	query.Set("deleted_at", "is.null")
	query.Set("select", "*")

	body, status, err := a.CallSupabase(ctx, http.MethodPatch, "/rest/v1/estudiantes", query, payload, true)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return nil, http.StatusNotFound, errors.New("no se encontró el estudiante")
	}

	return rows[0], http.StatusOK, nil
}

func (a *App) DeleteStudentRecord(ctx context.Context, numeroIdentificacion string) (int, error) {
	numero := normalizeUpper(numeroIdentificacion)
	if numero == "" {
		return http.StatusBadRequest, errors.New("numero_identificacion es requerido")
	}

	lookupQuery := url.Values{}
	lookupQuery.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))
	lookupQuery.Set("deleted_at", "is.null")
	lookupQuery.Set("select", "numero_identificacion,auth_user_id")

	lookupBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/estudiantes", lookupQuery, nil, false)
	if err != nil {
		return status, err
	}

	lookupRows, err := unmarshalRows(lookupBody)
	if err != nil {
		return http.StatusInternalServerError, err
	}
	if len(lookupRows) == 0 {
		return http.StatusNotFound, errors.New("no se encontró el estudiante")
	}

	authUserID, _ := asString(lookupRows[0]["auth_user_id"])

	// Keep explicit cleanup for compatibility with environments where cascades
	// may not be present in all migrations.
	courseLinksQuery := url.Values{}
	courseLinksQuery.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))

	_, status, err = a.CallSupabase(ctx, http.MethodDelete, "/rest/v1/cursos_x_estudiantes", courseLinksQuery, nil, false)
	if err != nil {
		return status, err
	}

	attendanceQuery := url.Values{}
	attendanceQuery.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))

	_, status, err = a.CallSupabase(ctx, http.MethodDelete, "/rest/v1/registro_asistencia", attendanceQuery, nil, false)
	if err != nil {
		return status, err
	}

	balanceQuery := url.Values{}
	balanceQuery.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))

	_, status, err = a.CallSupabase(ctx, http.MethodDelete, "/rest/v1/saldo_estudiantes", balanceQuery, nil, false)
	if err != nil {
		if status != http.StatusNotFound {
			return status, err
		}
	}

	deleteStudentQuery := url.Values{}
	deleteStudentQuery.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))
	deleteStudentQuery.Set("deleted_at", "is.null")
	deleteStudentQuery.Set("select", "numero_identificacion")

	body, status, err := a.CallSupabase(ctx, http.MethodDelete, "/rest/v1/estudiantes", deleteStudentQuery, nil, true)
	if err != nil {
		return status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return http.StatusNotFound, errors.New("no se encontró el estudiante")
	}

	if strings.TrimSpace(authUserID) != "" {
		if err := a.DeleteManagedAuthUser(ctx, authUserID); err != nil {
			return http.StatusBadGateway, err
		}
	}

	return http.StatusOK, nil
}

func (a *App) ListProfessors(ctx context.Context) ([]map[string]any, error) {
	query := url.Values{}
	query.Set("select", "*")
	query.Set("order", "apellidos.asc")

	body, _, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/profesores", query, nil, false)
	if err != nil {
		return nil, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, err
	}

	profilesByID, profilesByEmail, err := a.loadProfileIndexByRole(ctx, "profesor")
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		attachProfileStatus(row, profilesByID, profilesByEmail)
	}

	return rows, nil
}

func (a *App) GetProfessorByNumero(ctx context.Context, numeroIdentificacion string) (map[string]any, int, error) {
	numero := normalizeUpper(numeroIdentificacion)
	if numero == "" {
		return nil, http.StatusBadRequest, errors.New("numero_identificacion es requerido")
	}

	query := url.Values{}
	query.Set("select", "*")
	query.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/profesores", query, nil, false)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return nil, http.StatusNotFound, errors.New("no se encontró el profesor")
	}

	profilesByID, profilesByEmail, err := a.loadProfileIndexByRole(ctx, "profesor")
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	attachProfileStatus(rows[0], profilesByID, profilesByEmail)

	return rows[0], http.StatusOK, nil
}

func (a *App) ProfessorExists(ctx context.Context, numeroIdentificacion string) (bool, error) {
	_, status, err := a.GetProfessorByNumero(ctx, numeroIdentificacion)
	if err != nil {
		if status == http.StatusNotFound {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func buildProfessorUpdatePayload(data map[string]any) map[string]any {
	payload := map[string]any{
		"updated_at": time.Now().UTC().Format(time.RFC3339Nano),
	}

	if value, ok := data["tipo_identificacion"]; ok {
		if s, ok := asString(value); ok {
			payload["tipo_identificacion"] = normalizeUpper(s)
		}
	}
	if value, ok := data["numero_identificacion"]; ok {
		if s, ok := asString(value); ok {
			payload["numero_identificacion"] = normalizeUpper(s)
		}
	}
	if value, ok := data["nombres"]; ok {
		if s, ok := asString(value); ok {
			payload["nombres"] = normalizeUpper(s)
		}
	}
	if value, ok := data["apellidos"]; ok {
		if s, ok := asString(value); ok {
			payload["apellidos"] = normalizeUpper(s)
		}
	}
	if value, ok := data["telefono"]; ok {
		if s, ok := asString(value); ok {
			payload["telefono"] = normalizeUpper(s)
		}
	}
	if value, ok := data["direccion"]; ok {
		if s, ok := asString(value); ok {
			payload["direccion"] = normalizeUpper(s)
		}
	}
	if value, ok := data["barrio"]; ok {
		if s, ok := asString(value); ok {
			payload["barrio"] = normalizeUpper(s)
		}
	}
	if value, ok := data["nombre_contacto_emergencia"]; ok {
		if s, ok := asString(value); ok {
			payload["nombre_contacto_emergencia"] = normalizeUpper(s)
		}
	}
	if value, ok := data["telefono_contacto_emergencia"]; ok {
		if s, ok := asString(value); ok {
			payload["telefono_contacto_emergencia"] = normalizeUpper(s)
		}
	}
	if value, ok := data["eps"]; ok {
		if s, ok := asString(value); ok {
			payload["eps"] = normalizeUpper(s)
		}
	}
	if value, ok := data["email"]; ok {
		if s, ok := asString(value); ok {
			payload["email"] = normalizeOptionalTrim(s)
		}
	}

	return payload
}

func (a *App) CreateProfessorRecord(ctx context.Context, req models.ProfessorCreateRequest, authUserID string) (map[string]any, int, error) {
	payload := map[string]any{
		"tipo_identificacion":          normalizeUpper(req.TipoIdentificacion),
		"numero_identificacion":        normalizeUpper(req.NumeroIdentificacion),
		"nombres":                      normalizeUpper(req.Nombres),
		"apellidos":                    normalizeUpper(req.Apellidos),
		"telefono":                     normalizeUpper(req.Telefono),
		"direccion":                    normalizeUpper(req.Direccion),
		"barrio":                       normalizeUpper(req.Barrio),
		"nombre_contacto_emergencia":   normalizeUpper(req.NombreContactoEmergencia),
		"telefono_contacto_emergencia": normalizeUpper(req.TelefonoContactoEmergencia),
		"eps":                          normalizeUpper(req.EPS),
		"email":                        normalizeLower(req.Email),
		"auth_user_id":                 authUserID,
	}

	query := url.Values{}
	query.Set("select", "*")

	body, status, err := a.CallSupabase(ctx, http.MethodPost, "/rest/v1/profesores", query, payload, true)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return nil, http.StatusInternalServerError, errors.New("no se recibió respuesta de Supabase al crear el profesor")
	}

	return rows[0], http.StatusCreated, nil
}

func (a *App) UpdateProfessorRecord(ctx context.Context, numeroIdentificacion string, data map[string]any) (map[string]any, int, error) {
	numero := normalizeUpper(numeroIdentificacion)
	if numero == "" {
		return nil, http.StatusBadRequest, errors.New("numero_identificacion es requerido")
	}

	payload := buildProfessorUpdatePayload(data)

	query := url.Values{}
	query.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))
	query.Set("select", "*")

	body, status, err := a.CallSupabase(ctx, http.MethodPatch, "/rest/v1/profesores", query, payload, true)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return nil, http.StatusNotFound, errors.New("no se encontró el profesor")
	}

	return rows[0], http.StatusOK, nil
}

func (a *App) DeleteProfessorRecord(ctx context.Context, numeroIdentificacion string) (int, error) {
	numero := normalizeUpper(numeroIdentificacion)
	if numero == "" {
		return http.StatusBadRequest, errors.New("numero_identificacion es requerido")
	}

	lookupQuery := url.Values{}
	lookupQuery.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))
	lookupQuery.Set("select", "numero_identificacion,auth_user_id")

	lookupBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/profesores", lookupQuery, nil, false)
	if err != nil {
		return status, err
	}

	lookupRows, err := unmarshalRows(lookupBody)
	if err != nil {
		return http.StatusInternalServerError, err
	}
	if len(lookupRows) == 0 {
		return http.StatusNotFound, errors.New("no se encontró el profesor")
	}

	authUserID, _ := asString(lookupRows[0]["auth_user_id"])

	courseLinksQuery := url.Values{}
	courseLinksQuery.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))

	_, status, err = a.CallSupabase(ctx, http.MethodDelete, "/rest/v1/cursos_x_profesores", courseLinksQuery, nil, false)
	if err != nil {
		return status, err
	}

	query := url.Values{}
	query.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))
	query.Set("select", "numero_identificacion")

	body, status, err := a.CallSupabase(ctx, http.MethodDelete, "/rest/v1/profesores", query, nil, true)
	if err != nil {
		return status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return http.StatusNotFound, errors.New("no se encontró el profesor")
	}

	if strings.TrimSpace(authUserID) != "" {
		if err := a.DeleteManagedAuthUser(ctx, authUserID); err != nil {
			return http.StatusBadGateway, err
		}
	}

	return http.StatusOK, nil
}

func (a *App) ListCourses(ctx context.Context) ([]map[string]any, error) {
	query := url.Values{}
	query.Set("select", "*")
	query.Set("order", "nombre_curso.asc")

	body, _, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos", query, nil, false)
	if err != nil {
		return nil, err
	}

	return unmarshalRows(body)
}

func (a *App) ListCourseOptions(ctx context.Context) ([]map[string]any, error) {
	query := url.Values{}
	query.Set("select", "id_curso,nombre_curso")
	query.Set("order", "id_curso.asc")

	body, _, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos", query, nil, false)
	if err != nil {
		return nil, err
	}

	return unmarshalRows(body)
}

func (a *App) GetCourseByID(ctx context.Context, idCurso int) (map[string]any, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso inválido")
	}

	query := url.Values{}
	query.Set("select", "*")
	query.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos", query, nil, false)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return nil, http.StatusNotFound, errors.New("no se encontró el curso")
	}

	return rows[0], http.StatusOK, nil
}

func (a *App) CourseExists(ctx context.Context, idCurso int) (bool, error) {
	_, status, err := a.GetCourseByID(ctx, idCurso)
	if err != nil {
		if status == http.StatusNotFound {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func buildCoursePayload(data map[string]any, includeUpdatedAt bool) map[string]any {
	payload := map[string]any{}
	if !includeUpdatedAt {
		// Keep DB constraints satisfied while courses are treated as perpetual.
		payload["fecha_inicio"] = "2000-01-01"
		payload["fecha_fin"] = "2999-12-31"
	}
	if includeUpdatedAt {
		payload["updated_at"] = time.Now().UTC().Format(time.RFC3339Nano)
	}

	if value, ok := data["nombre_curso"]; ok {
		if s, ok := asString(value); ok {
			payload["nombre_curso"] = normalizeUpper(s)
		}
	}
	if value, ok := data["nivel_curso"]; ok {
		if s, ok := asString(value); ok {
			payload["nivel_curso"] = normalizeUpper(s)
		}
	}
	if value, ok := data["hora_inicio"]; ok {
		if s, ok := asString(value); ok {
			payload["hora_inicio"] = strings.TrimSpace(s)
		}
	}
	if value, ok := data["hora_fin"]; ok {
		if s, ok := asString(value); ok {
			payload["hora_fin"] = strings.TrimSpace(s)
		}
	}
	if value, ok := data["salon"]; ok {
		if value == nil {
			payload["salon"] = nil
		} else if s, ok := asString(value); ok {
			payload["salon"] = normalizeOptionalUpper(s)
		}
	}
	if value, ok := data["fecha_inicio"]; ok {
		if s, ok := asString(value); ok {
			payload["fecha_inicio"] = strings.TrimSpace(s)
		}
	}
	if value, ok := data["fecha_fin"]; ok {
		if s, ok := asString(value); ok {
			payload["fecha_fin"] = strings.TrimSpace(s)
		}
	}

	return payload
}

func (a *App) CreateCourseRecord(ctx context.Context, data map[string]any) (map[string]any, int, error) {
	payload := buildCoursePayload(data, false)

	query := url.Values{}
	query.Set("select", "*")

	body, status, err := a.CallSupabase(ctx, http.MethodPost, "/rest/v1/cursos", query, payload, true)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return nil, http.StatusInternalServerError, errors.New("no se recibió respuesta de Supabase al crear el curso")
	}

	return rows[0], http.StatusCreated, nil
}

func (a *App) UpdateCourseRecord(ctx context.Context, idCurso int, data map[string]any) (map[string]any, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso inválido")
	}

	payload := buildCoursePayload(data, true)

	query := url.Values{}
	query.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
	query.Set("select", "*")

	body, status, err := a.CallSupabase(ctx, http.MethodPatch, "/rest/v1/cursos", query, payload, true)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if len(rows) == 0 {
		return nil, http.StatusNotFound, errors.New("no se encontró el curso")
	}

	return rows[0], http.StatusOK, nil
}

func (a *App) DeleteCourseRecord(ctx context.Context, idCurso int) (int, error) {
	if idCurso <= 0 {
		return http.StatusBadRequest, errors.New("id_curso inválido")
	}

	query := url.Values{}
	query.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))

	_, status, err := a.CallSupabase(ctx, http.MethodDelete, "/rest/v1/cursos", query, nil, false)
	if err != nil {
		return status, err
	}

	return http.StatusOK, nil
}

func (a *App) LookupParticipantsByIdentification(ctx context.Context, participantIDs []string) ([]map[string]any, int, error) {
	normalizedIDs := normalizeIdentificationIDs(participantIDs)
	if len(normalizedIDs) == 0 {
		return []map[string]any{}, http.StatusOK, nil
	}

	queryStudents := url.Values{}
	queryStudents.Set("select", "numero_identificacion")
	queryStudents.Set("numero_identificacion", buildStringInFilter(normalizedIDs))

	studentsBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/estudiantes", queryStudents, nil, false)
	if err != nil {
		return nil, status, err
	}

	queryProfessors := url.Values{}
	queryProfessors.Set("select", "numero_identificacion")
	queryProfessors.Set("numero_identificacion", buildStringInFilter(normalizedIDs))

	professorsBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/profesores", queryProfessors, nil, false)
	if err != nil {
		return nil, status, err
	}

	students, err := unmarshalRows(studentsBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	professors, err := unmarshalRows(professorsBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	studentSet := map[string]bool{}
	for _, row := range students {
		id, _ := asString(row["numero_identificacion"])
		if id != "" {
			studentSet[id] = true
		}
	}

	professorSet := map[string]bool{}
	for _, row := range professors {
		id, _ := asString(row["numero_identificacion"])
		if id != "" {
			professorSet[id] = true
		}
	}

	result := make([]map[string]any, 0, len(normalizedIDs))
	for _, id := range normalizedIDs {
		role := "NO_ENCONTRADO"
		isStudent := studentSet[id]
		isProfessor := professorSet[id]

		switch {
		case isStudent && isProfessor:
			role = "ESTUDIANTE_Y_PROFESOR"
		case isStudent:
			role = "ESTUDIANTE"
		case isProfessor:
			role = "PROFESOR"
		}

		result = append(result, map[string]any{
			"numero_identificacion": id,
			"role":                  role,
		})
	}

	return result, http.StatusOK, nil
}

func (a *App) AssociateParticipantsToCourse(ctx context.Context, idCurso int, participantIDs []string) (map[string]any, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("el id_curso no existe")
	}

	normalizedIDs := normalizeIdentificationIDs(participantIDs)
	if len(normalizedIDs) == 0 {
		return nil, http.StatusBadRequest, errors.New("debe ingresar al menos un numero_identificacion")
	}

	courseExists, err := a.CourseExists(ctx, idCurso)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	if !courseExists {
		return nil, http.StatusBadRequest, errors.New("el id_curso no existe")
	}

	lookupRows, _, err := a.LookupParticipantsByIdentification(ctx, normalizedIDs)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	studentIDs := make([]string, 0)
	professorIDs := make([]string, 0)
	missingIDs := make([]string, 0)

	for _, row := range lookupRows {
		id, _ := asString(row["numero_identificacion"])
		role, _ := asString(row["role"])
		switch role {
		case "ESTUDIANTE":
			studentIDs = append(studentIDs, id)
		case "PROFESOR":
			professorIDs = append(professorIDs, id)
		case "ESTUDIANTE_Y_PROFESOR":
			studentIDs = append(studentIDs, id)
			professorIDs = append(professorIDs, id)
		default:
			missingIDs = append(missingIDs, id)
		}
	}

	if len(missingIDs) > 0 {
		return nil, http.StatusBadRequest, fmt.Errorf("no existen estos participantes (ni estudiantes ni profesores): %s", strings.Join(missingIDs, ", "))
	}

	insertedStudents := 0
	insertedProfessors := 0

	if len(studentIDs) > 0 {
		existingQuery := url.Values{}
		existingQuery.Set("select", "numero_identificacion")
		existingQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
		existingQuery.Set("numero_identificacion", buildStringInFilter(studentIDs))

		existingBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos_x_estudiantes", existingQuery, nil, false)
		if err != nil {
			return nil, status, err
		}

		existingRows, err := unmarshalRows(existingBody)
		if err != nil {
			return nil, http.StatusInternalServerError, err
		}

		existingSet := map[string]bool{}
		for _, row := range existingRows {
			id, _ := asString(row["numero_identificacion"])
			if id != "" {
				existingSet[id] = true
			}
		}

		payload := make([]map[string]any, 0)
		for _, id := range studentIDs {
			if existingSet[id] {
				continue
			}
			payload = append(payload, map[string]any{
				"numero_identificacion": id,
				"id_curso":              idCurso,
			})
		}

		if len(payload) > 0 {
			_, status, err := a.CallSupabase(ctx, http.MethodPost, "/rest/v1/cursos_x_estudiantes", nil, payload, false)
			if err != nil {
				return nil, status, err
			}
			insertedStudents = len(payload)
		}
	}

	if len(professorIDs) > 0 {
		existingQuery := url.Values{}
		existingQuery.Set("select", "numero_identificacion")
		existingQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
		existingQuery.Set("numero_identificacion", buildStringInFilter(professorIDs))

		existingBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos_x_profesores", existingQuery, nil, false)
		if err != nil {
			return nil, status, err
		}

		existingRows, err := unmarshalRows(existingBody)
		if err != nil {
			return nil, http.StatusInternalServerError, err
		}

		existingSet := map[string]bool{}
		for _, row := range existingRows {
			id, _ := asString(row["numero_identificacion"])
			if id != "" {
				existingSet[id] = true
			}
		}

		payload := make([]map[string]any, 0)
		for _, id := range professorIDs {
			if existingSet[id] {
				continue
			}
			payload = append(payload, map[string]any{
				"numero_identificacion": id,
				"id_curso":              idCurso,
			})
		}

		if len(payload) > 0 {
			_, status, err := a.CallSupabase(ctx, http.MethodPost, "/rest/v1/cursos_x_profesores", nil, payload, false)
			if err != nil {
				return nil, status, err
			}
			insertedProfessors = len(payload)
		}
	}

	return map[string]any{
		"insertedStudentsCount":   insertedStudents,
		"insertedProfessorsCount": insertedProfessors,
		"insertedCount":           insertedStudents + insertedProfessors,
	}, http.StatusOK, nil
}

func (a *App) DissociateParticipantsFromCourse(ctx context.Context, idCurso int, participantIDs []string) (map[string]any, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso inválido")
	}

	normalizedIDs := normalizeIdentificationIDs(participantIDs)
	if len(normalizedIDs) == 0 {
		return nil, http.StatusBadRequest, errors.New("debe ingresar al menos un numero_identificacion")
	}

	linkedStudentsQuery := url.Values{}
	linkedStudentsQuery.Set("select", "numero_identificacion")
	linkedStudentsQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
	linkedStudentsQuery.Set("numero_identificacion", buildStringInFilter(normalizedIDs))

	linkedStudentsBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos_x_estudiantes", linkedStudentsQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	linkedProfessorsQuery := url.Values{}
	linkedProfessorsQuery.Set("select", "numero_identificacion")
	linkedProfessorsQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
	linkedProfessorsQuery.Set("numero_identificacion", buildStringInFilter(normalizedIDs))

	linkedProfessorsBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos_x_profesores", linkedProfessorsQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	linkedStudents, err := unmarshalRows(linkedStudentsBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	linkedProfessors, err := unmarshalRows(linkedProfessorsBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	studentIDs := make([]string, 0, len(linkedStudents))
	for _, row := range linkedStudents {
		id, _ := asString(row["numero_identificacion"])
		if id != "" {
			studentIDs = append(studentIDs, id)
		}
	}

	professorIDs := make([]string, 0, len(linkedProfessors))
	for _, row := range linkedProfessors {
		id, _ := asString(row["numero_identificacion"])
		if id != "" {
			professorIDs = append(professorIDs, id)
		}
	}

	if len(studentIDs) == 0 && len(professorIDs) == 0 {
		return nil, http.StatusBadRequest, errors.New("no existe vinculo para estas identificaciones en el curso seleccionado")
	}

	if len(studentIDs) > 0 {
		deleteQuery := url.Values{}
		deleteQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
		deleteQuery.Set("numero_identificacion", buildStringInFilter(studentIDs))

		_, status, err := a.CallSupabase(ctx, http.MethodDelete, "/rest/v1/cursos_x_estudiantes", deleteQuery, nil, false)
		if err != nil {
			return nil, status, err
		}
	}

	if len(professorIDs) > 0 {
		deleteQuery := url.Values{}
		deleteQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
		deleteQuery.Set("numero_identificacion", buildStringInFilter(professorIDs))

		_, status, err := a.CallSupabase(ctx, http.MethodDelete, "/rest/v1/cursos_x_profesores", deleteQuery, nil, false)
		if err != nil {
			return nil, status, err
		}
	}

	return map[string]any{
		"removedStudentsCount":   len(studentIDs),
		"removedProfessorsCount": len(professorIDs),
		"removedCount":           len(studentIDs) + len(professorIDs),
	}, http.StatusOK, nil
}

func (a *App) GetParticipantsByCourseID(ctx context.Context, idCurso int) ([]map[string]any, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso inválido")
	}

	studentsQuery := url.Values{}
	studentsQuery.Set("select", "numero_identificacion,estudiantes(numero_identificacion,nombres,apellidos,no_matricula,grado,tipo_identificacion,telefono,email)")
	studentsQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))

	studentsBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos_x_estudiantes", studentsQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	professorsQuery := url.Values{}
	professorsQuery.Set("select", "numero_identificacion,profesores(numero_identificacion,nombres,apellidos,tipo_identificacion,email,telefono)")
	professorsQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))

	professorsBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos_x_profesores", professorsQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	studentRows, err := unmarshalRows(studentsBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	professorRows, err := unmarshalRows(professorsBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	combined := make([]map[string]any, 0)

	for _, row := range studentRows {
		rawEmbedded := row["estudiantes"]
		embedded := map[string]any{}
		switch typed := rawEmbedded.(type) {
		case map[string]any:
			embedded = typed
		case []any:
			if len(typed) > 0 {
				if first, ok := typed[0].(map[string]any); ok {
					embedded = first
				}
			}
		}

		numero, _ := asString(embedded["numero_identificacion"])
		nombres, _ := asString(embedded["nombres"])
		apellidos, _ := asString(embedded["apellidos"])
		noMatricula, _ := asString(embedded["no_matricula"])
		grado, _ := asString(embedded["grado"])
		tipoIdentificacion, _ := asString(embedded["tipo_identificacion"])
		telefono, _ := asString(embedded["telefono"])
		email, _ := asString(embedded["email"])

		combined = append(combined, map[string]any{
			"numero_identificacion": numero,
			"role":                  "ESTUDIANTE",
			"tipo_identificacion":   nullableString(tipoIdentificacion),
			"no_matricula":          nullableString(noMatricula),
			"grado":                 nullableString(grado),
			"telefono":              nullableString(telefono),
			"email":                 nullableString(email),
			"nombres":               nombres,
			"apellidos":             apellidos,
		})
	}

	for _, row := range professorRows {
		rawEmbedded := row["profesores"]
		embedded := map[string]any{}
		switch typed := rawEmbedded.(type) {
		case map[string]any:
			embedded = typed
		case []any:
			if len(typed) > 0 {
				if first, ok := typed[0].(map[string]any); ok {
					embedded = first
				}
			}
		}

		numero, _ := asString(embedded["numero_identificacion"])
		nombres, _ := asString(embedded["nombres"])
		apellidos, _ := asString(embedded["apellidos"])
		email, _ := asString(embedded["email"])
		telefono, _ := asString(embedded["telefono"])
		tipoIdentificacion, _ := asString(embedded["tipo_identificacion"])

		combined = append(combined, map[string]any{
			"numero_identificacion": numero,
			"role":                  "PROFESOR",
			"tipo_identificacion":   nullableString(tipoIdentificacion),
			"no_matricula":          nil,
			"grado":                 nil,
			"telefono":              nullableString(telefono),
			"email":                 nullableString(email),
			"nombres":               nombres,
			"apellidos":             apellidos,
		})
	}

	sort.Slice(combined, func(i, j int) bool {
		aLast, _ := asString(combined[i]["apellidos"])
		bLast, _ := asString(combined[j]["apellidos"])
		if aLast != bLast {
			return aLast < bLast
		}
		aFirst, _ := asString(combined[i]["nombres"])
		bFirst, _ := asString(combined[j]["nombres"])
		if aFirst != bFirst {
			return aFirst < bFirst
		}
		aID, _ := asString(combined[i]["numero_identificacion"])
		bID, _ := asString(combined[j]["numero_identificacion"])
		return aID < bID
	})

	return combined, http.StatusOK, nil
}

func (a *App) GetStudentsByCourseID(ctx context.Context, idCurso int) ([]map[string]any, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso inválido")
	}

	query := url.Values{}
	query.Set("select", "numero_identificacion,estudiantes(numero_identificacion,nombres,apellidos,no_matricula,grado,tipo_identificacion)")
	query.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos_x_estudiantes", query, nil, false)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	students := make([]map[string]any, 0)
	for _, row := range rows {
		rawEmbedded := row["estudiantes"]
		embedded := map[string]any{}
		switch typed := rawEmbedded.(type) {
		case map[string]any:
			embedded = typed
		case []any:
			if len(typed) > 0 {
				if first, ok := typed[0].(map[string]any); ok {
					embedded = first
				}
			}
		}

		if len(embedded) == 0 {
			continue
		}

		students = append(students, embedded)
	}

	sort.Slice(students, func(i, j int) bool {
		aLast, _ := asString(students[i]["apellidos"])
		bLast, _ := asString(students[j]["apellidos"])
		return aLast < bLast
	})

	return students, http.StatusOK, nil
}

func (a *App) GetDashboardSummary(ctx context.Context) (map[string]any, error) {
	students, err := a.ListStudents(ctx)
	if err != nil {
		return nil, err
	}

	courses, err := a.ListCourses(ctx)
	if err != nil {
		return nil, err
	}

	nowBogota := time.Now().In(bogotaTZ)
	monthStart := time.Date(nowBogota.Year(), nowBogota.Month(), 1, 0, 0, 0, 0, bogotaTZ).UTC().Format(time.RFC3339)
	nextMonthStart := time.Date(nowBogota.Year(), nowBogota.Month()+1, 1, 0, 0, 0, 0, bogotaTZ).UTC().Format(time.RFC3339)

	attendedQuery := url.Values{}
	attendedQuery.Set("select", "id")
	attendedQuery.Set("asistio", "eq.true")
	attendedQuery.Set("fecha", fmt.Sprintf("gte.%s", monthStart))
	attendedQuery.Add("fecha", fmt.Sprintf("lt.%s", nextMonthStart))
	attendedBody, _, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/registro_asistencia", attendedQuery, nil, false)
	if err != nil {
		return nil, err
	}
	attendedRows, err := unmarshalRows(attendedBody)
	if err != nil {
		return nil, err
	}

	absentQuery := url.Values{}
	absentQuery.Set("select", "id")
	absentQuery.Set("asistio", "eq.false")
	absentQuery.Set("fecha", fmt.Sprintf("gte.%s", monthStart))
	absentQuery.Add("fecha", fmt.Sprintf("lt.%s", nextMonthStart))
	absentBody, _, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/registro_asistencia", absentQuery, nil, false)
	if err != nil {
		return nil, err
	}
	absentRows, err := unmarshalRows(absentBody)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"studentsCount": len(students),
		"coursesCount":  len(courses),
		"attendedCount": len(attendedRows),
		"absentCount":   len(absentRows),
	}, nil
}

func normalizeAttendanceSaldo(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.ToLower(strings.TrimSpace(*value))
	if trimmed == "" {
		return nil
	}
	if trimmed == "cancelado" || trimmed == "debe" {
		return &trimmed
	}
	return nil
}

func normalizeAttendanceMetodoPago(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := normalizeUpper(*value)
	if trimmed == "" {
		return nil
	}
	allowed := map[string]bool{
		"EFECTIVO":      true,
		"TRANSFERENCIA": true,
		"NEQUI":         true,
		"DAVIPLATA":     true,
		"OTRO":          true,
	}
	if !allowed[trimmed] {
		return nil
	}
	return &trimmed
}

func nullableString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func (a *App) GetAttendanceRoster(ctx context.Context, idCurso int, date string) ([]map[string]any, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso inválido")
	}

	startISO, endISO, err := getBogotaDayBounds(date)
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("fecha inválida")
	}

	enrolledQuery := url.Values{}
	enrolledQuery.Set("select", "numero_identificacion,estudiantes(numero_identificacion,nombres,apellidos)")
	enrolledQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
	enrolledQuery.Set("order", "numero_identificacion.asc")

	enrolledBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos_x_estudiantes", enrolledQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	enrolledRows, err := unmarshalRows(enrolledBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	identifiers := make([]string, 0)
	for _, row := range enrolledRows {
		id, _ := asString(row["numero_identificacion"])
		if strings.TrimSpace(id) != "" {
			identifiers = append(identifiers, id)
		}
	}

	if len(identifiers) == 0 {
		return []map[string]any{}, http.StatusOK, nil
	}

	attendanceQuery := url.Values{}
	attendanceQuery.Set("select", "numero_identificacion,asistio,saldo,metodo_pago,fecha")
	attendanceQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
	attendanceQuery.Set("numero_identificacion", buildStringInFilter(identifiers))
	attendanceQuery.Set("fecha", fmt.Sprintf("gte.%s", startISO))
	attendanceQuery.Add("fecha", fmt.Sprintf("lt.%s", endISO))

	attendanceBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/registro_asistencia", attendanceQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	attendanceRows, err := unmarshalRows(attendanceBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	attendanceByStudent := map[string]map[string]any{}
	for _, row := range attendanceRows {
		id, _ := asString(row["numero_identificacion"])
		if id == "" {
			continue
		}
		attendanceByStudent[id] = row
	}

	advanceByStudent := map[string]int{}
	saldoQuery := url.Values{}
	saldoQuery.Set("select", "numero_identificacion,clases_adelantadas")
	saldoQuery.Set("numero_identificacion", buildStringInFilter(identifiers))

	saldoBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/saldo_estudiantes", saldoQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	saldoRows, err := unmarshalRows(saldoBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	for _, saldoRow := range saldoRows {
		id, _ := asString(saldoRow["numero_identificacion"])
		if id == "" {
			continue
		}

		clasesAdelantadas, ok := asInt(saldoRow["clases_adelantadas"])
		if !ok || clasesAdelantadas < 0 {
			clasesAdelantadas = 0
		}

		advanceByStudent[id] = clasesAdelantadas
	}

	result := make([]map[string]any, 0, len(enrolledRows))
	for _, row := range enrolledRows {
		id, _ := asString(row["numero_identificacion"])
		if id == "" {
			continue
		}

		rawEmbedded := row["estudiantes"]
		embedded := map[string]any{}
		switch typed := rawEmbedded.(type) {
		case map[string]any:
			embedded = typed
		case []any:
			if len(typed) > 0 {
				if first, ok := typed[0].(map[string]any); ok {
					embedded = first
				}
			}
		}

		nombres, _ := asString(embedded["nombres"])
		apellidos, _ := asString(embedded["apellidos"])

		attendance := attendanceByStudent[id]
		asistio := false
		saldo := any(nil)
		metodoPago := any(nil)
		marcadoEn := any(nil)
		if attendance != nil {
			if value, ok := asBool(attendance["asistio"]); ok {
				asistio = value
			}
			if value, ok := asString(attendance["saldo"]); ok {
				saldo = nullableString(strings.ToLower(value))
			}
			if value, ok := asString(attendance["metodo_pago"]); ok {
				metodoPago = nullableString(normalizeUpper(value))
			}
			if value, ok := asString(attendance["fecha"]); ok {
				marcadoEn = nullableString(value)
			}
		}

		result = append(result, map[string]any{
			"numero_identificacion": id,
			"nombres":               nombres,
			"apellidos":             apellidos,
			"asistio":               asistio,
			"saldo":                 saldo,
			"metodo_pago":           metodoPago,
			"marcado_en":            marcadoEn,
			"clases_adelantadas":    advanceByStudent[id],
		})
	}

	return result, http.StatusOK, nil
}

func (a *App) SaveAttendance(ctx context.Context, req models.AttendanceSaveRequest) (map[string]any, int, error) {
	if req.IDCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso inválido")
	}
	if strings.TrimSpace(req.Date) == "" {
		return nil, http.StatusBadRequest, errors.New("date es requerido")
	}

	registradoPor := ""
	if req.RegistradoPor != nil {
		registradoPor = strings.TrimSpace(*req.RegistradoPor)
	}

	normalizedRows := make([]models.AttendanceSaveRow, 0, len(req.Rows))
	for _, row := range req.Rows {
		id := normalizeUpper(row.NumeroIdentificacion)
		if id == "" {
			continue
		}

		normalizedSaldo := normalizeAttendanceSaldo(row.Saldo)
		normalizedMetodo := normalizeAttendanceMetodoPago(row.MetodoPago)
		marcadoEn := row.MarcadoEn

		if !row.Asistio {
			normalizedSaldo = nil
			normalizedMetodo = nil
			marcadoEn = nil
		} else {
			if normalizedSaldo != nil && *normalizedSaldo == "debe" {
				normalizedMetodo = nil
			} else if normalizedSaldo == nil || *normalizedSaldo != "cancelado" {
				normalizedSaldo = nil
				normalizedMetodo = nil
			}
		}

		normalizedRows = append(normalizedRows, models.AttendanceSaveRow{
			NumeroIdentificacion: id,
			Asistio:              row.Asistio,
			Saldo:                normalizedSaldo,
			MetodoPago:           normalizedMetodo,
			MarcadoEn:            marcadoEn,
		})
	}

	if len(normalizedRows) == 0 {
		return nil, http.StatusBadRequest, errors.New("no hay estudiantes para registrar")
	}

	startISO, endISO, err := getBogotaDayBounds(req.Date)
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("fecha inválida")
	}

	studentIDs := make([]string, 0, len(normalizedRows))
	for _, row := range normalizedRows {
		studentIDs = append(studentIDs, row.NumeroIdentificacion)
	}

	studentIDs = normalizeIdentificationIDs(studentIDs)

	existingQuery := url.Values{}
	existingQuery.Set("select", "id,numero_identificacion,asistio,fecha,id_pago")
	existingQuery.Set("id_curso", fmt.Sprintf("eq.%d", req.IDCurso))
	existingQuery.Set("numero_identificacion", buildStringInFilter(studentIDs))
	existingQuery.Set("fecha", fmt.Sprintf("gte.%s", startISO))
	existingQuery.Add("fecha", fmt.Sprintf("lt.%s", endISO))

	existingBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/registro_asistencia", existingQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	existingRows, err := unmarshalRows(existingBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	existingByStudent := map[string]map[string]any{}
	for _, row := range existingRows {
		id, _ := asString(row["numero_identificacion"])
		if id != "" {
			existingByStudent[id] = row
		}
	}

	supportByStudent := map[string]float64{}
	if registradoPor != "" {
		supportQuery := url.Values{}
		supportQuery.Set("select", "numero_identificacion,valor_apoyo_semanal")
		supportQuery.Set("numero_identificacion", buildStringInFilter(studentIDs))

		supportBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/estudiantes", supportQuery, nil, false)
		if err != nil {
			return nil, status, err
		}

		supportRows, err := unmarshalRows(supportBody)
		if err != nil {
			return nil, http.StatusInternalServerError, err
		}

		for _, supportRow := range supportRows {
			numero, _ := asString(supportRow["numero_identificacion"])
			if numero == "" {
				continue
			}
			valorApoyoSemanal, ok := asFloat(supportRow["valor_apoyo_semanal"])
			if !ok || valorApoyoSemanal <= 0 {
				continue
			}
			supportByStudent[numero] = valorApoyoSemanal
		}
	}

	advanceByStudent := map[string]int{}
	advanceQuery := url.Values{}
	advanceQuery.Set("select", "numero_identificacion,clases_adelantadas")
	advanceQuery.Set("numero_identificacion", buildStringInFilter(studentIDs))

	advanceBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/saldo_estudiantes", advanceQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	advanceRows, err := unmarshalRows(advanceBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	for _, advanceRow := range advanceRows {
		id, _ := asString(advanceRow["numero_identificacion"])
		if id == "" {
			continue
		}

		clasesAdelantadas, ok := asInt(advanceRow["clases_adelantadas"])
		if !ok || clasesAdelantadas < 0 {
			clasesAdelantadas = 0
		}

		advanceByStudent[id] = clasesAdelantadas
	}

	savedCount := 0

	for _, row := range normalizedRows {
		hadAdvanceBefore := row.Asistio && advanceByStudent[row.NumeroIdentificacion] > 0
		if hadAdvanceBefore {
			forcedSaldo := "cancelado"
			row.Saldo = &forcedSaldo
			row.MetodoPago = nil
		}

		existing := existingByStudent[row.NumeroIdentificacion]
		existingPagoID := ""
		if existing != nil {
			if value, ok := asString(existing["id_pago"]); ok {
				existingPagoID = strings.TrimSpace(value)
			}
		}

		attendanceID := 0
		if existing == nil {
			insertDate := startISO
			if row.Asistio {
				if row.MarcadoEn != nil && strings.TrimSpace(*row.MarcadoEn) != "" {
					insertDate = strings.TrimSpace(*row.MarcadoEn)
				} else {
					insertDate = getBogotaTimestampForDate(req.Date)
				}
			}

			insertPayload := map[string]any{
				"numero_identificacion": row.NumeroIdentificacion,
				"id_curso":              req.IDCurso,
				"fecha":                 insertDate,
				"asistio":               row.Asistio,
				"saldo":                 nil,
				"metodo_pago":           nil,
			}
			if row.Asistio {
				if row.Saldo != nil {
					insertPayload["saldo"] = *row.Saldo
				}
				if row.Saldo != nil && *row.Saldo == "cancelado" && row.MetodoPago != nil {
					insertPayload["metodo_pago"] = *row.MetodoPago
				}
			} else if req.SaveTimestampISO != nil && strings.TrimSpace(*req.SaveTimestampISO) != "" {
				insertPayload["created_at"] = strings.TrimSpace(*req.SaveTimestampISO)
			}

			insertQuery := url.Values{}
			insertQuery.Set("select", "id,id_pago")

			insertBody, status, err := a.CallSupabase(ctx, http.MethodPost, "/rest/v1/registro_asistencia", insertQuery, insertPayload, true)
			if err != nil {
				return nil, status, err
			}

			insertedRows, err := unmarshalRows(insertBody)
			if err != nil {
				return nil, http.StatusInternalServerError, err
			}
			if len(insertedRows) == 0 {
				continue
			}

			insertedID, ok := asInt(insertedRows[0]["id"])
			if ok {
				attendanceID = insertedID
			}
			if value, ok := asString(insertedRows[0]["id_pago"]); ok {
				existingPagoID = strings.TrimSpace(value)
			}

			savedCount += 1
		} else {
			existingID, ok := asInt(existing["id"])
			if !ok {
				continue
			}
			attendanceID = existingID

			existingAsistio, _ := asBool(existing["asistio"])
			existingFecha, _ := asString(existing["fecha"])

			fechaMarcado := existingFecha
			if row.Asistio {
				if !existingAsistio {
					if row.MarcadoEn != nil && strings.TrimSpace(*row.MarcadoEn) != "" {
						fechaMarcado = strings.TrimSpace(*row.MarcadoEn)
					} else {
						fechaMarcado = getBogotaTimestampForDate(req.Date)
					}
				}
			}

			updatePayload := map[string]any{
				"fecha":       fechaMarcado,
				"asistio":     row.Asistio,
				"saldo":       nil,
				"metodo_pago": nil,
			}
			if row.Asistio {
				if row.Saldo != nil {
					updatePayload["saldo"] = *row.Saldo
				}
				if row.Saldo != nil && *row.Saldo == "cancelado" && row.MetodoPago != nil {
					updatePayload["metodo_pago"] = *row.MetodoPago
				}
			} else if req.SaveTimestampISO != nil && strings.TrimSpace(*req.SaveTimestampISO) != "" {
				updatePayload["created_at"] = strings.TrimSpace(*req.SaveTimestampISO)
			}

			updateQuery := url.Values{}
			updateQuery.Set("id", fmt.Sprintf("eq.%d", existingID))
			updateQuery.Set("select", "id,id_pago")

			updateBody, status, err := a.CallSupabase(ctx, http.MethodPatch, "/rest/v1/registro_asistencia", updateQuery, updatePayload, true)
			if err != nil {
				return nil, status, err
			}

			updatedRows, err := unmarshalRows(updateBody)
			if err != nil {
				return nil, http.StatusInternalServerError, err
			}
			if len(updatedRows) > 0 {
				if value, ok := asString(updatedRows[0]["id_pago"]); ok {
					existingPagoID = strings.TrimSpace(value)
				}
			}

			savedCount += 1
		}

		if registradoPor == "" || attendanceID <= 0 {
			continue
		}

		if !row.Asistio || row.Saldo == nil || *row.Saldo != "cancelado" || row.MetodoPago == nil {
			continue
		}
		if hadAdvanceBefore {
			continue
		}
		if existingPagoID != "" {
			continue
		}

		valorApoyoSemanal, ok := supportByStudent[row.NumeroIdentificacion]
		if !ok || valorApoyoSemanal <= 0 {
			continue
		}

		pagoPayload := map[string]any{
			"numero_identificacion": row.NumeroIdentificacion,
			"id_curso":              req.IDCurso,
			"id_asistencia":         attendanceID,
			"registrado_por":        registradoPor,
			"origen_pago":           "asistencia",
			"tipo_pago":             "clase_presencial",
			"metodo_pago":           *row.MetodoPago,
			"valor":                 valorApoyoSemanal,
			"clases_adelantadas":    0,
			"notas":                 fmt.Sprintf("PAGO REGISTRADO EN ASISTENCIA %s", req.Date),
		}

		pagoQuery := url.Values{}
		pagoQuery.Set("select", "id")

		pagoBody, status, err := a.CallSupabase(ctx, http.MethodPost, "/rest/v1/pagos", pagoQuery, pagoPayload, true)
		if err != nil {
			return nil, status, err
		}

		pagoRows, err := unmarshalRows(pagoBody)
		if err != nil {
			return nil, http.StatusInternalServerError, err
		}
		if len(pagoRows) == 0 {
			continue
		}

		pagoID, _ := asString(pagoRows[0]["id"])
		if strings.TrimSpace(pagoID) == "" {
			continue
		}

		linkQuery := url.Values{}
		linkQuery.Set("id", fmt.Sprintf("eq.%d", attendanceID))

		_, status, err = a.CallSupabase(ctx, http.MethodPatch, "/rest/v1/registro_asistencia", linkQuery, map[string]any{"id_pago": strings.TrimSpace(pagoID)}, false)
		if err != nil {
			return nil, status, err
		}
	}

	return map[string]any{"savedCount": savedCount}, http.StatusOK, nil
}

func (a *App) DeleteAttendance(ctx context.Context, idCurso int, date string) (map[string]any, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso inválido")
	}

	startISO, endISO, err := getBogotaDayBounds(date)
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("fecha inválida")
	}

	countQuery := url.Values{}
	countQuery.Set("select", "id")
	countQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
	countQuery.Set("fecha", fmt.Sprintf("gte.%s", startISO))
	countQuery.Add("fecha", fmt.Sprintf("lt.%s", endISO))

	countBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/registro_asistencia", countQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	countRows, err := unmarshalRows(countBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	deleteQuery := url.Values{}
	deleteQuery.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
	deleteQuery.Set("fecha", fmt.Sprintf("gte.%s", startISO))
	deleteQuery.Add("fecha", fmt.Sprintf("lt.%s", endISO))

	_, status, err = a.CallSupabase(ctx, http.MethodDelete, "/rest/v1/registro_asistencia", deleteQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	return map[string]any{"deletedCount": len(countRows)}, http.StatusOK, nil
}

func (a *App) GetAttendanceExport(ctx context.Context, idCurso int, date string) ([]map[string]any, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso inválido")
	}

	startISO, endISO, err := getBogotaDayBounds(date)
	if err != nil {
		return nil, http.StatusBadRequest, errors.New("fecha inválida")
	}

	query := url.Values{}
	query.Set("select", "id,id_curso,numero_identificacion,fecha,asistio,saldo,metodo_pago,estudiantes(tipo_identificacion,nombres,apellidos),cursos(nombre_curso)")
	query.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
	query.Set("fecha", fmt.Sprintf("gte.%s", startISO))
	query.Add("fecha", fmt.Sprintf("lt.%s", endISO))
	query.Set("order", "numero_identificacion.asc")

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/registro_asistencia", query, nil, false)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	exportRows := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		rawStudent := row["estudiantes"]
		rawCourse := row["cursos"]

		student := map[string]any{}
		course := map[string]any{}

		switch typed := rawStudent.(type) {
		case map[string]any:
			student = typed
		case []any:
			if len(typed) > 0 {
				if first, ok := typed[0].(map[string]any); ok {
					student = first
				}
			}
		}

		switch typed := rawCourse.(type) {
		case map[string]any:
			course = typed
		case []any:
			if len(typed) > 0 {
				if first, ok := typed[0].(map[string]any); ok {
					course = first
				}
			}
		}

		nombreCurso, _ := asString(course["nombre_curso"])
		tipoIdentificacion, _ := asString(student["tipo_identificacion"])
		nombres, _ := asString(student["nombres"])
		apellidos, _ := asString(student["apellidos"])

		exportRows = append(exportRows, map[string]any{
			"id":                    row["id"],
			"id_curso":              row["id_curso"],
			"nombre_curso":          nombreCurso,
			"tipo_identificacion":   nullableString(tipoIdentificacion),
			"numero_identificacion": row["numero_identificacion"],
			"nombres":               nombres,
			"apellidos":             apellidos,
			"fecha":                 row["fecha"],
			"asistio":               row["asistio"],
			"saldo":                 row["saldo"],
			"metodo_pago":           row["metodo_pago"],
		})
	}

	return exportRows, http.StatusOK, nil
}

func (a *App) GetAttendanceDatesByCourse(ctx context.Context, idCurso int) ([]string, int, error) {
	if idCurso <= 0 {
		return nil, http.StatusBadRequest, errors.New("id_curso inválido")
	}

	query := url.Values{}
	query.Set("select", "fecha")
	query.Set("id_curso", fmt.Sprintf("eq.%d", idCurso))
	query.Set("order", "fecha.desc")

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/registro_asistencia", query, nil, false)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	seen := map[string]bool{}
	dates := make([]string, 0, len(rows))

	for _, row := range rows {
		fechaRaw, ok := asString(row["fecha"])
		if !ok {
			continue
		}

		parsed, parseErr := time.Parse(time.RFC3339Nano, strings.TrimSpace(fechaRaw))
		if parseErr != nil {
			continue
		}

		dateOnly := parsed.In(bogotaTZ).Format("2006-01-02")
		if dateOnly == "" || seen[dateOnly] {
			continue
		}

		seen[dateOnly] = true
		dates = append(dates, dateOnly)
	}

	sort.Sort(sort.Reverse(sort.StringSlice(dates)))

	return dates, http.StatusOK, nil
}

func (a *App) GetStudentAttendanceSummary(ctx context.Context, numeroIdentificacion string) (map[string]any, int, error) {
	numero := normalizeUpper(numeroIdentificacion)
	if numero == "" {
		return nil, http.StatusBadRequest, errors.New("numero_identificacion es requerido")
	}

	query := url.Values{}
	query.Set("select", "asistio")
	query.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))

	body, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/registro_asistencia", query, nil, false)
	if err != nil {
		return nil, status, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	attendedCount := 0
	absentCount := 0

	for _, row := range rows {
		asistio, ok := asBool(row["asistio"])
		if ok && asistio {
			attendedCount++
			continue
		}

		absentCount++
	}

	return map[string]any{
		"numero_identificacion": numero,
		"attended_count":       attendedCount,
		"absent_count":         absentCount,
		"total_count":          attendedCount + absentCount,
	}, http.StatusOK, nil
}

func normalizePersonCourse(raw map[string]any) (models.PersonCourseInfo, bool) {
	idCurso, ok := asInt(raw["id_curso"])
	if !ok {
		return models.PersonCourseInfo{}, false
	}
	nombreCurso, ok := asString(raw["nombre_curso"])
	if !ok {
		return models.PersonCourseInfo{}, false
	}
	nivelCurso, ok := asString(raw["nivel_curso"])
	if !ok {
		return models.PersonCourseInfo{}, false
	}
	horaInicio, ok := asString(raw["hora_inicio"])
	if !ok {
		return models.PersonCourseInfo{}, false
	}
	horaFin, ok := asString(raw["hora_fin"])
	if !ok {
		return models.PersonCourseInfo{}, false
	}

	var salon *string
	if salonValue, ok := asString(raw["salon"]); ok && strings.TrimSpace(salonValue) != "" {
		s := strings.TrimSpace(salonValue)
		salon = &s
	}

	return models.PersonCourseInfo{
		IDCurso:     idCurso,
		NombreCurso: nombreCurso,
		NivelCurso:  nivelCurso,
		Salon:       salon,
		HoraInicio:  horaInicio,
		HoraFin:     horaFin,
	}, true
}

func sortPersonCourses(courses []models.PersonCourseInfo) {
	sort.Slice(courses, func(i, j int) bool {
		if courses[i].IDCurso != courses[j].IDCurso {
			return courses[i].IDCurso < courses[j].IDCurso
		}
		return courses[i].NombreCurso < courses[j].NombreCurso
	})
}

func (a *App) LookupPersonByID(ctx context.Context, numeroIdentificacion string) (map[string]any, int, error) {
	numero := normalizeUpper(numeroIdentificacion)
	if numero == "" {
		return nil, http.StatusBadRequest, errors.New("numero_identificacion es requerido")
	}

	studentQuery := url.Values{}
	studentQuery.Set("select", "numero_identificacion,tipo_identificacion,nombres,apellidos")
	studentQuery.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))
	studentBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/estudiantes", studentQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	professorQuery := url.Values{}
	professorQuery.Set("select", "numero_identificacion,tipo_identificacion,nombres,apellidos")
	professorQuery.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))
	professorBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/profesores", professorQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	studentCoursesQuery := url.Values{}
	studentCoursesQuery.Set("select", "id_curso,cursos(id_curso,nombre_curso,nivel_curso,salon,hora_inicio,hora_fin)")
	studentCoursesQuery.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))
	studentCoursesBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos_x_estudiantes", studentCoursesQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	professorCoursesQuery := url.Values{}
	professorCoursesQuery.Set("select", "id_curso,cursos(id_curso,nombre_curso,nivel_curso,salon,hora_inicio,hora_fin)")
	professorCoursesQuery.Set("numero_identificacion", fmt.Sprintf("eq.%s", numero))
	professorCoursesBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/cursos_x_profesores", professorCoursesQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	studentRows, err := unmarshalRows(studentBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	professorRows, err := unmarshalRows(professorBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	studentCoursesRows, err := unmarshalRows(studentCoursesBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	professorCoursesRows, err := unmarshalRows(professorCoursesBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	records := make([]models.PersonRecord, 0, 2)

	if len(studentRows) > 0 {
		student := studentRows[0]
		tipo, _ := asString(student["tipo_identificacion"])
		nombres, _ := asString(student["nombres"])
		apellidos, _ := asString(student["apellidos"])

		courses := make([]models.PersonCourseInfo, 0)
		for _, row := range studentCoursesRows {
			rawCourse := row["cursos"]
			courseObj := map[string]any{}
			switch typed := rawCourse.(type) {
			case map[string]any:
				courseObj = typed
			case []any:
				if len(typed) > 0 {
					if first, ok := typed[0].(map[string]any); ok {
						courseObj = first
					}
				}
			}

			if normalized, ok := normalizePersonCourse(courseObj); ok {
				courses = append(courses, normalized)
			}
		}
		sortPersonCourses(courses)

		var tipoPtr *string
		if strings.TrimSpace(tipo) != "" {
			t := tipo
			tipoPtr = &t
		}

		records = append(records, models.PersonRecord{
			Role:                 "ESTUDIANTE",
			TipoIdentificacion:   tipoPtr,
			NumeroIdentificacion: numero,
			Nombres:              nombres,
			Apellidos:            apellidos,
			Cursos:               courses,
		})
	}

	if len(professorRows) > 0 {
		professor := professorRows[0]
		tipo, _ := asString(professor["tipo_identificacion"])
		nombres, _ := asString(professor["nombres"])
		apellidos, _ := asString(professor["apellidos"])

		courses := make([]models.PersonCourseInfo, 0)
		for _, row := range professorCoursesRows {
			rawCourse := row["cursos"]
			courseObj := map[string]any{}
			switch typed := rawCourse.(type) {
			case map[string]any:
				courseObj = typed
			case []any:
				if len(typed) > 0 {
					if first, ok := typed[0].(map[string]any); ok {
						courseObj = first
					}
				}
			}

			if normalized, ok := normalizePersonCourse(courseObj); ok {
				courses = append(courses, normalized)
			}
		}
		sortPersonCourses(courses)

		var tipoPtr *string
		if strings.TrimSpace(tipo) != "" {
			t := tipo
			tipoPtr = &t
		}

		records = append(records, models.PersonRecord{
			Role:                 "PROFESOR",
			TipoIdentificacion:   tipoPtr,
			NumeroIdentificacion: numero,
			Nombres:              nombres,
			Apellidos:            apellidos,
			Cursos:               courses,
		})
	}

	responseRecords := make([]map[string]any, 0, len(records))
	for _, record := range records {
		cursos := make([]map[string]any, 0, len(record.Cursos))
		for _, course := range record.Cursos {
			cursos = append(cursos, map[string]any{
				"id_curso":     course.IDCurso,
				"nombre_curso": course.NombreCurso,
				"nivel_curso":  course.NivelCurso,
				"salon":        course.Salon,
				"hora_inicio":  course.HoraInicio,
				"hora_fin":     course.HoraFin,
			})
		}

		responseRecords = append(responseRecords, map[string]any{
			"role":                  record.Role,
			"tipo_identificacion":   record.TipoIdentificacion,
			"numero_identificacion": record.NumeroIdentificacion,
			"nombres":               record.Nombres,
			"apellidos":             record.Apellidos,
			"cursos":                cursos,
		})
	}

	return map[string]any{
		"found":                 len(responseRecords) > 0,
		"numero_identificacion": numero,
		"records":               responseRecords,
	}, http.StatusOK, nil
}

func (a *App) ResolveAccessByUserID(ctx context.Context, req models.ResolveAccessRequest) (map[string]any, int, error) {
	userID := strings.TrimSpace(req.UserID)
	if userID == "" {
		return nil, http.StatusBadRequest, errors.New("user_id es requerido")
	}

	mustChangePassword := false
	if req.UserMetadata != nil {
		if value, ok := req.UserMetadata["must_change_password"]; ok {
			if parsed, ok := asBool(value); ok {
				mustChangePassword = parsed
			}
		}
	}

	profileQuery := url.Values{}
	profileQuery.Set("select", "nombre,apellido,role,approved")
	profileQuery.Set("id", fmt.Sprintf("eq.%s", userID))

	profileBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/profiles", profileQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	profiles, err := unmarshalRows(profileBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	if len(profiles) > 0 {
		profile := profiles[0]
		nombre, _ := asString(profile["nombre"])
		apellido, _ := asString(profile["apellido"])
		role, _ := asString(profile["role"])
		approved, _ := asBool(profile["approved"])
		forcePasswordChange := mustChangePassword && strings.EqualFold(strings.TrimSpace(role), "administrador")

		return map[string]any{
			"role":               nullableString(role),
			"approved":           approved,
			"mustChangePassword": forcePasswordChange,
			"fullName":           strings.TrimSpace(strings.TrimSpace(nombre) + " " + strings.TrimSpace(apellido)),
			"profileFound":       true,
			"email":              nullableString(req.Email),
			"user_id":            userID,
		}, http.StatusOK, nil
	}

	adminQuery := url.Values{}
	adminQuery.Set("select", "nombres,apellidos")
	adminQuery.Set("id", fmt.Sprintf("eq.%s", userID))

	adminBody, status, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/administrador", adminQuery, nil, false)
	if err != nil {
		return nil, status, err
	}

	admins, err := unmarshalRows(adminBody)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	if len(admins) > 0 {
		admin := admins[0]
		nombres, _ := asString(admin["nombres"])
		apellidos, _ := asString(admin["apellidos"])
		return map[string]any{
			"role":               "administrador",
			"approved":           false,
			"mustChangePassword": mustChangePassword,
			"fullName":           strings.TrimSpace(strings.TrimSpace(nombres) + " " + strings.TrimSpace(apellidos)),
			"profileFound":       false,
			"email":              nullableString(req.Email),
			"user_id":            userID,
		}, http.StatusOK, nil
	}

	return map[string]any{
		"role":               nil,
		"approved":           false,
		"mustChangePassword": false,
		"fullName":           nil,
		"profileFound":       false,
		"email":              nullableString(req.Email),
		"user_id":            userID,
	}, http.StatusOK, nil
}
