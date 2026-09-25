// HerzVouchChain re-export — thin lightseed wrapper.
// All rendering lives in @oasisomniverse/react; this file only wires the API URL.
import { HerzVouchChain } from '@oasisomniverse/react';

export const HerzVouchChainPanel = ({ initialHerzId }: { initialHerzId?: string }) => (
    <HerzVouchChain
        initialHerzId={initialHerzId}
        apiUrl={(import.meta as unknown as { env: Record<string, string> }).env.VITE_OASIS_API_URL}
    />
);
