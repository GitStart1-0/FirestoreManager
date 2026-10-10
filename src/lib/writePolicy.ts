export function localReadOnly(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ['localhost', '127.0.0.1', '[::1]', '::1', ''].includes(host)
    || host.endsWith('.localhost') || host.endsWith('.local')
    || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}

export function isLocalReadOnly(): boolean {
  return localReadOnly(globalThis.location?.hostname ?? '');
}

export function assertRemoteWriteAllowed(): void {
  if (isLocalReadOnly()) throw new Error('Локальний конструктор працює без запису в БД. Експортуйте JSON і використайте менеджер в AI Studio для публікації.');
}
