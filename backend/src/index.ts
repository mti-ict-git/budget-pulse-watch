import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { connectDatabase } from './config/database';
import prfRoutes from './routes/prfRoutes';
import budgetRoutes from './routes/budgetRoutes';
import coaRoutes from './routes/coaRoutes';
import importRoutes from './routes/importRoutes';
import settingsRoutes from './routes/settingsRoutes';
import uploadRoutes from './routes/uploadRoutes';
import ocrPrfRoutes from './routes/ocrPrfRoutes';
import prfFilesRoutes from './routes/prfFilesRoutes';
import cloudSyncRoutes from './routes/cloudSyncRoutes';
import prfDocumentsRoutes from './routes/prfDocumentsRoutes';
import authRoutes from './routes/auth';
import ldapUsersRoutes from './routes/ldapUsers';
import usersRoutes from './routes/users';
import reportsRoutes from './routes/reports';
import { initializeDatabase, ensureTablesExist } from './config/initializeDatabase';
// TODO: Add error handling middleware later

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

const envCorsOrigins = (process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

const allowedCorsOrigins = new Set<string>([
  ...envCorsOrigins,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'https://pomon.merdekabattery.com:9007',
  'capacitor://localhost'
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedCorsOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: process.env.CORS_CREDENTIALS === 'true' || true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
  })
);
app.use(morgan('combined'));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const docsDirCandidates = [
  path.resolve(__dirname, '../../docs'),
  path.resolve(__dirname, '../../../docs')
];
const docsDir =
  docsDirCandidates.find((dir) => fs.existsSync(path.join(dir, 'openapi.yaml'))) ??
  docsDirCandidates.find((dir) => fs.existsSync(dir)) ??
  docsDirCandidates[0];

app.get('/api/docs/openapi.yaml', (req, res) => {
  const openApiPath = path.join(docsDir, 'openapi.yaml');
  if (!fs.existsSync(openApiPath)) {
    return res.status(404).json({ success: false, message: 'OpenAPI spec not found' });
  }

  res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
  return res.sendFile(openApiPath);
});

app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    customSiteTitle: 'Budget Pulse Watch API Docs',
    swaggerOptions: {
      url: '/api/docs/openapi.yaml',
      docExpansion: 'list',
      displayRequestDuration: true
    }
  })
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'PRF Monitoring API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/prfs', prfRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/coa', coaRoutes);
app.use('/api/import', importRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ocr-prf', ocrPrfRoutes);
app.use('/api/prf-files', prfFilesRoutes);
app.use('/api/prf-documents', prfDocumentsRoutes);
app.use('/api/cloud-sync', cloudSyncRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/ldap-users', ldapUsersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);

// Basic error handling
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected successfully');
    
    // Ensure tables exist and initialize database
    await ensureTablesExist();
    await initializeDatabase();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 API Health Check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
