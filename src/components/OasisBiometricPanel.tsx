// OasisBiometricPanel — routes voice biometric through lightseed Cloud Functions.
// UI lives in @oasisomniverse/react; this file supplies the CF callbacks.
import { AvatarBiometric } from '@oasisomniverse/react';
import { useOasisIdentity } from '../hooks/useOasisIdentity';

export const OasisBiometricPanel = () => {
    const { identity, enrollBiometric, verifyBiometric } = useOasisIdentity();
    if (!identity) return null;

    return (
        <AvatarBiometric
            enrolled={identity.biometricEnrolled}
            onEnroll={enrollBiometric}
            onVerify={async (b64: string) => ({ verified: await verifyBiometric(b64) })}
        />
    );
};
