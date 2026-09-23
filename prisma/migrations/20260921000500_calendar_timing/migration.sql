-- AlterTable: modello tempi calendario (riscaldamento + match + cambio) e limite partite/giorno opzionale
ALTER TABLE "TournamentSettings" RENAME COLUMN "minRestMinutes" TO "changeoverMinutes";
ALTER TABLE "TournamentSettings" ADD COLUMN "warmUpMinutes" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "TournamentSettings" ALTER COLUMN "maxMatchesPerPlayerDay" DROP NOT NULL;
