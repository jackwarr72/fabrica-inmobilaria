import type {
  AppointmentStatus,
  ContactKind,
  OperationType,
  OpportunityStatus,
  PropertyType,
  Qualification,
} from "@prisma/client";

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  HOUSE: "Casa",
  APARTMENT: "Departamento",
  LAND: "Terreno",
  COMMERCIAL: "Local comercial",
  WAREHOUSE: "Bodega",
  DEVELOPMENT: "Desarrollo",
  INVESTMENT: "Inversión",
  OTHER: "Otro",
};

export const OPERATION_LABELS: Record<OperationType, string> = {
  SALE: "Venta",
  RENT: "Renta",
};

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  DETECTED: "Detectada",
  REGISTERED: "Registrada",
  VALIDATING: "Validando",
  QUALIFIED: "Calificada",
  CONTACTED: "Contactada",
  APPOINTMENT: "Cita",
  DOCUMENTATION: "Documentación",
  INVENTORY: "Inventario",
  FOLLOW_UP: "Seguimiento",
  DISCARDED: "Descartada",
};

export const QUALIFICATION_LABELS: Record<Qualification, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

export const STATUS_BADGE_VARIANT: Record<
  OpportunityStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DETECTED: "outline",
  REGISTERED: "secondary",
  VALIDATING: "secondary",
  QUALIFIED: "default",
  CONTACTED: "default",
  APPOINTMENT: "default",
  DOCUMENTATION: "secondary",
  INVENTORY: "default",
  FOLLOW_UP: "outline",
  DISCARDED: "destructive",
};

export const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  OWNER: "Propietario",
  BROKER: "Broker",
  ALLIANCE: "Aliado",
  OTHER: "Otro",
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "Programada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asistió",
};

export const APPOINTMENT_BADGE_VARIANT: Record<
  AppointmentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  SCHEDULED: "default",
  COMPLETED: "secondary",
  CANCELLED: "outline",
  NO_SHOW: "destructive",
};
