import "dotenv/config";
import "server-only"; // protection layer to not be imported in client file (doesn't create API endpoints)

export { prisma } from "@/lib/prisma-runtime";
