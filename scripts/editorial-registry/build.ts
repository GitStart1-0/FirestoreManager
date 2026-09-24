import {promises as fs} from 'node:fs';
import path from 'node:path';
import {uniqueStrings} from '../../src/editorialRegistry/normalize';
import {RegistrySnapshot, RegistrySourceKind, RegistryUsage} from '../../src/editorialRegistry/types';

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const mythosRoot = path.resolve(option('--mythos', 'D:/NoesisInfo/КОНТЕНТ/ВІКТОРИНИ/Ерудит'));
const externalRoot = path.resolve(option('--external', 'content-registry/external'));
const output = path.resolve(option('--output', 'content-registry/generated/registry.json'));

async function filesUnder(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, {withFileTypes: true});
    const nested = await Promise.all(entries.map(async entry => {
      const full = path.join(root, entry.name);
      if (entry.isDirectory()) {
        if (/^(backups?|archive|tmp)$/i.test(entry.name)) return [];
        return filesUnder(full);
      }
      return [full];
    }));
    return nested.flat();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function readJsonDocuments(file: string): Promise<unknown[]> {
  const bytes = await fs.readFile(file);
  if (bytes.subarray(0, 2).toString('hex') === '504b') return [];
  const text = bytes.toString('utf8').trim();
  if (!text || (!text.startsWith('{') && !text.startsWith('['))) return [];
  try {
    return [JSON.parse(text)];
  } catch {
    const lines = text.split(/\r?\n/).filter(Boolean);
    try {
      return lines.map(line => JSON.parse(line));
    } catch {
      console.warn(`Skipped invalid JSON: ${file}`);
      return [];
    }
  }
}

function questionArray(document: any): any[] {
  if (Array.isArray(document)) return document;
  if (Array.isArray(document?.questions)) return document.questions;
  if (Array.isArray(document?.items)) return document.items;
  if (typeof document?.question === 'string' || typeof document?.question?.stem === 'string' || typeof document?.input === 'string') {
    return [document];
  }
  return [];
}

function correctAnswers(question: any): string[] {
  const options = question.answers ?? question.options ?? question.choices?.text ?? [];
  if (!Array.isArray(options)) return [];
  const indices = question.correctAnswerIndices ??
    (Number.isInteger(question.correctOptionIndex) ? [question.correctOptionIndex] : []);
  return Array.isArray(indices)
    ? indices.map((index: number) => typeof options[index] === 'string' ? options[index] : options[index]?.text)
    : [];
}

function mythosUsage(question: any, file: string, index: number): RegistryUsage {
  const editorial = question.editorial ?? {};
  const terms = uniqueStrings([
    ...(question.topics ?? []),
    question.topic,
    question.title,
    question.blockName,
    question.blockTitle,
    editorial.conceptName,
    ...correctAnswers(question),
  ]);
  return {
    source: 'MYTHOS',
    sourceId: String(question.id ?? question.docId ?? `${path.basename(file)}:${index + 1}`),
    level: String(question.level ?? question.levelNumber ?? question.levelTitle ?? ''),
    questionId: String(question.id ?? question.docId ?? index + 1),
    title: question.title,
    question: question.question ?? question.stem,
    explanation: question.explanation,
    terms,
    disciplines: uniqueStrings(question.scientificDisciplines ?? question.disciplines ?? []),
    conceptId: editorial.conceptId ?? question.conceptId,
    claimKey: editorial.claimKey ?? question.claimKey,
    sourceFile: path.relative(mythosRoot, file).replaceAll('\\', '/'),
  };
}

function externalUsage(record: any, file: string, index: number, source: RegistrySourceKind): RegistryUsage {
  const choices = record.choices?.text ?? record.question?.choices ?? record.options ?? [];
  const answer = record.answer ?? record.answerKey ?? record.correct_answer;
  const resolvedAnswer = typeof answer === 'number' ? choices[answer] : answer;
  return {
    source,
    sourceId: String(record.id ?? `${path.basename(file)}:${index + 1}`),
    question: typeof record.question === 'string' ? record.question : record.question?.stem ?? record.input,
    explanation: record.explanation ?? record.fact1 ?? record.fact2,
    terms: uniqueStrings([
      record.concept,
      record.subject,
      record.topic,
      record.category,
      resolvedAnswer,
      ...(record.terms ?? []),
    ]),
    disciplines: uniqueStrings([record.subject, record.category, ...(record.disciplines ?? [])]),
    sourceFile: path.relative(externalRoot, file).replaceAll('\\', '/'),
  };
}

function sourceFromPath(file: string): RegistrySourceKind {
  const name = file.toUpperCase();
  if (name.includes('OPENBOOK')) return 'OPENBOOK_QA';
  if (name.includes('MMLU')) return 'MMLU';
  if (name.includes('QASC')) return 'QASC';
  if (name.includes('ARC')) return 'ARC';
  return 'GENERIC';
}

async function main() {
  const usages: RegistryUsage[] = [];
  for (const file of await filesUnder(mythosRoot)) {
    for (const document of await readJsonDocuments(file)) {
      questionArray(document).forEach((question, index) => usages.push(mythosUsage(question, file, index)));
    }
  }
  for (const file of await filesUnder(externalRoot)) {
    const source = sourceFromPath(file);
    for (const document of await readJsonDocuments(file)) {
      questionArray(document).forEach((record, index) => usages.push(externalUsage(record, file, index, source)));
    }
  }

  const counts = new Map<RegistrySourceKind, number>();
  usages.forEach(usage => counts.set(usage.source, (counts.get(usage.source) ?? 0) + 1));
  const snapshot: RegistrySnapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sources: [...counts].map(([source, records]) => ({source, records})),
    usages,
  };
  await fs.mkdir(path.dirname(output), {recursive: true});
  await fs.writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${usages.length} searchable records to ${output}`);
}

await main();
