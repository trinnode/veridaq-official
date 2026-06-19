-- AlterTable: add encrypted wallet key fields for per-institution EOA wallets
ALTER TABLE "institutions" ADD COLUMN "adminKeyEncrypted" TEXT,
ADD COLUMN "adminKeyIv" TEXT,
ADD COLUMN "adminKeyTag" TEXT;
