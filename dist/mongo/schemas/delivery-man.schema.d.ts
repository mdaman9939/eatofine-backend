import { HydratedDocument } from 'mongoose';
export type DeliveryManDocument = HydratedDocument<DeliveryMan>;
export declare class DeliveryMan {
    mysql_id?: number;
    f_name?: string;
    l_name?: string;
    email?: string;
    phone?: string;
    password?: string;
    status?: boolean;
    image?: string;
    application_status?: string;
    mysql_zone_id?: number;
    legacy?: Record<string, unknown>;
}
export declare const DeliveryManSchema: import("mongoose").Schema<DeliveryMan, import("mongoose").Model<DeliveryMan, any, any, any, any, any, DeliveryMan>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, DeliveryMan, import("mongoose").Document<unknown, {}, DeliveryMan, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<DeliveryMan & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    mysql_id?: import("mongoose").SchemaDefinitionProperty<number | undefined, DeliveryMan, import("mongoose").Document<unknown, {}, DeliveryMan, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeliveryMan & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    f_name?: import("mongoose").SchemaDefinitionProperty<string | undefined, DeliveryMan, import("mongoose").Document<unknown, {}, DeliveryMan, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeliveryMan & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    l_name?: import("mongoose").SchemaDefinitionProperty<string | undefined, DeliveryMan, import("mongoose").Document<unknown, {}, DeliveryMan, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeliveryMan & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    email?: import("mongoose").SchemaDefinitionProperty<string | undefined, DeliveryMan, import("mongoose").Document<unknown, {}, DeliveryMan, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeliveryMan & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    phone?: import("mongoose").SchemaDefinitionProperty<string | undefined, DeliveryMan, import("mongoose").Document<unknown, {}, DeliveryMan, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeliveryMan & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    password?: import("mongoose").SchemaDefinitionProperty<string | undefined, DeliveryMan, import("mongoose").Document<unknown, {}, DeliveryMan, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeliveryMan & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<boolean | undefined, DeliveryMan, import("mongoose").Document<unknown, {}, DeliveryMan, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeliveryMan & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    image?: import("mongoose").SchemaDefinitionProperty<string | undefined, DeliveryMan, import("mongoose").Document<unknown, {}, DeliveryMan, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeliveryMan & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    application_status?: import("mongoose").SchemaDefinitionProperty<string | undefined, DeliveryMan, import("mongoose").Document<unknown, {}, DeliveryMan, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeliveryMan & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    mysql_zone_id?: import("mongoose").SchemaDefinitionProperty<number | undefined, DeliveryMan, import("mongoose").Document<unknown, {}, DeliveryMan, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeliveryMan & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    legacy?: import("mongoose").SchemaDefinitionProperty<Record<string, unknown> | undefined, DeliveryMan, import("mongoose").Document<unknown, {}, DeliveryMan, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<DeliveryMan & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, DeliveryMan>;
