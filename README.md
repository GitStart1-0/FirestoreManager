# Firestore Manager

Content authoring and database inspection tool for the Mythos/Noesis quiz
platform. It manages quiz questions, debates, causal graphs, tournament mirrors
and immutable level bundles.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) before changing database paths
or publishing behavior.

## Development

```bash
npm install
npm run lint
npm run dev
```

Production Firestore rules are maintained and deployed from
`D:/AndroidDevProject/noesis`, not from this repository.

## Official tournament events

Choose a Firebase connection, sign in with Google Login and open **Турнірні події**.
The panel creates official events through `createTournamentEvent`; it never writes
event documents directly. Specify a registration deadline and a start at least
two minutes later. Participants register in the Android app and the server
allocates balanced rooms with a shared question set and overall standings.

Creation requires `admin`/`tournamentModerator` Auth claims, or
`constructorAccess/<uid>` with `admin: true`, `role: admin`, or
`tournamentEvents: true`. Publishing tournament questions alone does not grant
event moderation. The panel shows the most recent 50 events and their status;
editing and cancellation are not implemented yet.

Production callables enforce Firebase App Check. Register this manager's web
app in Firebase App Check using reCAPTCHA Enterprise and add its public site key
as `appCheckSiteKey` in the connection's Firebase JSON. The manager initializes
App Check and refreshes tokens automatically. No enforcement bypass was added.

## Read-only editorial registry for ChatGPT

The editorial registry indexes local Mythos quiz files and optional local
snapshots of external datasets. It has no Firebase dependency and exposes only
HTTP `GET` operations.

```bash
npm run registry:build
npm run registry:serve
```

The default Mythos source is
`D:/NoesisInfo/КОНТЕНТ/ВІКТОРИНИ/Ерудит`. Override paths when needed:

```bash
npm run registry:build -- --mythos D:/path/to/levels --external D:/path/to/datasets
```

OpenAPI is available at `http://127.0.0.1:4317/openapi.json`. A cloud ChatGPT
client cannot call a loopback address directly; expose this service only through
an authenticated HTTPS gateway with the same read-only routes. Generated quiz
JSON remains a chat/download artifact and is published separately through this
manager's existing import workflow.

### GPT Action deployment

Public mode requires a Bearer key and remains read-only:

```bash
REGISTRY_HOST=0.0.0.0 REQUIRE_API_KEY=true REGISTRY_API_KEY=... npm run registry:serve
```

Build the registry, create a `mythos-registry-api-key` secret in a separate
Google Cloud project, then run:

```powershell
./scripts/editorial-registry/deploy-cloud-run.ps1 -ProjectId YOUR_EDITORIAL_PROJECT
```

The deploy script refuses the production Firebase project. Configure the
secret as a Bearer key in the GPT Action and import the deployed
`/openapi.json`.
