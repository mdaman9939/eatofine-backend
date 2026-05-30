import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
export declare class AuthExtrasController {
    private readonly prisma;
    private readonly mongo;
    constructor(prisma: PrismaService, mongo: MongoDataService);
    private useMongo;
    forgot(): {
        message: string;
    };
    reset(): {
        message: string;
    };
    verifyToken(): {
        message: string;
        otp: string;
    };
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
    vendorForgot(): {
        message: string;
    };
    vendorReset(): {
        message: string;
    };
    vendorVerifyToken(): {
        message: string;
    };
    vendorRegister(_body: unknown): {
        message: string;
    };
    packageRenew(): {
        message: string;
    };
    subscriptionPayment(): {
        redirect_url: null;
    };
    dmForgot(): {
        message: string;
    };
    dmReset(): {
        message: string;
    };
    dmVerifyToken(): {
        message: string;
    };
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
