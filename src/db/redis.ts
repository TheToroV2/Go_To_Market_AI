import { createClient } from 'redis';
import { config } from '../config/config';

export const redis = createClient({
  url: config.redisUrl,
});

redis.on('error', (err) => console.error('Redis Client Error', err));

redis.connect().catch(console.error);