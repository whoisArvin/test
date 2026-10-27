export function required(name: string) {
  const value = process.env[name];
  if (!value || value.includes('CHANGE_ME') || value.startsWith('GENERATE_'))
    throw new Error(`Missing configuration: ${name}`);
  return value;
}
export function demoOnly() {
  if (required('PROVIDER_MODE') !== 'DEMO')
    throw new Error('No contractual live adapters configured. Refusing live operations.');
}
export function appUrl() {
  const url = new URL(required('APP_URL'));
  if (
    process.env.NODE_ENV === 'production' &&
    !['localhost', '127.0.0.1'].includes(url.hostname) &&
    url.protocol !== 'https:'
  )
    throw new Error('HTTPS APP_URL required for non-loopback production deployments.');
  return url;
}

export function redisNamespace() {
  return (
    process.env.REDIS_NAMESPACE || `berjis:${new URL(required('DATABASE_URL')).pathname.slice(1)}`
  );
}
