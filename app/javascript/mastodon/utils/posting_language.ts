import { languages } from '../initial_state';

export function postingLanguageForLocale(locale: string) {
  const normalized = locale.replaceAll('_', '-');
  const primary = normalized.split('-')[0] ?? 'en';
  if (!languages) return normalized;
  return (
    languages.find(
      ([code]) => code.toLowerCase() === normalized.toLowerCase(),
    )?.[0] ??
    languages.find(([code]) => code === primary)?.[0] ??
    'en'
  );
}
