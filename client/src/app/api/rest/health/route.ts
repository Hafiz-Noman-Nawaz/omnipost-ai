import { prisma } from "@omnipost/database";
import { fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let db = "down";
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = "up";
    } catch {
      db = "down";
    }
    return ok({
      status: "ok",
      service: "omnipost-web",
      db,
      time: new Date().toISOString(),
    });
  } catch (err) {
    return fail(err);
  }
}
