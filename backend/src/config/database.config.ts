import { DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config();

// Helper function to get Windows host IP in WSL2
function getWindowsHostIP(): string {
  // In WSL2, host.docker.internal resolves to Windows host
  // But for direct connection, we need to handle it differently
  
  // Check if we're in WSL2
  const isWSL = process.env.WSL_DISTRO_NAME ?? process.env.WSL_INTEROP;
  
  if (isWSL) {
    // In WSL2, we can use host.docker.internal or get the actual IP
    const fs = require('fs') as typeof import('fs');
    try {
      // Try to read the Windows host IP from /etc/resolv.conf
      const resolv = fs.readFileSync('/etc/resolv.conf', 'utf8');
      const match = resolv.match(/nameserver\s+(\d+\.\d+\.\d+\.\d+)/);
      if (match?.[1]) {
        console.log(`🔗 WSL2 detected, using Windows host IP: ${match[1]}`);
        return match[1];
      }
    } catch (error) {
      console.log('⚠️ Could not detect Windows host IP, using fallback');
    }
  }
  
  // Fallback to environment variable or localhost
  return process.env.DATABASE_HOST ?? 'localhost';
}

const databaseHost = getWindowsHostIP();

export const databaseConfig: DataSourceOptions = {
  type: 'postgres',
  host: databaseHost,
  port: parseInt(process.env.DATABASE_PORT ?? '5432'),
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? '@abcd1234',
  database: process.env.DATABASE_NAME ?? 'postgres',
  entities: [path.join(__dirname, '../modules/**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '../migrations/*{.ts,.js}')],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  poolSize: 10,
  connectTimeoutMS: 10000,
  extra: {
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  }
};

// Log connection info (hide password)
console.log('📦 Database Configuration:', {
  host: databaseHost,
  port: databaseConfig.port,
  database: databaseConfig.database,
  user: databaseConfig.username,
  ssl: !!databaseConfig.ssl,
  environment: process.env.NODE_ENV
});