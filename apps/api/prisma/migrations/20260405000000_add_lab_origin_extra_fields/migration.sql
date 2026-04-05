-- AlterTable
ALTER TABLE "public"."lab_origins"
ADD COLUMN "contractActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "incorporationDate" TIMESTAMP(3),
ADD COLUMN "agreementDate" TIMESTAMP(3),
ADD COLUMN "lastAddendumNumber" TEXT,
ADD COLUMN "lastAddendumDate" TIMESTAMP(3),
ADD COLUMN "lastAddendumDetail" TEXT,
ADD COLUMN "receptionDays" TEXT,
ADD COLUMN "receptionSchedule" TEXT;
