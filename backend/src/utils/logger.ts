import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.logLevel,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  redact: ['req.headers.authorization', 'password', 'token'],
});
