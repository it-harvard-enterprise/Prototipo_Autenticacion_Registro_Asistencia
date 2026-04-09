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
    label: "CC",
  },
  {
    value: "TI",
    label: "TI.",
  },
  {
    value: "CE",
    label: "CE - Cédula de Extranjería.",
  },
  {
    value: "RCN",
    label: "Registro Civil de Nacimiento",
  },
  {
    value: "PAS",
    label: "PAS - Pasaporte.",
  },
  {
    value: "PPT",
    label: "PPT - Permiso por Protección Temporal para población venezolana.",
  },
];
