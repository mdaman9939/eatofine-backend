import { HydratedDocument } from 'mongoose';
export type RestaurantDocument = HydratedDocument<Restaurant>;
export declare class Restaurant {
    mysql_id?: number;
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    mysql_vendor_id?: number;
    mysql_zone_id?: number;
    logo?: string;
    cover_photo?: string;
    comission?: number;
    minimum_order?: number;
    restaurant_model?: string;
    status?: boolean;
    active?: boolean;
    order_count?: number;
    legacy?: Record<string, unknown>;
}
export declare const RestaurantSchema: import("mongoose").Schema<Restaurant, import("mongoose").Model<Restaurant, any, any, any, any, any, Restaurant>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    mysql_id?: import("mongoose").SchemaDefinitionProperty<number | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    name?: import("mongoose").SchemaDefinitionProperty<string | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    email?: import("mongoose").SchemaDefinitionProperty<string | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    phone?: import("mongoose").SchemaDefinitionProperty<string | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    address?: import("mongoose").SchemaDefinitionProperty<string | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    latitude?: import("mongoose").SchemaDefinitionProperty<number | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    longitude?: import("mongoose").SchemaDefinitionProperty<number | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    mysql_vendor_id?: import("mongoose").SchemaDefinitionProperty<number | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    mysql_zone_id?: import("mongoose").SchemaDefinitionProperty<number | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    logo?: import("mongoose").SchemaDefinitionProperty<string | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    cover_photo?: import("mongoose").SchemaDefinitionProperty<string | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    comission?: import("mongoose").SchemaDefinitionProperty<number | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    minimum_order?: import("mongoose").SchemaDefinitionProperty<number | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    restaurant_model?: import("mongoose").SchemaDefinitionProperty<string | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<boolean | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    active?: import("mongoose").SchemaDefinitionProperty<boolean | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    order_count?: import("mongoose").SchemaDefinitionProperty<number | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    legacy?: import("mongoose").SchemaDefinitionProperty<Record<string, unknown> | undefined, Restaurant, import("mongoose").Document<unknown, {}, Restaurant, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Restaurant & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Restaurant>;
