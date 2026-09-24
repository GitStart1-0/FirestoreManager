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
