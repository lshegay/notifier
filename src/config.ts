export type Config = {
  PORT: number;
  DB_PATH: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: number;
  HOST: string;
  NODE_ENV: string;
  port: number;
  dbPath: string;
  jwtSecret: string;
  jwtExpiresIn: number;
  host: string;
  nodeEnv: string;
};

export const CONFIG = {
  PORT: Number(process.env.PORT) || 3000,
  DB_PATH: process.env.DB_PATH ?? 'data/notifier.db',
  JWT_SECRET: process.env.JWT_SECRET ?? 'notifier-default-secret-key',
  JWT_EXPIRES_IN: Number(process.env.JWT_EXPIRES_IN) || 3600,
  HOST: process.env.HOST ?? '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV ?? 'development',

  get port(): number {
    return this.PORT;
  },
  get dbPath(): string {
    return this.DB_PATH;
  },
  get jwtSecret(): string {
    return this.JWT_SECRET;
  },
  get jwtExpiresIn(): number {
    return this.JWT_EXPIRES_IN;
  },
  get host(): string {
    return this.HOST;
  },
  get nodeEnv(): string {
    return this.NODE_ENV;
  },
};
