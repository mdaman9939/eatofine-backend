import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import type { Collection, Document, Filter, FindOptions, ObjectId, OptionalUnlessRequiredId } from 'mongodb';

/**
 * Thin Prisma-style data-access wrapper for MongoDB collections. Lets us
 * migrate services off Prisma incrementally. Usage:
 *
 *   const users = await this.mongo.findMany<User>('users', { status: true }, { limit: 100 });
 *   const user = await this.mongo.findOne<User>('users', { mysql_id: 5 });
 *   const total = await this.mongo.count('orders');
 *
 * Every migrated MySQL row has `mysql_id` (the original integer primary
 * key), so most lookups are `{ mysql_id: <id> }`.
 */
@Injectable()
export class MongoDataService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  /** Get the raw MongoDB driver collection (bypasses Mongoose wrappers). */
  private coll<T extends Document = Document>(name: string): Collection<T> {
    if (!this.connection.db) {
      throw new Error('MongoDB connection not ready');
    }
    return this.connection.db.collection<T>(name) as unknown as Collection<T>;
  }

  /** Find many — like `prisma.foo.findMany({ where, take, skip, orderBy })`. */
  async findMany<T extends Document = Document>(
    collection: string,
    filter: Record<string, unknown> = {},
    options: {
      limit?: number;
      skip?: number;
      sort?: Record<string, 1 | -1>;
      projection?: Record<string, 0 | 1>;
    } = {},
  ): Promise<T[]> {
    const findOpts: FindOptions = {};
    if (options.limit !== undefined) findOpts.limit = options.limit;
    if (options.skip !== undefined) findOpts.skip = options.skip;
    if (options.sort) findOpts.sort = options.sort;
    if (options.projection) findOpts.projection = options.projection;

    const cursor = this.coll<T>(collection).find(filter as Filter<T>, findOpts);
    return (await cursor.toArray()) as unknown as T[];
  }

  /** Find one — like `prisma.foo.findFirst({ where })`. */
  async findOne<T extends Document = Document>(
    collection: string,
    filter: Record<string, unknown>,
  ): Promise<T | null> {
    const doc = await this.coll<T>(collection).findOne(filter as Filter<T>);
    return (doc as unknown as T | null);
  }

  /** Find by mysql_id — common pattern across the codebase. */
  async findByMysqlId<T extends Document = Document>(
    collection: string,
    mysqlId: number | string,
  ): Promise<T | null> {
    return this.findOne<T>(collection, { mysql_id: Number(mysqlId) });
  }

  /** Count documents — like `prisma.foo.count({ where })`. */
  async count(collection: string, filter: Record<string, unknown> = {}): Promise<number> {
    return this.coll<Document>(collection).countDocuments(filter as Filter<Document>);
  }

  /** Insert one — like `prisma.foo.create({ data })`. Returns inserted document with _id. */
  async insertOne<T extends Document = Document>(
    collection: string,
    doc: T,
  ): Promise<T & { _id: ObjectId }> {
    const res = await this.coll<T>(collection).insertOne(doc as OptionalUnlessRequiredId<T>);
    return { ...doc, _id: res.insertedId } as T & { _id: ObjectId };
  }

  /** Update one — like `prisma.foo.update({ where, data })`. */
  async updateOne(
    collection: string,
    filter: Record<string, unknown>,
    set: Record<string, unknown>,
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    const res = await this.coll<Document>(collection).updateOne(
      filter as Filter<Document>,
      { $set: set },
    );
    return { matchedCount: res.matchedCount, modifiedCount: res.modifiedCount };
  }

  /** Update many. */
  async updateMany(
    collection: string,
    filter: Record<string, unknown>,
    set: Record<string, unknown>,
  ): Promise<{ matchedCount: number; modifiedCount: number }> {
    const res = await this.coll<Document>(collection).updateMany(
      filter as Filter<Document>,
      { $set: set },
    );
    return { matchedCount: res.matchedCount, modifiedCount: res.modifiedCount };
  }

  /** Delete one — like `prisma.foo.delete({ where })`. */
  async deleteOne(
    collection: string,
    filter: Record<string, unknown>,
  ): Promise<{ deletedCount: number }> {
    const res = await this.coll<Document>(collection).deleteOne(filter as Filter<Document>);
    return { deletedCount: res.deletedCount };
  }

  /** Delete many — used by Clean Database (truncate). Empty filter = wipe all. */
  async deleteMany(
    collection: string,
    filter: Record<string, unknown>,
  ): Promise<number> {
    const res = await this.coll<Document>(collection).deleteMany(filter as Filter<Document>);
    return res.deletedCount ?? 0;
  }

  /** Aggregation pipeline — for reports, multi-step grouping. */
  async aggregate<T extends Document = Document>(
    collection: string,
    pipeline: Document[],
  ): Promise<T[]> {
    return this.coll<Document>(collection).aggregate<T>(pipeline).toArray();
  }

  /** Get the next auto-increment-like mysql_id for a collection.
   * Used when creating new docs that need a `mysql_id` slot. */
  async nextMysqlId(collection: string): Promise<number> {
    const top = await this.coll<Document>(collection)
      .find({}, { projection: { mysql_id: 1 }, sort: { mysql_id: -1 }, limit: 1 })
      .toArray();
    const cur = top[0] ? Number((top[0] as Record<string, unknown>).mysql_id ?? 0) : 0;
    return cur + 1;
  }
}
