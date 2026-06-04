import { Connection } from 'mongoose';
import type { Document, ObjectId } from 'mongodb';
export declare class MongoDataService {
    private readonly connection;
    constructor(connection: Connection);
    private coll;
    findMany<T extends Document = Document>(collection: string, filter?: Record<string, unknown>, options?: {
        limit?: number;
        skip?: number;
        sort?: Record<string, 1 | -1>;
        projection?: Record<string, 0 | 1>;
    }): Promise<T[]>;
    findOne<T extends Document = Document>(collection: string, filter: Record<string, unknown>): Promise<T | null>;
    findByMysqlId<T extends Document = Document>(collection: string, mysqlId: number | string): Promise<T | null>;
    count(collection: string, filter?: Record<string, unknown>): Promise<number>;
    insertOne<T extends Document = Document>(collection: string, doc: T): Promise<T & {
        _id: ObjectId;
    }>;
    updateOne(collection: string, filter: Record<string, unknown>, set: Record<string, unknown>): Promise<{
        matchedCount: number;
        modifiedCount: number;
    }>;
    updateMany(collection: string, filter: Record<string, unknown>, set: Record<string, unknown>): Promise<{
        matchedCount: number;
        modifiedCount: number;
    }>;
    deleteOne(collection: string, filter: Record<string, unknown>): Promise<{
        deletedCount: number;
    }>;
    deleteMany(collection: string, filter: Record<string, unknown>): Promise<number>;
    aggregate<T extends Document = Document>(collection: string, pipeline: Document[]): Promise<T[]>;
    nextMysqlId(collection: string): Promise<number>;
}
