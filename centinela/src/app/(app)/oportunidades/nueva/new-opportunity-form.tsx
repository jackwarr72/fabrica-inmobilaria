"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OPERATION_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/labels";
import { createOpportunityAction } from "../actions";

type Option = { id: string; name: string };

export function NewOpportunityForm({
  sources,
  contacts,
}: {
  sources: Option[];
  contacts: Option[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createOpportunityAction, {
    error: null as string | null,
    id: null as string | null,
  });

  useEffect(() => {
    if (state?.id) router.push(`/oportunidades/${state.id}`);
  }, [state?.id, router]);

  return (
    <form action={formAction} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="title">Título *</Label>
        <Input
          id="title"
          name="title"
          required
          minLength={5}
          placeholder="Ej. Casa en San Mateo Oxtotitlán, 3 recámaras"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="propertyType">Tipo de inmueble *</Label>
        <select
          id="propertyType"
          name="propertyType"
          required
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="operation">Operación *</Label>
        <select
          id="operation"
          name="operation"
          required
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {Object.entries(OPERATION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="price">Precio (MXN)</Label>
        <Input id="price" name="price" type="number" min={1} step="1" placeholder="1500000" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="zone">Zona / colonia / municipio</Label>
        <Input id="zone" name="zone" placeholder="Ej. Toluca Centro" />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="address">Dirección</Label>
        <Input id="address" name="address" placeholder="Calle, número, colonia" />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="sourceUrl">Liga de la publicación</Label>
        <Input id="sourceUrl" name="sourceUrl" type="url" placeholder="https://…" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sourceId">Fuente</Label>
        <select
          id="sourceId"
          name="sourceId"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          defaultValue=""
        >
          <option value="">Sin fuente</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contactId">Contacto asociado</Label>
        <select
          id="contactId"
          name="contactId"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          defaultValue=""
        >
          <option value="">Sin contacto</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="sourceNotes">¿Cómo se detectó?</Label>
        <Textarea
          id="sourceNotes"
          name="sourceNotes"
          placeholder="Ej. operador site:facebook.com, alerta de Google, referencia de aliado…"
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" name="description" placeholder="Detalles, características o condiciones..." />
      </div>

      {state?.error ? (
        <p className="text-sm font-medium text-destructive sm:col-span-2">{state.error}</p>
      ) : null}

      <div className="pt-2 sm:col-span-2">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Registrando…" : "Registrar oportunidad"}
        </Button>
      </div>
    </form>
  );
}
