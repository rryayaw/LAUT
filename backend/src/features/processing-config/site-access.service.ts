import { prisma } from "../../db/prisma.js";

export async function assertUserOwnsManufacturingSite(userId: string, manufacturingSiteId: string) {
  if (!prisma) {
    throw new Error("DATABASE_URL must be configured before manufacturing-site access can be checked.");
  }

  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `select id
     from public.manufacturing_sites
     where id = $1::uuid and owner_id = $2::uuid
     limit 1`,
    manufacturingSiteId,
    userId
  );

  const site = rows[0];
  if (!site) {
    throw new Error("Manufacturing site was not found for the authenticated user.");
  }

  return site;
}
