/**
 * Normalización y match estilo "people search" (Facebook/LinkedIn):
 * - case-insensitive
 * - ignora acentos (`Cañón` ≈ `canon` ≈ `cañon`)
 * - multi-palabra AND: cada token del query debe estar contenido en
 *   alguno de los campos buscables del registro.
 */

export interface SearchablePerson {
  nombres?: string | null;
  apellidos?: string | null;
  numero_identificacion?: string | null;
}

// Rango Unicode de marcas diacríticas combinables (U+0300..U+036F).
// Tras NFD las letras acentuadas se descomponen en (letra base + marca);
// removiendo esas marcas obtenemos el texto sin acentos.
const COMBINING_DIACRITICS = /[̀-ͯ]/g;

export function normalizeSearchText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .trim();
}

export function matchesPeopleQuery(
  query: string,
  person: SearchablePerson,
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const haystack = [
    normalizeSearchText(person.nombres),
    normalizeSearchText(person.apellidos),
    normalizeSearchText(person.numero_identificacion),
    normalizeSearchText(
      `${person.nombres ?? ""} ${person.apellidos ?? ""}`,
    ),
  ].join(" | ");

  return tokens.every((token) => haystack.includes(token));
}
