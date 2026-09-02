"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CONTACT_KIND_LABELS } from "@/lib/labels";
import { createContactAction, updateContactAction } from "./actions";

type UserOption = { id: string; name: string };
export type ContactInitial = {
  name: string;
  kind: string;
  phone: string;
  phone2: string;
  email: string;
  socialHandle: string;
  zone: string;
  notes: string;
  assignedToId: string;
};

export function ContactForm({
  users,
  contactId,
  initial,
  currentUserId,
}: {
  users: UserOption[];
  contactId?: string;
  initial?: ContactInitial;
  currentUserId: string;
}) {
  const router = useRouter();
  const action = contactId ? updateContactAction : createContactAction;
  const [state, formAction, pending] = useActionState(action, {
    error: null as string | null,
    id: null as string | null,
  });

  useEffect(() => {
    if (state?.id && !contactId) router.push(`/contactos/${state.id}`);
  }, [state?.id, contactId, router]);

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
    >
      {contactId ? <input type="hidden" name="contactId" value={contactId} /> : null}

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="name">Nombre *</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          defaultValue={initial?.name}
          placeholder="Nombre completo o razón social"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="kind">Tipo *</Label>
        <select
          id="kind"
          name="kind"
          required
          defaultValue={initial?.kind ?? "OWNER"}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {Object.entries(CONTACT_KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="assignedToId">Asignado a</Label>
        <select
          id="assignedToId"
          name="assignedToId"
          defaultValue={initial?.assignedToId || currentUserId}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Sin asesor asignado</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Teléfono</Label>
        <Input id="phone" name="phone" defaultValue={initial?.phone} placeholder="Ej. 722 123 4567" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone2">Teléfono secundario</Label>
        <Input id="phone2" name="phone2" defaultValue={initial?.phone2} placeholder="Opcional" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={initial?.email}
          placeholder="contacto@ejemplo.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="socialHandle">Red social / WhatsApp</Label>
        <Input
          id="socialHandle"
          name="socialHandle"
          defaultValue={initial?.socialHandle}
          placeholder="@usuario o link de WhatsApp"
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="zone">Zona de interés o influencia</Label>
        <Input
          id="zone"
          name="zone"
          defaultValue={initial?.zone}
          placeholder="Ej. Metepec, Toluca Centro, Zinacantepec"
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="notes">Notas comerciales</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={initial?.notes}
          placeholder="Detalles sobre el perfil, propiedades en cartera, preferencias de comunicación..."
        />
      </div>

      {state?.error ? (
        <p className="text-sm font-medium text-destructive sm:col-span-2">{state.error}</p>
      ) : null}
      {contactId && !state?.error && state?.id ? (
        <p className="text-sm font-medium text-emerald-600 sm:col-span-2">Contacto actualizado con éxito.</p>
      ) : null}

      <div className="pt-2 sm:col-span-2">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Guardando…" : contactId ? "Guardar cambios" : "Crear contacto"}
        </Button>
      </div>
    </form>
  );
}
