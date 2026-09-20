import { describe, expect, it } from 'vitest';
import { composeTeamDisplayName, parsePlayerName } from '@/lib/domain/teams';

describe('teams — parsing e nome coppia', () => {
  it('seplica nome e cognome', () => {
    expect(parsePlayerName('Mario Rossi')).toEqual({ firstName: 'Mario', lastName: 'Rossi' });
    expect(parsePlayerName('Luca')).toEqual({ firstName: 'Luca', lastName: '' });
    expect(parsePlayerName('Maria Grazia Bianchi')).toEqual({ firstName: 'Maria', lastName: 'Grazia Bianchi' });
  });

  it('usa il nome squadra se fornito', () => {
    expect(composeTeamDisplayName('Gli Invincibili', ['Mario Rossi', 'Luca Bianchi'])).toBe('Gli Invincibili');
  });

  it('compone il nome dai giocatori quando assente', () => {
    expect(composeTeamDisplayName('', ['Mario Rossi', 'Luca Bianchi'])).toBe('Mario Rossi / Luca Bianchi');
    expect(composeTeamDisplayName(undefined, ['Mario Rossi', 'Luca Bianchi'])).toBe('Mario Rossi / Luca Bianchi');
  });
});
