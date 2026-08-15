import {
  createPresentationSchedule,
  listRegisteredPresentations,
  resolveSkillPresentation,
  validateSkillPresentationSpec,
} from './skillPresentation';

describe('skillPresentation', () => {
  it('resolves exact specialized presentations before elemental fallback', () => {
    const spec = resolveSkillPresentation('dark_summon', 'DARK', 'SUMMON');
    expect(spec.effectKey).toBe('dark_summon');
    expect(spec.timeline.damageTimingsMs).toEqual([720, 860]);
  });

  it.each(['SLASH', 'STRIKE', 'PROJECTILE', 'MAGIC', 'SUMMON', 'HEAL'] as const)('provides a valid common fallback for %s', attackType => {
    const spec = resolveSkillPresentation(`unknown_${attackType.toLowerCase()}`, 'FIRE', attackType);
    expect(spec.attackType).toBe(attackType);
    expect(validateSkillPresentationSpec(spec).filter(item => item.level === 'FAIL')).toEqual([]);
  });

  it('scales damage and SFX timings with playback rate', () => {
    const schedule = createPresentationSchedule(resolveSkillPresentation('thunder_slash', 'THUNDER', 'SLASH'), 2);
    expect(schedule.damageTimingsMs).toEqual([95, 133, 170]);
    expect(schedule.totalMs).toBe(405);
  });

  it('lists common and specialized registry entries', () => {
    const registered = listRegisteredPresentations();
    const keys = registered.map(spec => spec.effectKey);
    expect(keys).toContain('common_heal');
    expect(keys).toContain('dark_summon');
    expect(registered.flatMap(spec => validateSkillPresentationSpec(spec)).filter(item => item.level === 'FAIL')).toEqual([]);
  });
});
