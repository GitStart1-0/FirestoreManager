import defaults from './managerAppCheckConfig.json';

export function managerAppCheckSiteKey(appId: string, hostname: string, configuredKey?: string): string | undefined {
  if (configuredKey?.trim()) return configuredKey.trim();
  return appId === defaults.appId && defaults.allowedDomains.includes(hostname.toLowerCase()) ? defaults.siteKey : undefined;
}
