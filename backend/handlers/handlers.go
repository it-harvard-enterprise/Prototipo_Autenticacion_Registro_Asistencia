package handlers

import (
    "encoding/json"
    "net/http"
    "strings"

    "github.com/gin-gonic/gin"
    "github.com/jtejido/sourceafis"
    "fingerprint-backend/services"
    "fingerprint-backend/models"
)

func EnrollStudentHandler(app *services.App) gin.HandlerFunc {
    return func(c *gin.Context) {
        var req models.StudentEnrollRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON payload"})
            return
        }

        // basic trimming and validation moved from original main
        req.NumeroIdentificacion = strings.TrimSpace(req.NumeroIdentificacion)
        req.TipoIdentificacion = strings.TrimSpace(req.TipoIdentificacion)
        req.Nombres = strings.TrimSpace(req.Nombres)
        req.Apellidos = strings.TrimSpace(req.Apellidos)
        req.Grado = strings.TrimSpace(req.Grado)
        req.CoordinadorAcademico = strings.TrimSpace(req.CoordinadorAcademico)
        req.MedioPagoMatricula = strings.TrimSpace(req.MedioPagoMatricula)

        if req.TipoIdentificacion == "" || req.NumeroIdentificacion == "" || req.Nombres == "" || req.Apellidos == "" || req.Grado == "" {
            c.JSON(http.StatusBadRequest, gin.H{"error": "tipo_identificacion, numero_identificacion, nombres, apellidos y grado validos son requeridos"})
            return
        }

        // Resolve fingerprints: check for encrypted payloads first, then fall back to plaintext
        var rightPNG, leftPNG *string
        if req.HuellaIndiceDerecho_Encrypted != nil {
            // Decrypt the encrypted PNG
            decrypted, err := app.DecryptPNG(req.HuellaIndiceDerecho_Encrypted)
            if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Huella derecha no se pudo desencriptar: " + err.Error()})
                return
            }
            rightPNG = &decrypted
        } else if req.HuellaIndiceDerecho != nil {
            rightPNG = req.HuellaIndiceDerecho
        }

        if req.HuellaIndiceIzquierdo_Encrypted != nil {
            // Decrypt the encrypted PNG
            decrypted, err := app.DecryptPNG(req.HuellaIndiceIzquierdo_Encrypted)
            if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "Huella izquierda no se pudo desencriptar: " + err.Error()})
                return
            }
            leftPNG = &decrypted
        } else if req.HuellaIndiceIzquierdo != nil {
            leftPNG = req.HuellaIndiceIzquierdo
        }

        // Extract templates from PNG and encrypt them for storage
        rightTemplate, err := app.ResolveStoredFingerprintTemplate(rightPNG)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Huella derecha invalida: " + err.Error()})
            return
        }

        leftTemplate, err := app.ResolveStoredFingerprintTemplate(leftPNG)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Huella izquierda invalida: " + err.Error()})
            return
        }

        // Encrypt templates before storage
        var rightEncrypted, leftEncrypted any
        if rightTemplate != services.DefaultFingerprint {
            encPayload, err := app.EncryptTemplate(rightTemplate)
            if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Error encriptando huella derecha: " + err.Error()})
                return
            }
            rightEncrypted = encPayload
        } else {
            rightEncrypted = nil
        }

        if leftTemplate != services.DefaultFingerprint {
            encPayload, err := app.EncryptTemplate(leftTemplate)
            if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "Error encriptando huella izquierda: " + err.Error()})
                return
            }
            leftEncrypted = encPayload
        } else {
            leftEncrypted = nil
        }

        payload := map[string]any{
            "tipo_identificacion": req.TipoIdentificacion,
            "numero_identificacion": req.NumeroIdentificacion,
            "no_matricula": app.NormalizeOptional(req.NoMatricula),
            "nombres": req.Nombres,
            "apellidos": req.Apellidos,
            "email": app.NormalizeOptional(req.Email),
            "grado": req.Grado,
            "telefono": app.NormalizeOptional(req.Telefono),
            "direccion": app.NormalizeOptional(req.Direccion),
            "barrio": app.NormalizeOptional(req.Barrio),
            "nombre_acudiente": app.NormalizeOptional(req.NombreAcudiente),
            "telefono_acudiente": app.NormalizeOptional(req.TelefonoAcudiente),
            "eps": app.NormalizeOptional(req.EPS),
            "coordinador_academico": req.CoordinadorAcademico,
            "programa": app.NormalizeOptional(req.Programa),
            "fecha_inicio": app.NormalizeOptional(req.FechaInicio),
            "fecha_matricula": app.NormalizeOptional(req.FechaMatricula),
            "valor_matricula": req.ValorMatricula,
            "medio_pago_matricula": req.MedioPagoMatricula,
            "valor_apoyo_semanal": req.ValorApoyoSemanal,
            "huella_indice_derecho": rightEncrypted,
            "huella_indice_izquierdo": leftEncrypted,
        }

        rows, status, err := app.InsertStudent(c.Request.Context(), payload)
        if err != nil {
            if status == http.StatusConflict {
                c.JSON(http.StatusConflict, gin.H{"error": "Error: En la base datos ya existe un usuario con el mismo número de identificación."})
                return
            }
            c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
            return
        }

        if len(rows) == 0 {
            c.JSON(http.StatusInternalServerError, gin.H{"error": "No se recibio respuesta de Supabase al crear el estudiante"})
            return
        }

        created := rows[0]

        // Send invitation email if email is provided
        if req.Email != nil && strings.TrimSpace(*req.Email) != "" {
            email := strings.TrimSpace(*req.Email)
            metadata := map[string]interface{}{
                "rol":       "estudiante",
                "nombres":   req.Nombres,
                "apellidos": req.Apellidos,
            }
            _, err := app.InviteUserByEmail(c.Request.Context(), email, metadata)
            if err != nil {
                // Log the error but don't fail the entire operation
                // The student was created successfully, but email invitation failed
                c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{
                    "numero_identificacion": created["numero_identificacion"],
                    "nombres": created["nombres"],
                    "apellidos": created["apellidos"],
                    "created_at": created["created_at"],
                    "email_invitation_error": err.Error(),
                }})
                return
            }
        }

        c.JSON(http.StatusCreated, gin.H{"success": true, "data": gin.H{
            "numero_identificacion": created["numero_identificacion"],
            "nombres": created["nombres"],
            "apellidos": created["apellidos"],
            "created_at": created["created_at"],
        }})
    }
}

