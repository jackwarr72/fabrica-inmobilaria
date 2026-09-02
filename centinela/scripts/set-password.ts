import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Falta DATABASE_URL en el archivo .env");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Uso: pnpm set-password <email> <password>");
    process.exit(1);
  }

  const hash = bcrypt.hashSync(password, 12);
  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash: hash },
  });

  console.log(`Contraseña actualizada para ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
