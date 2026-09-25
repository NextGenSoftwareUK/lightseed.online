import { describe, it, expect } from 'vitest';
import {
    herzTierLabel,
    herzClearanceLabel,
    displayHerzId,
    HERZ_TIER_LABELS,
    type LinkedOasisIdentity,
} from '../src/domain/oasis';

describe('herzTierLabel', () => {
    it('returns correct labels for all defined tiers', () => {
        expect(herzTierLabel(1)).toBe('Explorer');
        expect(herzTierLabel(5)).toBe('Ally');
        expect(herzTierLabel(9)).toBe('Sovereign / Founder');
    });

    it('returns a fallback for unknown levels', () => {
        expect(herzTierLabel(0)).toBe('Level 0');
        expect(herzTierLabel(10)).toBe('Level 10');
    });

    it('covers all nine canonical tiers', () => {
        for (let i = 1; i <= 9; i++) {
            expect(HERZ_TIER_LABELS[i]).toBeTruthy();
        }
    });
});

describe('herzClearanceLabel', () => {
    it('combines tier name and numeric level', () => {
        expect(herzClearanceLabel(3)).toBe('Tribe Member (3)');
        expect(herzClearanceLabel(6)).toBe('Guardian (6)');
    });

    it('handles unknown level via fallback', () => {
        expect(herzClearanceLabel(0)).toBe('Level 0 (0)');
    });
});

describe('displayHerzId', () => {
    it('returns the herzId string as-is (display form from the API)', () => {
        expect(displayHerzId('052·0·000·000·001·✦')).toBe('052·0·000·000·001·✦');
        expect(displayHerzId('052·0·000·000·001·R')).toBe('052·0·000·000·001·R');
    });
});

describe('LinkedOasisIdentity type shape', () => {
    it('accepts a minimal identity (no optional fields)', () => {
        const id: LinkedOasisIdentity = {
            avatarId: 'uuid-123',
            avatarUsername: 'zoltan',
            linkedAt: new Date().toISOString(),
        };
        expect(id.herzId).toBeUndefined();
        expect(id.biometricEnrolled).toBeUndefined();
    });

    it('accepts a full identity including biometricEnrolled', () => {
        const id: LinkedOasisIdentity = {
            avatarId: 'uuid-456',
            avatarUsername: 'zoltan',
            linkedAt: '2026-09-25T00:00:00.000Z',
            karmaScore: 1234,
            herzId: '052·0·000·000·001·✦',
            herzClearanceLevel: 5,
            herzCountryCode: '052',
            herzJoinedAt: '2026-01-01',
            biometricEnrolled: true,
        };
        expect(id.herzClearanceLevel).toBe(5);
        expect(id.biometricEnrolled).toBe(true);
    });
});
