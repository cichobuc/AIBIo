type Config = {
  readonly encryptionKey: string;
  readonly dbPath: string;
  readonly workspacesPath: string;
  readonly isDev: boolean;
};

let _config: Config | undefined;

export function getConfig(): Config {
  if (_config) return _config;

  const missing = ['AIBIO_ENCRYPTION_KEY'].filter(
    (k) => !process.env[k],
  );
  if (missing.length > 0) {
    throw new Error(`Required env vars not set: ${missing.join(', ')}`);
  }

  _config = {
    encryptionKey: process.env.AIBIO_ENCRYPTION_KEY!,
    dbPath: process.env.AIBIO_DB_PATH ?? './aibio.db',
    workspacesPath: process.env.AIBIO_WORKSPACES_PATH ?? './workspaces',
    isDev: process.env.NODE_ENV !== 'production',
  };

  return _config;
}
