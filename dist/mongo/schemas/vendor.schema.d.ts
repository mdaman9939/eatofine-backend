import { HydratedDocument } from 'mongoose';
export type VendorDocument = HydratedDocument<Vendor>;
export declare class Vendor {
    mysql_id?: number;
    f_name?: string;
    l_name?: string;
    email?: string;
    phone?: string;
    password?: string;
    status?: boolean;
    image?: string;
    last_login_at?: Date;
    legacy?: Record<string, unknown>;
}
export declare const VendorSchema: import("mongoose").Schema<Vendor, import("mongoose").Model<Vendor, any, any, any, any, any, Vendor>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Vendor, import("mongoose").Document<unknown, {}, Vendor, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Vendor & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    mysql_id?: import("mongoose").SchemaDefinitionProperty<number | undefined, Vendor, import("mongoose").Document<unknown, {}, Vendor, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Vendor & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    f_name?: import("mongoose").SchemaDefinitionProperty<string | undefined, Vendor, import("mongoose").Document<unknown, {}, Vendor, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Vendor & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    l_name?: import("mongoose").SchemaDefinitionProperty<string | undefined, Vendor, import("mongoose").Document<unknown, {}, Vendor, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Vendor & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    email?: import("mongoose").SchemaDefinitionProperty<string | undefined, Vendor, import("mongoose").Document<unknown, {}, Vendor, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Vendor & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    phone?: import("mongoose").SchemaDefinitionProperty<string | undefined, Vendor, import("mongoose").Document<unknown, {}, Vendor, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Vendor & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    password?: import("mongoose").SchemaDefinitionProperty<string | undefined, Vendor, import("mongoose").Document<unknown, {}, Vendor, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Vendor & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<boolean | undefined, Vendor, import("mongoose").Document<unknown, {}, Vendor, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Vendor & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    image?: import("mongoose").SchemaDefinitionProperty<string | undefined, Vendor, import("mongoose").Document<unknown, {}, Vendor, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Vendor & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    last_login_at?: import("mongoose").SchemaDefinitionProperty<Date | undefined, Vendor, import("mongoose").Document<unknown, {}, Vendor, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Vendor & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    legacy?: import("mongoose").SchemaDefinitionProperty<Record<string, unknown> | undefined, Vendor, import("mongoose").Document<unknown, {}, Vendor, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Vendor & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Vendor>;
