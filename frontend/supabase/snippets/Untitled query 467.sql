ALTER TABLE estudiantes
ALTER COLUMN huella_indice_izquierdo TYPE jsonb USING huella_indice_izquierdo::jsonb,
ALTER COLUMN huella_indice_derecho TYPE jsonb USING huella_indice_derecho::jsonb;
