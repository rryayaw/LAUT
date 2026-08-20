import { prisma } from "../../db/prisma.js";

export async function assertUserOwnsProcessingSite(userId: string, processingSiteId: string) {
  if (!prisma) {
    throw new Error("DATABASE_URL must be configured before processing-site access can be checked.");
  }

  const site = await prisma.processingSite.findFirst({
    where: {
      id: processingSiteId,
      ownerId: userId
    }
  });

  if (!site) {
    throw new Error("Processing site was not found for the authenticated user.");
  }

  return site;
}