func StartServiceHandler(app *services.App) gin.HandlerFunc {
    return func(c *gin.Context) {
        c.JSON(http.StatusOK, gin.H{"message": "Fingerprint capture service is up and running."})
    }
}

func IdentifyAttendanceHandler(app *services.App) gin.HandlerFunc {
    return func(c *gin.Context) {
        var req models.AttendanceIdentifyRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Invalid JSON payload"})
            return
        }

        if req.IDCurso <= 0 {
            c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "id_curso invalido"})
            return
        }

        _, probeTemplate, err := app.ExtractTemplate(req.FingerprintTemplate)
        if err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
            return
        }

        enrollments, err := app.ListEnrolledStudentsWithTemplates(c.Request.Context(), req.IDCurso)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
            return
        }

        if len(enrollments) == 0 {
            c.JSON(http.StatusOK, gin.H{"success": true, "numero_identificacion": nil, "confidence": 0.0})
            return
        }

        matcher, err := sourceafis.NewMatcher(app.Logger, probeTemplate)
        if err != nil {
            c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "No fue posible inicializar el matcher"})
            return
        }

        ctx := c.Request.Context()

        bestID := ""
        bestScore := 0.0

        for _, enrollment := range enrollments {
            templatesToTry := []*string{enrollment.HuellaIndiceDerecho, enrollment.HuellaIndiceIzquierdo}
            for _, encryptedTemplateStr := range templatesToTry {
                if encryptedTemplateStr == nil || strings.TrimSpace(*encryptedTemplateStr) == "" {
                    continue
                }

                // Encrypted templates come from DB as JSON strings; parse and decrypt
                var encPayload models.EncryptedPayload
                if err := json.Unmarshal([]byte(*encryptedTemplateStr), &encPayload); err != nil {
                    // Fallback: assume plaintext template (backward compatibility)
                    candidate, err := app.DeserializeTemplate(*encryptedTemplateStr)
                    if err != nil {
                        continue
                    }
                    score := matcher.Match(ctx, candidate)
                    if bestID == "" || score > bestScore {
                        bestID = enrollment.NumeroIdentificacion
                        bestScore = score
                    }
                    continue
                }

                // Decrypt the template
                decryptedTemplateStr, err := app.DecryptTemplate(&encPayload)
                if err != nil {
                    continue
                }

                // Deserialize decrypted template
                candidate, err := app.DeserializeTemplate(decryptedTemplateStr)
                if err != nil {
                    continue
                }

                score := matcher.Match(ctx, candidate)
                if bestID == "" || score > bestScore {
                    bestID = enrollment.NumeroIdentificacion
                    bestScore = score
                }
            }
        }

        if bestID == "" || bestScore < app.Threshold {
            c.JSON(http.StatusOK, gin.H{"success": true, "numero_identificacion": nil, "confidence": app.NormalizeConfidence(bestScore, app.Threshold)})
            return
        }

        c.JSON(http.StatusOK, gin.H{"success": true, "numero_identificacion": bestID, "confidence": app.NormalizeConfidence(bestScore, app.Threshold)})
    }
}
