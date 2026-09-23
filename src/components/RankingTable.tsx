import type { RankingRow } from '@/lib/domain/types';

export function RankingTable({ rows, phaseReached }: { rows: RankingRow[]; phaseReached?: Map<string, string> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Partecipante</th>{phaseReached && <th>Fase raggiunta</th>}<th>PG</th><th>V</th><th>P</th><th>Pt</th><th>Set</th><th>Game</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.participantId}>
              <td>{row.position}</td>
              <td><strong>{row.displayName}</strong></td>
              {phaseReached && <td>{phaseReached.get(row.participantId) ?? ''}</td>}
              <td>{row.played}</td>
              <td>{row.won}</td>
              <td>{row.lost}</td>
              <td><strong>{row.points}</strong></td>
              <td>{row.setsWon}-{row.setsLost} ({row.setDiff > 0 ? '+' : ''}{row.setDiff})</td>
              <td>{row.gamesWon}-{row.gamesLost} ({row.gameDiff > 0 ? '+' : ''}{row.gameDiff})</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
