import { notFound } from 'next/navigation';
import { prisma } from '@/lib/server/db';
import { tournamentInclude, toDomainContext, computeMvp, type TournamentContext } from '@/lib/server/serialize';
import { demoTournament } from '@/lib/demo/demo-data';
import { calculateRanking } from '@/lib/domain/ranking';
import { averageMvpRatingByParticipant, MVP_THROUGH_LABEL } from '@/lib/domain/mvp';
import { RankingTable } from '@/components/RankingTable';
import { MVPTable } from '@/components/MVPTable';
import { PresentAutoRefresh } from '@/components/PresentAutoRefresh';
import type { Match } from '@/lib/domain/types';

export const dynamic = 'force-dynamic';

async function loadPresentData(id: string): Promise<TournamentContext | null> {
  if (id === 'demo-tournament') {
    return {
      id: demoTournament.id,
      name: demoTournament.name,
      format: demoTournament.format,
      status: 'RUNNING',
      rules: demoTournament.rules,
      settings: null,
      participants: demoTournament.participants,
      players: demoTournament.players,
      matches: demoTournament.matches,
      mvpVotes: demoTournament.mvpVotes,
      courts: demoTournament.courts,
      groups: []
    };
  }
  const tournament = await prisma.tournament.findFirst({
    where: { OR: [{ id }, { slug: id }, { publicToken: id }] },
    include: tournamentInclude
  });
  if (!tournament) return null;
  return toDomainContext(tournament);
}

function fmtTime(iso?: string): string {
  if (!iso) return 'orario da assegnare';
  return new Date(iso).toLocaleString('it-IT', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

const BRACKET_LABEL: Record<string, string> = { GOLD: 'Tabellone Gold', SILVER: 'Tabellone Silver', UNICO: 'Tabellone' };

function FinalSlot({ match, side, names }: { match: Match; side: 'A' | 'B'; names: Map<string, string> }) {
  const id = side === 'A' ? match.participantAId : match.participantBId;
  const won = !!match.winnerId && match.winnerId === id;
  const done = ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(match.status);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 8px', background: won ? '#f0fdf4' : 'transparent', borderLeft: won ? '4px solid #16a34a' : '4px solid transparent', fontWeight: won ? 800 : 500, opacity: id && !done ? 1 : 0.75 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{id ? (names.get(id) ?? id) : 'in attesa'}</span>
    </div>
  );
}

function MatchCell({ match, names }: { match: Match; names: Map<string, string> }) {
  const score = match.sets.length ? match.sets.map((s) => `${s.gamesA}-${s.gamesB}`).join('  ') : '';
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'white', minWidth: 220, flex: '0 0 auto' }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 8px', background: '#f8fafc' }}>
        {match.phase}{match.courtId ? ` · ${match.courtId}` : ''} · {fmtTime(match.scheduledAt)}
      </div>
      <FinalSlot match={match} side="A" names={names} />
      <FinalSlot match={match} side="B" names={names} />
      {score && <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', padding: '2px 0', borderTop: '1px dashed var(--border)' }}>{score}</div>}
    </div>
  );
}

