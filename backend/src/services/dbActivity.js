// Supabase Free는 지난 7일간 Postgres 쿼리가 거의 없으면 프로젝트를 멈춘다.
// 이 테이블만 넣고, 고치고, 한도를 넘기면 지운다. User/Alarm 등 서비스 데이터는 건드리지 않는다.

export const DB_ACTIVITY_MAX_ROWS = 24;
export const DB_ACTIVITY_MIN_INTERVAL_MS = 10 * 60 * 1000;

export async function recordDbActivity(prisma, options = {}) {
  const minIntervalMs = options.minIntervalMs ?? DB_ACTIVITY_MIN_INTERVAL_MS;
  const now = options.now ?? Date.now();

  const latest = await prisma.dbActivityPing.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (latest && now - new Date(latest.updatedAt).getTime() < minIntervalMs) {
    const kept = await prisma.dbActivityPing.count();
    return { skipped: true, id: latest.id, kept, deleted: 0 };
  }

  const created = await prisma.dbActivityPing.create({
    data: { note: 'activity', seq: 1 },
  });

  const updated = await prisma.dbActivityPing.update({
    where: { id: created.id },
    data: { note: 'activity-updated', seq: { increment: 1 } },
  });

  const count = await prisma.dbActivityPing.count();
  let deleted = 0;

  if (count > DB_ACTIVITY_MAX_ROWS) {
    const oldest = await prisma.dbActivityPing.findMany({
      where: { id: { not: updated.id } },
      orderBy: { createdAt: 'asc' },
      take: count - DB_ACTIVITY_MAX_ROWS,
      select: { id: true },
    });

    if (oldest.length > 0) {
      const result = await prisma.dbActivityPing.deleteMany({
        where: { id: { in: oldest.map((row) => row.id) } },
      });
      deleted = result.count ?? oldest.length;
    }
  }

  return {
    skipped: false,
    id: updated.id,
    kept: count - deleted,
    deleted,
  };
}
