import type { FastifyInstance } from 'fastify';
import {
  buildBillingSummary,
  deleteEnergyTariff,
  ensureDefaultTariffs,
  getEnergyTariff,
  listEnergyTariffs,
  simulateBill,
  upsertEnergyTariff,
} from '../services/energyBillingService.js';
import { resolveProjectId } from '../services/carbonService.js';
import { normalizeTariffConfig, type EnergyTariffConfig, type TariffMode } from '@energylink/shared-types';

function parseBillingQuery(query: Record<string, unknown>) {
  return {
    projectId: typeof query.projectId === 'string' ? query.projectId : undefined,
    from: typeof query.from === 'string' ? query.from : undefined,
    to: typeof query.to === 'string' ? query.to : undefined,
    period: (['live', 'today', '7d', '30d'] as const).includes(query.period as any)
      ? (query.period as 'live' | 'today' | '7d' | '30d')
      : undefined,
    tariffId: typeof query.tariffId === 'string' ? query.tariffId : undefined,
  };
}

export async function registerBillingRoutes(app: FastifyInstance) {
  app.get('/api/billing/tariffs', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const projectId = await resolveProjectId(typeof query.projectId === 'string' ? query.projectId : undefined);
    if (!projectId) return reply.code(404).send({ message: 'No project found.' });
    await ensureDefaultTariffs(projectId);
    const tariffs = await listEnergyTariffs(projectId);
    return {
      projectId,
      tariffs: tariffs.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        isDefault: t.isDefault,
        effectiveFrom: t.effectiveFrom?.toISOString() ?? null,
        config: normalizeTariffConfig(JSON.parse(t.configJson)),
        updatedAt: t.updatedAt.toISOString(),
      })),
    };
  });

  app.get('/api/billing/tariffs/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const tariff = await getEnergyTariff(params.id);
    if (!tariff) return reply.code(404).send({ message: 'Tariff not found.' });
    return {
      ...tariff,
      config: normalizeTariffConfig(JSON.parse(tariff.configJson)),
    };
  });

  app.post('/api/billing/tariffs', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const projectId = await resolveProjectId(typeof body.projectId === 'string' ? body.projectId : undefined);
    if (!projectId) return reply.code(404).send({ message: 'No project found.' });
    const name = String(body.name ?? '').trim();
    if (!name) return reply.code(400).send({ message: 'Tariff name is required.' });

    const config = normalizeTariffConfig(body.config);
    const saved = await upsertEnergyTariff({
      id: typeof body.id === 'string' ? body.id : undefined,
      projectId,
      name,
      description: typeof body.description === 'string' ? body.description : null,
      isDefault: body.isDefault === true,
      config,
      effectiveFrom: typeof body.effectiveFrom === 'string' ? body.effectiveFrom : null,
    });
    return { ok: true, tariff: saved };
  });

  app.delete('/api/billing/tariffs/:id', async (request, reply) => {
    const params = request.params as { id: string };
    try {
      await deleteEnergyTariff(params.id);
      return { ok: true };
    } catch {
      return reply.code(404).send({ message: 'Tariff not found.' });
    }
  });

  app.get('/api/billing/summary', async (request, reply) => {
    const query = parseBillingQuery(request.query as Record<string, unknown>);
    const summary = await buildBillingSummary(query.projectId, query);
    if (!summary) return reply.code(404).send({ message: 'No billing summary available.' });
    return summary;
  });

  app.post('/api/billing/simulate', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const query = {
      projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
      from: typeof body.from === 'string' ? body.from : undefined,
      to: typeof body.to === 'string' ? body.to : undefined,
      period: (['live', 'today', '7d', '30d'] as const).includes(body.period as any)
        ? (body.period as 'live' | 'today' | '7d' | '30d')
        : undefined,
      tariffId: typeof body.tariffId === 'string' ? body.tariffId : undefined,
    };
    const result = await simulateBill(query.projectId, query);
    if (!result) return reply.code(404).send({ message: 'Bill simulation failed.' });
    return result;
  });

  app.get('/api/billing/modes', async () => ({
    modes: [
      { id: 'flat', label: 'Flat rate (THB/kWh)', description: 'Simple multiplication of total kWh × rate' },
      { id: 'tiered', label: 'Block / Tier pricing', description: 'Progressive blocks (e.g. PEA residential)' },
      { id: 'tou', label: 'Time-of-use (TOU)', description: 'Peak/off-peak rates from hourly history' },
      { id: 'combined', label: 'TOU + Demand + Fixed', description: 'Industrial tariff with demand charge (kW)' },
    ] satisfies Array<{ id: TariffMode; label: string; description: string }>,
  }));
}