function BracketView({ bracket, matches, names }: { bracket: string; matches: Match[]; names: Map<string, string> }) {
  const rounds = Array.from(new Set(matches.map((m) => m.roundIndex ?? 0))).sort((a, b) => a - b);
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{ margin: '0 0 8px' }}>{BRACKET_LABEL[bracket] ?? 'Tabellone'}</h3>
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
        {rounds.map((round) => {
          const roundMatches = matches.filter((m) => (m.roundIndex ?? 0) === round).sort((a, b) => a.id.localeCompare(b.id));
          return (
            <div key={round} style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'space-around', minHeight: 120 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>{roundMatches[0]?.phase ?? `Turno ${round}`}</div>
              {roundMatches.map((m) => <MatchCell key={m.id} match={m} names={names} />)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function PresentTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadPresentData(id);
  if (!data) notFound();

  const names = new Map(data.participants.map((p) => [p.id, p.displayName]));
  const avgMvp = averageMvpRatingByParticipant(data.participants, data.mvpVotes);
  const mvp = computeMvp(data);
  const finals = data.matches.filter((m) => !!m.phase && m.phase !== 'group');

  const byBracket = new Map<string, Match[]>();
  for (const m of finals) {
    const key = m.bracket ?? 'UNICO';
    byBracket.set(key, [...(byBracket.get(key) ?? []), m]);
  }
  const bracketOrder = ['GOLD', 'UNICO', 'SILVER'].filter((k) => byBracket.has(k));

  function championOf(bracketKey: string): string | null {
    const final = (byBracket.get(bracketKey) ?? []).find((m) => m.phase === 'final');
    if (final?.winnerId && ['COMPLETED', 'WALKOVER', 'RETIRED'].includes(final.status)) return names.get(final.winnerId) ?? final.winnerId;
    return null;
  }
  const champion = championOf('GOLD') ?? championOf('UNICO');
  const silverWinner = championOf('SILVER');

  const upcoming = finals
    .filter((m) => ['SCHEDULED', 'IN_PROGRESS'].includes(m.status) && m.participantAId && m.participantBId)
    .sort((a, b) => (a.scheduledAt ?? 'zzz').localeCompare(b.scheduledAt ?? 'zzz'))
    .slice(0, 6);

  return (
    <main className="grid">
      <PresentAutoRefresh intervalMs={20000} />

      <section className="panel">
        <span className="badge">Schermo di proiezione</span>
        <h1 style={{ margin: '6px 0', fontSize: 34 }}>{data.name}</h1>
        <p className="lead" style={{ margin: 0 }}>
          {champion ? (
            <span style={{ color: '#16a34a', fontWeight: 800 }}>🏆 Vincitore: {champion}</span>
          ) : silverWinner ? (
            <span>Silver: {silverWinner} · Gold in corso</span>
          ) : finals.length > 0 ? (
            <span>Fase finale in corso</span>
          ) : data.groups.length > 0 ? (
            <span>Fase a gironi</span>
          ) : (
            <span>Torneo in preparazione</span>
          )}
        </p>
      </section>

      {bracketOrder.length > 0 && (
        <section className="panel">
          <h2>Fase finale</h2>
          {bracketOrder.map((k) => <BracketView key={k} bracket={k} matches={byBracket.get(k)!} names={names} />)}
          {upcoming.length > 0 && !champion && (
            <div style={{ marginTop: 8 }}>
              <h3>Prossime partite</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                {upcoming.map((m) => (
                  <li key={m.id} style={{ fontSize: 18 }}>
                    <strong>{names.get(m.participantAId ?? '')}</strong> vs <strong>{names.get(m.participantBId ?? '')}</strong>
                    <span style={{ color: 'var(--muted)', fontSize: 14 }}> — {m.phase}, {fmtTime(m.scheduledAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {data.groups.length > 0 ? (
        <div className="grid grid-2">
          {data.groups.map((group) => {
            const gp = data.participants.filter((p) => p.groupId === group.id);
            const gm = data.matches.filter((m) => m.groupId === group.id);
            const ranking = calculateRanking(gp, gm, data.rules, avgMvp);
            return (
              <section className="panel" key={group.id}>
                <h2>{group.name}</h2>
                {ranking.length > 0 ? <RankingTable rows={ranking} /> : <p style={{ color: 'var(--muted)' }}>Nessuna squadra.</p>}
              </section>
            );
          })}
        </div>
      ) : (
        calculateRanking(data.participants, data.matches, data.rules, avgMvp).length > 0 && (
          <section className="panel"><h2>Classifica</h2><RankingTable rows={calculateRanking(data.participants, data.matches, data.rules, avgMvp)} /></section>
        )
      )}

      {mvp.rows.length > 0 && (
        <section className="panel">
          <h2>MVP del torneo <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)' }}>· fino alla {MVP_THROUGH_LABEL[mvp.through]}</span></h2>
          <MVPTable rows={mvp.rows.slice(0, 8)} />
        </section>
      )}
    </main>
  );
}
