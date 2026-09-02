"use server";

import { revalidatePath } from "next/cache";
import { AppointmentStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

function emptyToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

const createSchema = z.object({
  opportunityId: z.string().optional(),
  contactId: z.string().optional(),
  locationOrUrl: z.string().max(500).optional(),
  notes: z.string().optional(),
});

export async function createAppointmentAction(
  _prev: { error: string | null; id: string | null },
  formData: FormData
): Promise<{ error: string | null; id: string | null }> {
  const user = await requireUser();

  const scheduledAt = new Date(String(formData.get("scheduledAt") ?? ""));
  if (Number.isNaN(scheduledAt.getTime())) {
    return { error: "Selecciona fecha y hora válidas.", id: null };
  }

  const parsed = createSchema.safeParse({
    opportunityId: emptyToUndefined(formData.get("opportunityId")),
    contactId: emptyToUndefined(formData.get("contactId")),
    locationOrUrl: emptyToUndefined(formData.get("locationOrUrl")),
    notes: emptyToUndefined(formData.get("notes")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", id: null };
  }
  const data = parsed.data;

  const appointment = await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.create({
      data: {
        opportunityId: data.opportunityId,
        contactId: data.contactId,
        userId: user.id,
        scheduledAt,
        locationOrUrl: data.locationOrUrl,
        notes: data.notes,
      },
    });

    // La oportunidad avanza automáticamente a CITA si viene de etapas previas
    if (data.opportunityId) {
      const opp = await tx.opportunity.findUnique({ where: { id: data.opportunityId } });
      const advanceable =
        opp &&
        ["DETECTED", "REGISTERED", "VALIDATING", "QUALIFIED", "CONTACTED"].includes(opp.status);
      if (advanceable) {
        await tx.opportunity.update({
          where: { id: opp.id },
          data: { status: "APPOINTMENT" },
        });
        await tx.stageHistory.create({
          data: {
            opportunityId: opp.id,
            fromStatus: opp.status,
            toStatus: "APPOINTMENT",
            note: "Cita agendada",
            userId: user.id,
          },
        });
      }
    }
    return appt;
  });

  revalidatePath("/citas");
  revalidatePath("/oportunidades");
  if (data.opportunityId) revalidatePath(`/oportunidades/${data.opportunityId}`);
  if (data.contactId) revalidatePath(`/contactos/${data.contactId}`);
  return { error: null, id: appointment.id };
}

export async function setAppointmentStatusAction(
  appointmentId: string,
  status: AppointmentStatus
): Promise<void> {
  await requireUser();
  const current = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!current || current.status !== "SCHEDULED") return;

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status },
  });
  revalidatePath("/citas");
  if (current.opportunityId) revalidatePath(`/oportunidades/${current.opportunityId}`);
  if (current.contactId) revalidatePath(`/contactos/${current.contactId}`);
}
