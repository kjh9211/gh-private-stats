const { CacheStack, MemoryLayer, RedisLayer } = require("layercache");
const Redis = require("ioredis");

// ─── Redis client (ioredis) ───────────────────────────────────────────────────

const STATS_TTL = parseInt(process.env.CACHE_TTL_SECONDS || "300"); // seconds
const MEM_TTL   = Math.min(60, STATS_TTL);                           // L1 TTL

let redisClient = null;
let cacheStack  = null;

function buildStack() {
  if (cacheStack) return cacheStack;

  const layers = [
    new MemoryLayer({
      name: "memory",
      ttl: MEM_TTL * 1000, // MemoryLayer uses milliseconds
    }),
  ];

  if (redisClient) {
    layers.push(
      new RedisLayer({
        name: "redis",
        client: redisClient,
        ttl: STATS_TTL, // RedisLayer uses seconds
      })
    );
  }

  cacheStack = new CacheStack(layers);
  return cacheStack;
}

// Attempt Redis connection. If it fails we degrade to memory-only cache.
try {
  redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    enableOfflineQueue: false,
    lazyConnect: true,
    connectTimeout: 3000,
    maxRetriesPerRequest: 1,
  });

  redisClient.on("ready", () => {
    console.log("Redis connected.");
    // Rebuild stack now that Redis is ready
    cacheStack = null;
  });

  redisClient.on("error", (err) => {
    if (!err.message.includes("ECONNREFUSED")) {
      console.warn("Redis error:", err.message);
    }
  });

  redisClient.connect().catch(() => {
    console.warn("Redis unavailable — falling back to memory-only cache.");
    redisClient = null;
    cacheStack = null;
  });
} catch {
  redisClient = null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get cached language stats for a user, or compute them via fetchFn on miss.
 *
 * Uses layercache CacheStack: L1=Memory, L2=Redis (if available).
 * On a hit, the value is automatically promoted to any cold layers.
 *
 * @param {number} userId
 * @param {() => Promise<object>} fetchFn  Called on cache miss
 */
async function getOrFetch(userId, fetchFn) {
  const key   = `user:${userId}:stats`;
  const stack = buildStack();
  return stack.getOrSet(key, fetchFn, { ttl: STATS_TTL });
}

/**
 * Invalidate the stats cache for a user (e.g. after re-auth).
 */
async function invalidate(userId) {
  const key   = `user:${userId}:stats`;
  const stack = buildStack();
  await stack.delete(key).catch(() => {});
}

module.exports = { getOrFetch, invalidate };
