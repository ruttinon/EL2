import Fastify from 'fastify';
import { readEngineConfig } from '@energylink/shared-data';
import { ensureRuntimeFolders } from './services/folders.js';
import { appendEngineLog } from './services/engineLogger.js';
import { registerStatusRoutes } from './routes/statusRoutes.js';
import { registerNotImplementedRoutes } from './routes/notImplementedRoutes.js';
import { registerCommunicationRoutes } from './routes/communicationRoutes.js';
import { registerGraphicsRoutes } from './routes/graphicsRoutes.js';
import { registerReportsRoutes } from './routes/reportsRoutes.js';
import { registerRuntimeRoutes } from './routes/runtimeRoutes.js';
import { registerAlarmRoutes } from './routes/alarmRoutes.js';
import { registerWebViewerRoutes } from './routes/webViewerRoutes.js';
import { registerBackupRoutes } from './routes/backupRoutes.js';
import { registerSettingsRoutes } from './routes/settingsRoutes.js';
import { registerNotificationRoutes } from './routes/notificationRoutes.js';
import { registerReportSchedulerRoutes } from './routes/reportSchedulerRoutes.js';
import { registerMaintenanceRoutes } from './routes/maintenanceRoutes.js';
import { registerProjectRoutes } from './routes/projectRoutes.js';
import { registerPublishRoutes } from './routes/publishRoutes.js';
import { registerEditorDataRoutes } from './routes/editorDataRoutes.js';
import { registerAssetConvertRoutes } from './routes/assetConvertRoutes.js';
import { registerSharedAssetRoutes } from './routes/sharedAssetRoutes.js';
import { registerStreamRoutes } from './routes/streamRoutes.js';
import { registerCarbonRoutes } from './routes/carbonRoutes.js';
import { registerBillingRoutes } from './routes/billingRoutes.js';
import { startRuntimePolling, stopRuntimePolling } from './services/runtimePollingService.js';
import { startReportScheduler, stopReportScheduler } from './services/reportSchedulerService.js';
import { setEngineListeningEndpoint } from './services/engineState.js';
import { disconnectPrismaClient, ensureDatabaseSchema } from './services/database.js';
import { stopAllRtspSessions } from './services/rtspProxyService.js';

async function main() {
  const folders = ensureRuntimeFolders();
  const config = readEngineConfig();
  await ensureDatabaseSchema();
  const port = Number(process.env.ENERGYLINK_PORT ?? config.port ?? 8081);
  const host = process.env.ENERGYLINK_HOST ?? config.apiHost ?? '0.0.0.0';

  const app = Fastify({
    logger: { level: config.logLevel ?? 'info' }
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (request.method === 'OPTIONS') {
      return reply.code(204).send();
    }
  });

  await registerStatusRoutes(app);
  await registerProjectRoutes(app);
  await registerPublishRoutes(app);
  await registerCommunicationRoutes(app);
  await registerEditorDataRoutes(app);
  await registerAssetConvertRoutes(app);
  await registerSharedAssetRoutes(app);
  await registerStreamRoutes(app);
  await registerCarbonRoutes(app);
  await registerBillingRoutes(app);
  await registerGraphicsRoutes(app);
  await registerReportsRoutes(app);
  await registerRuntimeRoutes(app);
  await registerAlarmRoutes(app);
  await registerNotImplementedRoutes(app);
  await registerWebViewerRoutes(app);
  await registerBackupRoutes(app);
  await registerSettingsRoutes(app);
  await registerNotificationRoutes(app);
  await registerReportSchedulerRoutes(app);
  await registerMaintenanceRoutes(app);

  const shutdown = async (signal: NodeJS.Signals) => {
    appendEngineLog('info', 'Engine service shutdown requested', { signal });
    app.log.info({ signal }, 'Engine service shutdown requested');
    stopRuntimePolling('service_shutdown');
    stopReportScheduler('service_shutdown');
    stopAllRtspSessions();
    await app.close();
    await disconnectPrismaClient();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', (error) => {
    appendEngineLog('error', 'Uncaught exception', { message: error.message, stack: error.stack });
    app.log.error(error, 'Uncaught exception');
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    appendEngineLog('error', 'Unhandled rejection', { reason: String(reason) });
    app.log.error({ reason }, 'Unhandled rejection');
  });

  await app.listen({ port, host });
  setEngineListeningEndpoint(host, port);
  startRuntimePolling('service_start');
  startReportScheduler();
  appendEngineLog('info', 'Engine service started', { host, port, folders });
}

main().catch((error) => {
  appendEngineLog('error', 'Engine service failed to start', { message: error.message, stack: error.stack });
  console.error(error);
  process.exit(1);
});

