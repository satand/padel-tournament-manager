-- AlterTable
ALTER TABLE "TournamentSettings" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Rome',
ADD COLUMN     "assignGroupTimes" BOOLEAN NOT NULL DEFAULT true;
