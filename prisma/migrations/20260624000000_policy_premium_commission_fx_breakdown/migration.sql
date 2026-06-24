-- Desglose de prima (afecta/exenta), desglose de comisión y snapshot de tipo
-- de cambio en Policy. Todas las columnas son nullable y aditivas: no
-- reescriben datos existentes.

-- AlterTable
ALTER TABLE "Policy" ADD COLUMN     "commissionAffect" DECIMAL(14,4),
ADD COLUMN     "commissionAffectPct" DECIMAL(6,3),
ADD COLUMN     "commissionCalculated" DECIMAL(14,4),
ADD COLUMN     "commissionExempt" DECIMAL(14,4),
ADD COLUMN     "commissionExemptPct" DECIMAL(6,3),
ADD COLUMN     "commissionFinalCompany" DECIMAL(14,2),
ADD COLUMN     "commissionPaid" BOOLEAN,
ADD COLUMN     "exchangeRate" DECIMAL(14,4),
ADD COLUMN     "premiumAffect" DECIMAL(14,2),
ADD COLUMN     "premiumExempt" DECIMAL(14,2),
ADD COLUMN     "ufValue" DECIMAL(14,4);
