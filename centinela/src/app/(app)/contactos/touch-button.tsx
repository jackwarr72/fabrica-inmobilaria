"use client";

import { useTransition } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerTouchAction } from "./actions";

export function TouchButton({ contactId }: { contactId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => registerTouchAction(contactId))}
      className="inline-flex items-center gap-1.5"
    >
      <Clock className="h-3.5 w-3.5" />
      {pending ? "Registrando…" : "Marcar contactado hoy"}
    </Button>
  );
}
