"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QUALIFICATION_LABELS } from "@/lib/labels";
import { setQualificationAction } from "../actions";

export function QualificationForm({
  opportunityId,
  currentQualification,
}: {
  opportunityId: string;
  currentQualification?: string | null;
}) {
  const [state, formAction, pending] = useActionState(setQualificationAction, {
    error: null as string | null,
    done: false,
  });

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <div className="space-y-2">
        <Label htmlFor="qualification">Calificación</Label>
        <select
          id="qualification"
          name="qualification"
          required
          defaultValue={currentQualification ?? ""}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="" disabled>
            Selecciona…
          </option>
          {Object.entries(QUALIFICATION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Criterios: precio, motivación del propietario y documentación disponible.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="qualificationNotes">Notas de calificación</Label>
        <Textarea
          id="qualificationNotes"
          name="qualificationNotes"
          placeholder="Motivos de la calificación..."
        />
      </div>
      {state?.error ? <p className="text-sm font-medium text-destructive">{state.error}</p> : null}
      {state?.done ? (
        <p className="text-sm font-medium text-emerald-600">Calificación guardada.</p>
      ) : null}
      <Button type="submit" disabled={pending} variant="secondary" className="w-full">
        {pending ? "Guardando…" : "Guardar calificación"}
      </Button>
    </form>
  );
}
