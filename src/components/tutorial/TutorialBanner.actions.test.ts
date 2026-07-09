import { confirmTutorialBanner } from './TutorialBanner.actions';
import type { TutorialNavigationTab } from '../../data/tutorial/triggers';

describe('TutorialBanner actions', () => {
  test('navigates to the party formation destination before dismissing the popup', () => {
    const calls: string[] = [];
    const setCurrentTab = (tab: TutorialNavigationTab) => {
      calls.push(`tab:${tab}`);
    };
    const dismissBanner = () => {
      calls.push('dismiss');
    };

    const destination = confirmTutorialBanner({
      phase: 'PARTY_FORMATION',
      setCurrentTab,
      dismissBanner,
    });

    expect(destination).toBe('EQUIP');
    expect(calls).toEqual(['tab:EQUIP', 'dismiss']);
  });

  test('dismisses battle-only tutorial popups without changing tabs', () => {
    const calls: string[] = [];
    const setCurrentTab = (tab: TutorialNavigationTab) => {
      calls.push(`tab:${tab}`);
    };
    const dismissBanner = () => {
      calls.push('dismiss');
    };

    const destination = confirmTutorialBanner({
      phase: 'DEMONIZATION',
      setCurrentTab,
      dismissBanner,
    });

    expect(destination).toBeNull();
    expect(calls).toEqual(['dismiss']);
  });
});
