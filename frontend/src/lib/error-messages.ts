const DUPLICATE_FIELD_MESSAGES: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /(estudiantes?_pkey|profesores?_pkey|numero_identificacion)/i,
    message: "Ya existe un usuario con el mismo número de identificación.",
  },
  {
    pattern: /(estudiantes?_no_matricula_key|no_matricula)/i,
    message: "Ya existe un usuario con el mismo número de matrícula.",
  },
  {
    pattern: /(email|profiles_email_key|auth_user_id|already\s+registered)/i,
    message: "Ya existe un usuario con el mismo correo electrónico.",
  },
  {
    pattern: /(uq_course_material_folders_course_parent_name_lower)/i,
    message: "Ya existe una carpeta con ese nombre en el mismo nivel.",
  },
  {
    pattern: /(uq_course_material_files_folder_youtube_url)/i,
    message: "Ese video de YouTube ya existe en esta carpeta.",
  },
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function translateDuplicateMessage(rawMessage: string): string | null {
  const text = rawMessage.toLowerCase();
  const isDuplicate =
    text.includes("duplicate key value violates unique constraint") ||
    text.includes("already registered") ||
    text.includes("already exists") ||
    text.includes("already been registered");

  if (!isDuplicate) {
    return null;
  }

  for (const rule of DUPLICATE_FIELD_MESSAGES) {
    if (rule.pattern.test(rawMessage)) {
      return rule.message;
    }
  }

  return "Ya existe un registro con uno de los valores únicos que intenta guardar.";
}

export function translateErrorMessage(
  rawMessage: string | null | undefined,
  fallback = "Error del sistema. Intente nuevamente.",
): string {
  const input = normalizeWhitespace(String(rawMessage ?? ""));
  if (!input) {
    return fallback;
  }

  const duplicateMessage = translateDuplicateMessage(input);
  if (duplicateMessage) {
    return duplicateMessage;
  }

  const lower = input.toLowerCase();

  if (lower === "unknown error" || lower === "error desconocido") {
    return "Error desconocido del sistema.";
  }

  if (lower.includes("invalid json payload")) {
    return "La solicitud enviada al servidor es inválida.";
  }

  if (lower.includes("backend error")) {
    return "El servidor devolvió un error al procesar la solicitud.";
  }

  if (lower.includes("chk_estudiantes_coordinador")) {
    return "El coordinador académico seleccionado no es válido para este entorno. Seleccione uno de los coordinadores autorizados.";
  }

  if (
    lower.includes("supabase auth admin request failed with status 409") ||
    lower.includes("supabase auth admin request failed with status 422")
  ) {
    return "Ya existe un usuario con el mismo correo electrónico. Use un correo diferente.";
  }

  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "No fue posible conectar con el servidor. Verifique su conexión e intente nuevamente.";
  }

  if (lower.includes("supabase error:")) {
    return input.replace(/supabase error:\s*/i, "").trim();
  }

  return input;
}

export function toAppErrorMessage(
  error: unknown,
  fallback = "Error del sistema. Intente nuevamente.",
): string {
  if (error instanceof Error) {
    return translateErrorMessage(error.message, fallback);
  }

  if (typeof error === "string") {
    return translateErrorMessage(error, fallback);
  }

  return fallback;
}
