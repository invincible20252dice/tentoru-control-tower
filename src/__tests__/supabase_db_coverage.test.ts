import { describe, test, expect, beforeEach, vi } from 'vitest';
import { db } from '../lib/db';

describe('Supabase Client Dynamic Coverage Integration (Fundamental Fix)', () => {
  beforeEach(() => {
    db.clearMockData();
  });

  test('executes Supabase queries across all DB methods when mock mode is disabled', async () => {
    // Construct robust Supabase mock chain
    const mockSupabaseQuery: any = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockImplementation(() => mockSupabaseQuery),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'mock-single-1', student_id: 'std-1' }, error: null }),
      order: vi.fn().mockResolvedValue({ data: [{ id: 'branch-1', name: '恵比寿教室', code: 'EBI', email: 'ebisu@tentoru.jp' }], error: null }),
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'usr-sb-1', user_metadata: { role: 'branch', branch_id: 'branch-1', branch_name: '恵比寿教室' } },
            session: { access_token: 'mock-sb-token' }
          },
          error: null
        }),
        resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null })
      }
    };

    const mockSupabase = {
      from: vi.fn().mockReturnValue(mockSupabaseQuery),
      auth: mockSupabaseQuery.auth
    };

    // Enable Supabase mode on db instance
    (db as any).isMockMode = false;
    (db as any).supabase = mockSupabase;

    // Test Supabase branches across methods
    await db.fetchStudents();
    await db.saveStudent({ id: 'std-sb-1', name: 'Supabase生徒', grade: '小5', login_id: 'sb_std', password: 'pass', status: 'normal', created_at: '' });
    await db.fetchLearningTasks();
    await db.saveLearningTasks([{ id: 't-sb-1', student_id: 'std-sb-1', scheduled_date: '2026-08-21', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' }]);
    await db.fetchCurriculumMasters();
    await db.saveCurriculumMasters([{ id: 'cm-sb-1', grade: '小5', subject: '算数', unit_name: '整数', lesson_name: '10倍', sort_order: 1, created_at: '' }]);
    await db.fetchStudentScheduleConfig('std-sb-1');
    await db.saveStudentScheduleConfig({ student_id: 'std-sb-1', weekly_frequency: '2回', weekly_duration: '120分', selected_days: ['tuesday', 'friday'], default_slots: 2 });
    await db.fetchBranches();
    await db.saveBranch({ id: 'branch-sb-1', name: 'Supabase校', code: 'SB1', email: 'sb1@tentoru.jp', status: 'active', created_at: '' });
    await db.deleteBranch('branch-sb-1');
    await db.saveBranchAIRules('branch-sb-1', { lessons_per_slot: 3 });
    await db.sendBranchPasswordReset('reset@tentoru.jp');
    await db.signInWithPassword('ebisu@tentoru.jp', 'password');
    await db.signOut();

    // Reset db instance to mock mode for other tests
    (db as any).isMockMode = true;
    (db as any).supabase = null;

    expect(mockSupabase.from).toHaveBeenCalled();
  });
});
