import EffectPreviewClient from '@/components/admin/EffectPreviewClient';
import skillsData from '@/data/master/skills.json';
import {
  listRegisteredPresentations,
  resolveSkillPresentation,
  type SkillPresentationSpec,
} from '@/lib/presentation/skillPresentation';
import type { SkillData } from '@/types/game';

export const dynamic = 'force-dynamic';

export default function EffectPreviewPage() {
  const registry = new Map<string, SkillPresentationSpec>();
  for (const spec of listRegisteredPresentations()) registry.set(spec.effectKey, spec);
  for (const skill of Object.values(skillsData) as SkillData[]) {
    const element = skill.element ?? 'NONE';
    const attackType = skill.attackType ?? (skill.type === 'MAGICAL' ? 'MAGIC' : 'SLASH');
    const effectKey = skill.effectKey ?? `${element.toLowerCase()}_${attackType.toLowerCase()}`;
    const spec = resolveSkillPresentation(effectKey, element, attackType);
    registry.set(effectKey, { ...spec, effectKey, label: skill.name });
  }
  return <EffectPreviewClient specs={[...registry.values()].sort((a, b) => a.effectKey.localeCompare(b.effectKey))}/>;
}
