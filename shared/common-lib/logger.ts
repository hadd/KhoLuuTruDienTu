import pino, {
  type LevelWithSilent,
  type Logger as PinoLogger,
  type LoggerOptions,
  type TransportSingleOptions,
} from "pino";

export type Logger = PinoLogger;

export interface LoggerConfig {
  name?: string;
  level?: LevelWithSilent;
  bindings?: Record<string, unknown>;
  options?: LoggerOptions;
  pretty?: boolean;
}

const devLikeEnvs = new Set(["development", "test", "local", "production"]);
const nodeEnv = (Deno.env.get("NODE_ENV") ?? "development").toLowerCase();
const envLevel = Deno.env.get("LOG_LEVEL")?.toLowerCase() as LevelWithSilent | undefined;
const isDevLike = devLikeEnvs.has(nodeEnv);
const defaultLevel: LevelWithSilent = envLevel ?? (isDevLike ? "debug" : "info");

const prettyTransport: TransportSingleOptions = {
  target: "pino-pretty",
  options: {
    colorize: true,
    translateTime: "SYS:standard",
    ignore: "pid,hostname",
    singleLine: true,
    messageFormat: "{logger} | {msg}", // Move logger name here for pretty print only
  },
};

const fileTransport: TransportSingleOptions = {
  target: "pino-roll",
  options: {
    file: "./logs/app.log",
    frequency: "daily",
    mkdir: true,
    size: "30m",
    limit: {
      count: 10,
    },
  },
};

const consoleTransport: TransportSingleOptions = {
  target: "pino/file",
  options: {
    destination: 1,
  },
};

const baseLoggerOptions: LoggerOptions = {
  level: defaultLevel,
};

const loggerCache = new Map<string, Logger>();

// Helper type for the shortcut function
type LogMethod = (obj: unknown, msg?: string, ...args: unknown[]) => void;
type LogShortcut = Logger & LogMethod;

function buildLogger(name: string, config: LoggerConfig): Logger {
  const loggerName = config.name ?? name;
  const options: LoggerOptions = {
    ...baseLoggerOptions,
    ...config.options,
  };
  options.level = config.level ?? config.options?.level ?? baseLoggerOptions.level;

  const usePretty = config.pretty ?? isDevLike;

  const targets: TransportSingleOptions[] = [fileTransport];
  if (usePretty) {
    targets.push(prettyTransport);
  } else {
    targets.push(consoleTransport);
  }

  const instance = pino({
    ...options,
    transport: {
      targets,
    },
  });

  return instance.child({
    logger: loggerName,
    ...(config.bindings ?? {}),
  });
}

export function getLogger(name: string = "app", config: LoggerConfig = {}): Logger {
  if (loggerCache.has(name)) {
    return loggerCache.get(name)!;
  }
  const logger = buildLogger(name, config);
  loggerCache.set(name, logger);
  return logger;
}

export function getModuleLogger(module: string, component: string, config: LoggerConfig = {}): Logger {
  return getLogger(`${module}:${component}`, config);
}

function createLogShortcut(logger: Logger, level: pino.Level = 'info'): LogShortcut {
  const invoke = (entry?: unknown, ...args: unknown[]) => {
    // @ts-ignore - dynamic access to level method
    const logFn = logger[level].bind(logger);

    if (entry === undefined) return;

    // Handle Error objects specifically for the shortcut
    if (entry instanceof Error) {
      logFn({ err: entry }, args[0] as string || entry.message);
      return;
    }

    if (typeof entry === "object" && entry !== null) {
      const [msg, ...rest] = args;
      logFn(entry as Record<string, unknown>, msg as string | undefined, ...rest);
      return;
    }

    logFn(entry as any, ...(args as any[]));
  };

  return new Proxy(invoke as LogShortcut, {
    apply(_target, _thisArg, argArray) {
      return invoke(...argArray);
    },
    get(target, prop, receiver) {
      // Proxy passthrough to original logger instance
      if (prop in logger) {
        const value = Reflect.get(logger, prop);
        if (typeof value === "function") {
          return value.bind(logger);
        }
        return value;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

const baseLoggers = {
  app: getLogger("app"),
  database: getLogger("database"),
  api: getLogger("api"),
  auth: getLogger("auth"),
  error: getLogger("error", { level: "error" }),
  debug: getLogger("debug", { level: "debug" }),
} as const;

// Pass the correct levels to the shortcuts!
export const logApp = createLogShortcut(baseLoggers.app, 'info');
export const logDb = createLogShortcut(baseLoggers.database, 'info');
export const logApi = createLogShortcut(baseLoggers.api, 'info');
export const logAuth = createLogShortcut(baseLoggers.auth, 'info');
export const logError = createLogShortcut(baseLoggers.error, 'error');
export const logDebug = createLogShortcut(baseLoggers.debug, 'debug');

export const loggers = {
  app: logApp,
  database: logDb,
  api: logApi,
  auth: logAuth,
  error: logError,
  debug: logDebug,
} as const;

export function getTimedLogger(
  name: string = "timed",
  config: LoggerConfig = {},
): Logger & {
  startTimer: (operation: string) => {
    end: (message?: string) => void;
  };
} {
  const logger = getLogger(name, config);

  return Object.assign(logger, {
    startTimer: (operation: string) => {
      const startTime = performance.now();
      return {
        end: (message?: string) => {
          const duration = performance.now() - startTime;
          // Format duration to 2 decimal places for cleanliness
          logger.info({ operation, durationMs: Number(duration.toFixed(2)) }, message ?? `${operation} completed`);
        },
      };
    },
  });
}

export function clearLoggerCache(): void {
  loggerCache.clear();
}