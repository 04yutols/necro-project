import type { TutorialPhase } from '../../data/tutorial/phases';
import {
  getTutorialPhaseDestinationTab,
  type TutorialNavigationTab,
} from '../../data/tutorial/triggers';

interface TutorialBannerConfirmInput {
  phase: TutorialPhase;
  setCurrentTab: (tab: TutorialNavigationTab) => void;
  dismissBanner: () => void;
}

export function confirmTutorialBanner({
  phase,
  setCurrentTab,
  dismissBanner,
}: TutorialBannerConfirmInput): TutorialNavigationTab | null {
  const destinationTab = getTutorialPhaseDestinationTab(phase);
  if (destinationTab) setCurrentTab(destinationTab);
  dismissBanner();
  return destinationTab;
}
