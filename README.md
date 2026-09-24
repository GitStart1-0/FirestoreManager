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
