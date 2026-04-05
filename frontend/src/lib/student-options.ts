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

export const PAYMENT_METHOD_OPTIONS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "nequi", label: "Nequi" },
  { value: "daviplata", label: "Daviplata" },
  { value: "otro", label: "Otro" },
] as const;
