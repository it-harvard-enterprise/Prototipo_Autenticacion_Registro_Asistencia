export const STUDENT_GRADE_OPTIONS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "T",
  "B",
] as const;

export const STUDENT_COORDINATOR_OPTIONS = [
  "Nicol Delgado",
  "Santiago Delgado",
  "David Delgado",
  "Elena Martinez",
] as const;

export const EPS_OTHER_OPTION = "Otro";

// Curated fallback list of EPS names used when no reliable public API is available.
export const COLOMBIA_EPS_OPTIONS = [
  "Aliansalud EPS",
  "Asmet Salud EPS",
  "Capital Salud EPS",
  "Cajacopi Atlántico EPS",
  "Compensar EPS",
  "Comfenalco Valle EPS",
  "Coosalud EPS",
  "Dusakawi EPSI",
  "EMSSANAR EPS",
  "EPS Familiar de Colombia",
  "EPS Sanitas",
  "Famisanar EPS",
  "Mallamas EPSI",
  "Mutual Ser EPS",
  "Nueva EPS",
  "Pijaos Salud EPSI",
  "Salud Bolívar EPS",
  "Salud Total EPS",
  "Sisben",
  "Savia Salud EPS",
  "SURA EPS",
  EPS_OTHER_OPTION,
] as const;

export const PAYMENT_METHOD_OPTIONS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "nequi", label: "Nequi" },
  { value: "daviplata", label: "Daviplata" },
  { value: "otro", label: "Otro" },
] as const;
