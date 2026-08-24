import "dotenv/config";
import { prisma } from "../db/prisma.js";
import { importSyntheticRedSnapperDataset } from "../features/synthetic-data/synthetic-red-snapper-import.service.js";

const emailFlag = process.argv.find((argument) => argument.startsWith("--email="));
const emailIndex = process.argv.indexOf("--email");
const positionalEmail = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
const email = emailFlag?.slice("--email=".length) ?? (emailIndex >= 0 ? process.argv[emailIndex + 1] : positionalEmail);

if (!email) {
  throw new Error("Usage: npm run import:synthetic-red-snapper -- --email test@test.com");
}

try {
  const result = await importSyntheticRedSnapperDataset(email);
  console.log(`Synthetic import complete: ${result.inserted} inserted, ${result.skipped} already present, ${result.lineCount} lines, ${result.batchCount} source batches.`);
} finally {
  await prisma?.$disconnect();
}
