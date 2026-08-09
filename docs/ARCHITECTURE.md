# Firestore Manager architecture

## Responsibilities

- `src/App.tsx`: application shell, authentication, connection selection and Explorer routing.
- `src/components/NoesisConstructor.tsx`: quiz/debate authoring workflow orchestration.
- `src/components/CausalGraphConstructor.tsx`: isolated causal-graph editor.
- `src/domain`: stable content identifiers and database naming rules.
- `src/features`: privileged workflows such as tournament publication.
- `src/services`: Firestore/Storage integration and compatibility adapters.
- `src/shared`: reusable, database-independent utilities and UI.

Large editors are loaded lazily. Opening Explorer does not download the quiz
constructor, and opening a regular quiz does not download the causal-graph
editor.

## Database source of truth

Production Firestore and Storage security rules belong to the Android/Firebase
repository at `D:/AndroidDevProject/noesis`. The `firestore.rules` file in this
repository is intentionally deny-all and must not replace production rules.

The manager writes ordinary quiz content through Firestore rules granted to a
constructor account. Privileged tournament publication always calls the
`publishTournamentQuestion` Cloud Function. There is no direct Firestore
fallback for tournament pool documents.

## Content paths

- Ukrainian: `{category}/{levelId}/questions/{questionId}`
- English/German: `{category}_{lang}/{levelId}/questions/{questionId}`
- Debate disciplines: `debateDisciplines/{disciplineId}`
- Debate topics: `debateTopics/{topicId}`
- Tournament pool: server-owned `tournamentQuestionPools/{hash}`
- Level bundles: Storage `level-bundles/{category}/{levelId}/{lang}/...json`

Supported root categories and languages are centralized in
`src/domain/content/catalog.ts`.

## Publishing guarantees

1. Main questions are saved independently and remain editable.
2. Tournament mirrors are prepared from saved content and published separately.
3. The server validates tournament type, indices, source path and schema.
4. Level bundles are immutable Storage artifacts with a SHA-256 checksum; only
   their manifest is merged into the Firestore level document.
