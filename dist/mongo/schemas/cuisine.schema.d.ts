import { HydratedDocument } from 'mongoose';
export type CuisineDocument = HydratedDocument<Cuisine>;
export declare class Cuisine {
    mysql_id?: number;
    name?: string;
    image?: string;
    status?: boolean;
    legacy?: Record<string, unknown>;
}
export declare const CuisineSchema: import("mongoose").Schema<Cuisine, import("mongoose").Model<Cuisine, any, any, any, any, any, Cuisine>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Cuisine, import("mongoose").Document<unknown, {}, Cuisine, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Cuisine & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    mysql_id?: import("mongoose").SchemaDefinitionProperty<number | undefined, Cuisine, import("mongoose").Document<unknown, {}, Cuisine, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Cuisine & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    name?: import("mongoose").SchemaDefinitionProperty<string | undefined, Cuisine, import("mongoose").Document<unknown, {}, Cuisine, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Cuisine & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    image?: import("mongoose").SchemaDefinitionProperty<string | undefined, Cuisine, import("mongoose").Document<unknown, {}, Cuisine, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Cuisine & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<boolean | undefined, Cuisine, import("mongoose").Document<unknown, {}, Cuisine, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Cuisine & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    legacy?: import("mongoose").SchemaDefinitionProperty<Record<string, unknown> | undefined, Cuisine, import("mongoose").Document<unknown, {}, Cuisine, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Cuisine & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Cuisine>;
