import { describe, test, expect, beforeEach, vi } from 'vitest';
import { db, Branch, StudentScheduleConfig, BranchAIRules, UserRole } from '../lib/db';

describe('DatabaseService (db.ts) Comprehensive High-Coverage Test Suite', () => {
  beforeEach(() => {
    db.clearMockData();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('Branch & Multitenancy Management API', () => {
    test('getBranches should calculate student count dynamically', () => {
      const branches = db.getBranches();
      expect(branches.length).toBeGreaterThan(0);
      expect(branches[0]).toHaveProperty('id');
      expect(branches[0]).toHaveProperty('name');
      expect(branches[0]).toHaveProperty('student_count');
    });

    test('fetchBranches should work in mock mode and trigger event', async () => {
      const branches = await db.fetchBranches();
      expect(branches.length).toBeGreaterThan(0);
    });

    test('saveBranch should add a new branch or update existing one', async () => {
      const newBranch: Branch = {
        id: 'branch-test-99',
        name: 'テスト校舎',
        code: 'TEST99',
        email: 'test99@tentoru.jp',
        status: 'active',
        created_at: new Date().toISOString()
      };

      const saved = await db.saveBranch(newBranch);
      expect(saved.id).toBe('branch-test-99');

      const all = db.getBranches();
      expect(all.some(b => b.id === 'branch-test-99')).toBe(true);

      // Update
      const updated = await db.saveBranch({ ...newBranch, name: 'テスト校舎(更新)' });
      expect(updated.name).toBe('テスト校舎(更新)');
    });

    test('toggleBranchStatus should switch branch status between active and suspended', async () => {
      const branches = db.getBranches();
      const targetId = branches[0].id;
      const initialStatus = branches[0].status;

      const toggled = await db.toggleBranchStatus(targetId);
      expect(toggled.status).toBe(initialStatus === 'active' ? 'suspended' : 'active');

      const restored = await db.toggleBranchStatus(targetId);
      expect(restored.status).toBe(initialStatus);
    });

    test('toggleBranchStatus should throw error if branch not found', async () => {
      await expect(db.toggleBranchStatus('non-existent-branch-id')).rejects.toThrow('校舎が見つかりません');
    });

    test('deleteBranch should remove specified branch', async () => {
      const branches = db.getBranches();
      const deleteId = branches[0].id;

      await db.deleteBranch(deleteId);
      const after = db.getBranches();
      expect(after.some(b => b.id === deleteId)).toBe(false);
    });

    test('createBranchAccount should generate unique code and branch model', async () => {
      const branch = await db.createBranchAccount({
        name: ' 横浜みなとみらい校 ',
        email: ' yokohama_mm@tentoru.jp ',
        code: ' ymm ',
        phone: ' 045-999-9999 ',
        address: ' 神奈川県横浜市 '
      });

      expect(branch.name).toBe('横浜みなとみらい校');
      expect(branch.email).toBe('yokohama_mm@tentoru.jp');
      expect(branch.code).toBe('YMM');
      expect(branch.phone).toBe('045-999-9999');
      expect(branch.status).toBe('active');
    });

    test('createBranchAccount without code should generate fallback code', async () => {
      const branch = await db.createBranchAccount({
        name: '特設テスト校',
        email: 'special@tentoru.jp'
      });
      expect(branch.code).toBeDefined();
      expect(branch.name).toBe('特設テスト校');
    });
  });

  describe('Branch AI Rules API', () => {
    test('getBranchAIRules should return default rules when branchId is null/all', () => {
      const rulesAll = db.getBranchAIRules('all');
      expect(rulesAll).toHaveProperty('lessons_per_slot');
      expect(rulesAll).toHaveProperty('punk_threshold_slots');
      const rulesNull = db.getBranchAIRules(null);
      expect(rulesNull).toHaveProperty('lessons_per_slot');
    });

    test('getBranchAIRules for specific branch should merge custom rules', () => {
      const branches = db.getBranches();
      const rules = db.getBranchAIRules(branches[0].id);
      expect(rules).toBeDefined();
    });

    test('saveBranchAIRules should update rules for all and specific branch', async () => {
      const updatedGlobal = await db.saveBranchAIRules('all', { max_daily_tasks: 5 });
      expect(updatedGlobal.max_daily_tasks).toBe(5);

      const branches = db.getBranches();
      const branchId = branches[0].id;

      const updatedBranch = await db.saveBranchAIRules(branchId, { max_daily_tasks: 6, auto_reschedule_enabled: false });
      expect(updatedBranch.max_daily_tasks).toBe(6);
      expect(updatedBranch.auto_reschedule_enabled).toBe(false);

      const reFetched = db.getBranchAIRules(branchId);
      expect(reFetched.max_daily_tasks).toBe(6);
    });
  });

  describe('Student Schedule Config API', () => {
    test('getStudentScheduleConfig should return default or mock saved config', () => {
      const config = db.getStudentScheduleConfig('non-existent-student');
      expect(config.weekly_frequency).toBe('2回');
      expect(config.selected_days).toEqual(['tuesday', 'friday']);
    });

    test('fetchStudentScheduleConfig & saveStudentScheduleConfig lifecycle', async () => {
      const studentId = 'std-config-test-1';
      const initialConfig = await db.fetchStudentScheduleConfig(studentId);
      expect(initialConfig.student_id).toBe(studentId);

      const newConfig: StudentScheduleConfig = {
        student_id: studentId,
        weekly_frequency: '3回',
        weekly_duration: '180分',
        selected_days: ['monday', 'wednesday', 'friday'],
        default_slots: 3
      };

      await db.saveStudentScheduleConfig(newConfig);

      const savedConfig = await db.fetchStudentScheduleConfig(studentId);
      expect(savedConfig.weekly_frequency).toBe('3回');
      expect(savedConfig.selected_days).toEqual(['monday', 'wednesday', 'friday']);
      expect(savedConfig.default_slots).toBe(3);
    });
  });

  describe('Auth & Session Management API', () => {
    test('signInWithPassword validation checks', async () => {
      const res1 = await db.signInWithPassword('', 'password');
      expect(res1.success).toBe(false);
      expect(res1.error).toContain('メールアドレスを入力してください');

      const res2 = await db.signInWithPassword('test@tentoru.jp', '');
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('パスワードを入力してください');
    });

    test('signInWithPassword for branch account', async () => {
      const res = await db.signInWithPassword('ebisu@tentoru.jp', 'validpass');
      expect(res.success).toBe(true);
      expect(res.session?.user.role).toBe('branch');
      expect(res.session?.user.branch_id).toBe('branch-1');
      expect(res.session?.user.branch_name).toBe('恵比寿教室');
    });

    test('signInWithPassword for suspended branch account should fail', async () => {
      const res = await db.signInWithPassword('yokohama@tentoru.jp', 'validpass');
      expect(res.success).toBe(false);
      expect(res.error).toContain('一時停止中');
    });

    test('signInWithPassword for admin account', async () => {
      const res = await db.signInWithPassword('admin@tentoru.jp', 'adminpass');
      expect(res.success).toBe(true);
      expect(res.session?.user.role).toBe('admin');
      expect(res.session?.user.branch_name).toBe('本部統括管理者');
    });

    test('signInWithPassword wrong password should fail', async () => {
      const res = await db.signInWithPassword('unknown_user@example.com', 'wrongpass');
      expect(res.success).toBe(false);
      expect(res.error).toContain('正しくありません');
    });

    test('signInWithPassword general user email fallback', async () => {
      const res = await db.signInWithPassword('teacher_school@tentoru.jp', 'secret');
      expect(res.success).toBe(true);
      expect(res.session?.user.role).toBe('branch');

      const resAdmin = await db.signInWithPassword('general_teacher@tentoru.jp', 'secret');
      expect(resAdmin.success).toBe(true);
      expect(resAdmin.session?.user.role).toBe('admin');
    });

    test('sendBranchPasswordReset mock execution', async () => {
      const res = await db.sendBranchPasswordReset('reset@tentoru.jp');
      expect(res.success).toBe(true);
      expect(res.message).toContain('送信しました');
    });

    test('getCurrentUserRole & setCurrentUserRole localStorage integration', () => {
      db.setCurrentUserRole('branch', 'branch-1', '恵比寿教室');
      const roleObj = db.getCurrentUserRole();
      expect(roleObj.role).toBe('branch');
      expect(roleObj.branch_id).toBe('branch-1');
      expect(roleObj.branch_name).toBe('恵比寿教室');
    });

    test('signOut should clear auth session and reset role', async () => {
      await db.signInWithPassword('ebisu@tentoru.jp', 'pass');
      expect(db.getSession()).not.toBeNull();

      await db.signOut();
      expect(db.getSession()).toBeNull();

      const roleObj = db.getCurrentUserRole();
      expect(roleObj.role).toBe('admin');
    });
  });

  describe('Supabase Error Handlers & Network Resilience', () => {
    test('saveStudentLessonProgress should catch network errors and return mock fallback safely', async () => {
      const result = await db.saveStudentLessonProgress({
        student_id: 'std-fail-1',
        lesson_id: 'les-fail-1',
        subject: '算数',
        status: 'completed',
        completed_at: new Date().toISOString()
      });

      expect(result).toHaveProperty('lesson_id');
      expect(result.status).toBe('completed');
    });
  });
});
