import { describe, it, expect } from 'vitest';
import {
    herzTierLabel,
    herzClearanceLabel,
    displayHerzId,
    HERZ_TIER_LABELS,
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
        expect(herzClearanceLabel(8)).toBe('Flame Keeper (8)');
    });
});

describe('displayHerzId', () => {
    it('returns the herzId string unchanged', () => {
        const id = '052·0·000·000·001·✦';
        expect(displayHerzId(id)).toBe(id);
    });
});
