-- AlterTable: add blockchain registration status for event-driven KYC approval
ALTER TABLE "institutions" ADD COLUMN "blockchainStatus" TEXT NOT NULL DEFAULT 'NOT_REGISTERED';
