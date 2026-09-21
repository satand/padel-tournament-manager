-- Drop unused "tier thresholds" (gironi creati con serpentina sul livello; le fasce non erano usate)
ALTER TABLE "TournamentSettings" DROP COLUMN IF EXISTS "tierThresholds";
