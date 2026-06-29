export const SHARED_UI_VERSION = '0.1.0';
export {
  DEFAULT_ENGINE_URL,
  CANONICAL_ENGINE_URL_KEY,
  buildEngineUrl,
  getEngineUrl,
  normalizeEngineUrl,
  parseEnginePort,
  probeEngineUrl,
  setEngineUrl,
  syncEngineUrlFromEngine,
  type EngineEndpointPayload,
} from './engineUrl';
export {
  OPERATOR_ROLE_STORAGE_KEY,
  OPERATOR_ROLE_OPTIONS,
  getOperatorRole,
  setOperatorRole,
  initOperatorRoleFromQuery,
  isOperatorRole,
  type OperatorRole,
} from './operatorRole';
