import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { RequireAuth, type AuthedRequest } from '../auth/auth.guard';
import { DocumentsService } from './documents.service';

type TargetRole = 'vendor' | 'delivery_man' | 'restaurant';

@Controller('admin')
@RequireAuth('admin')
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  // ── Document categories (master) ──────────────────────────────
  @Get('document-categories')
  listCategories(@Query('target_role') role?: TargetRole) {
    return this.svc.listCategories(role);
  }

  @Post('document-categories')
  @HttpCode(200)
  createCategory(@Body() body: Parameters<DocumentsService['createCategory']>[0]) {
    return this.svc.createCategory(body);
  }

  @Patch('document-categories/:id')
  @HttpCode(200)
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Parameters<DocumentsService['updateCategory']>[1],
  ) {
    return this.svc.updateCategory(id, body);
  }

  @Patch('document-categories/:id/status')
  @HttpCode(200)
  toggleCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: boolean },
  ) {
    return this.svc.toggleCategoryStatus(id, body.status);
  }

  @Delete('document-categories/:id')
  @HttpCode(200)
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteCategory(id);
  }

  // ── Submitted documents (review queue) ────────────────────────
  @Get('submitted-documents')
  listSubmitted(
    @Query('status') status?: 'pending' | 'approved' | 'rejected',
    @Query('owner_type') ownerType?: TargetRole,
    @Query('owner_id') ownerId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listSubmitted({
      status,
      ownerType,
      ownerId: ownerId ? parseInt(ownerId, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('submitted-documents/stats')
  stats() {
    return this.svc.getStats();
  }

  @Patch('submitted-documents/:id/approve')
  @HttpCode(200)
  approve(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { remarks?: string },
  ) {
    const reviewer = Number(req.actor?.id ?? 0);
    return this.svc.approveDocument(id, reviewer, body.remarks);
  }

  @Patch('submitted-documents/:id/reject')
  @HttpCode(200)
  reject(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { remarks: string },
  ) {
    const reviewer = Number(req.actor?.id ?? 0);
    return this.svc.rejectDocument(id, reviewer, body.remarks);
  }

  @Delete('submitted-documents/:id')
  @HttpCode(200)
  deleteSubmitted(@Param('id', ParseIntPipe) id: number) {
    return this.svc.deleteSubmitted(id);
  }
}
