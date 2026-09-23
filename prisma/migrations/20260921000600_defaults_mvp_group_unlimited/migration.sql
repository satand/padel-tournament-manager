-- AlterTable: default "Conta MVP fino a" -> GROUP (solo gironi); "Max partite/giorno" -> senza limite (null)
ALTER TABLE "TournamentSettings" ALTER COLUMN "mvpThroughPhase" SET DEFAULT 'GROUP';
ALTER TABLE "TournamentSettings" ALTER COLUMN "maxMatchesPerPlayerDay" DROP DEFAULT;
