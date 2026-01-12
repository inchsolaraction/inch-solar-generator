// Diagnostic endpoint to check Redis duplicate tracking
// Add this as: api/check-redis.js

const redis = require('redis');

let redisClient = null;

async function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      throw new Error('REDIS_URL not configured');
    }
    
    redisClient = redis.createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 3) return new Error('Max retries');
          return Math.min(retries * 100, 3000);
        }
      }
    });
    
    redisClient.on('error', (err) => console.error('Redis Error:', err));
    await redisClient.connect();
  }
  
  return redisClient;
}

module.exports = async (req, res) => {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = await getRedisClient();
    
    // Get all submission keys
    const submissionKeys = await client.keys('submission:*');
    const quickKeys = await client.keys('quick:*');
    const backupKeys = await client.keys('backup:*');
    
    // Get details for submission keys
    const submissions = [];
    for (const key of submissionKeys.slice(0, 50)) { // Limit to 50
      const value = await client.get(key);
      const ttl = await client.ttl(key);
      submissions.push({
        key: key,
        timestamp: value ? new Date(parseInt(value)).toISOString() : null,
        expiresIn: ttl > 0 ? `${Math.floor(ttl / 3600)} hours` : 'expired'
      });
    }
    
    // Get quick check keys
    const quickChecks = [];
    for (const key of quickKeys.slice(0, 20)) {
      const value = await client.get(key);
      const ttl = await client.ttl(key);
      quickChecks.push({
        key: key.replace('quick:', ''),
        timestamp: value ? new Date(parseInt(value)).toISOString() : null,
        expiresIn: ttl > 0 ? `${ttl} seconds` : 'expired'
      });
    }
    
    return res.status(200).json({
      status: 'ok',
      redis_connected: true,
      stats: {
        total_submissions: submissionKeys.length,
        total_quick_checks: quickKeys.length,
        total_backups: backupKeys.length
      },
      recent_submissions: submissions.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      ).slice(0, 20),
      active_quick_checks: quickChecks.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      )
    });
    
  } catch (error) {
    console.error('Redis diagnostic error:', error);
    return res.status(500).json({
      error: error.message,
      redis_connected: false
    });
  }
};
