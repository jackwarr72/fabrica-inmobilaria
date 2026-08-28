import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Uso: pnpm set-password <email> <password>");
  process.exit(1);
}

const prisma = new PrismaClient();
const hash = bcrypt.hashSync(password, 12);

const user = await prisma.user.update({
  where: { email },
  data: { passwordHash: hash },
});

console.log(`✅ Contraseña actualizada para ${user.email}`);
await prisma.$disconnect();