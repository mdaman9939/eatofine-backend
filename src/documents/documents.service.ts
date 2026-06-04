import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';

// SOW §4.1 + §5.1 — Document Master.
// Two new tables that aren't in Prisma schema yet, so use $queryRawUnsafe.

type TargetRole = 'vendor' | 'delivery_man' | 'restaurant';
type DocStatus = 'pending' | 'approved' | 'rejected';

interface CategoryRow {
  id: number;
  name: string;
  target_role: TargetRole;
  allowed_formats: string;
  max_size_mb: number;
  is_mandatory: number;
  description: string | null;
  status: number;
  sort_order: number;
  created_at: Date | null;
  updated_at: Date | null;
}

interface SubmittedRow {
  id: number;
  category_id: number;
  category_name: string | null;
  is_mandatory: number | null;
  owner_type: TargetRole;
  owner_id: number;
  owner_name: string | null;
  file_path: string;
  original_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  status: DocStatus;
  remarks: string | null;
  reviewed_by: number | null;
  reviewed_at: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
}

type MongoDocCategory = {
  mysql_id: number;
  name: string;
  target_role: TargetRole;
  allowed_formats?: string | null;
  max_size_mb?: number | null;
  is_mandatory?: boolean | number | null;
  description?: string | null;
  status?: boolean | number | null;
  sort_order?: number | null;
  created_at?: Date | null;
  updated_at?: Date | null;
};

