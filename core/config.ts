type Config = {
  readonly anthropicApiKey: string;
  readonly encryptionKey: string;
  readonly dbPath: string;
  readonly workspacesPath: string;
  readonly isDev: boolean;
};

let _config: Config | undefined;

export function getConfig(): Config {
  if (_config) return _config;

  const missing = ['ANTHROPIC_API_KEY', 'AIBIO_ENCRYPTION_KEY'].filter(
    (k) => !process.env[k],
  );
  if (missing.length > 0) {
    throw new Error(`Required env vars not set: ${missing.join(', ')}`);
  }

  _config = {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    encryptionKey: process.env.AIBIO_ENCRYPTION_KEY!,
    dbPath: process.env.AIBIO_DB_PATH ?? './aibio.db',
    workspacesPath: process.env.AIBIO_WORKSPACES_PATH ?? './workspaces',
    isDev: process.env.NODE_ENV !== 'production',
  };

  return _config;
}
