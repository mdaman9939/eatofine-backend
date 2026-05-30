import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
type Actor = 'customer' | 'vendor' | 'deliveryman' | 'admin';
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    private readonly mongo;
    constructor(prisma: PrismaService, jwt: JwtService, mongo: MongoDataService);
    private useMongo;
    private generateToken;
    verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean>;
    customerLoginByEmail(email: string, password: string): Promise<{
        token: string;
        is_phone_verified: number;
        is_email_verified: number;
        is_personal_info: number;
        is_exist_user: null;
        login_type: string;
        email: string | null;
    }>;
    customerLoginByPhone(phone: string, password: string): Promise<{
        token: string;
        is_phone_verified: number;
        is_email_verified: number;
        is_personal_info: number;
        is_exist_user: null;
        login_type: string;
        email: string | null;
    }>;
    customerRegister(input: {
        f_name: string;
        l_name?: string;
        phone: string;
        email?: string;
        password: string;
    }): Promise<{
        token: string;
        is_phone_verified: number;
        is_email_verified: number;
        is_personal_info: number;
        is_exist_user: null;
        login_type: string;
        email: string | null;
    }>;
    vendorLogin(email: string, password: string): Promise<{
        token: string;
        restaurant_id: number | null;
        role: string;
    } | {
        token: string;
        restaurant_id: bigint | null;
        role: string;
    }>;
    deliveryManLogin(phone: string, password: string): Promise<{
        token: string;
        topic: string[];
    }>;
    createGuest(input: {
        ip_address?: string;
        fcm_token?: string;
    }): Promise<{
        guest_id: number;
    }>;
    adminLogin(email: string, password: string): Promise<{
        token: string;
        admin: {
            id: number;
            f_name: string | null;
            l_name: string | null;
            email: string;
            image: string | null;
            role_id: number;
        };
    }>;
    findActorByToken(token: string): Promise<{
        kind: Actor;
        id: bigint;
    } | null>;
}
export {};
