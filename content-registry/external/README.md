# External dataset snapshots

Place legally obtained JSON or JSONL snapshots here. The registry builder reads
them locally; it does not contact third-party services and never connects to
production Firestore.

Recognized source names in a file or directory path: `MMLU`, `ARC`,
`OpenBookQA`, and `QASC`. Generic records are also accepted. Useful fields are:

```json
{
  "id": "source-record-id",
  "question": "Question text",
  "subject": "physics",
  "concept": "thermal conductivity",
  "terms": ["heat transfer"],
  "answer": "thermal conductivity"
}
```

Raw snapshots should not be committed unless their license permits it.
