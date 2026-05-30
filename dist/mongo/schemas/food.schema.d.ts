import { HydratedDocument } from 'mongoose';
export type FoodDocument = HydratedDocument<Food>;
export declare class Food {
    mysql_id?: number;
    name?: string;
    description?: string;
    image?: string;
    mysql_restaurant_id?: number;
    mysql_category_id?: number;
    price?: number;
    discount?: number;
    discount_type?: string;
    veg?: boolean;
    status?: boolean;
    recommended?: boolean;
    avg_rating?: number;
    order_count?: number;
    item_stock?: number;
    stock_type?: string;
    variations?: unknown;
    add_ons?: unknown;
    legacy?: Record<string, unknown>;
}
export declare const FoodSchema: import("mongoose").Schema<Food, import("mongoose").Model<Food, any, any, any, any, any, Food>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Food, import("mongoose").Document<unknown, {}, Food, {
    id: string;
}, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, "id"> & {
    id: string;
}, {
    mysql_id?: import("mongoose").SchemaDefinitionProperty<number | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    name?: import("mongoose").SchemaDefinitionProperty<string | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    description?: import("mongoose").SchemaDefinitionProperty<string | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    image?: import("mongoose").SchemaDefinitionProperty<string | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    mysql_restaurant_id?: import("mongoose").SchemaDefinitionProperty<number | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    mysql_category_id?: import("mongoose").SchemaDefinitionProperty<number | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    price?: import("mongoose").SchemaDefinitionProperty<number | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    discount?: import("mongoose").SchemaDefinitionProperty<number | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    discount_type?: import("mongoose").SchemaDefinitionProperty<string | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    veg?: import("mongoose").SchemaDefinitionProperty<boolean | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    status?: import("mongoose").SchemaDefinitionProperty<boolean | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    recommended?: import("mongoose").SchemaDefinitionProperty<boolean | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    avg_rating?: import("mongoose").SchemaDefinitionProperty<number | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    order_count?: import("mongoose").SchemaDefinitionProperty<number | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    item_stock?: import("mongoose").SchemaDefinitionProperty<number | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    stock_type?: import("mongoose").SchemaDefinitionProperty<string | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    variations?: import("mongoose").SchemaDefinitionProperty<unknown, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    add_ons?: import("mongoose").SchemaDefinitionProperty<unknown, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
    legacy?: import("mongoose").SchemaDefinitionProperty<Record<string, unknown> | undefined, Food, import("mongoose").Document<unknown, {}, Food, {
        id: string;
    }, import("mongoose").DefaultSchemaOptions> & Omit<Food & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    }, "id"> & {
        id: string;
    }> | undefined;
}, Food>;
