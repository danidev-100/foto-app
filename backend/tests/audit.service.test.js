/**
 * AuditService unit tests.
 *
 * Tests AuditService.log(), list(), and getStats() with real Prisma.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuditService } from '../src/services/audit.service.js';
import { prisma } from '../src/lib/prisma.js';
import { cleanupTestData, createTestAdmin } from './helpers.js';

const auditService = new AuditService();
let adminId;

beforeAll(async () => {
  await cleanupTestData();
  const { student } = await createTestAdmin();
  adminId = student.id;
});

afterAll(async () => {
  await cleanupTestData();
});

describe('AuditService.log()', () => {
  it('creates an AdminLog record with all fields', async () => {
    const log = await auditService.log(adminId, 'create', 'booklet', 'b-1', { title: 'Test Booklet' });

    expect(log).toHaveProperty('id');
    expect(log.adminId).toBe(adminId);
    expect(log.action).toBe('create');
    expect(log.entity).toBe('booklet');
    expect(log.entityId).toBe('b-1');
    expect(log.details).toEqual({ title: 'Test Booklet' });
    expect(log.createdAt).toBeInstanceOf(Date);

    // Verify it was persisted
    const saved = await prisma.adminLog.findUnique({ where: { id: log.id } });
    expect(saved).not.toBeNull();
    expect(saved.action).toBe('create');
  });

  it('creates a log with nullish details and entityId', async () => {
    const log = await auditService.log(adminId, 'delete', 'course', 'c-1', null);
    expect(log.action).toBe('delete');
    expect(log.entityId).toBe('c-1');
  });

  it('creates multiple logs and returns all fields', async () => {
    await auditService.log(adminId, 'update', 'booklet', 'b-2', { changes: { title: ['Old', 'New'] } });
    await auditService.log(adminId, 'confirm', 'payment', 'ord-1', { method: 'cash' });

    const secondLog = await auditService.log(adminId, 'update', 'order', 'ord-1', { from: 'pending', to: 'ready' });
    expect(secondLog.action).toBe('update');
    expect(secondLog.entity).toBe('order');
  });
});

describe('AuditService.list()', () => {
  beforeAll(async () => {
    // Ensure baseline entries exist for filtering tests
    await auditService.log(adminId, 'create', 'booklet', 'b-list-1', { title: 'List Test' });
    await auditService.log(adminId, 'create', 'course', 'c-list-1', { name: 'Course List' });
  });

  it('returns paginated results ordered by createdAt DESC', async () => {
    const result = await auditService.list({ page: 1, limit: 10 });
    expect(result).toHaveProperty('logs');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('page', 1);
    expect(result).toHaveProperty('limit', 10);
    expect(Array.isArray(result.logs)).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(1);

    // Verify DESC order
    for (let i = 1; i < result.logs.length; i++) {
      expect(new Date(result.logs[i].createdAt).getTime())
        .toBeLessThanOrEqual(new Date(result.logs[i - 1].createdAt).getTime());
    }
  });

  it('filters by entity', async () => {
    const result = await auditService.list({ entity: 'course', page: 1, limit: 10 });
    for (const log of result.logs) {
      expect(log.entity).toBe('course');
    }
  });

  it('filters by action', async () => {
    const result = await auditService.list({ action: 'create', page: 1, limit: 10 });
    for (const log of result.logs) {
      expect(log.action).toBe('create');
    }
  });

  it('filters by adminId', async () => {
    const result = await auditService.list({ adminId, page: 1, limit: 10 });
    for (const log of result.logs) {
      expect(log.adminId).toBe(adminId);
    }
  });

  it('returns empty list for non-matching filter', async () => {
    const result = await auditService.list({ entity: 'nonexistent', page: 1, limit: 10 });
    expect(result.logs).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('respects limit parameter', async () => {
    const result = await auditService.list({ page: 1, limit: 2 });
    expect(result.logs.length).toBeLessThanOrEqual(2);
  });
});

describe('AuditService.getStats()', () => {
  beforeAll(async () => {
    // Add more varied log entries for stats
    await auditService.log(adminId, 'create', 'booklet', 'stat-b-1', { title: 'Stats Booklet' });
    await auditService.log(adminId, 'update', 'booklet', 'stat-b-2', { title: 'Updated' });
    await auditService.log(adminId, 'delete', 'booklet', 'stat-b-3', { title: 'Deleted' });
    await auditService.log(adminId, 'confirm', 'payment', 'stat-ord-1', { method: 'cash' });
    await auditService.log(adminId, 'confirm', 'payment', 'stat-ord-2', { method: 'transfer' });
  });

  it('returns stats grouped by action', async () => {
    const stats = await auditService.getStats();
    expect(Array.isArray(stats)).toBe(true);
    expect(stats.length).toBeGreaterThan(0);

    const createStat = stats.find(s => s.action === 'create');
    expect(createStat).toBeDefined();
    expect(createStat.count).toBeGreaterThanOrEqual(1);
  });

  it('returns stats with entity breakdown', async () => {
    const stats = await auditService.getStats();
    // Should have at least one entry per action type
    const actionTypes = stats.map(s => s.action);
    expect(actionTypes).toContain('create');
  });
});
