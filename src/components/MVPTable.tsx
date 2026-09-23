import type { MVPStandingRow } from '@/lib/domain/types';

export function MVPTable({ rows }: { rows: MVPStandingRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Giocatore</th><th>Partite</th><th>MVP</th><th>Media voto</th><th>Penalità</th><th>Totale</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.playerId}>
              <td>{row.position}</td>
              <td><strong>{row.displayName}</strong></td>
              <td>{row.matchesPlayed}</td>
              <td>{row.mvpCount}</td>
              <td>{row.avgRating}</td>
              <td>{row.penalties}</td>
              <td><strong>{row.totalScore}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
