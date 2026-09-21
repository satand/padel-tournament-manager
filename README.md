# Padel Tournament Manager

Applicazione web responsive per creare, gestire e consultare tornei di padel da desktop, smartphone e tablet.

Il progetto supporta due modalità d'uso:

1. **Demo senza database**, utile per esplorare interfaccia e flussi principali.
2. **Modalità completa con PostgreSQL**, per creare tornei reali, salvare risultati e generare calendari persistenti.

## Avvio con Docker (consigliato, anche senza esperienza)

Serve soltanto **Docker Desktop** installato e in esecuzione sul PC. Le operazioni di ogni giorno sono racchiuse in semplici script nella cartella `docker/`.

| Azione | macOS / Linux | Windows | Con npm | Cosa succede |
|--------|---------------|---------|---------|--------------|
| **Avviare** | `bash docker/start.sh` | doppio click `docker/start.bat` | `npm run docker:start` | Avvia app + database. Al primo avvio costruisce l'immagine. |
| **Fermare** | `bash docker/stop.sh` | doppio click `docker/stop.bat` | `npm run docker:stop` | Ferma tutto. **I dati restano salvati.** |
| **Riaggiornare dopo una modifica al software** | `bash docker/rebuild.sh` | doppio click `docker/rebuild.bat` | `npm run docker:rebuild` | Ricostruisce solo l'app e la riavvia. **Il database non viene toccato.** |
| **Vedere i log** | `bash docker/logs.sh` | doppio click `docker/logs.bat` | `npm run docker:logs` | Mostra i log dell'app (Ctrl+C per uscire). |

A avvio completato apri nel browser: **http://localhost:3000**

Il primo avvio crea in automatico un file `.env` a partire da `.env.example` (valori locali); basta lasciarlo così per usare l'app sul proprio PC.

> **Sicurezza dei dati.** `stop` e `rebuild` **non cancellano nulla**: tornei e risultati restano nel volume `padel-postgres-data`. L'unica operazione distruttiva che azzera il database è `down -v` (usarla solo quando si vuole ripartire da zero):
>
> ```bash
> docker compose --env-file .env -f docker/docker-compose.yml down -v
> ```

### Comandi Docker manuali equivalenti

Dalla cartella principale del progetto, gli script eseguono esattamente:

```bash
# Avvia app + database
docker compose --env-file .env -f docker/docker-compose.yml up -d

# Ferma (dati conservati)
docker compose --env-file .env -f docker/docker-compose.yml down

# Ricostruisci e riavvia solo l'app dopo una modifica al codice
docker compose --env-file .env -f docker/docker-compose.yml up -d --build app
```

### Avvio passo-passo su Windows

Prerequisiti: **Docker Desktop in esecuzione** (backend WSL2 consigliato) e un terminale (PowerShell o CMD).

1. **Procurati il codice**
   ```bash
   git clone https://github.com/satand/padel-tournament-manager.git
   ```
   (Se hai già il repo: `git pull`.)
2. **Apri il terminale nella cartella radice** del progetto (quella con `package.json` e la cartella `docker/`).
3. **Avvia** con un doppio click su `docker\start.bat` (oppure `npm run docker:start`). Il primo avvio costruisce l'immagine (pochi minuti) e crea il database, applicando le migrazioni in automatico.
4. Al termine apri **http://localhost:3000**.

Verifica rapida:
```bash
docker compose --env-file .env -f docker\docker-compose.yml ps
docker\logs.bat
```
(nei log cerca "Ready"; `Ctrl+C` per uscire dai log).

> **Prima volta su una nuova macchina?** Il database parte **vuoto** (il volume non eredita i tornei di altri PC). La **demo** resta comunque visibile; per popolare subito apri `/tournaments` e fai **triplo click** sul titolo "I tuoi tornei" (quick-seed).

