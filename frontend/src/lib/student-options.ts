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
  "NICOL DELGADO",
  "SANTIAGO DELGADO",
  "DAVID DELGADO",
  "ELENA MARTINEZ",
] as const;

export const EPS_OTHER_OPTION = "OTRO";

// Curated fallback list of EPS names used when no reliable public API is available.
export const COLOMBIA_EPS_OPTIONS = [
  "ALIANSALUD EPS",
  "ASMET SALUD EPS",
  "CAPITAL SALUD EPS",
  "CAJACOPI ATLANTICO EPS",
  "COMPENSAR EPS",
  "COMFENALCO VALLE EPS",
  "COOSALUD EPS",
  "DUSAKAWI EPSI",
  "EMSSANAR EPS",
  "EPS FAMILIAR DE COLOMBIA",
  "EPS SANITAS",
  "FAMISANAR EPS",
  "MALLAMAS EPSI",
  "MUTUAL SER EPS",
  "NUEVA EPS",
  "PIJAOS SALUD EPSI",
  "SALUD BOLIVAR EPS",
  "SALUD TOTAL EPS",
  "SISBEN",
  "SAVIA SALUD EPS",
  "SURA EPS",
  EPS_OTHER_OPTION,
] as const;

export const PAYMENT_METHOD_OPTIONS = [
  { value: "EFECTIVO", label: "EFECTIVO" },
  { value: "TRANSFERENCIA", label: "TRANSFERENCIA" },
  { value: "NEQUI", label: "NEQUI" },
  { value: "DAVIPLATA", label: "DAVIPLATA" },
  { value: "OTRO", label: "OTRO" },
] as const;
