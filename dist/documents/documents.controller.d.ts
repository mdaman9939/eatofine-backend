import { type AuthedRequest } from '../auth/auth.guard';
import { DocumentsService } from './documents.service';
type TargetRole = 'vendor' | 'delivery_man' | 'restaurant';
export declare class DocumentsController {
    private readonly svc;
    constructor(svc: DocumentsService);
    listCategories(role?: TargetRole): Promise<{
        id: number;
        name: string;
        target_role: "vendor" | "restaurant" | "delivery_man";
        allowed_formats: string;
        max_size_mb: number;
        is_mandatory: boolean;
        description: string | null;
        status: boolean;
        sort_order: number;
        created_at: Date | null;
        updated_at: Date | null;
    }[]>;
    createCategory(body: Parameters<DocumentsService['createCategory']>[0]): Promise<{
        ok: boolean;
    }>;
    updateCategory(id: number, body: Parameters<DocumentsService['updateCategory']>[1]): Promise<{
        ok: boolean;
        id: number;
    }>;
    toggleCategory(id: number, body: {
        status: boolean;
    }): Promise<{
        ok: boolean;
        id: number;
        status: boolean;
    }>;
    deleteCategory(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
    listSubmitted(status?: 'pending' | 'approved' | 'rejected', ownerType?: TargetRole, ownerId?: string, limit?: string): Promise<{
        is_mandatory: boolean | null;
        id: number;
        category_id: number;
        category_name: string | null;
        owner_type: "vendor" | "restaurant" | "delivery_man";
        owner_id: number;
        owner_name: string | null;
        file_path: string;
        original_name: string | null;
        mime_type: string | null;
        file_size_bytes: number | null;
        status: "approved" | "pending" | "rejected";
        remarks: string | null;
        reviewed_by: number | null;
        reviewed_at: Date | null;
        created_at: Date | null;
        updated_at: Date | null;
    }[]>;
    stats(): Promise<{
        pending: number;
        approved: number;
        rejected: number;
        total: number;
    }>;
    approve(req: AuthedRequest, id: number, body: {
        remarks?: string;
    }): Promise<{
        ok: boolean;
        id: number;
        status: string;
    }>;
    reject(req: AuthedRequest, id: number, body: {
        remarks: string;
    }): Promise<{
        ok: boolean;
        id: number;
        status: string;
    }>;
    deleteSubmitted(id: number): Promise<{
        ok: boolean;
        id: number;
    }>;
}
export {};
