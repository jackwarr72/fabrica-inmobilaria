"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUserAction } from "./actions";

export function CreateUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, {
    error: null as string | null,
    success: null as string | null,
  });

  return (
    <form action={formAction} className="grid gap-4 rounded-lg border p-4 md:grid-cols-5">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input id="password" name="password" type="password" minLength={8} required />
      </div>
      <div className="space-y-2">
        <Label>Rol</Label>
        <Select name="role" defaultValue="ANALYST" required>
          <SelectTrigger>
            <SelectValue placeholder="Rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ANALYST">Analista</SelectItem>
            <SelectItem value="ADVISOR">Asesor</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creando…" : "Crear usuario"}
        </Button>
      </div>
      {state?.error ? (
        <p className="text-sm text-destructive md:col-span-5">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p className="text-sm text-green-600 md:col-span-5">{state.success}</p>
      ) : null}
    </form>
  );
}