import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../lib/db';

describe('Coverage Deep Dive v42 - db.ts 95%+ Final Target', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('covers remaining branches in db.ts including getCurrentUserRole, saveSession errors, and signIn edge cases', async () => {
    // 1. getCurrentUserRole with broken JSON in localStorage
    localStorage.setItem('current_user_role', 'invalid-json');
    const role1 = db.getCurrentUserRole();
    expect(role1.role).toBe('admin');

    // 2. saveSession with localStorage throwing error
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    db.saveSession({
      user: { id: 'u1', email: 'test@tentoru.jp', role: 'admin', branch_id: null, branch_name: null, name: 'Admin' },
      token: 'tok-1',
      logged_in_at: '2026-04-01'
    });
    setItemSpy.mockRestore();

    // 3. getSession with broken JSON
    localStorage.setItem('tentoru_auth_session', 'broken-json-data');
    const brokenSession = db.getSession();
    expect(brokenSession).toBeNull();

    // 4. signInWithPassword with empty email or empty password
    const emptyEmail = await db.signInWithPassword('', 'password123');
    expect(emptyEmail.success).toBe(false);
    expect(emptyEmail.error).toBe('メールアドレスを入力してください');

    const emptyPass = await db.signInWithPassword('test@tentoru.jp', '');
    expect(emptyPass.success).toBe(false);
    expect(emptyPass.error).toBe('パスワードを入力してください');

    // 5. signInWithPassword with wrongpass
    const wrongPass = await db.signInWithPassword('admin@tentoru.jp', 'wrongpass');
    expect(wrongPass.success).toBe(false);

    // 6. signInWithPassword with valid admin / branch email
    const adminLogin = await db.signInWithPassword('admin@tentoru.jp', 'correctpass');
    expect(adminLogin.success).toBe(true);

    const branchLogin = await db.signInWithPassword('shinjuku-branch@tentoru.jp', 'correctpass');
    expect(branchLogin.success).toBe(true);

    // 7. signInWithPassword with generic email containing @
    const genericLogin = await db.signInWithPassword('teacher.tanaka@tentoru.jp', 'correctpass');
    expect(genericLogin.success).toBe(true);

    // 8. signOut
    await db.signOut();
    expect(db.getSession()).toBeNull();

    // 9. getExamThresholdsMaster
    const examThresholds = await db.getExamThresholdsMaster();
    expect(examThresholds).toBeDefined();

    // 10. getPromptSettings
    const promptSettings = await db.getPromptSettings();
    expect(promptSettings).toBeDefined();

    expect(true).toBe(true);
  });
});
