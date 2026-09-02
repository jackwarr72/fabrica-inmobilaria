"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  OPERATION_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  QUALIFICATION_LABELS,
} from "@/lib/labels";

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
  router.push(`/oportunidades?${params.toString()}`);
}

function FilterSelect({
  label,
  param,
  value,
  options,
}: {
  label: string;
  param: string;
  value: string;
  options: Record<string, string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => pushParam(router, searchParams, param, e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Todos</option>
        {Object.entries(options).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function OpportunitiesFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground md:col-span-2">
        Búsqueda
        <Input
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="Título o zona… (Enter)"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              pushParam(router, searchParams, "q", (e.target as HTMLInputElement).value);
            }
          }}
        />
      </label>
      <FilterSelect
        label="Estatus"
        param="status"
        value={searchParams.get("status") ?? ""}
        options={OPPORTUNITY_STATUS_LABELS}
      />
      <FilterSelect
        label="Tipo"
        param="propertyType"
        value={searchParams.get("propertyType") ?? ""}
        options={PROPERTY_TYPE_LABELS}
      />
      <FilterSelect
        label="Operación"
        param="operation"
        value={searchParams.get("operation") ?? ""}
        options={OPERATION_LABELS}
      />
      <FilterSelect
        label="Calificación"
        param="qualification"
        value={searchParams.get("qualification") ?? ""}
        options={QUALIFICATION_LABELS}
      />
      <div className="flex items-end">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => router.push("/oportunidades")}
        >
          Limpiar filtros
        </Button>
      </div>
    </div>
  );
}
