import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Auth, onAuthStateChanged } from 'firebase/auth';
import { Firestore, collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { CONTENT_CATEGORIES, CONTENT_LANGUAGES } from '../../domain/content/catalog';

export default function TournamentEventsPanel({ auth, db }: { auth?: Auth; db?: Firestore }) {
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [mode, setMode] = useState('SURVIVAL');
  const [language, setLanguage] = useState('ua');
  const [category, setCategory] = useState('culture');
  const [count, setCount] = useState(20);
  const [start, setStart] = useState('');
  const [close, setClose] = useState('');
  const retry = useRef<{ fingerprint: string; requestId: string }>();
  useEffect(() => {
    if (!auth || !db) return;
    let stop: (() => void) | undefined;
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, user => {
      const current = ++generation;
      stop?.(); setAllowed(false); setEvents([]); setError('');
      if (!user) return;
      stop = onSnapshot(query(collection(db, 'tournamentEvents'), where('schemaVersion', '==', 1), orderBy('createdAt', 'desc'), limit(50)), snapshot => setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), e => setError(e.message));
      httpsCallable<any, { canCreate: boolean }>(getFunctions(auth.app), 'getTournamentEventAccess')({}).then(result => { if (current === generation) setAllowed(result.data.canCreate); }).catch(e => { if (current === generation) setError(e.message); });
    });
    return () => { generation++; stop?.(); unsubscribe(); };
  }, [auth, db]);
  async function create(e: FormEvent) {
    e.preventDefault(); if (!auth || busy || !allowed) return;
    const payload = { name: name.trim(), mode, language, categories: [category], questionCount: mode === 'SURVIVAL' ? 50 : count, scheduledStartTimeMs: new Date(start).getTime(), registrationClosesAtMs: new Date(close).getTime() };
    if (!Number.isFinite(payload.scheduledStartTimeMs) || !Number.isFinite(payload.registrationClosesAtMs) || payload.registrationClosesAtMs < Date.now() + 60000 || payload.scheduledStartTimeMs < payload.registrationClosesAtMs + 120000) { setError('Закрийте реєстрацію щонайменше через хвилину, а старт призначте мінімум через дві хвилини після її закриття.'); return; }
    const fingerprint = JSON.stringify(payload);
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, requestId: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      await httpsCallable(getFunctions(auth.app), 'createTournamentEvent')({ ...payload, requestId: retry.current.requestId });
      setName(''); retry.current = undefined;
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const field = 'border rounded-lg p-2 w-full bg-white';
  return <section className="max-w-4xl space-y-4">
    <h2 className="text-xl font-bold">Офіційні турнірні події</h2>
    <p>Реєстрація відкрита для всіх до дедлайну. Сервер розподіляє учасників на кімнати з однаковими питаннями й формує спільний рейтинг. Survival: 10 гравців у кімнаті, 50 раундів, спільні місця при нічиїй. Classic: до 100 гравців.</p>
    {!auth?.currentUser ? <p>Виберіть Firebase-проєкт і увійдіть через Google Login.</p> : !allowed && <p>Для створення потрібне право tournamentEvents у constructorAccess вашого UID або право адміністратора. Публікація питань сама по собі цього права не надає.</p>}
    {error && <p role="alert" className="text-red-700 whitespace-pre-wrap">{error}</p>}
    <form onSubmit={create} className="grid sm:grid-cols-2 gap-3 border rounded-xl p-4">
      <label>Назва<input required maxLength={80} className={field} value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Режим<select className={field} value={mode} onChange={e => setMode(e.target.value)}><option>SURVIVAL</option><option>CLASSIC</option></select></label>
      <label>Мова<select className={field} value={language} onChange={e => setLanguage(e.target.value)}>{CONTENT_LANGUAGES.map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Категорія<select className={field} value={category} onChange={e => setCategory(e.target.value)}>{CONTENT_CATEGORIES.map(v => <option key={v}>{v}</option>)}</select></label>
      <label>Закриття реєстрації (місцевий час)<input required type="datetime-local" className={field} value={close} onChange={e => setClose(e.target.value)} /></label>
      <label>Старт (місцевий час)<input required type="datetime-local" className={field} value={start} onChange={e => setStart(e.target.value)} /></label>
      {mode === 'CLASSIC' && <label>Кількість питань<input type="number" min={1} max={50} className={field} value={count} onChange={e => setCount(Number(e.target.value))} /></label>}
      <button disabled={!allowed || busy} className="rounded-lg bg-amber-400 p-3 disabled:opacity-40">{busy ? 'Підготовка питань…' : 'Створити й відкрити реєстрацію'}</button>
    </form>
    <p className="text-sm">Останні 50 подій. Набір питань готується сервером перед відкриттям реєстрації.</p>
    {events.map(event => <article key={event.id} className="border rounded-xl p-4 space-y-1"><h3 className="font-bold">{event.name}</h3><p>{event.mode} · {event.language} · {event.status}</p><p>Старт: {event.scheduledStartTime?.toDate().toLocaleString()} · Учасників після закриття: {event.registrationCount ?? 'реєстрація триває'} · Кімнат: {event.roomCount ?? 'ще не розподілено'}</p><p className="text-xs break-all">tournamentEvents/{event.id}</p></article>)}
  </section>;
}
