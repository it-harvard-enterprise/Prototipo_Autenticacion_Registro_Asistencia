export const IDENTIFICATION_TYPE_VALUES = [
  "CC",
  "TI",
  "CE",
  "RCN",
  "PAS",
  "PPT",
] as const;

export type IdentificationType = (typeof IDENTIFICATION_TYPE_VALUES)[number];

export const IDENTIFICATION_TYPE_OPTIONS: Array<{
  value: IdentificationType;
  label: string;
}> = [
  {
    value: "CC",
    label:
      "Cédula de Ciudadania - Documento identificación oficial en Colombia.",
  },
  {
    value: "TI",
    label:
      "Tarjeta de Identidad - Documento obligatorio para menores entre 7 y 17 anos.",
  },
  {
    value: "CE",
    label: "Cedula de Extranjeria - Identificacion de residentes extranjeros.",
  },
  {
    value: "RCN",
    label: "Registro Civil de Nacimiento - Requerido para menores de 7 anos.",
  },
  {
    value: "PAS",
    label: "PAS - Pasaporte.",
  },
  {
    value: "PPT",
    label: "PPT - Permiso por Proteccion Temporal para poblacion venezolana.",
  },
];
