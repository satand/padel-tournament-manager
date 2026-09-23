import { describe, expect, it } from 'vitest';
import { composeTeamDisplayName, parsePlayerName, playerSurname } from '@/lib/domain/teams';

describe('teams — parsing e nome coppia', () => {
  it('separa nome e cognome', () => {
    expect(parsePlayerName('Mario Rossi')).toEqual({ firstName: 'Mario', lastName: 'Rossi' });
    expect(parsePlayerName('Luca')).toEqual({ firstName: 'Luca', lastName: '' });
    expect(parsePlayerName('Maria Grazia Bianchi')).toEqual({ firstName: 'Maria', lastName: 'Grazia Bianchi' });
  });

  it('playerSurname usa il cognome, con fallback sul nome', () => {
    expect(playerSurname({ firstName: 'Mario', lastName: 'Rossi' })).toBe('Rossi');
    expect(playerSurname({ firstName: 'Luca', lastName: '' })).toBe('Luca');
    expect(playerSurname({ firstName: 'Maria', lastName: 'Grazia Bianchi' })).toBe('Grazia Bianchi');
  });

  it('compone il nome squadra dai soli cognomi', () => {
    expect(composeTeamDisplayName(['Rossi', 'Bianchi'])).toBe('Rossi / Bianchi');
    expect(composeTeamDisplayName(['Rossi', ''])).toBe('Rossi');
    expect(composeTeamDisplayName([null, 'B'])).toBe('B');
  });
});
