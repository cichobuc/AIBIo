export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { cleanupPendingGates } = await import('@/core/agent-sdk/approval-gate.js');
    const cleanup = () => {
      cleanupPendingGates();
      process.exit(0);
    };
    process.once('SIGTERM', cleanup);
    process.once('SIGINT', cleanup);
  }
}
