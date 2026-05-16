export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runMigrations } = await import('@/core/db/client');
    runMigrations();

    const { cleanupPendingGates } = await import('@/core/orchestration/approval-gate');
    const cleanup = () => {
      cleanupPendingGates();
      process.exit(0);
    };
    process.once('SIGTERM', cleanup);
    process.once('SIGINT', cleanup);

    const { registerGovernTools } = await import(
      '@/modules/ainderstanding/govern/lib/register-tools'
    );
    const { registerExploreTools } = await import(
      '@/modules/ainderstanding/explore/lib/register-tools'
    );
    registerGovernTools();
    registerExploreTools();
  }
}
