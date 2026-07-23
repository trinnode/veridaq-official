-- AlterTable
ALTER TABLE "credentials" ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedBy" TEXT,
ADD COLUMN     "revokedReason" TEXT;
