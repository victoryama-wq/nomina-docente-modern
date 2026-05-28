export default async function teardownIntegrationTests(): Promise<void> {
  const { closeDatabase } = await import('../db.js');
  await closeDatabase().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Called end on pool more than once')) {
      throw error;
    }
  });
}
