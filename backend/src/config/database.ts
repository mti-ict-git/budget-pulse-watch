import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const dbConfig: sql.config = {
  server: process.env.DB_SERVER || '10.60.10.47',
  database: process.env.DB_NAME || 'PRFMonitoringDB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
    enableArithAbort: true,
    requestTimeout: 30000,
    connectTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Global connection pool
let pool: sql.ConnectionPool | null = null;

/**
 * Connect to MS SQL Server database
 */
export const connectDatabase = async (): Promise<sql.ConnectionPool> => {
  try {
    if (pool && pool.connected) {
      return pool;
    }

    pool = new sql.ConnectionPool(dbConfig);
    await pool.connect();
    
    console.log('✅ Connected to MS SQL Server database:', process.env.DB_NAME);
    return pool;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

/**
 * Get database connection pool
 */
export const getPool = (): sql.ConnectionPool => {
  if (!pool || !pool.connected) {
    throw new Error('Database not connected. Call connectDatabase() first.');
  }
  return pool;
};

/**
 * Close database connection
 */
export const closeDatabase = async (): Promise<void> => {
  try {
    if (pool && pool.connected) {
      await pool.close();
      pool = null;
      console.log('✅ Database connection closed');
    }
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
    throw error;
  }
};

/**
 * Execute a SQL query
 */
export const executeQuery = async <T = unknown>(
  query: string,
  params?: { [key: string]: unknown }
): Promise<sql.IResult<T>> => {
  try {
    const currentPool = getPool();
    const request = currentPool.request();
    
    // Add parameters if provided
    if (params) {
      Object.keys(params).forEach(key => {
        request.input(key, params[key]);
      });
    }
    
    const result = await request.query<T>(query);
    return result;
  } catch (error) {
    console.error('❌ Query execution failed:', error);
    throw error;
  }
};

/**
 * Execute a stored procedure
 */
export const executeStoredProcedure = async <T = unknown>(
  procedureName: string,
  params?: { [key: string]: unknown }
): Promise<sql.IResult<T>> => {
  try {
    const currentPool = getPool();
    const request = currentPool.request();
    
    // Add parameters if provided
    if (params) {
      Object.keys(params).forEach(key => {
        request.input(key, params[key]);
      });
    }
    
    const result = await request.execute<T>(procedureName);
    return result;
  } catch (error) {
    console.error('❌ Stored procedure execution failed:', error);
    throw error;
  }
};

export default { connectDatabase, getPool, closeDatabase, executeQuery, executeStoredProcedure };