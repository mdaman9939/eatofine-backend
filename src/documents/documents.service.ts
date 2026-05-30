import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Document categories (master) ──────────────────────────────
  async listCategories(targetRole?: TargetRole) {
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
    await this.prisma.$executeRawUnsafe(
      `UPDATE document_categories SET status = ?, updated_at = NOW() WHERE id = ?`,
      status ? 1 : 0,
      id,
    );
    return { ok: true, id, status };
  }

  async deleteCategory(id: number) {
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
    const conditions: string[] = [];
    if (filters.status) conditions.push(`sd.status = '${filters.status}'`);
    if (filters.ownerType) conditions.push(`sd.owner_type = '${filters.ownerType}'`);
    if (filters.ownerId) conditions.push(`sd.owner_id = ${filters.ownerId}`);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filters.limit ?? 500, 2000);

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
    await this.prisma.$executeRawUnsafe(`DELETE FROM submitted_documents WHERE id = ?`, id);
    return { ok: true, id };
  }

  async getStats() {
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
