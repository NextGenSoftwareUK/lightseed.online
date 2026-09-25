// Type shims for @oasisomniverse packages that ship without TypeScript declarations.

declare module '@oasisomniverse/react' {
    import type { ReactNode } from 'react';

    export interface HerzIdPanelProps {
        session?: { avatarId?: string; jwtToken?: string; username?: string };
        apiUrl?: string;
        herzId?: string;
        clearanceLevel?: number;
        countryCode?: string;
        joinedAt?: string;
        karmaScore?: number;
        karmaSyncedAt?: string;
        onRegister?: (args: { countryCode: string; voucherHerzId?: string }) => Promise<unknown>;
        onKarmaSync?: () => Promise<{ karmaScore: number }>;
        onVouch?: (targetHerzId: string) => Promise<void>;
        onUnlink?: () => void;
    }
    export function HerzIdPanel(props: HerzIdPanelProps): ReactNode;

    export interface HerzVouchChainProps {
        initialHerzId?: string;
        apiUrl?: string;
        onLookup?: (herzId: string) => Promise<{ profile: unknown; chain: unknown[] }>;
    }
    export function HerzVouchChain(props: HerzVouchChainProps): ReactNode;

    export interface AvatarBiometricProps {
        session?: { jwtToken?: string };
        apiUrl?: string;
        enrolled?: boolean;
        onEnroll?: (audioBase64: string) => Promise<void>;
        onVerify?: (audioBase64: string) => Promise<{ verified: boolean }>;
        onEnrolled?: () => void;
    }
    export function AvatarBiometric(props: AvatarBiometricProps): ReactNode;

    export interface AvatarConnectProps {
        onLogin?: (session: { avatarId: string; username: string; jwtToken: string; karma: number }) => void;
        onLogout?: () => void;
        sessionKey?: string;
        apiUrl?: string;
    }
    export function AvatarConnect(props: AvatarConnectProps): ReactNode;
    export default AvatarConnect;
}
