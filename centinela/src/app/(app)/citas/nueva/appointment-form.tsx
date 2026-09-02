"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createAppointmentAction } from "../actions";

type OpportunityOption = { id: string; name: string; contactId: string | null };
type ContactOption = { id: string; name: string };

export function AppointmentForm({
  opportunities,
  contacts,
}: {
  opportunities: OpportunityOption[];
  contacts: ContactOption[];
}) {
  const router = useRouter();
  const [contactId, setContactId] = useState("");
  const [state, formAction, pending] = useActionState(createAppointmentAction, {
    error: null as string | null,
    id: null as string | null,
  });

  useEffect(() => {
    if (state?.id) router.push("/citas");
  }, [state?.id, router]);

  function onOpportunityChange(value: string) {
    const opp = opportunities.find((o) => o.id === value);
    if (opp?.contactId) {
      setContactId(opp.contactId);
    }
  }

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
    >
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="opportunityId">Oportunidad / Inmueble</Label>
        <select
          id="opportunityId"
          name="opportunityId"
          defaultValue=""
          onChange={(e) => onOpportunityChange(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Sin oportunidad asociada</option>
          {opportunities.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Si la propiedad está en una etapa inicial, avanzará automáticamente a estatus “Cita”.
        </p>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="contactId">Contacto / Propietario / Broker</Label>
        <select
          id="contactId"
          name="contactId"
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Sin contacto específico</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="scheduledAt">Fecha y hora de la cita *</Label>
        <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="locationOrUrl">Lugar o enlace de reunión</Label>
        <Input
          id="locationOrUrl"
          name="locationOrUrl"
          placeholder="Dirección del inmueble, oficina o https://meet.google.com/…"
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="notes">Notas o agenda de la cita</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Objetivo de la reunión, puntos a revisar, documentos solicitados..."
        />
      </div>

      {state?.error ? (
        <p className="text-sm font-medium text-destructive sm:col-span-2">{state.error}</p>
      ) : null}

      <div className="pt-2 sm:col-span-2">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Agendando…" : "Agendar cita"}
        </Button>
      </div>
    </form>
  );
}
