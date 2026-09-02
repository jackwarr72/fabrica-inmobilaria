"use client";

import { useTransition } from "react";
import { Check, X, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setAppointmentStatusAction } from "./actions";

export function AppointmentStatusActions({ appointmentId }: { appointmentId: string }) {
  const [pending, startTransition] = useTransition();

  function set(status: "COMPLETED" | "CANCELLED" | "NO_SHOW") {
    startTransition(() => setAppointmentStatusAction(appointmentId, status));
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="xs"
        variant="outline"
        disabled={pending}
        title="Marcar completada"
        onClick={() => set("COMPLETED")}
        className="h-7 px-2 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
      >
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="xs"
        variant="outline"
        disabled={pending}
        title="Marcar no asistió"
        onClick={() => set("NO_SHOW")}
        className="h-7 px-2 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="xs"
        variant="ghost"
        disabled={pending}
        title="Cancelar cita"
        onClick={() => set("CANCELLED")}
        className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
      >
        <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar
      </Button>
    </div>
  );
}