type MongoSubmittedDoc = {
  mysql_id: number;
  category_id: number;
  owner_type: TargetRole;
  owner_id: number;
  file_path: string;
  original_name?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  status: DocStatus;
  remarks?: string | null;
  reviewed_by?: number | null;
  reviewed_at?: Date | null;
  created_at?: Date | null;
  updated_at?: Date | null;
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoDataService,
  ) {}

  /** Feature flag — when set, documents reads/writes route to MongoDB. */
  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_DOCUMENTS ?? '1').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  /** Resolve owner display name for a submitted doc. */
  private async ownerNameMongo(ownerType: TargetRole, ownerId: number): Promise<string | null> {
    if (ownerType === 'vendor') {
      const v = await this.mongo.findByMysqlId<{ f_name?: string; l_name?: string }>('vendors', ownerId);
      if (!v) return null;
      return [v.f_name, v.l_name].filter((x) => x != null && String(x).length > 0).join(' ') || null;
    }
    if (ownerType === 'delivery_man') {
      const dm = await this.mongo.findByMysqlId<{ f_name?: string; l_name?: string }>('delivery_men', ownerId);
      if (!dm) return null;
      return [dm.f_name, dm.l_name].filter((x) => x != null && String(x).length > 0).join(' ') || null;
    }
    if (ownerType === 'restaurant') {
      const r = await this.mongo.findByMysqlId<{ name?: string }>('restaurants', ownerId);
      return r?.name ?? null;
    }
    return null;
  }

  // ── Document categories (master) ──────────────────────────────
  async listCategories(targetRole?: TargetRole) {
    if (this.useMongo()) {
      const filter: Record<string, unknown> = {};
      if (targetRole) filter.target_role = targetRole;
      const docs = await this.mongo.findMany<MongoDocCategory>('document_categories', filter, {
        sort: { target_role: 1, sort_order: 1, mysql_id: 1 },
      });
      return docs.map((d) => ({
        id: Number(d.mysql_id),
        name: d.name,
        target_role: d.target_role,
        allowed_formats: d.allowed_formats ?? 'pdf,jpg,jpeg,png',
        max_size_mb: Number(d.max_size_mb ?? 5),
        is_mandatory: !!d.is_mandatory,
        description: d.description ?? null,
        status: !!(d.status ?? true),
        sort_order: Number(d.sort_order ?? 0),
        created_at: d.created_at ?? null,
        updated_at: d.updated_at ?? null,
      }));
    }

    const where = targetRole ? `WHERE target_role = '${targetRole}'` : '';
    const rows = await this.prisma.$queryRawUnsafe<CategoryRow[]>(
      `SELECT id, name, target_role, allowed_formats, max_size_mb, is_mandatory,
              description, status, sort_order, created_at, updated_at
       FROM document_categories
       ${where}
       ORDER BY target_role ASC, sort_order ASC, id ASC`,
    );
    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      max_size_mb: Number(r.max_size_mb),
      sort_order: Number(r.sort_order),
      is_mandatory: !!r.is_mandatory,
      status: !!r.status,
    }));
  }

  async createCategory(body: {
    name: string;
    target_role: TargetRole;
    allowed_formats?: string;
    max_size_mb?: number;
    is_mandatory?: boolean;
    description?: string | null;
    sort_order?: number;
  }) {
    if (!body.name?.trim()) throw new BadRequestException({ errors: [{ code: 'name', message: 'name required' }] });
    if (!['vendor', 'delivery_man', 'restaurant'].includes(body.target_role)) {
      throw new BadRequestException({ errors: [{ code: 'target_role', message: 'invalid target_role' }] });
    }

    if (this.useMongo()) {
      const now = new Date();
      const mysqlId = await this.mongo.nextMysqlId('document_categories');
      await this.mongo.insertOne<MongoDocCategory>('document_categories', {
        mysql_id: mysqlId,
        name: body.name.trim(),
        target_role: body.target_role,
        allowed_formats: (body.allowed_formats ?? 'pdf,jpg,jpeg,png').trim(),
        max_size_mb: body.max_size_mb ?? 5,
        is_mandatory: !!body.is_mandatory,
        description: body.description ?? null,
        status: true,
        sort_order: body.sort_order ?? 0,
        created_at: now,
        updated_at: now,
      });
      return { ok: true };
    }

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO document_categories
        (name, target_role, allowed_formats, max_size_mb, is_mandatory, description, status, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())`,
      body.name.trim(),
      body.target_role,
      (body.allowed_formats ?? 'pdf,jpg,jpeg,png').trim(),
      body.max_size_mb ?? 5,
      body.is_mandatory ? 1 : 0,
      body.description ?? null,
      body.sort_order ?? 0,
    );
    return { ok: true };
  }

  async updateCategory(id: number, body: {
    name?: string;
    target_role?: TargetRole;
    allowed_formats?: string;
    max_size_mb?: number;
    is_mandatory?: boolean;
    description?: string | null;
    sort_order?: number;
  }) {
    if (this.useMongo()) {
      const set: Record<string, unknown> = {};
      if (body.name !== undefined) set.name = body.name.trim();
      if (body.target_role !== undefined) set.target_role = body.target_role;
      if (body.allowed_formats !== undefined) set.allowed_formats = body.allowed_formats.trim();
      if (body.max_size_mb !== undefined) set.max_size_mb = body.max_size_mb;
      if (body.is_mandatory !== undefined) set.is_mandatory = !!body.is_mandatory;
      if (body.description !== undefined) set.description = body.description;
      if (body.sort_order !== undefined) set.sort_order = body.sort_order;
      if (Object.keys(set).length === 0) return { ok: true, id };
      set.updated_at = new Date();
      await this.mongo.updateOne('document_categories', { mysql_id: Number(id) }, set);
      return { ok: true, id };
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name.trim()); }
    if (body.target_role !== undefined) { updates.push('target_role = ?'); values.push(body.target_role); }
    if (body.allowed_formats !== undefined) { updates.push('allowed_formats = ?'); values.push(body.allowed_formats.trim()); }
    if (body.max_size_mb !== undefined) { updates.push('max_size_mb = ?'); values.push(body.max_size_mb); }
    if (body.is_mandatory !== undefined) { updates.push('is_mandatory = ?'); values.push(body.is_mandatory ? 1 : 0); }
    if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description); }
    if (body.sort_order !== undefined) { updates.push('sort_order = ?'); values.push(body.sort_order); }
    if (updates.length === 0) return { ok: true, id };
    updates.push('updated_at = NOW()');
    values.push(id);
    await this.prisma.$executeRawUnsafe(
      `UPDATE document_categories SET ${updates.join(', ')} WHERE id = ?`,
      ...values,
    );
    return { ok: true, id };
  }

  async toggleCategoryStatus(id: number, status: boolean) {
    if (this.useMongo()) {
      await this.mongo.updateOne(
        'document_categories',
        { mysql_id: Number(id) },
        { status: !!status, updated_at: new Date() },
      );
      return { ok: true, id, status };
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE document_categories SET status = ?, updated_at = NOW() WHERE id = ?`,
      status ? 1 : 0,
      id,
    );
    return { ok: true, id, status };
  }

  async deleteCategory(id: number) {
    if (this.useMongo()) {
      const count = await this.mongo.count('submitted_documents', { category_id: Number(id) });
      if (count > 0) {
        throw new BadRequestException({
          errors: [{ code: 'in_use', message: `Cannot delete — ${count} submitted document(s) reference this category. Disable it instead.` }],
        });
      }
      await this.mongo.deleteOne('document_categories', { mysql_id: Number(id) });
      return { ok: true, id };
    }

    const inUse = await this.prisma.$queryRawUnsafe<Array<{ c: number | bigint }>>(
      `SELECT COUNT(*) AS c FROM submitted_documents WHERE category_id = ?`,
      id,
    );
    const count = Number(inUse[0]?.c ?? 0);
    if (count > 0) {
      throw new BadRequestException({
        errors: [{ code: 'in_use', message: `Cannot delete — ${count} submitted document(s) reference this category. Disable it instead.` }],
      });
    }
    await this.prisma.$executeRawUnsafe(`DELETE FROM document_categories WHERE id = ?`, id);
    return { ok: true, id };
  }

  // ── Submitted documents (review queue) ────────────────────────
  async listSubmitted(filters: { status?: DocStatus; ownerType?: TargetRole; ownerId?: number; limit?: number } = {}) {
    const limit = Math.min(filters.limit ?? 500, 2000);

    if (this.useMongo()) {
      const filter: Record<string, unknown> = {};
      if (filters.status) filter.status = filters.status;
      if (filters.ownerType) filter.owner_type = filters.ownerType;
      if (filters.ownerId) filter.owner_id = Number(filters.ownerId);
      const docs = await this.mongo.findMany<MongoSubmittedDoc>('submitted_documents', filter, {
        sort: { created_at: -1, mysql_id: -1 },
        limit,
      });

      // Preload categories (cache map by mysql_id)
      const catIds = Array.from(new Set(docs.map((d) => Number(d.category_id))));
      const catDocs = catIds.length
        ? await this.mongo.findMany<MongoDocCategory>('document_categories', { mysql_id: { $in: catIds } })
        : [];
      const catMap = new Map<number, MongoDocCategory>();
      for (const c of catDocs) catMap.set(Number(c.mysql_id), c);

      const out = [] as Array<SubmittedRow & { id: number }>;
      for (const d of docs) {
        const cat = catMap.get(Number(d.category_id));
        const ownerName = await this.ownerNameMongo(d.owner_type, Number(d.owner_id));
        out.push({
          id: Number(d.mysql_id),
          category_id: Number(d.category_id),
          category_name: cat?.name ?? null,
          is_mandatory: cat ? (!!cat.is_mandatory ? 1 : 0) : null,
          owner_type: d.owner_type,
          owner_id: Number(d.owner_id),
          owner_name: ownerName,
          file_path: d.file_path,
          original_name: d.original_name ?? null,
          mime_type: d.mime_type ?? null,
          file_size_bytes: d.file_size_bytes != null ? Number(d.file_size_bytes) : null,
          status: d.status,
          remarks: d.remarks ?? null,
          reviewed_by: d.reviewed_by != null ? Number(d.reviewed_by) : null,
          reviewed_at: d.reviewed_at ?? null,
          created_at: d.created_at ?? null,
          updated_at: d.updated_at ?? null,
        });
      }
      // Final massage to match Prisma output shape (booleanise is_mandatory)
      return out.map((r) => ({
        ...r,
        is_mandatory: r.is_mandatory === null ? null : !!Number(r.is_mandatory),
      }));
    }

    const conditions: string[] = [];
    if (filters.status) conditions.push(`sd.status = '${filters.status}'`);
    if (filters.ownerType) conditions.push(`sd.owner_type = '${filters.ownerType}'`);
    if (filters.ownerId) conditions.push(`sd.owner_id = ${filters.ownerId}`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await this.prisma.$queryRawUnsafe<SubmittedRow[]>(
      `SELECT
         sd.id, sd.category_id,
         dc.name AS category_name,
         dc.is_mandatory,
         sd.owner_type, sd.owner_id,
         CASE
           WHEN sd.owner_type = 'vendor' THEN (SELECT CONCAT_WS(' ', v.f_name, v.l_name) FROM vendors v WHERE v.id = sd.owner_id)
           WHEN sd.owner_type = 'delivery_man' THEN (SELECT CONCAT_WS(' ', dm.f_name, dm.l_name) FROM delivery_men dm WHERE dm.id = sd.owner_id)
           WHEN sd.owner_type = 'restaurant' THEN (SELECT r.name FROM restaurants r WHERE r.id = sd.owner_id)
           ELSE NULL
         END AS owner_name,
         sd.file_path, sd.original_name, sd.mime_type, sd.file_size_bytes,
         sd.status, sd.remarks, sd.reviewed_by, sd.reviewed_at,
         sd.created_at, sd.updated_at
       FROM submitted_documents sd
       LEFT JOIN document_categories dc ON dc.id = sd.category_id
       ${where}
       ORDER BY sd.created_at DESC, sd.id DESC
       LIMIT ${limit}`,
    );
    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      category_id: Number(r.category_id),
      owner_id: Number(r.owner_id),
      file_size_bytes: r.file_size_bytes ? Number(r.file_size_bytes) : null,
      is_mandatory: r.is_mandatory === null ? null : !!Number(r.is_mandatory),
      reviewed_by: r.reviewed_by ? Number(r.reviewed_by) : null,
    }));
  }

  async approveDocument(id: number, reviewerId: number, remarks?: string) {
    if (this.useMongo()) {
      const existing = await this.mongo.findByMysqlId<MongoSubmittedDoc>('submitted_documents', id);
      if (!existing) throw new NotFoundException({ errors: [{ code: 'not_found', message: 'document not found' }] });
      const now = new Date();
      await this.mongo.updateOne(
        'submitted_documents',
        { mysql_id: Number(id) },
        {
          status: 'approved',
          remarks: remarks ?? null,
          reviewed_by: Number(reviewerId),
          reviewed_at: now,
          updated_at: now,
        },
      );
      return { ok: true, id, status: 'approved' };
    }

    const exists = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM submitted_documents WHERE id = ? LIMIT 1`,
      id,
    );
    if (!exists.length) throw new NotFoundException({ errors: [{ code: 'not_found', message: 'document not found' }] });
    await this.prisma.$executeRawUnsafe(
      `UPDATE submitted_documents
       SET status = 'approved', remarks = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      remarks ?? null,
      reviewerId,
      id,
    );
    return { ok: true, id, status: 'approved' };
  }

  async rejectDocument(id: number, reviewerId: number, remarks: string) {
    if (!remarks?.trim()) {
      throw new BadRequestException({ errors: [{ code: 'remarks', message: 'remarks are required when rejecting' }] });
    }

    if (this.useMongo()) {
      const existing = await this.mongo.findByMysqlId<MongoSubmittedDoc>('submitted_documents', id);
      if (!existing) throw new NotFoundException({ errors: [{ code: 'not_found', message: 'document not found' }] });
      const now = new Date();
      await this.mongo.updateOne(
        'submitted_documents',
        { mysql_id: Number(id) },
        {
          status: 'rejected',
          remarks: remarks.trim(),
          reviewed_by: Number(reviewerId),
          reviewed_at: now,
          updated_at: now,
        },
      );
      return { ok: true, id, status: 'rejected' };
    }

    const exists = await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM submitted_documents WHERE id = ? LIMIT 1`,
      id,
    );
    if (!exists.length) throw new NotFoundException({ errors: [{ code: 'not_found', message: 'document not found' }] });
    await this.prisma.$executeRawUnsafe(
      `UPDATE submitted_documents
       SET status = 'rejected', remarks = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      remarks.trim(),
      reviewerId,
      id,
    );
    return { ok: true, id, status: 'rejected' };
  }

  async deleteSubmitted(id: number) {
    if (this.useMongo()) {
      await this.mongo.deleteOne('submitted_documents', { mysql_id: Number(id) });
      return { ok: true, id };
    }

    await this.prisma.$executeRawUnsafe(`DELETE FROM submitted_documents WHERE id = ?`, id);
    return { ok: true, id };
  }

  async getStats() {
    if (this.useMongo()) {
      const rows = await this.mongo.aggregate<{ _id: DocStatus; c: number }>('submitted_documents', [
        { $group: { _id: '$status', c: { $sum: 1 } } },
      ]);
      const summary = { pending: 0, approved: 0, rejected: 0, total: 0 };
      for (const r of rows) {
        const n = Number(r.c ?? 0);
        const status = r._id as DocStatus;
        if (status in summary) (summary as Record<string, number>)[status] = n;
        summary.total += n;
      }
      return summary;
    }

    const rows = await this.prisma.$queryRawUnsafe<Array<{ status: DocStatus; c: bigint | number }>>(
      `SELECT status, COUNT(*) AS c FROM submitted_documents GROUP BY status`,
    );
    const summary = { pending: 0, approved: 0, rejected: 0, total: 0 };
    for (const r of rows) {
      const n = Number(r.c);
      summary[r.status] = n;
      summary.total += n;
    }
    return summary;
  }
}
