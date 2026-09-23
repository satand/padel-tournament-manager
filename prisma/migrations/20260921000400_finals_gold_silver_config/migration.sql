-- AlterTable: fase finale configurabile a gironi conclusi (numero squadre Gold + giri dei tabelloni)
ALTER TABLE "TournamentSettings" ADD COLUMN     "qualifiedForGold" INTEGER,
ADD COLUMN     "finalStartRoundGold" "FinalStartRound",
ADD COLUMN     "finalStartRoundSilver" "FinalStartRound";
