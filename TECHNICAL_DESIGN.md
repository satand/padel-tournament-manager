# Padel Tournament Manager — Technical & Product Design

## 1. Assunzioni

1. La prima release è una web app/PWA responsive, non una app nativa iOS/Android.
2. Il backend è integrato in Next.js tramite Route Handlers; la logica torneo resta separata in moduli TypeScript puri.
3. Il database target è PostgreSQL via Prisma ORM.
4. L'autenticazione è predisposta per email/password, magic link o OAuth; nel repository è inclusa la struttura RBAC, non un provider completo.
5. I formati più complessi, come mexicano e king/queen of the court, sono rappresentati da motori estendibili: la versione base include round robin, knockout, americano semplificato, scheduler e funzione king/queen per promozione/retrocessione.
6. Ogni regola importante è salvata come JSON configurabile in `TournamentSettings`, `RankingRule`, `TieBreakerRule`, `mvpWeights` e `scoreRules`.
7. Export PDF/XLSX è previsto in architettura; la base include export CSV puro. PDF/XLSX possono essere aggiunti con librerie server-side.

## 2. Analisi requisiti

### Obiettivi prodotto

L'app deve aiutare un organizzatore non tecnico a creare e gestire tornei di Padel anche durante l'evento, con priorità a:

- creazione torneo guidata;
- inserimento rapido risultati da smartphone;
- classifica automatica affidabile;
- gestione MVP partita e MVP torneo;
- pagina pubblica consultabile dai partecipanti;
- personalizzazione di formati, punteggi, spareggi e calendario.

### Ambiti funzionali principali

1. Gestione tornei: dati generali, formato, stato, pagina pubblica.
2. Gestione partecipanti: giocatori, coppie, sostituti, ritirati, jolly, quote.
3. Gestione regole: set, game, tie-break, golden/killer point, punteggi custom.
4. Scheduling: campi, slot, durata, recupero, collisioni, vincoli manuali.
5. Risultati: inserimento set per set, validazione, stato partita, note, MVP.
6. Classifiche: punti, set/game, scontri diretti, avulsa, criteri ordinabili.
7. MVP: voti multipli, pesi, bonus fase finale, penalità, eleggibilità.
8. Audit: tracciamento modifiche rilevanti.
9. Export/condivisione: CSV nella base, PDF/XLSX/immagine in estensione.
10. Ruoli: super admin, organizzatore, arbitro, giocatore, pubblico.

## 3. Architettura applicativa

```text
Browser / PWA
  ├─ UI responsive Next.js
  ├─ Wizard creazione torneo
  ├─ Dashboard organizzatore
  ├─ Inserimento risultati rapido
  └─ Pagina pubblica torneo

Next.js App Router
  ├─ Server Components
  ├─ Client Components per form/interazioni
  ├─ Route Handlers API
  └─ Service worker + manifest PWA

Domain Engine TypeScript
  ├─ ranking.ts
  ├─ mvp.ts
  ├─ scheduler.ts
  ├─ validators.ts
  └─ exports.ts

Persistence
  ├─ Prisma ORM
  ├─ PostgreSQL
  └─ AuditLog

Quality
  ├─ Vitest unit tests
  ├─ validation schema Zod
  └─ RBAC guard
```

### Motivo scelte tecniche

- **Next.js + React**: consente UI responsive, rendering server-side, API Route Handlers e PWA in un unico progetto.
- **TypeScript**: riduce errori sui modelli di dominio e rende più sicura l'evoluzione del motore torneo.
- **Prisma + PostgreSQL**: offre database relazionale, migrazioni, modello dati chiaro e query tipizzate.
- **Zod**: valida payload API e risultati partita prima di scrivere sul database.
- **Vitest**: testa ranking, scontri diretti, avulsa, MVP, validazione e calendario senza dipendere dalla UI.

## 4. Modello dati

Entità incluse nello schema Prisma:

- `User`: utenti e ruoli.
- `Tournament`: torneo, formato, stato, slug, pagina pubblica.
- `TournamentSettings`: set/game/regole/pesi MVP/punteggi.
- `Player`: anagrafica giocatore.
- `Team`: coppia/squadra.
- `TeamPlayer`: relazione team-giocatore.
- `TournamentParticipant`: astrazione comune per giocatore singolo o team.
- `TournamentGroup`: gironi.
- `Court`: campi.
- `ScheduleSlot`: slot orari.
- `Match`: partita.
- `MatchSet`: risultato set per set.
- `MatchResult`: risultato normalizzato e raw score.
- `Ranking`: snapshot classifica persistibile.
- `RankingRule`: regole punteggio custom.
- `TieBreakerRule`: criteri di spareggio ordinabili.
- `MVPVote`: voto MVP per partita.
- `MVPStanding`: classifica MVP persistibile.
- `AuditLog`: chi, cosa, quando, valore precedente e nuovo valore.

## 5. Flussi utente principali

### Creazione torneo

```text
Dashboard → Nuovo torneo → Dati generali → Formato → Partecipanti → Regole punteggio → Calendario → Conferma
```

Output del flusso:

- record `Tournament`;
- `TournamentSettings`;
- campi `Court`;
- giocatori/coppie;
- partecipanti normalizzati;
- eventuali gironi;
- calendario iniziale generato.

