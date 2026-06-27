-- DropForeignKey
ALTER TABLE "earning_transactions" DROP CONSTRAINT "earning_transactions_institutionId_fkey";

-- DropForeignKey
ALTER TABLE "institution_earnings" DROP CONSTRAINT "institution_earnings_institutionId_fkey";

-- AlterTable
ALTER TABLE "verification_requests" ADD COLUMN     "courseName" TEXT;

-- AddForeignKey
ALTER TABLE "institution_earnings" ADD CONSTRAINT "institution_earnings_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earning_transactions" ADD CONSTRAINT "earning_transactions_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
