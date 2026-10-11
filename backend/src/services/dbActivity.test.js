import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_ACTIVITY_MAX_ROWS, recordDbActivity } from './dbActivity.js';

function createFakePrisma(seed = []) {
  const rows = seed.map((row) => ({ ...row }));
  let seq = rows.length;

  return {
    rows,
    dbActivityPing: {
      async findFirst({ orderBy }) {
        const sorted = [...rows].sort((a, b) => {
          const field = Object.keys(orderBy)[0];
          const dir = orderBy[field] === 'desc' ? -1 : 1;
          return (new Date(a[field]) - new Date(b[field])) * dir;
        });
        return sorted[0] ? { ...sorted[0] } : null;
      },
      async count() {
        return rows.length;
      },
      async create({ data }) {
        seq += 1;
        const row = {
          id: `row-${seq}`,
          note: data.note,
          seq: data.seq,
          createdAt: new Date('2026-10-11T00:00:00.000Z'),
          updatedAt: new Date('2026-10-11T00:00:00.000Z'),
        };
        rows.push(row);
        return { ...row };
      },
      async update({ where, data }) {
        const row = rows.find((item) => item.id === where.id);
        row.note = data.note;
        row.seq += data.seq.increment;
        row.updatedAt = new Date('2026-10-11T00:00:01.000Z');
        return { ...row };
      },
      async findMany({ where, orderBy, take }) {
        const excluded = where?.id?.not;
        const sorted = rows
          .filter((row) => row.id !== excluded)
          .sort((a, b) => new Date(a[Object.keys(orderBy)[0]]) - new Date(b[Object.keys(orderBy)[0]]));
        return sorted.slice(0, take).map((row) => ({ id: row.id }));
      },
      async deleteMany({ where }) {
        const ids = new Set(where.id.in);
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i -= 1) {
          if (ids.has(rows[i].id)) rows.splice(i, 1);
        }
        return { count: before - rows.length };
      },
    },
  };
}

test('inserts and updates a heartbeat row without touching other tables', async () => {
  const prisma = createFakePrisma();

  const result = await recordDbActivity(prisma, { now: Date.parse('2026-10-11T12:00:00.000Z') });

  assert.equal(result.skipped, false);
  assert.equal(result.deleted, 0);
  assert.equal(result.kept, 1);
  assert.equal(prisma.rows[0].note, 'activity-updated');
  assert.equal(prisma.rows[0].seq, 2);
  assert.equal(Object.keys(prisma).includes('user'), false);
});

test('skips when a recent heartbeat already exists', async () => {
  const prisma = createFakePrisma([
    {
      id: 'recent',
      note: 'activity-updated',
      seq: 2,
      createdAt: new Date('2026-10-11T11:55:00.000Z'),
      updatedAt: new Date('2026-10-11T11:55:00.000Z'),
    },
  ]);

  const result = await recordDbActivity(prisma, { now: Date.parse('2026-10-11T12:00:00.000Z') });

  assert.equal(result.skipped, true);
  assert.equal(prisma.rows.length, 1);
});

test('deletes the oldest heartbeat rows once the cap is exceeded', async () => {
  const seed = Array.from({ length: DB_ACTIVITY_MAX_ROWS }, (_, index) => ({
    id: `old-${index}`,
    note: 'activity-updated',
    seq: 2,
    createdAt: new Date(Date.parse('2026-10-01T00:00:00.000Z') + index * 60_000),
    updatedAt: new Date(Date.parse('2026-10-10T00:00:00.000Z') + index * 60_000),
  }));
  const prisma = createFakePrisma(seed);

  const result = await recordDbActivity(prisma, { now: Date.parse('2026-10-11T12:00:00.000Z') });

  assert.equal(result.skipped, false);
  assert.equal(result.deleted, 1);
  assert.equal(prisma.rows.length, DB_ACTIVITY_MAX_ROWS);
  assert.equal(prisma.rows.some((row) => row.id === 'old-0'), false);
  assert.equal(prisma.rows.some((row) => row.id === result.id), true);
});
