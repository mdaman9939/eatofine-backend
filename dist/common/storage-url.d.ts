import { AsyncLocalStorage } from 'async_hooks';
export declare const storageContext: AsyncLocalStorage<{
    baseUrl?: string;
}>;
export declare function storageBaseUrl(): string;
export declare function storageFullUrl(folder: string, file?: string | null): string | null;
