-- AlterTable
ALTER TABLE "person_profiles" ADD COLUMN "personType" TEXT NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE "person_profiles" ADD COLUMN "company" TEXT;
