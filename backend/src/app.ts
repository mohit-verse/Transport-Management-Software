import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger';
import { errorHandler } from './errors/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';

export const app = express();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(pinoHttp({ logger, autoLogging: false })); // customize as needed for prod

// Rate limiting foundation
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

import { partiesRouter } from './modules/parties/parties.routes';
import { ownersRouter } from './modules/vehicle-owners/owners.routes';
import { mvRouter } from './modules/market-vehicles/mv.routes';
import { ofRouter } from './modules/own-fleet/of.routes';
import { tripsRouter } from './modules/trips/trips.routes';
import { documentsRouter } from './modules/documents/documents.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { billsRouter } from './modules/bills/bills.routes';
import { reportsRouter } from './modules/reports/reports.routes';

// Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/parties', partiesRouter);
app.use('/api/vehicle-owners', ownersRouter);
app.use('/api/market-vehicles', mvRouter);
app.use('/api/own-fleet', ofRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/bills', billsRouter);
app.use('/api/reports', reportsRouter);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource could not be found.',
    },
  });
});

// Centralized error handler
app.use(errorHandler);
