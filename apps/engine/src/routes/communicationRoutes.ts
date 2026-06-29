import type { FastifyInstance } from 'fastify';
import {
  listRuntimeDevices,
  readTagOnce,
  runDeviceDiagnostics,
  testDeviceConnection,
  validateDeviceCommunication,
  writeTag
} from '../services/communicationService.js';
import { canWriteTags, isWriteGuardEnabled, resolveOperatorRole } from '../services/operatorGuard.js';

export async function registerCommunicationRoutes(app: FastifyInstance) {
  app.get('/api/communication/capabilities', async () => ({
    phase: 'Phase 26 - Device Communication Enhancement',
    runtimeSource: 'not_present',
    polling: 'real_device_polling_and_alarm_runtime_available',
    supportedProtocols: [
      {
        protocol: 'modbus_tcp',
        connectionTest: true,
        readOnce: true,
        polling: true,
        historyLogging: true,
        notes: 'Real TCP connection, physical Modbus register reads, inherited converter endpoint support, current values, history, and alarm evaluation.'
      },
      {
        protocol: 'modbus_rtu',
        connectionTest: true,
        readOnce: true,
        polling: true,
        historyLogging: true,
        notes: 'Real serial RTU connection using configured COM port, baud rate, data bits, stop bits, parity, and peripheral number. No generated values.'
      },
      {
        protocol: 'cvm_c4',
        connectionTest: true,
        readOnce: true,
        polling: true,
        historyLogging: true,
        notes: 'CVM-C4 meter driver over Modbus RTU. Uses configured serial port, baud rate, data bits, stop bits, parity, and peripheral number.'
      },
      {
        protocol: 'cvm_c11',
        connectionTest: true,
        readOnce: true,
        polling: true,
        historyLogging: true,
        notes: 'CVM-C11 meter driver over Modbus RTU. Uses configured serial port, baud rate, data bits, stop bits, parity, and peripheral number.'
      },
      {
        protocol: 'xgmb_meter',
        connectionTest: true,
        readOnce: true,
        polling: true,
        historyLogging: true,
        notes: 'Imported XGMB meter driver. Uses the selected parent converter and the imported register map.'
      },
      {
        protocol: 'mqtt',
        connectionTest: true,
        readOnce: true,
        polling: true,
        historyLogging: true,
        notes: 'MQTT pub/sub driver. Broker host/port on converter device; each tag subscribes to mqttTopic (or description/name).'
      }
    ],
    reservedProtocols: [
      {
        protocol: 'tcp/udp',
        connectionTest: false,
        readOnce: false,
        polling: false,
        historyLogging: false,
        notes: 'Generic drivers are not implemented yet.'
      }
    ]
  }));

  app.get('/api/devices', async () => ({ devices: await listRuntimeDevices() }));

  app.get('/api/devices/:id/communication-validation', async (request, reply) => {
    try {
      const params = request.params as { id: string };
      return await validateDeviceCommunication(params.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(404).send({ ok: false, message });
    }
  });

  app.post('/api/devices/:id/diagnostics', async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const result = await runDeviceDiagnostics(params.id);
      return reply.code(result.ok ? 200 : 422).send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(404).send({ ok: false, message });
    }
  });

  app.post('/api/devices/:id/test-connection', async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const result = await testDeviceConnection(params.id);
      return reply.code(result.ok ? 200 : 422).send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(404).send({ ok: false, message });
    }
  });

  app.post('/api/tags/:id/read-once', async (request, reply) => {
    try {
      const params = request.params as { id: string };
      const result = await readTagOnce(params.id);
      return reply.code(result.ok ? 200 : 422).send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(404).send({ ok: false, message });
    }
  });

  app.post('/api/tags/:id/write', async (request, reply) => {
    try {
      if (isWriteGuardEnabled()) {
        const role = resolveOperatorRole(request.headers['x-operator-role']);
        if (!canWriteTags(role)) {
          return reply.code(403).send({ ok: false, message: 'Write denied: operator role required (X-Operator-Role: operator|engineer).' });
        }
      }
      const params = request.params as { id: string };
      const body = request.body as { value: number | boolean };
      if (body.value === undefined) {
        return reply.code(400).send({ ok: false, message: 'value is required in request body.' });
      }
      const result = await writeTag(params.id, body.value);
      return reply.code(result.ok ? 200 : 422).send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.code(404).send({ ok: false, message });
    }
  });
}
