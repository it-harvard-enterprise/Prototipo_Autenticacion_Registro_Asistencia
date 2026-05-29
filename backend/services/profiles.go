package services

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"fingerprint-backend/models"
)

func (a *App) loadProfileIndexByRole(ctx context.Context, role string) (map[string]map[string]any, map[string]map[string]any, error) {
	query := url.Values{}
	query.Set("select", "id,email,role,approved")
	query.Set("role", fmt.Sprintf("eq.%s", role))

	body, _, err := a.CallSupabase(ctx, http.MethodGet, "/rest/v1/profiles", query, nil, false)
	if err != nil {
		return nil, nil, err
	}

	rows, err := unmarshalRows(body)
	if err != nil {
		return nil, nil, err
	}

	byID := make(map[string]map[string]any, len(rows))
	byEmail := make(map[string]map[string]any, len(rows))
	for _, row := range rows {
		if id, ok := asString(row["id"]); ok && strings.TrimSpace(id) != "" {
			byID[strings.ToLower(strings.TrimSpace(id))] = row
		}
		if email, ok := asString(row["email"]); ok && strings.TrimSpace(email) != "" {
			byEmail[normalizeLower(email)] = row
		}
	}

	return byID, byEmail, nil
}

func attachProfileStatus(record map[string]any, byID, byEmail map[string]map[string]any) {
	if record == nil {
		return
	}

	authUserID, _ := asString(record["auth_user_id"])
	email, _ := asString(record["email"])

	var profile map[string]any
	if strings.TrimSpace(authUserID) != "" {
		profile = byID[strings.ToLower(strings.TrimSpace(authUserID))]
	}
	if profile == nil && strings.TrimSpace(email) != "" {
		profile = byEmail[normalizeLower(email)]
	}

	if profile == nil {
		record["perfil_usuario"] = "inactivo"
		record["profile_id"] = nil
		return
	}

	record["perfil_usuario"] = "activo"
	record["profile_id"] = profile["id"]
	record["profile_role"] = profile["role"]
	record["profile_approved"] = profile["approved"]
}

func (a *App) managedRecordByRole(ctx context.Context, role, numero string) (map[string]any, int, error) {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "estudiante":
		return a.GetStudentByNumero(ctx, numero)
	case "profesor":
		return a.GetProfessorByNumero(ctx, numero)
	default:
		return nil, http.StatusBadRequest, errors.New("role inválido")
	}
}

func (a *App) EnsureStudentProfile(ctx context.Context, numero string) (map[string]any, int, error) {
	return a.ensureManagedProfile(ctx, "estudiante", numero)
}

func (a *App) EnsureProfessorProfile(ctx context.Context, numero string) (map[string]any, int, error) {
	return a.ensureManagedProfile(ctx, "profesor", numero)
}

func (a *App) DeleteStudentProfile(ctx context.Context, numero string) (map[string]any, int, error) {
	return a.deleteManagedProfile(ctx, "estudiante", numero)
}

func (a *App) DeleteProfessorProfile(ctx context.Context, numero string) (map[string]any, int, error) {
	return a.deleteManagedProfile(ctx, "profesor", numero)
}

func (a *App) ensureManagedProfile(ctx context.Context, role, numero string) (map[string]any, int, error) {
	record, status, err := a.managedRecordByRole(ctx, role, numero)
	if err != nil {
		return nil, status, err
	}

	perfilUsuario, _ := asString(record["perfil_usuario"])
	if strings.EqualFold(strings.TrimSpace(perfilUsuario), "activo") {
		return record, http.StatusOK, nil
	}

	authUserID, _ := asString(record["auth_user_id"])
	email, _ := asString(record["email"])
	nombres, _ := asString(record["nombres"])
	apellidos, _ := asString(record["apellidos"])
	tipoIdentificacion, _ := asString(record["tipo_identificacion"])
	numeroIdentificacion, _ := asString(record["numero_identificacion"])

	if strings.TrimSpace(authUserID) != "" {
		payload := map[string]any{
			"id":       strings.TrimSpace(authUserID),
			"nombre":   normalizeUpper(nombres),
			"apellido": normalizeUpper(apellidos),
			"email":    normalizeLower(email),
			"role":     strings.ToLower(strings.TrimSpace(role)),
			"approved": true,
		}

		query := url.Values{}
		query.Set("select", "id,email,role,approved")

		if _, status, err := a.CallSupabase(ctx, http.MethodPost, "/rest/v1/profiles", query, payload, true); err != nil {
			return nil, status, err
		}

		return a.managedRecordByRole(ctx, role, numero)
	}

	if strings.TrimSpace(email) == "" {
		return nil, http.StatusBadRequest, errors.New("el correo electrónico es obligatorio para crear el perfil")
	}

	_, alreadyRegistered, err := a.CreateManagedAuthUser(ctx, models.ManagedAuthUserParams{
		Email:                email,
		Password:             numeroIdentificacion,
		Role:                 strings.ToLower(strings.TrimSpace(role)),
		Nombres:              nombres,
		Apellidos:            apellidos,
		TipoIdentificacion:   tipoIdentificacion,
		NumeroIdentificacion: numeroIdentificacion,
		ApprovedByAdmin:      true,
	})
	if err != nil {
		if alreadyRegistered {
			return nil, http.StatusConflict, errors.New("el correo ya está registrado en autenticación")
		}
		return nil, http.StatusBadGateway, err
	}

	return a.managedRecordByRole(ctx, role, numero)
}

func (a *App) deleteManagedProfile(ctx context.Context, role, numero string) (map[string]any, int, error) {
	record, status, err := a.managedRecordByRole(ctx, role, numero)
	if err != nil {
		return nil, status, err
	}

	profileID, _ := asString(record["profile_id"])
	if strings.TrimSpace(profileID) == "" {
		perfilUsuario, _ := asString(record["perfil_usuario"])
		if !strings.EqualFold(strings.TrimSpace(perfilUsuario), "activo") {
			return record, http.StatusOK, nil
		}
		return nil, http.StatusInternalServerError, errors.New("no fue posible resolver el perfil asociado")
	}

	query := url.Values{}
	query.Set("id", fmt.Sprintf("eq.%s", strings.TrimSpace(profileID)))

	if _, status, err := a.CallSupabase(ctx, http.MethodDelete, "/rest/v1/profiles", query, nil, false); err != nil {
		return nil, status, err
	}

	return a.managedRecordByRole(ctx, role, numero)
}