"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CONTACT_KIND_LABELS } from "@/lib/labels";

function pushParam(
  router: ReturnType<typeof useRouter>,
  searchParams: URLSearchParams,
  param: string,
  value: string
) {
  const params = new URLSearchParams(searchParams.toString());
  if (value) params.set(param, value);
  else params.delete(param);
  params.delete("page");
  router.push(`/contactos?${params.toString()}`);
}

export function ContactsFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground md:col-span-2">
        Búsqueda
        <Input
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="Nombre, teléfono o correo… (Enter)"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              pushParam(router, searchParams, "q", (e.target as HTMLInputElement).value);
            }
          }}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Tipo de contacto
        <select
          value={searchParams.get("kind") ?? ""}
          onChange={(e) => pushParam(router, searchParams, "kind", e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(CONTACT_KIND_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-end">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => router.push("/contactos")}
        >
          Limpiar filtros
        </Button>
      </div>
    </div>
  );
}
