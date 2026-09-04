import type { MVPStandingRow } from '@/lib/domain/types';

export function MVPTable({ rows }: { rows: MVPStandingRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Giocatore</th><th>Partite</th><th>MVP</th><th>Media voto</th><th>Bonus</th><th>Penalità</th><th>Totale</th><th>Elegibile</th>
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
              <td>{row.finalBonus}</td>
              <td>{row.penalties}</td>
              <td><strong>{row.totalScore}</strong></td>
              <td>{row.eligible ? 'Sì' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
