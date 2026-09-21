-- Fix: allow deleting a tournament (and its players) that has MVP votes.
-- MVPVote.player was ON DELETE RESTRICT, which blocked cascade-deleting Player rows.

-- DropForeignKey
ALTER TABLE "MVPVote" DROP CONSTRAINT "MVPVote_playerId_fkey";

-- AddForeignKey
ALTER TABLE "MVPVote" ADD CONSTRAINT "MVPVote_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
