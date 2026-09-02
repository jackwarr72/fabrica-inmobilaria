"use server";

import { revalidatePath } from "next/cache";
import { ContactKind } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

function emptyToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

const contactSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  kind: z.nativeEnum(ContactKind),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  email: z.string().email("Correo inválido").optional(),
  socialHandle: z.string().optional(),
  zone: z.string().optional(),
  notes: z.string().optional(),
  assignedToId: z.string().optional(),
});

function parseContactFormData(formData: FormData) {
  const raw = Object.fromEntries(formData);
  return contactSchema.safeParse({
    name: raw.name,
    kind: raw.kind,
    phone: emptyToUndefined(raw.phone),
    phone2: emptyToUndefined(raw.phone2),
    email: emptyToUndefined(raw.email),
    socialHandle: emptyToUndefined(raw.socialHandle),
    zone: emptyToUndefined(raw.zone),
    notes: emptyToUndefined(raw.notes),
    assignedToId: emptyToUndefined(raw.assignedToId),
  });
}

export async function createContactAction(
  _prev: { error: string | null; id: string | null },
  formData: FormData
): Promise<{ error: string | null; id: string | null }> {
  await requireUser();
  const parsed = parseContactFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", id: null };
  }
  const contact = await prisma.contact.create({ data: parsed.data });
  revalidatePath("/contactos");
  return { error: null, id: contact.id };
}

export async function updateContactAction(
  _prev: { error: string | null; id: string | null },
  formData: FormData
): Promise<{ error: string | null; id: string | null }> {
  await requireUser();
  const contactId = String(formData.get("contactId") ?? "");
  if (!contactId) return { error: "Contacto inválido", id: null };

  const parsed = parseContactFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", id: null };
  }
  await prisma.contact.update({ where: { id: contactId }, data: parsed.data });
  revalidatePath(`/contactos/${contactId}`);
  revalidatePath("/contactos");
  return { error: null, id: contactId };
}

export async function registerTouchAction(contactId: string): Promise<void> {
  await requireUser();
  await prisma.contact.update({
    where: { id: contactId },
    data: { lastContactAt: new Date() },
  });
  revalidatePath(`/contactos/${contactId}`);
  revalidatePath("/contactos");
}
