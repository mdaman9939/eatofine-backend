export declare class AppController {
    root(): string;
    health(): {
        ok: boolean;
        service: string;
        database: string;
        uptime_seconds: number;
        timestamp: string;
    };
    apiRoot(): {
        service: string;
        version: string;
        database: string;
        status: string;
        docs: string;
    };
    private formatUptime;
}
