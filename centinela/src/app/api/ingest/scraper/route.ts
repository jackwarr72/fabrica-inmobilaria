import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const scraperItemSchema = z.object({
  sourceId: z.coerce.number().int().positive(),
  agencyName: z.string().min(1).max(120),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  title: z.string().min(1).max(240),
  price: z.string().max(120).optional().nullable(),
  textContent: z.string().max(20_000).optional().nullable(),
  matchScore: z.coerce.number().int().min(0).max(100).optional().nullable(),
  matchStatus: z.string().max(60).optional().nullable(),
  createdAt: z.coerce.date().optional(),
});

const scraperBatchSchema = z.object({
  properties: z.array(scraperItemSchema).min(1).max(500),
});

function authorized(request: Request) {
  const configuredToken = process.env.INGEST_TOKEN;
  if (!configuredToken) return false;

  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const headerToken = request.headers.get("x-ingest-token");
  return bearerToken === configuredToken || headerToken === configuredToken;
}

function parsePrice(value: string | null | undefined) {
  if (!value) return null;

  const normalized = value.replace(/[^\d.,-]/g, "").replace(/,/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function sourceNotes(item: z.infer<typeof scraperItemSchema>) {
  return [
    item.matchScore === null || item.matchScore === undefined
      ? null
      : `match_score=${item.matchScore}`,
    item.matchStatus ? `match_status=${item.matchStatus}` : null,
    item.textContent ? `scraper_text=${item.textContent.slice(0, 1_500)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Token de ingestión inválido" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = scraperBatchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "El lote de propiedades no tiene un formato válido",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  let imported = 0;
  let updated = 0;

  for (const item of parsed.data.properties) {
    const source = await prisma.source.upsert({
      where: { name: item.agencyName },
      update: { isActive: true },
      create: { name: item.agencyName, kind: "PORTAL", url: item.sourceUrl || null },
    });

    const existing = item.sourceUrl
      ? await prisma.opportunity.findFirst({ where: { sourceUrl: item.sourceUrl } })
      : null;
    const data = {
      title: item.title,
      description: item.textContent?.slice(0, 5_000) || null,
      propertyType: "OTHER" as const,
      operation: "SALE" as const,
      price: parsePrice(item.price),
      sourceUrl: item.sourceUrl || null,
      sourceNotes: sourceNotes(item) || null,
      sourceId: source.id,
      status: "DETECTED" as const,
      createdAt: item.createdAt ?? new Date(),
    };

    if (existing) {
      await prisma.opportunity.update({ where: { id: existing.id }, data });
      updated += 1;
    } else {
      await prisma.opportunity.create({ data });
      imported += 1;
    }
  }

  return NextResponse.json({ imported, updated, total: parsed.data.properties.length });
}
