import { Connection } from 'mongoose';
export declare class AppController {
    private readonly mongo;
    constructor(mongo: Connection);
    root(): string;
    health(): Promise<{
        ok: boolean;
        service: string;
        database: {
            name: string;
            state: string;
            ping_ok: boolean;
            latency_ms: number | null;
            error: string | null;
        };
        uptime_seconds: number;
        timestamp: string;
    }>;
    apiRoot(): {
        service: string;
        version: string;
        database: string;
        status: string;
        docs: string;
    };
    private formatUptime;
}
