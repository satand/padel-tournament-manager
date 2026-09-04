# Padel Tournament Manager

Applicazione web e PWA per creare, gestire e consultare tornei di padel da desktop, smartphone e tablet.

Il progetto supporta due modalità d'uso:

1. **Demo senza database**, utile per esplorare interfaccia e flussi principali.
2. **Modalità completa con PostgreSQL**, per creare tornei reali, salvare risultati e generare calendari persistenti.

## Architettura

Il progetto usa Next.js come shell applicativa e backend, con la logica di dominio separata in moduli TypeScript puri. Questo rende il motore torneo testabile e riusabile indipendentemente dalla UI.

```mermaid
flowchart TD
  browser["Browser / PWA"]
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

- `src/app/layout.tsx`: shell globale, navigazione, metadati PWA e registrazione service worker.
- `src/app/page.tsx`: home demo con dati statici.
- `src/app/new-tournament/page.tsx`: entry point del wizard di creazione torneo.
- `src/components/TournamentWizard.tsx`: wizard in 6 step che crea il torneo via API.
- `src/app/tournaments/page.tsx`: elenco dei tornei salvati nel database.
- `src/app/tournaments/[id]/page.tsx`: dashboard organizzatore.
- `src/app/public/[id]/page.tsx`: pagina pubblica read-only.
- `src/app/api/*`: route handlers per CRUD tornei, calendario, partecipanti e risultati.
- `src/lib/domain/*`: motore torneo puro per classifiche, MVP, validazione e scheduling.
- `prisma/schema.prisma`: schema relazionale PostgreSQL.
- `src/lib/server/*`: Prisma client, audit log e RBAC.
- `src/lib/demo/demo-data.ts`: dataset demo senza database.

## Funzionalità incluse

- Wizard di creazione torneo guidata.
- Lista tornei e dashboard organizzatore.
- Pagina pubblica consultabile da tutti.
- Gestione partecipanti, calendario e risultati.
- Classifica automatica con scontri diretti e avulsa.
- Classifica MVP con voti, pesi, bonus e penalità.
- Scheduling round robin, knockout e americano semplificato.
- Audit log delle modifiche principali.
- PWA installabile su smartphone, tablet e desktop.
- Test automatici sul motore di dominio.

## Requisiti

- Node.js 20 o superiore.
- npm.
- PostgreSQL 16 o superiore per la modalità completa.
- Docker opzionale, ma consigliato per PostgreSQL e per la produzione.

## Variabili d'ambiente

Il file `.env.example` contiene le variabili minime attese:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/padel_tournament_manager?schema=public
JWT_SECRET=change-me-in-production
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
- Imposta `JWT_SECRET` con un valore lungo e casuale.
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
src/lib/server           Prisma, RBAC e audit
src/tests                Test unitari
prisma/schema.prisma     Schema PostgreSQL
public                   Manifest PWA, service worker e asset statici
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

- autenticazione completa;
- import Excel più ricco;
- export PDF/XLSX server-side;
- notifiche ai giocatori;
- gestione tabelloni più avanzata.