### Inserimento risultato

```text
Dashboard → Partita → Inserisci risultato → Validazione set/game → MVP opzionale → Salva → Ricalcolo classifiche → Audit log
```

Validazioni incluse:

- punteggio compatibile con regole;
- numero set valido;
- tie-break/super tie-break coerente;
- vincitore richiesto per walkover/ritiro;
- MVP unico, salvo regola custom;
- aggiornamento classifica dopo modifica risultato.

### Pagina pubblica

```text
URL pubblico → Calendario → Risultati → Classifica → MVP provvisorio
```

Il pubblico non vede funzioni admin e non può modificare dati.

## 6. Logica classifica

Per ogni match concluso, walkover o ritiro:

1. Inizializza statistiche per ogni partecipante.
2. Somma partite giocate, vinte, perse, pareggiate.
3. Somma set vinti/persi e game vinti/persi.
4. Calcola differenza set e differenza game.
5. Assegna punti secondo `scoreRules`.
6. Applica eventuali bonus set/game e penalità disciplinari.
7. Integra media voto MVP, se attiva.
8. Ordina secondo `tieBreakers` configurabili.
9. In caso di parità multipla, calcola classifica avulsa sui soli match tra i pari merito.

File principale: `src/lib/domain/ranking.ts`.

## 7. Logica scontri diretti e classifica avulsa

### Due partecipanti a pari punti

L'engine crea una mini-classifica solo sulle partite tra i due partecipanti e usa il miglior risultato diretto. Se non risolve, passa ai criteri successivi.

### Tre o più partecipanti a pari punti

L'engine filtra tutte le partite giocate esclusivamente tra i partecipanti coinvolti nel pari merito e ricalcola:

- punti nella mini-classifica;
- differenza set;
- differenza game;
- game vinti;
- minor numero di game persi;
- eventuale ordine manuale.

File principale: `calculateMiniLeague()` in `ranking.ts`.

## 8. Logica miglior giocatore

Per ogni giocatore:

```text
Punteggio MVP =
  (numero MVP partita × peso MVP)
  + (voto ponderato × peso voto)
  + bonus semifinale/finale
  + bonus vittoria torneo
  - penalità
```

Il sistema considera anche:

- minimo partite giocate;
- eleggibilità;
- voto organizzatore, arbitro, pubblico;
- peso della fase;
- penalità.

File principale: `src/lib/domain/mvp.ts`.

## 9. Generazione calendario

La base include:

- round robin con gestione bye;
- knockout con bye e teste di serie;
- americano semplificato per multipli di 4;
- assegnazione campi/orari con durata match, recupero minimo e limite partite/giorno;
- funzione di promozione/retrocessione per king/queen of the court.

File principale: `src/lib/domain/scheduler.ts`.

## 10. Wireframe testuali

### Dashboard torneo

```text
[Nome torneo] [Formato] [Stato]
------------------------------------------------
| Partecipanti | Partite | Concluse | MVP leader |
------------------------------------------------
| Prossime partite          | Inserimento rapido |
| - Campo/Ora/Partecipanti  | Game A / Game B    |
| - Stato                   | MVP / Voto / Salva |
------------------------------------------------
| Classifica completa                            |
------------------------------------------------
| Classifica MVP                                 |
```

### Wizard creazione torneo

```text
[1 Dati] [2 Formato] [3 Partecipanti] [4 Regole] [5 Calendario] [6 Conferma]

Step 1: Nome, date, campi, tipo partecipanti
Step 2: Formato torneo, gironi/fase finale
Step 3: Import CSV/Excel o inserimento manuale
Step 4: Set, game, tie-break, punti, spareggi, MVP
Step 5: durata match, recupero, fasce orarie, vincoli
Step 6: riepilogo, genera calendario, crea torneo
```

### Inserimento risultati mobile

```text
[Partita]
Coppia A vs Coppia B
Campo 2 · 10:30

Set 1: [ 6 ] - [ 4 ]
+ Aggiungi set
Stato: Conclusa / Walkover / Ritiro / Rinviata
MVP: [seleziona giocatore]
Voto: [8.5]
Note: [textarea]
[Salva risultato]
```

### Pagina pubblica

```text
[Nome torneo]
Tabs: Calendario | Risultati | Classifica | MVP
Nessun pulsante amministrativo
```

## 11. Test automatici inclusi

- `ranking.test.ts`: classifica, scontro diretto, classifica avulsa.
- `mvp.test.ts`: MVP, voti, bonus finale.
- `validators.test.ts`: risultati impossibili, tie-break, conflitti campo/partecipante.
- `scheduler.test.ts`: round robin, scheduling, knockout.

## 12. Roadmap consigliata

### Release 1

- login reale;
- CRUD completo tornei/giocatori/coppie;
- risultato rapido persistente;
- ranking persistito post-update;
- pagina pubblica via token;
- export CSV.

### Release 2

- import Excel robusto;
- PDF e immagine condivisibile;
- generatore mexicano avanzato;
- editor manuale tabellone;
- notifiche WhatsApp/email;
- modalità offline-first per arbitri.

### Release 3

- pagamenti quote;
- multi-club;
- ranking storico giocatori;
- analytics torneo;
- app store wrapper Capacitor, se richiesta app nativa.
