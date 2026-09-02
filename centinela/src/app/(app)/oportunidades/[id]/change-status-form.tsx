"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";
import { changeStatusAction } from "../actions";

export function ChangeStatusForm({
  opportunityId,
  currentStatus,
}: {
  opportunityId: string;
  currentStatus: string;
}) {
  const [state, formAction, pending] = useActionState(changeStatusAction, {
    error: null as string | null,
    done: false,
  });

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <div className="space-y-2">
        <Label htmlFor="toStatus">Nuevo estatus</Label>
        <select
          id="toStatus"
          name="toStatus"
          required
          defaultValue=""
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="" disabled>
            Selecciona…
          </option>
          {Object.entries(OPPORTUNITY_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value} disabled={value === currentStatus}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">Nota (opcional)</Label>
        <Input id="note" name="note" placeholder="Ej. validada con fotos y visita" />
      </div>
      {state?.error ? <p className="text-sm font-medium text-destructive">{state.error}</p> : null}
      {state?.done ? <p className="text-sm font-medium text-emerald-600">Estatus actualizado.</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Actualizando…" : "Actualizar estatus"}
      </Button>
    </form>
  );
}
