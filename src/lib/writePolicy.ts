export function localReadOnly(hostname: string, development: boolean): boolean {
  return development || ['localhost', '127.0.0.1', '[::1]', '::1', ''].includes(hostname.toLowerCase());
}

export function isLocalReadOnly(): boolean {
  return localReadOnly(globalThis.location?.hostname ?? '', Boolean((import.meta as any).env?.DEV));
}

export function assertRemoteWriteAllowed(): void {
  if (isLocalReadOnly()) throw new Error('Локальний конструктор працює без запису в БД. Експортуйте JSON і використайте менеджер в AI Studio для публікації.');
}
