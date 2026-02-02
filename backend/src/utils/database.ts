/**
 * Database Configuration
 * PostgreSQL connection pool with error handling
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from './logger';

// Database configuration from environment
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'kidcoord',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '5000'),
};

// Create connection pool
export const pool = new Pool(config);

// Test connection on startup
pool.on('connect', () => {
  logger.info('Database connection established');
});

pool.on('error', (err) => {
  logger.error('Unexpected database error', { error: err.message });
});

/**
 * Execute a query with automatic error handling
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Executed query', {
      text: text.substring(0, 100),
      duration,
      rows: result.rowCount,
    });
    
    return result;
  } catch (error: any) {
    logger.error('Database query error', {
      error: error.message,
      query: text.substring(0, 100),
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

/**
 * Execute a function within a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW()');
    logger.info('Database connection test successful');
    return true;
  } catch (error: any) {
    logger.error('Database connection test failed', { error: error.message });
    return false;
  }
}

/**
 * Close all connections
 */
export async function closePool(): Promise<void> {
  await pool.end();
  logger.info('Database connection pool closed');
}

/**
 * Helper: Generate ID with prefix
 */
export function generateId(prefix: string): string {
  const { v4: uuidv4 } = require('uuid');
  return `${prefix}_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
}

/**
 * Helper: Hash sensitive data (phone, email)
 */
export function hashSensitiveData(data: string): string {
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(data.toLowerCase().trim())
    .digest('hex');
}
