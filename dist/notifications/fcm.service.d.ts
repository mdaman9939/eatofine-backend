export declare class FcmService {
    private readonly logger;
    private app;
    private initialized;
    private disabled;
    private ensureApp;
    private loadCredential;
    isEnabled(): boolean;
    sendToToken(token: string | null | undefined, notification: {
        title: string;
        body: string;
    }, data?: Record<string, string | number | null | undefined>): Promise<boolean>;
}
