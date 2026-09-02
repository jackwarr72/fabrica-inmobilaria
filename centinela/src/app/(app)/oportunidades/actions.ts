"use server";

import { revalidatePath } from "next/cache";
import {
  OpportunityStatus,
  OperationType,
  PropertyType,
  Qualification,
} from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

function emptyToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

// ─── Crear oportunidad ────────────────────────────────────

const createSchema = z.object({
  title: z.string().min(5, "El título debe tener al menos 5 caracteres"),
  description: z.string().optional(),
  propertyType: z.nativeEnum(PropertyType),
  operation: z.nativeEnum(OperationType),
  price: z.coerce.number().positive("El precio debe ser mayor a cero").optional(),
  zone: z.string().optional(),
  address: z.string().optional(),
  sourceUrl: z.string().url("La liga debe ser una URL válida").optional(),
  sourceNotes: z.string().optional(),
  sourceId: z.string().optional(),
  contactId: z.string().optional(),
});

export async function createOpportunityAction(
  _prev: { error: string | null; id: string | null },
  formData: FormData
): Promise<{ error: string | null; id: string | null }> {
  const user = await requireUser();
  const raw = Object.fromEntries(formData);

  const parsed = createSchema.safeParse({
    title: raw.title,
    description: emptyToUndefined(raw.description),
    propertyType: raw.propertyType,
    operation: raw.operation,
    price: emptyToUndefined(raw.price),
    zone: emptyToUndefined(raw.zone),
    address: emptyToUndefined(raw.address),
    sourceUrl: emptyToUndefined(raw.sourceUrl),
    sourceNotes: emptyToUndefined(raw.sourceNotes),
    sourceId: emptyToUndefined(raw.sourceId),
    contactId: emptyToUndefined(raw.contactId),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", id: null };
  }
  const data = parsed.data;

  const opportunity = await prisma.$transaction(async (tx) => {
    const opp = await tx.opportunity.create({
      data: {
        title: data.title,
        description: data.description,
        propertyType: data.propertyType,
        operation: data.operation,
        price: data.price,
        zone: data.zone,
        address: data.address,
        sourceUrl: data.sourceUrl,
        sourceNotes: data.sourceNotes,
        sourceId: data.sourceId,
        contactId: data.contactId,
        status: "REGISTERED",
        registeredById: user.id,
        assignedToId: user.id,
      },
    });
    await tx.stageHistory.create({
      data: {
        opportunityId: opp.id,
        fromStatus: null,
        toStatus: "REGISTERED",
        note: "Registro manual",
        userId: user.id,
      },
    });
    return opp;
  });

  revalidatePath("/oportunidades");
  return { error: null, id: opportunity.id };
}

// ─── Cambiar estatus ──────────────────────────────────────

const changeStatusSchema = z.object({
  opportunityId: z.string(),
  toStatus: z.nativeEnum(OpportunityStatus),
  note: z.string().optional(),
});

export async function changeStatusAction(
  _prev: { error: string | null; done: boolean },
  formData: FormData
): Promise<{ error: string | null; done: boolean }> {
  const user = await requireUser();
  const parsed = changeStatusSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    toStatus: formData.get("toStatus"),
    note: emptyToUndefined(formData.get("note")),
  });
  if (!parsed.success) return { error: "Datos inválidos", done: false };
  const { opportunityId, toStatus, note } = parsed.data;

  await prisma.$transaction(async (tx) => {
    const current = await tx.opportunity.findUnique({ where: { id: opportunityId } });
    if (!current || current.status === toStatus) return;

    await tx.opportunity.update({
      where: { id: opportunityId },
      data: {
        status: toStatus,
        // KPI de contacto < 24h: se registra el momento del primer contacto
        ...(toStatus === "CONTACTED" && !current.firstContactAt
          ? { firstContactAt: new Date() }
          : {}),
      },
    });
    await tx.stageHistory.create({
      data: {
        opportunityId,
        fromStatus: current.status,
        toStatus,
        note,
        userId: user.id,
      },
    });
  });

  revalidatePath(`/oportunidades/${opportunityId}`);
  revalidatePath("/oportunidades");
  return { error: null, done: true };
}

// ─── Calificar ────────────────────────────────────────────

const qualificationSchema = z.object({
  opportunityId: z.string(),
  qualification: z.nativeEnum(Qualification),
  qualificationNotes: z.string().optional(),
});

export async function setQualificationAction(
  _prev: { error: string | null; done: boolean },
  formData: FormData
): Promise<{ error: string | null; done: boolean }> {
  const user = await requireUser();
  const parsed = qualificationSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    qualification: formData.get("qualification"),
    qualificationNotes: emptyToUndefined(formData.get("qualificationNotes")),
  });
  if (!parsed.success) return { error: "Datos inválidos", done: false };
  const { opportunityId, qualification, qualificationNotes } = parsed.data;

  await prisma.$transaction(async (tx) => {
    const current = await tx.opportunity.findUnique({ where: { id: opportunityId } });
    if (!current) return;

    const autoAdvance = ["DETECTED", "REGISTERED", "VALIDATING"].includes(current.status);
    await tx.opportunity.update({
      where: { id: opportunityId },
      data: {
        qualification,
        qualificationNotes,
        ...(autoAdvance ? { status: "QUALIFIED" as const } : {}),
      },
    });
    if (autoAdvance) {
      await tx.stageHistory.create({
        data: {
          opportunityId,
          fromStatus: current.status,
          toStatus: "QUALIFIED",
          note: "Calificación asignada",
          userId: user.id,
        },
      });
    }
  });

  revalidatePath(`/oportunidades/${opportunityId}`);
  revalidatePath("/oportunidades");
  return { error: null, done: true };
}
