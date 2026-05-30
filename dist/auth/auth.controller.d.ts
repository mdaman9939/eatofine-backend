import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    customerLogin(body: {
        login_type?: string;
        email_or_phone?: string;
        password?: string;
        field_type?: string;
    }): Promise<{
        token: string;
        is_phone_verified: number;
        is_email_verified: number;
        is_personal_info: number;
        is_exist_user: null;
        login_type: string;
        email: string | null;
    }>;
    customerRegister(body: {
        f_name?: string;
        l_name?: string;
        phone?: string;
        email?: string;
        password?: string;
    }): Promise<{
        token: string;
        is_phone_verified: number;
        is_email_verified: number;
        is_personal_info: number;
        is_exist_user: null;
        login_type: string;
        email: string | null;
    }>;
    vendorLogin(body: {
        email?: string;
        password?: string;
    }): Promise<{
        token: string;
        restaurant_id: bigint | null;
        role: string;
    }>;
    deliveryManLogin(body: {
        phone?: string;
        password?: string;
    }): Promise<{
        token: string;
        topic: string[];
    }>;
    guestRequest(body: {
        fcm_token?: string;
    }): Promise<{
        guest_id: number;
    }>;
    adminLogin(body: {
        email?: string;
        password?: string;
    }): Promise<{
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
}
