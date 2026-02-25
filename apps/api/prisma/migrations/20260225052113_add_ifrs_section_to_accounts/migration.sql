-- CreateEnum
CREATE TYPE "account_ifrs_section" AS ENUM ('REVENUE', 'OTHER_INCOME', 'COST_OF_SALES', 'OPERATING_EXPENSE', 'FINANCE_INCOME', 'FINANCE_COST', 'TAX_EXPENSE');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "ifrsSection" "account_ifrs_section";
