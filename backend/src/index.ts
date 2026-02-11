import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
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
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: process.env.CORS_CREDENTIALS === 'true' || true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// API Docs (Redoc + static OpenAPI YAML)
app.get('/api/docs', (req, res) => {
  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Budget Pulse Watch API Docs</title>
      <style>body{margin:0;padding:0} .container{height:100vh}</style>
    </head>
    <body>
      <redoc class="container" spec-url="/api/docs/openapi.yaml"></redoc>
      <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
    </body>
  </html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.use('/api/docs', express.static(path.resolve(__dirname, '../../docs')));

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
