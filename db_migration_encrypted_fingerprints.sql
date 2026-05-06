-- Migration: Prepare fingerprint columns for encrypted payloads
-- Purpose: Since prod DB is empty, just note schema expectations
-- The schema now expects JSONB encrypted payloads: { "iv": "base64...", "ciphertext": "base64..." }
-- Date: 2026-05-05

-- No-op migration for empty DB
-- The estudiantes table already has huella_indice_derecho and huella_indice_izquierdo columns
-- They will now store JSONB encrypted payloads instead of TEXT templates
-- No column changes needed since the table is empty

-- For reference, the column definitions should be:
-- huella_indice_derecho JSONB DEFAULT NULL COMMENT 'Encrypted fingerprint template: {"iv": "base64", "ciphertext": "base64"}'
-- huella_indice_izquierdo JSONB DEFAULT NULL COMMENT 'Encrypted fingerprint template: {"iv": "base64", "ciphertext": "base64"}'
