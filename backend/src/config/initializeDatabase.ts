import { UserModel } from '../models/User';
import { executeQuery } from './database';

/**
 * Initialize database with default data
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    console.log('🔄 Initializing database...');
    
    // Check if admin user exists
    const adminUser = await UserModel.findByUsername('mti.admin');
    
    if (!adminUser) {
      console.log('👤 Creating default admin user...');
      
      // Create admin user
      await UserModel.create({
        Username: 'mti.admin',
        Email: 'admin@mti.com',
        Password: 'admin123',
        FirstName: 'MTI',
        LastName: 'Administrator',
        Role: 'admin',
        Department: 'IT'
      });
      
      console.log('✅ Default admin user created:');
      console.log('   Username: mti.admin');
      console.log('   Password: admin123');
      console.log('   Role: Admin');
    } else {
      console.log('✅ Admin user already exists');
    }
    
    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

/**
 * Ensure required tables exist
 */
export const ensureTablesExist = async (): Promise<void> => {
  try {
    // Check if Users table exists, if not create it
    const checkTableQuery = `
      SELECT COUNT(*) as TableCount
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'Users'
    `;
    
    const result = await executeQuery<{ TableCount: number }>(checkTableQuery);
    const tableExists = result.recordset[0]?.TableCount > 0;
    
    if (!tableExists) {
      console.log('📋 Creating Users table...');
      
      const createTableQuery = `
        CREATE TABLE Users (
          UserID int IDENTITY(1,1) PRIMARY KEY,
          Username nvarchar(50) UNIQUE NOT NULL,
          Email nvarchar(100),
          PasswordHash nvarchar(255) NOT NULL,
          FirstName nvarchar(50),
          LastName nvarchar(50),
          Role nvarchar(20) DEFAULT 'User',
          Department nvarchar(50),
          IsActive bit DEFAULT 1,
          CreatedAt datetime2 DEFAULT GETDATE(),
          UpdatedAt datetime2 DEFAULT GETDATE(),
          LastLogin datetime2
        )
      `;
      
      await executeQuery(createTableQuery);
      console.log('✅ Users table created');
    }

    const checkSettingsTable = `
      SELECT COUNT(*) as TableCount
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'AppSettings'
    `;
    const settingsResult = await executeQuery<{ TableCount: number }>(checkSettingsTable);
    const settingsTableExists = settingsResult.recordset[0]?.TableCount > 0;
    if (!settingsTableExists) {
      console.log('📋 Creating AppSettings table...');
      const createSettingsQuery = `
        CREATE TABLE AppSettings (
          SettingsID INT IDENTITY(1,1) PRIMARY KEY,
          Provider NVARCHAR(20) NOT NULL CHECK (Provider IN ('gemini','openai')),
          GeminiApiKeyEnc NVARCHAR(MAX) NULL,
          OpenAIApiKeyEnc NVARCHAR(MAX) NULL,
          Enabled BIT NOT NULL DEFAULT 0,
          Model NVARCHAR(100) NULL,
          SharedFolderPath NVARCHAR(500) NULL,
          UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
        )
      `;
      await executeQuery(createSettingsQuery);
      console.log('✅ AppSettings table created');
    }

    const checkSettingsRow = `SELECT COUNT(*) AS Count FROM AppSettings`;
    const settingsCount = await executeQuery<{ Count: number }>(checkSettingsRow);
    const hasSettingsRow = (settingsCount.recordset[0]?.Count || 0) > 0;
    if (!hasSettingsRow) {
      console.log('🌱 Seeding default AppSettings row...');
      const insertDefault = `
        INSERT INTO AppSettings (Provider, GeminiApiKeyEnc, OpenAIApiKeyEnc, Enabled, Model, SharedFolderPath)
        VALUES (@Provider, NULL, NULL, @Enabled, @Model, NULL)
      `;
      await executeQuery(insertDefault, {
        Provider: 'gemini',
        Enabled: 0,
        Model: 'gemini-1.5-flash'
      });
      console.log('✅ Default AppSettings row inserted');
    }
  } catch (error) {
    console.error('❌ Table creation failed:', error);
    throw error;
  }
};
