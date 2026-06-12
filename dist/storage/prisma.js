import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ensureSqliteDatabase } from "./sqlite-init.js";
ensureSqliteDatabase();
export const prisma = new PrismaClient();
