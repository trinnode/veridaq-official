-- Add institution-as-employer link
ALTER TABLE "employers" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "employers" ADD CONSTRAINT "employers_institutionId_key" UNIQUE ("institutionId");

-- Add institution-as-employer opt-in flag
ALTER TABLE "institutions" ADD COLUMN "alsoEmployer" BOOLEAN NOT NULL DEFAULT false;

-- Create InstitutionEarnings table
CREATE TABLE "institution_earnings" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "totalEarnedUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalEarnedWei" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "withdrawnUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "withdrawnWei" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "availableUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "availableWei" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "payoutWallet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_earnings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "institution_earnings_institutionId_key" UNIQUE ("institutionId")
);

-- Create EarningTransaction table
CREATE TABLE "earning_transactions" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "verificationId" TEXT,
    "type" TEXT NOT NULL,
    "amountUsd" DECIMAL(65,30) NOT NULL,
    "amountWei" DECIMAL(65,30) NOT NULL,
    "platformShareUsd" DECIMAL(65,30),
    "institutionShareUsd" DECIMAL(65,30),
    "poolShareUsd" DECIMAL(65,30),
    "description" TEXT NOT NULL,
    "referenceId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "earning_transactions_pkey" PRIMARY KEY ("id")
);

-- Create GasPool table (singleton — only one row)
CREATE TABLE "gas_pool" (
    "id" TEXT NOT NULL,
    "totalDepositedUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalDepositedWei" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalSpentUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalSpentWei" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "availableUsd" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "availableWei" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gas_pool_pkey" PRIMARY KEY ("id")
);

-- Create GasPoolTransaction table
CREATE TABLE "gas_pool_transactions" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountUsd" DECIMAL(65,30) NOT NULL,
    "amountWei" DECIMAL(65,30) NOT NULL,
    "source" TEXT,
    "destination" TEXT,
    "referenceId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gas_pool_transactions_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "employers" ADD CONSTRAINT "employers_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "institution_earnings" ADD CONSTRAINT "institution_earnings_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "earning_transactions" ADD CONSTRAINT "earning_transactions_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Extend PaymentType enum
ALTER TYPE "PaymentType" ADD VALUE 'BATCH_UPLOAD';
ALTER TYPE "PaymentType" ADD VALUE 'CREDIT_PURCHASE';
