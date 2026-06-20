import Redis from 'ioredis';

let sharedConnection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (sharedConnection) return sharedConnection;
  sharedConnection = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  return sharedConnection;
}
