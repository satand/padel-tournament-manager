-- AlterTable: punteggio specifico per la fase finale (null = eredita la fase a gironi)
ALTER TABLE "TournamentSettings" ADD COLUMN     "finalScoringMode" "ScoringMode",
ADD COLUMN     "finalSetsPerMatch" INTEGER,
ADD COLUMN     "finalGamesPerSet" INTEGER,
ADD COLUMN     "finalTargetGames" INTEGER;
