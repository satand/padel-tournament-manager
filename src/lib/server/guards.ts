import { NextResponse } from 'next/server';

const CLOSED_MSG = 'Torneo chiuso: non è più modificabile.';

export function closedResponse(tournament: { status: string } | null | undefined): NextResponse | null {
  if (tournament && (tournament.status === 'COMPLETED' || tournament.status === 'ARCHIVED')) {
    return NextResponse.json({ error: CLOSED_MSG }, { status: 409 });
  }
  return null;
}
