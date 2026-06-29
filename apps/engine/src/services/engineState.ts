import os from 'node:os';

const startedAt = new Date();
let apiHost = '127.0.0.1';
let apiPort = 8081;

export function setEngineListeningEndpoint(host: string, port: number) {
  apiHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
  apiPort = port;
}

export function getEngineState() {
  const uptimeSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  return {
    engine: 'running',
    runtimeMode: 'enhanced_real_device_communication',
    phase: 'Phase 26 - Device Communication Enhancement',
    startedAt: startedAt.toISOString(),
    uptimeSeconds,
    pid: process.pid,
    platform: process.platform,
    hostname: os.hostname(),
    nodeVersion: process.version,
    communicationRuntime: 'real_device_modbus_tcp_and_rtu_available',
    dataCollection: 'current_values_history_alarm_runtime_and_reports',
    runtimeSource: 'not_present',
    apiHost,
    apiPort,
    apiBaseUrl: buildLocalApiBaseUrl(apiHost, apiPort),
  };
}

function buildLocalApiBaseUrl(host: string, port: number) {
  const localHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
  return `http://${localHost}:${port}`;
}
