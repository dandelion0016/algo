export function getAppVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION || 'v0.0.0-dev';
}
