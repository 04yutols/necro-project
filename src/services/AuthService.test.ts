import { validatePassword } from './AuthService';

describe('validatePassword', () => {
  describe('合格ケース', () => {
    test('12文字以上の英字のみはOK', () => {
      expect(validatePassword('abcdefghijkl')).toBeNull();
    });

    test('12文字以上の数字のみはOK', () => {
      expect(validatePassword('123456789012')).toBeNull();
    });

    test('12文字以上の英数混合はOK', () => {
      expect(validatePassword('CodexPass1234')).toBeNull();
    });

    test('英字+数字を含む8文字はOK', () => {
      expect(validatePassword('Pass1234')).toBeNull();
    });

    test('英字+数字を含む11文字はOK（既存統合テストのパスワード）', () => {
      expect(validatePassword('CodexPass123')).toBeNull();
    });

    test('英字+数字を含む8文字ちょうどはOK', () => {
      expect(validatePassword('abcd1234')).toBeNull();
    });
  });

  describe('不合格ケース', () => {
    test('空文字はNG', () => {
      expect(validatePassword('')).not.toBeNull();
    });

    test('7文字の英数混合はNG（8文字未満）', () => {
      expect(validatePassword('Pass123')).not.toBeNull();
    });

    test('8文字の英字のみはNG（数字なし）', () => {
      expect(validatePassword('abcdefgh')).not.toBeNull();
    });

    test('8文字の数字のみはNG（英字なし）', () => {
      expect(validatePassword('12345678')).not.toBeNull();
    });

    test('11文字の英字のみはNG（12文字未満かつ数字なし）', () => {
      expect(validatePassword('abcdefghijk')).not.toBeNull();
    });

    test('11文字の数字のみはNG（12文字未満かつ英字なし）', () => {
      expect(validatePassword('12345678901')).not.toBeNull();
    });

    test('旧ポリシー（8文字英字のみ）はNG', () => {
      expect(validatePassword('password')).not.toBeNull();
    });
  });

  describe('エラーメッセージ', () => {
    test('不合格時に日本語メッセージを返す', () => {
      const msg = validatePassword('short');
      expect(msg).toBe('パスワードは12文字以上、または英数字を含む8文字以上にしてください');
    });

    test('合格時はnullを返す（エラーなし）', () => {
      expect(validatePassword('CodexPass123')).toBeNull();
    });
  });
});
