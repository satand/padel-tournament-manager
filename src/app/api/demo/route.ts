import { NextResponse } from 'next/server';
import { demoTournament } from '@/lib/demo/demo-data';
import { calculateRanking } from '@/lib/domain/ranking';
import { averageMvpRatingByParticipant, calculateMVPStandings } from '@/lib/domain/mvp';

export async function GET() {
  const avgMvp = averageMvpRatingByParticipant(demoTournament.participants, demoTournament.mvpVotes);
  const ranking = calculateRanking(demoTournament.participants, demoTournament.matches, demoTournament.rules, avgMvp);
  const mvp = calculateMVPStandings(demoTournament.players, demoTournament.participants, demoTournament.matches, demoTournament.mvpVotes, demoTournament.mvpSettings);
  return NextResponse.json({ ...demoTournament, ranking, mvp });
}
