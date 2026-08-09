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
