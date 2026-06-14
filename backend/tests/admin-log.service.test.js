/**
 * AdminLogService unit tests.
 *
 * Tests AdminLogService.log(), list(), and getStats() with real Prisma.
 * Strict TDD: tests written first, implementation follows.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminLogService } from '../src/services/admin-log.service.js';
import { prisma } from '../src/lib/prisma.js';
import { cleanupTestData, createTestAdmin } from './helpers.js';

let adminId;

beforeAll(async () => {
  await cleanupTestData();
  const { student } = await createTestAdmin();
  adminId = student.id;
});

afterAll(async () => {
  await cleanupTestData();
});

describe('AdminLogService.log()', () => {
  it('creates an AdminLog record with all required fields', async () => {
    const log = await adminLogService.log(adminId, 'create', 'booklet', 'b-test-1', { title: 'Test' });

    expect(log).toHaveProperty('id');
    expect(log.adminId).toBe(adminId);
    expect(log.action).toBe('create');
    expect(log.entity).toBe('booklet');
    expect(log.entityId).toBe('b-test-1');
    expect(log.details).toEqual({ title: 'Test' });
    expect(log.createdAt).toBeInstanceOf(Date);

    // Verify it was actually persisted
    const saved = await prisma.adminLog.findUnique({ where: { id: log.id } });
    expect(saved).not.toBeNull();
    expect(saved.action).toBe('create');
  });

  it('creates a log with null details', async () => {
    const log = await adminLogService.log(adminId, 'delete', 'course', 'c-test-1', null);
    expect(log.action).toBe('delete');
    expect(log.entityId).toBe('c-test-1');
  });

  it('creates multiple logs and returns distinct records', async () => {
    const one = await adminLogService.log(adminId, 'update', 'booklet', 'b-test-2', { changes: { title: ['Old', 'New'] } });
    const two = await adminLogService.log(adminId, 'confirm', 'payment', 'ord-1', { method: 'cash' });

    expect(one.id).not.toBe(two.id);
    expect(two.action).toBe('confirm');
    expect(two.entity).toBe('payment');
  });
});

describe('AdminLogService.list()', () => {
  beforeAll(async () => {
    await adminLogService.log(adminId, 'create', 'booklet', 'b-list-1', { title: 'List Test' });
    await adminLogService.log(adminId, 'create', 'course', 'c-list-1', { name: 'Course List' });
  });

  it('returns paginated results ordered by createdAt DESC', async () => {
    const result = await adminLogService.list({ page: 1, limit: 10 });
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
    const result = await adminLogService.list({ entity: 'course', page: 1, limit: 10 });
    expect(result.logs.length).toBeGreaterThanOrEqual(1);
    for (const log of result.logs) {
      expect(log.entity).toBe('course');
    }
  });

  it('filters by action', async () => {
    const result = await adminLogService.list({ action: 'create', page: 1, limit: 10 });
    expect(result.logs.length).toBeGreaterThanOrEqual(1);
    for (const log of result.logs) {
      expect(log.action).toBe('create');
    }
  });

  it('filters by adminId', async () => {
    const result = await adminLogService.list({ adminId, page: 1, limit: 10 });
    expect(result.logs.length).toBeGreaterThanOrEqual(1);
    for (const log of result.logs) {
      expect(log.adminId).toBe(adminId);
    }
  });

  it('returns empty list for non-matching filter', async () => {
    const result = await adminLogService.list({ entity: '__nonexistent__', page: 1, limit: 10 });
    expect(result.logs).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('respects limit parameter', async () => {
    const result = await adminLogService.list({ page: 1, limit: 2 });
    expect(result.logs.length).toBeLessThanOrEqual(2);
  });

  it('combines entity and action filter', async () => {
    // Only "course" + "create" entries should match
    const result = await adminLogService.list({ entity: 'course', action: 'create', page: 1, limit: 10 });
    expect(result.logs.length).toBeGreaterThanOrEqual(1);
    for (const log of result.logs) {
      expect(log.entity).toBe('course');
      expect(log.action).toBe('create');
    }
  });
});

describe('AdminLogService.getStats()', () => {
  beforeAll(async () => {
    await adminLogService.log(adminId, 'create', 'booklet', 'stat-b-1', { title: 'Stats' });
    await adminLogService.log(adminId, 'update', 'booklet', 'stat-b-2', { title: 'Updated' });
    await adminLogService.log(adminId, 'delete', 'booklet', 'stat-b-3', { title: 'Deleted' });
    await adminLogService.log(adminId, 'confirm', 'payment', 'stat-ord-1', { method: 'cash' });
  });

  it('returns stats grouped by action with counts', async () => {
    const stats = await adminLogService.getStats();
    expect(Array.isArray(stats)).toBe(true);
    expect(stats.length).toBeGreaterThan(0);

    const createStat = stats.find(s => s.action === 'create');
    expect(createStat).toBeDefined();
    expect(createStat.count).toBeGreaterThanOrEqual(1);
  });

  it('includes multiple action types in stats', async () => {
    const stats = await adminLogService.getStats();
    const actionTypes = stats.map(s => s.action);
    expect(actionTypes).toContain('create');
    expect(actionTypes).toContain('update');
    expect(actionTypes).toContain('delete');
  });
});

describe('AdminLogService — singleton', () => {
  it('exports a singleton instance', async () => {
    const { adminLogService: s1 } = await import('../src/services/admin-log.service.js');
    const { adminLogService: s2 } = await import('../src/services/admin-log.service.js');
    expect(s1).toBe(s2);
  });
});
