import type { RankingRow } from '@/lib/domain/types';

export function RankingTable({ rows }: { rows: RankingRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Partecipante</th><th>PG</th><th>V</th><th>P</th><th>Pt</th><th>Set</th><th>Game</th><th>%V</th><th>Media game</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.participantId}>
              <td>{row.position}</td>
              <td><strong>{row.displayName}</strong></td>
              <td>{row.played}</td>
              <td>{row.won}</td>
              <td>{row.lost}</td>
              <td><strong>{row.points}</strong></td>
              <td>{row.setsWon}-{row.setsLost} ({row.setDiff > 0 ? '+' : ''}{row.setDiff})</td>
              <td>{row.gamesWon}-{row.gamesLost} ({row.gameDiff > 0 ? '+' : ''}{row.gameDiff})</td>
              <td>{row.winPercentage}%</td>
              <td>{row.avgGamesWon}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
