import { OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
export declare class PrismaService extends PrismaClient implements OnModuleDestroy {
    private readonly log;
    constructor();
    onModuleDestroy(): Promise<void>;
}
