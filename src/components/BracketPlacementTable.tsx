import type { BracketPlacement } from '@/lib/domain/finals';

export function BracketPlacementTable({ rows }: { rows: BracketPlacement[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Partecipante</th><th>Fase raggiunta</th><th>V</th><th>P</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.participantId}>
              <td>{row.position}</td>
              <td><strong>{row.displayName}</strong></td>
              <td>{row.phaseLabel}</td>
              <td>{row.wins}</td>
              <td>{row.losses}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
