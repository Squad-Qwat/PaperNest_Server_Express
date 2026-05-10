export interface User {
    userId: string;
    name: string;
    email: string;
    username: string;
    role: "Student" | "Lecturer";
    photoURL: string | null;
    linkedUids?: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface RegisterData {
    email: string;
    password: string;
    name: string;
    username: string;
    role: "Student" | "Lecturer";
    workspaceData?: {
        title: string;
        description?: string;
        icon?: string;
        mode: "create" | "join";
        invitationCode?: string;
    };
}

export interface LoginData {
    email: string;
    password: string;
}


export interface AuthResponse {
    user?: User;
    token?: string;
    refreshToken?: string;
    firebaseToken?: string;
    isNewUser?: boolean;
    isVerificationRequired?: boolean;
    firebaseData?: {
        uid: string;
        email: string;
        name: string;
        picture?: string;
    };
}

export interface CompleteSocialRegistrationData {
    firebaseToken: string;
    username: string;
    role: "Student" | "Lecturer";
    email?: string;
}