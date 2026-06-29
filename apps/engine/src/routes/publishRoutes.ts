import type { FastifyInstance } from 'fastify';
import { getPrismaClient, writePublishedSnapshotCarbonJson } from '../services/database.js';
import { appendEngineLog } from '../services/engineLogger.js';
import { serializeProjectCarbon, validateCarbonForPublish } from '../services/carbonService.js';

/**
 * Publish / Export routes
 * ───────────────────────
 * Editor edits live draft tables → clicks "Export to Monitor" →
 * Engine snapshots everything into PublishedSnapshot (versioned, immutable) →
 * Monitor reads the snapshot, never a half-edited draft.
 *
 *   POST  /api/projects/:id/publish              create snapshot (Editor calls this)
 *   GET   /api/projects/:id/published            latest snapshot (Monitor reads this)
 *   GET   /api/projects/:id/published/history    list all versions
 *   POST  /api/projects/:id/published/:v/rollback re-activate an old version
 */

function snapshotMeta(s: any) {
  return {
    id:          s.id,
    projectId:   s.projectId,
    version:     s.version,
    label:       s.label,
    publishedAt: s.publishedAt,
    publishedBy: s.publishedBy
  };
}

export async function registerPublishRoutes(app: FastifyInstance) {

  /* ── POST /api/projects/:id/publish ── */
  app.post('/api/projects/:id/publish', async (request, reply) => {
    const { id }  = request.params as { id: string };
    const body    = (request.body ?? {}) as { label?: string; publishedBy?: string };
    const prisma  = getPrismaClient();

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return reply.code(404).send({ message: `Project not found: ${id}` });

    const carbonCheck = await validateCarbonForPublish(id);

    try {
      /* Collect all current draft data in parallel */
      const [devices, tags, graphics, reports] = await Promise.all([
        prisma.device.findMany({
          where: { projectId: id },
          orderBy: [{ type: 'asc' }, { name: 'asc' }]
        }),
        prisma.tag.findMany({
          where: { projectId: id },
          orderBy: [{ name: 'asc' }]
        }),
        prisma.graphic.findMany({
          where: { projectId: id },
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
        }),
        prisma.report.findMany({
          where: { projectId: id },
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
        })
      ]);

      /* Create snapshot with retry on unique constraint to handle concurrent/duplicate requests */
      let snapshot;
      let nextVersion = 1;
      let attempts = 0;

      while (attempts < 5) {
        attempts++;
        const last = await prisma.publishedSnapshot.findFirst({
          where: { projectId: id },
          orderBy: { version: 'desc' }
        });
        nextVersion = (last?.version ?? 0) + 1;

        try {
          const projectCarbonJson = serializeProjectCarbon({
            facilityType: project.facilityType,
            emissionFactorKgPerKwh: project.emissionFactorKgPerKwh,
            netMetering: project.netMetering,
            floorAreaM2: project.floorAreaM2,
          });

          snapshot = await prisma.publishedSnapshot.create({
            data: {
              projectId:    id,
              version:      nextVersion,
              label:        body.label?.trim() || `v${nextVersion} — ${new Date().toLocaleString('th-TH')}`,
              devicesJson:  JSON.stringify(devices),
              tagsJson:     JSON.stringify(tags),
              graphicsJson: JSON.stringify(graphics),
              reportsJson:  JSON.stringify(reports),
              publishedBy:  body.publishedBy?.trim() || null
            }
          });
          await writePublishedSnapshotCarbonJson(snapshot.id, projectCarbonJson);
          break; // Success
        } catch (err: any) {
          const isUniqueConstraint = err.code === 'P2002' || String(err.message || err).includes('Unique constraint');
          if (isUniqueConstraint && attempts < 5) {
            await new Promise((resolve) => setTimeout(resolve, 50 * attempts));
            continue;
          }
          throw err;
        }
      }

      if (!snapshot) {
        throw new Error('Failed to create published snapshot after retries.');
      }

      /* Mark project as active / published */
      const updated = await prisma.project.update({
        where: { id },
        data: {
          status:          'active',
          publishedVersion: nextVersion,
          publishedAt:     snapshot.publishedAt
        }
      });

      appendEngineLog('info', 'Project published (Export to Monitor)', {
        projectId: id,
        version: nextVersion,
        devices: devices.length,
        tags: tags.length,
        graphics: graphics.length,
        reports: reports.length
      });

      return reply.code(201).send({
        ok: true,
        project:  updated,
        snapshot: snapshotMeta(snapshot),
        counts:   { devices: devices.length, tags: tags.length, graphics: graphics.length, reports: reports.length },
        carbonValidation: {
          ok: carbonCheck.ok,
          issues: carbonCheck.issues,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendEngineLog('error', 'Publish failed', { projectId: id, error: message });
      return reply.code(500).send({ ok: false, message });
    }
  });

  /* ── GET /api/projects/:id/published ── (Monitor uses this) */
  app.get('/api/projects/:id/published', async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getPrismaClient();

    const snapshot = await prisma.publishedSnapshot.findFirst({
      where: { projectId: id },
      orderBy: { version: 'desc' }
    });
    if (!snapshot) {
      return reply.code(404).send({ message: 'Project has not been published yet. Use "Export to Monitor" in the Editor first.' });
    }

    return {
      meta:     snapshotMeta(snapshot),
      carbon:   (snapshot as any).projectCarbonJson
        ? JSON.parse((snapshot as any).projectCarbonJson)
        : null,
      devices:  JSON.parse(snapshot.devicesJson),
      tags:     JSON.parse(snapshot.tagsJson),
      graphics: JSON.parse(snapshot.graphicsJson),
      reports:  JSON.parse(snapshot.reportsJson)
    };
  });

  /* ── GET /api/projects/:id/published/history ── */
  app.get('/api/projects/:id/published/history', async (request) => {
    const { id } = request.params as { id: string };
    const prisma = getPrismaClient();
    const snapshots = await prisma.publishedSnapshot.findMany({
      where:   { projectId: id },
      orderBy: { version: 'desc' },
      select:  { id: true, projectId: true, version: true, label: true, publishedAt: true, publishedBy: true }
    });
    return { snapshots };
  });

  /* ── POST /api/projects/:id/published/:version/rollback ── */
  app.post('/api/projects/:id/published/:version/rollback', async (request, reply) => {
    const { id, version } = request.params as { id: string; version: string };
    const prisma = getPrismaClient();

    const snapshot = await prisma.publishedSnapshot.findUnique({
      where: { projectId_version: { projectId: id, version: Number(version) } }
    });
    if (!snapshot) return reply.code(404).send({ message: `Published version ${version} not found.` });

    const updated = await prisma.project.update({
      where: { id },
      data:  { status: 'active', publishedVersion: snapshot.version, publishedAt: new Date() }
    });

    appendEngineLog('info', 'Project rolled back to published version', { projectId: id, version: snapshot.version });
    return { ok: true, project: updated, snapshot: snapshotMeta(snapshot) };
  });
}