**Problemi tipici su Windows**
- **Porta 5432 già usata** (es. un PostgreSQL installato in locale): in `docker/docker-compose.yml` cambia `"5432:5432"` in `"5433:5432"` (l'app dentro Compose usa comunque `db:5432`).
- **Porta 3000 già usata**: cambia `"3000:3000"` in `"3001:3000"` e apri `http://localhost:3001` (eventualmente aggiorna `NEXT_PUBLIC_APP_URL`).
- **`docker compose` non riconosciuto**: Docker Desktop non è in esecuzione, oppure prova `docker-compose` (v1, con il trattino).
- **Percorso con spazi**: usa gli script `.bat` (gestiscono loro il path).
- **Prima build fallita/lenta**: serve connessione a internet (scarica le immagini ed esegue `npm ci`); riprova con `docker\rebuild.bat`.

## Architettura

Il progetto usa Next.js come shell applicativa e backend, con la logica di dominio separata in moduli TypeScript puri. Questo rende il motore torneo testabile e riusabile indipendentemente dalla UI.

```mermaid
flowchart TD
  browser["Browser"]
  nextApp["Next.js App Router"]
  ui["Client Components"]
  api["Route Handlers API"]
  domain["Domain engine TypeScript"]
  prisma["Prisma ORM"]
  postgres["PostgreSQL"]

  browser --> nextApp
  nextApp --> ui
  nextApp --> api
  api --> domain
  api --> prisma
  prisma --> postgres
```

### Componenti principali

- `src/app/layout.tsx`: shell globale, navigazione e metadati applicativi.
- `src/app/page.tsx`: home demo con dati statici.
- `src/app/new-tournament/page.tsx`: entry point del wizard di creazione torneo.
- `src/components/TournamentWizard.tsx`: wizard guidato che crea il torneo via API.
- `src/app/tournaments/page.tsx`: elenco dei tornei salvati nel database.
- `src/app/tournaments/[id]/page.tsx`: dashboard organizzatore.
- `src/app/public/[id]/page.tsx`: pagina pubblica read-only.
- `src/app/api/*`: route handlers per CRUD tornei, calendario, partecipanti e risultati.
- `src/lib/domain/*`: motore torneo puro per classifiche, MVP, validazione e scheduling.
- `prisma/schema.prisma`: schema relazionale PostgreSQL.
- `src/lib/server/*`: Prisma client e audit log.
- `src/lib/demo/demo-data.ts`: dataset demo senza database.

## Funzionalità incluse

- **Un solo operatore, senza login**: tutto locale, pensato per gestire il torneo la settimana prima.
- **Solo coppie** (Team): iscrizione con i due giocatori + livello numerico per coppia.
- Wizard di creazione (solo tipo torneo e config); le coppie si inseriscono in amministrazione (CRUD con modifica).
- **Gironi bilanciati per livello** (fasce + serpentina) e **classifica per girone**.
- **Fase finale** a eliminazione diretta con tabelloni configurabili **Gold/Silver** e **propagazione automatica dei vincenti**.
- **Modalità punteggio**: set, "a target" (primo a N game) o "a tempo".
- **MVP "fino a una fase"**: il calcolo considera solo le partite fino alla fase scelta (es. fino alle semifinali).
- **Schermo di proiezione** `/present/[id]`: campione, tabellone, classifiche e MVP, adatti a un monitor.
- **Export CSV**: calendario, classifiche e MVP.
- Lista tornei, dashboard organizzatore e pagina pubblica di sola lettura.
- Audit log delle modifiche principali; interfaccia responsive; test automatici sul motore di dominio.

## Requisiti

- Docker o Podman con Docker Compose: e' il modo consigliato per avviare l'app (vedi "Avvio con Docker").
- Node.js 20 e npm: servono solo per lo sviluppo o per eseguire l'app senza Docker.
- PostgreSQL 16: fornito automaticamente dal container `db` quando usi Compose.

## Variabili d'ambiente

Il file `.env.example` contiene le variabili minime attese:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/padel_tournament_manager?schema=public
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=padel_tournament_manager
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Nota: i valori non devono essere racchiusi tra virgolette. Il formato `KEY=VALUE` senza virgolette funziona sia con Next.js (dotenv) sia con `docker run --env-file` / `docker compose env_file`, che non rimuovono le virgolette dai valori.

Per la demo senza database puoi comunque tenere il file `.env` pronto, ma le funzionalità che scrivono sul database richiedono una `DATABASE_URL` valida.

## Avvio rapido in demo

La demo serve per navigare l'interfaccia e testare i flussi principali senza preparare subito PostgreSQL.

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run dev
```

Poi apri:

```text
http://localhost:3000
```

### Cosa funziona in demo

- home e navigazione;
- dashboard demo;
- pagina pubblica demo;
- visualizzazione classifiche e calendari demo;
- consultazione dei risultati già presenti nei dati statici.

### Cosa non è una vera demo write-enabled

Le operazioni di scrittura reale, come:

- creazione tornei;
- aggiunta partecipanti;
- generazione calendario;
- salvataggio risultati;
- eliminazione tornei;

richiedono il database PostgreSQL e il backend attivo.

## Avvio completo con PostgreSQL locale

### 1. Avvia PostgreSQL con volume persistente

```bash
docker volume create padel-postgres-data

docker run --name padel-postgres \
  --restart unless-stopped \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=padel_tournament_manager \
  -p 5432:5432 \
  -v padel-postgres-data:/var/lib/postgresql/data \
  -d postgres:16
```

Il volume `padel-postgres-data` conserva i dati anche se il container viene ricreato.

### 2. Configura l'app

```bash
cp .env.example .env
```

Se necessario, aggiorna `DATABASE_URL` per puntare al tuo host o database.

### 3. Installa dipendenze e genera Prisma Client

```bash
npm install
npm run prisma:generate
```

### 4. Applica le migrazioni

```bash
npm run prisma:migrate
```

### 5. Seed opzionale

```bash
npm run prisma:seed
```

### 6. Avvia l'app

```bash
npm run dev
```

## Script disponibili

- `npm run dev` - avvio in sviluppo.
- `npm run build` - build di produzione.
- `npm run start` - avvio di produzione.
- `npm run lint` - lint del progetto.
- `npm test` - esecuzione test Vitest.
- `npm run prisma:generate` - genera Prisma Client.
- `npm run prisma:migrate` - crea/applica migrazioni in sviluppo.
- `npm run prisma:seed` - carica i dati demo nel database.
- `npm run docker:start` - avvia app + database con Docker Compose (equivalente a `docker/start.sh`).
- `npm run docker:stop` - ferma l'applicazione lasciando intatti i dati (equivalente a `docker/stop.sh`).
- `npm run docker:rebuild` - ricostruisce e riavvia solo l'app dopo una modifica, senza toccare il database (equivalente a `docker/rebuild.sh`).
- `npm run docker:logs` - mostra i log dell'app in tempo reale (equivalente a `docker/logs.sh`).

## Test

```bash
npm test
```

Le aree coperte includono:

- classifica;
- scontri diretti;
- classifica avulsa;
- MVP;
- validazione risultati;
- generazione calendario;
- scheduling dei match.

## Build immagine Docker dell'applicazione

Il Dockerfile reale si trova in [`docker/Dockerfile`](docker/Dockerfile).

Per costruire l'immagine:

```bash
docker build -f docker/Dockerfile -t padel-tournament-manager:latest .
```

Per avviare solo il container applicativo, collegandolo a un database già esistente:

```bash
docker run --rm \
  --name padel-app \
  --env-file .env \
  -e 'DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/padel_tournament_manager?schema=public' \
  -p 3000:3000 \
  padel-tournament-manager:latest
```

Nota: l'immagine dell'app richiede un `DATABASE_URL` raggiungibile dal container.

## Installazione completa in produzione con Docker

La soluzione consigliata è definita in [`docker/docker-compose.yml`](docker/docker-compose.yml) e compone:

- un container per **PostgreSQL** con volume persistente;
- un container per **l'app Next.js**;
- un reverse proxy HTTPS davanti all'app, ad esempio Nginx, Traefik o Caddy.

### 1. Prepara l'ambiente

- Installa Docker e il plugin Docker Compose.
- Prepara un file `.env` con valori di produzione.
- Scegli una password forte per PostgreSQL.
- Imposta `NEXT_PUBLIC_APP_URL` con l'URL pubblico reale.

### 2. Avvia l'intero stack con Docker Compose

Da root progetto:

```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d --build
```

Questo comando:

- crea l'immagine dell'app a partire da `docker/Dockerfile`;
- avvia PostgreSQL con volume persistente;
- avvia l'app Next.js;
- applica automaticamente le migrazioni Prisma all'avvio dell'app.

Se vuoi lavorare solo sul database puoi avviare il servizio `db` separatamente con Compose, ma per la produzione è consigliato usare lo stack completo.

### 3. Metti l'app dietro un reverse proxy HTTPS

Configura Nginx, Traefik o Caddy per:

- terminare TLS/HTTPS;
- inoltrare il traffico al container app sulla porta 3000;
- gestire eventuali redirect HTTP -> HTTPS;
- applicare rate limit e header di sicurezza.

### 4. Backup e manutenzione

In produzione devi prevedere:

- backup automatici del volume PostgreSQL;
- verifica periodica dei log applicativi e del database;
- rotazione delle credenziali;
- esecuzione delle migrazioni prima dei deploy;
- controllo dello spazio occupato dal volume dati.

### 5. Esempio di flusso completo

```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d --build
```

Se vuoi eseguire il seed dopo il primo avvio:

```bash
docker compose --env-file .env -f docker/docker-compose.yml run --rm app npm run prisma:seed
```

## Struttura del progetto

```text
src/app                  Pagine, layout e API Next.js
src/components           Componenti UI e wizard
src/lib/domain           Motore torneo testabile
src/lib/demo             Dati demo statici
src/lib/server           Prisma client e audit log
src/tests                Test unitari
prisma/schema.prisma     Schema PostgreSQL
public                   Asset statici e icona
scripts/seed.ts          Seed demo per PostgreSQL
```

## Note utili

- La home demo e le pagine demo pubbliche sono consultabili anche senza database.
- Le funzioni operative complete richiedono PostgreSQL.
- Le regole di ranking, scheduling e MVP vivono nel dominio TypeScript e sono progettate per essere testate indipendentemente dalla UI.

## Troubleshooting

### `npx prisma generate` fallisce

Verifica che `DATABASE_URL` punti a un database raggiungibile e che il file `.env` sia presente.

### I dati non persistono tra un riavvio e l'altro

Se usi PostgreSQL in Docker, controlla che il container monti un volume su `/var/lib/postgresql/data`.

### Il torneo creato non appare nella lista

Controlla che l'app sia collegata al database corretto e che le migrazioni siano state applicate.

### La build Docker non parte

Assicurati di avere un `Dockerfile` valido nel repository e che `npx prisma generate` venga eseguito durante la build o subito prima di `npm run build`.

## Roadmap breve

- login multi-organizzatore (oggi l'app e' pensata per un singolo operatore locale);
- import Excel più ricco;
- export PDF/XLSX server-side;
- notifiche ai giocatori;
- gestione tabelloni più avanzata.
