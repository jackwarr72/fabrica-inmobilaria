import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Falta DATABASE_URL en el archivo .env");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = "admin@centinela.local";

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Administrador Centinela",
      role: "ADMIN",
      passwordHash: "placeholder-hash",
    },
  });

  const baseSources = [
    { name: "Google Alerts", kind: "GOOGLE_ALERT" as const },
    { name: "Portal Inmobiliario", kind: "PORTAL" as const },
    { name: "Referidos", kind: "REFERRAL" as const },
  ];

  for (const source of baseSources) {
    await prisma.source.upsert({
      where: { name: source.name },
      update: {},
      create: source,
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
