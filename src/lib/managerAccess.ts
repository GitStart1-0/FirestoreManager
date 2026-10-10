import { Auth } from 'firebase/auth';
import { getToken } from 'firebase/app-check';
import { managerAppChecks } from './appCheckRegistry';

export async function prepareManagerCall(auth: Auth): Promise<void> {
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error('Увійдіть через Google Login для вибраного Firebase-проєкту.');
  await auth.currentUser.getIdToken();
  const check = managerAppChecks.get(auth.app.name);
  if (!check) throw new Error('App Check не налаштовано для цього підключення. Додайте appCheckSiteKey до Firebase-конфігурації менеджера та зареєструйте домен прев’ю.');
  try { await getToken(check); }
  catch { throw new Error('Не вдалося підтвердити App Check. Перевірте ключ reCAPTCHA Enterprise і дозвіл для домену прев’ю.'); }
}
