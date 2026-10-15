import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger';
import { errorHandler } from './errors/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';

import { config } from './config';

export const app = express();

// Security middleware
app.use(helmet());

const allowedOrigins = config.corsOrigin === '*'
  ? '*'
  : config.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  })
);
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
import dashboardRouter from './modules/dashboard/dashboard.routes';
import searchRouter from './modules/search/search.routes';
import { otherBusinessRouter } from './modules/other-business/other-business.routes';
import { financialYearsRouter } from './modules/financial-years/financial-years.routes';
import { dynamicFieldsRouter } from './modules/bill-templates/dynamic-fields.routes';
import { billTemplatesRouter } from './modules/bill-templates/bill-templates.routes';
import { numberingSeriesRouter } from './modules/numbering-series/numbering-series.routes';

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
app.use('/api/financial-years', financialYearsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/search', searchRouter);
app.use('/api/other-business-categories', otherBusinessRouter);
app.use('/api/dynamic-fields', dynamicFieldsRouter);
app.use('/api/bill-templates', billTemplatesRouter);
app.use('/api/numbering-series', numberingSeriesRouter);

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
