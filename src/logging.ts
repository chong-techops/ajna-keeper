import { createLogger, transports, LogEntry, Logger, format } from 'winston';
import Transport, { TransportStreamOptions } from 'winston-transport';

// FIXME: this always writes a log folder in the module location, which is not always desirable
const LOGS_FOLDER = 'logs';

// Define alert severity levels for Grafana filtering
export enum AlertSeverity {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

class CustomConsoleTransport extends Transport {
  constructor(opts: TransportStreamOptions) {
    super(opts);
  }

  log(entry: LogEntry, callback: any) {
    const { level, message, timestamp, ...meta } = entry;
    if (level === 'error') {
      console.error(`${timestamp} [${level}]: ${message}`);
    } else {
      console.log(`${timestamp} [${level}]: ${message}`);
    }
    callback();
  }
}

function createCustomLogger(logLevel: string = 'debug'): Logger {
  // Simpler timestamp format
  const timestampFormat = format.timestamp({
    format: () => {
      const now = new Date();
      return now.toISOString().replace('T', ' ').slice(0, 19); // Simple YYYY-MM-DD HH:MM:SS
    }
  });

  // For file logging, we can use a custom format that makes the timestamp appear first
  const fileFormat = format.printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
  });
  
  return createLogger({
    level: logLevel,
    format: format.combine(
      timestampFormat,
      format((info) => {
        const levels = ['error', 'info', 'debug'];
        const globalLevelIndex = levels.indexOf(logLevel);
        const logLevelIndex = levels.indexOf(info.level);
        return logLevelIndex <= globalLevelIndex ? info : false;
      })()
    ),
    defaultMeta: { 
      service: 'ajna-keeper',
    },
    transports: [
      new CustomConsoleTransport({ level: logLevel }),
      new transports.File({
        filename: `${LOGS_FOLDER}/debug.log`,
        level: 'debug',
        options: { mode: 0o600 },
        format: format.combine(
          timestampFormat,
          fileFormat  // Use our custom format for files
        )
      }),
      new transports.File({
        filename: `${LOGS_FOLDER}/info.log`,
        level: 'info',
        format: format.combine(
          timestampFormat,
          format((info) => (info.level === 'info' ? info : false))(),
          fileFormat  // Use our custom format for files
        ),
        options: { mode: 0o600 },
      }),
      new transports.File({
        filename: `${LOGS_FOLDER}/error.log`,
        level: 'error',
        format: format.combine(
          timestampFormat,
          format((info) => (info.level === 'error' ? info : false))(),
          fileFormat  // Use our custom format for files
        ),
        options: { mode: 0o600 },
      }),
    ],
  });
}

export let logger: Logger = createCustomLogger('debug');

export function setLoggerConfig(config: { logLevel?: string }) {
  logger = createCustomLogger(config.logLevel || 'debug');
}

// Helper functions for logging alertable events
export function logAlert(message: string, severity: AlertSeverity, metadata: Record<string, any> = {}) {
  // Add timestamp in ISO format for better Grafana parsing
  const timestamp = new Date().toISOString();
  
  logger.error(message, { 
    ...metadata, 
    alertSeverity: severity,
    alertable: true,
    timestamp,
    event_type: 'critical_event',
    // Add standardized fields for Grafana
    component: metadata.component || 'unknown',
    pool_address: metadata.poolAddress || 'none',
    pool_name: metadata.poolName || metadata.pool?.name || 'unknown',
    error_message: metadata.errorMessage || ''
  });
}

export function logWarning(message: string, severity: AlertSeverity = AlertSeverity.MEDIUM, metadata: Record<string, any> = {}) {
  // Add timestamp in ISO format for better Grafana parsing
  const timestamp = new Date().toISOString();
  
  logger.warn(message, { 
    ...metadata, 
    alertSeverity: severity,
    alertable: true,
    timestamp,
    event_type: 'warning_event',
    // Add standardized fields for Grafana
    component: metadata.component || 'unknown',
    pool_address: metadata.poolAddress || 'none',
    pool_name: metadata.poolName || metadata.pool?.name || 'unknown',
    error_message: metadata.errorMessage || ''
  });
}

export function logOperation(operation: string, durationMs: number, metadata: Record<string, any> = {}) {
  // Log operation performance for tracking in Grafana
  logger.info(`Operation completed: ${operation}`, {
    operation,
    duration_ms: durationMs,
    event_type: 'operation_metric',
    timestamp: new Date().toISOString(),
    pool_address: metadata.poolAddress || 'none',
    pool_name: metadata.poolName || metadata.pool?.name || 'unknown'
  });
}

export function setLogsFolderPermissions() {}
