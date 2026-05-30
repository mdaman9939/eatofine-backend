import { PrismaService } from '../prisma/prisma.service';
type TargetRole = 'vendor' | 'delivery_man' | 'restaurant';
type DocStatus = 'pending' | 'approved' | 'rejected';
export declare class DocumentsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listCategories(targetRole?: TargetRole): Promise<{
        id: number;
        max_size_mb: number;
        sort_order: number;
        is_mandatory: boolean;
        status: boolean;
        name: string;
        target_role: TargetRole;
        allowed_formats: string;
        description: string | null;
        created_at: Date | null;
        updated_at: Date | null;
    }[]>;
    createCategory(body: {
        name: string;
        target_role: TargetRole;
        allowed_formats?: string;
        max_size_mb?: number;
        is_mandatory?: boolean;
        description?: string | null;
        sort_order?: number;
    }): Promise<{
        ok: boolean;
    }>;
    updateCategory(id: number, body: {
        name?: string;
        target_role?: TargetRole;
        allowed_formats?: string;
        max_size_mb?: number;
        is_mandatory?: boolean;
        description?: string | null;
        sort_order?: number;
    }): Promise<{
        ok: boolean;
        id: number;
    }>;
    toggleCategoryStatus(id: number, status: boolean): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    deleteCategory(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listSubmitted(filters?: {
        status?: DocStatus;
        ownerType?: TargetRole;
        ownerId?: number;
        limit?: number;
    }): Promise<{
        id: number;
        category_id: number;
        owner_id: number;
        file_size_bytes: number | null;
        is_mandatory: boolean | null;
        reviewed_by: number | null;
        category_name: string | null;
        owner_type: TargetRole;
        owner_name: string | null;
        file_path: string;
        original_name: string | null;
        mime_type: string | null;
        status: DocStatus;
        remarks: string | null;
        reviewed_at: Date | null;
        created_at: Date | null;
        updated_at: Date | null;
    }[]>;
    approveDocument(id: number, reviewerId: number, remarks?: string): Promise<{
        ok: boolean;
        id: number;
        status: string;
    }>;
    rejectDocument(id: number, reviewerId: number, remarks: string): Promise<{
        ok: boolean;
        id: number;
        status: string;
    }>;
    deleteSubmitted(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    getStats(): Promise<{
        pending: number;
        approved: number;
        rejected: number;
        total: number;
    }>;
}
export {};
