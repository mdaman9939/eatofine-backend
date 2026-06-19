import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
import { BusinessSettingsService } from '../business-settings/business-settings.service';
export declare class AuthExtrasController {
    private readonly prisma;
    private readonly mongo;
    private readonly bs;
    constructor(prisma: PrismaService, mongo: MongoDataService, bs: BusinessSettingsService);
    private useMongo;
    private identifier;
    private findAccount;
    private requestOtp;
    private verifyOtp;
    private resetPassword;
    forgot(body?: Record<string, unknown>): Promise<{
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
        demo_otp?: undefined;
    } | {
        message: string;
        errors?: undefined;
        demo_otp?: undefined;
    } | {
        message: string;
        demo_otp: string;
        errors?: undefined;
    }>;
    reset(body?: Record<string, unknown>): Promise<{
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
    } | {
        message: string;
        errors?: undefined;
    }>;
    verifyToken(body?: Record<string, unknown>): Promise<{
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
    } | {
        message: string;
        errors?: undefined;
    }>;
    verifyEmail(): {
        message: string;
    };
    verifyPhone(): {
        message: string;
    };
    checkEmail(): {
        message: string;
    };
    updateInfo(): {
        message: string;
    };
    firebaseVerify(): {
        message: string;
    };
    firebaseReset(): {
        message: string;
    };
    vendorForgot(body?: Record<string, unknown>): Promise<{
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
        demo_otp?: undefined;
    } | {
        message: string;
        errors?: undefined;
        demo_otp?: undefined;
    } | {
        message: string;
        demo_otp: string;
        errors?: undefined;
    }>;
    vendorReset(body?: Record<string, unknown>): Promise<{
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
    } | {
        message: string;
        errors?: undefined;
    }>;
    vendorVerifyToken(body?: Record<string, unknown>): Promise<{
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
    } | {
        message: string;
        errors?: undefined;
    }>;
    vendorRegister(body?: Record<string, unknown>, files?: Express.Multer.File[]): Promise<{
        restaurant_id: number;
        package_id: number | null;
        message: string;
    }>;
    private storageDir;
    private saveUploaded;
    packageRenew(): {
        message: string;
    };
    subscriptionPayment(): {
        redirect_url: null;
    };
    dmForgot(body?: Record<string, unknown>): Promise<{
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
        demo_otp?: undefined;
    } | {
        message: string;
        errors?: undefined;
        demo_otp?: undefined;
    } | {
        message: string;
        demo_otp: string;
        errors?: undefined;
    }>;
    dmReset(body?: Record<string, unknown>): Promise<{
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
    } | {
        message: string;
        errors?: undefined;
    }>;
    dmVerifyToken(body?: Record<string, unknown>): Promise<{
        errors: {
            code: string;
            message: string;
        }[];
        message?: undefined;
    } | {
        message: string;
        errors?: undefined;
    }>;
    dmFirebaseVerify(): {
        message: string;
    };
    dmCheckPassword(): {
        message: string;
    };
    dmBiometric(): {
        message: string;
    };
    dmEnableBio(): {
        message: string;
    };
    dmDisableBio(): {
        message: string;
    };
    dmStore(): {
        message: string;
    };
}
