const { CacheStack, MemoryLayer, RedisLayer } = require("layercache");
const Redis = require("ioredis");

const STATS_TTL = parseInt(process.env.CACHE_TTL_SECONDS || "300"); // seconds
const MEM_TTL = Math.min(60, STATS_TTL) * 1000;                     // MemoryLayer uses ms

let redisClient = null;
let _stack = null;

// Build (or reuse) the layered cache stack.
// Layers: L1=Memory (fast, local) → L2=Redis (shared, if available).
function getStack() {
  if (_stack) return _stack;

  const layers = [new MemoryLayer({ name: "memory", ttl: MEM_TTL })];

  if (redisClient && redisClient.status === "ready") {
    layers.push(new RedisLayer({ name: "redis", client: redisClient, ttl: STATS_TTL }));
  }

  _stack = new CacheStack(layers);
  return _stack;
}

// Initialize Redis when REDIS_URL is provided.
// On failure we silently degrade to memory-only cache.
if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    redisClient.on("ready", () => {
      console.log("Redis connected.");
      _stack = null; // force stack rebuild to include Redis layer
    });

    redisClient.on("error", (err) => {
      // Suppress noisy ECONNREFUSED logs; still log other errors
      if (!err.message.includes("ECONNREFUSED")) {
        console.warn("Redis error:", err.message);
      }
    });
  } catch (err) {
    console.warn("Redis init failed:", err.message);
    redisClient = null;
  }
}

/**
 * Return cached stats for a user, computing them via fetchFn on a cache miss.
 *
 * layercache.getOrSet:
 *   1. Checks each layer in order (Memory → Redis).
 *   2. On miss, calls fetchFn and writes the result to all layers.
 *
 * @param {number} userId
 * @param {() => Promise<any>} fetchFn  Called only on a full cache miss.
 */
async function getOrFetch(userId, fetchFn) {
  const key = `user:${userId}:stats`;
  return getStack().getOrSet(key, fetchFn, { ttl: STATS_TTL });
}

/**
 * Invalidate cached stats for a user (e.g. after re-authentication).
 */
async function invalidate(userId) {
  const key = `user:${userId}:stats`;
  await getStack().delete(key).catch(() => {});
}

module.exports = { getOrFetch, invalidate };
