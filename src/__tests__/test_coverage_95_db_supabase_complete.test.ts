import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db, Student, LearningTask, CurriculumMaster, MilestonePlan, TestRecord, MiniTestResult, HomeworkResult } from '../lib/db';

describe('db.ts Full Supabase & Fallback Coverage Suite', () => {
  const originalMockMode = (db as any).isMockMode;
  const originalSupabase = (db as any).supabase;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    (db as any).isMockMode = originalMockMode;
    (db as any).supabase = originalSupabase;
  });

  it('should cover all Supabase data fetching, upserting, error handling, and deletions', async () => {
    // Construct mock Supabase client
    const createMockChain = (dataToReturn: any = [{}], shouldError = false) => {
      const chain: any = {
        select: vi.fn(() => chain),
        insert: vi.fn(() => chain),
        update: vi.fn(() => chain),
        upsert: vi.fn(() => chain),
        delete: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        gte: vi.fn(() => chain),
        lte: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        single: vi.fn(() => Promise.resolve({ data: (dataToReturn && dataToReturn[0]) || null, error: shouldError ? { message: 'Supabase Error' } : null })),
        then: (resolve: any) => resolve({ data: shouldError ? null : dataToReturn, error: shouldError ? { message: 'Supabase Error' } : null })
      };
      return chain;
    };

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'students') {
          return createMockChain([
            {
              id: 'std-mock-1',
              name: 'モック生徒',
              grade: '小5',
              grade_category: 'elementary',
              school_id: 'sch-1',
              selected_subjects: ['算数', '国語'],
              created_at: new Date().toISOString()
            }
          ]);
        }
        if (table === 'curriculum_masters') {
          return createMockChain([
            {
              id: 'cm-mock-1',
              grade: '小5',
              subject: '算数',
              unit_name: '1章',
              lesson_name: '単元テスト',
              sort_order: 1,
              created_at: new Date().toISOString()
            }
          ]);
        }
        return createMockChain([{ id: 'mock-item-1' }]);
      }),
      auth: {
        signInWithPassword: vi.fn(() => Promise.resolve({
          data: {
            user: {
              id: 'user-123',
              user_metadata: { role: 'admin', branch_id: null, branch_name: '本部' }
            },
            session: { access_token: 'mock-token' }
          },
          error: null
        })),
        signOut: vi.fn(() => Promise.resolve({ error: null }))
      }
    };

    // Enable Supabase mode
    (db as any).isMockMode = false;
    (db as any).supabase = mockSupabase;

    // 1. fetchStudents
    const students = await db.fetchStudents();
    expect(students.length).toBeGreaterThan(0);

    // 2. saveStudent
    const sampleStudent: Student = {
      id: 'std-mock-1',
      name: 'モック生徒 更新',
      grade: '小5',
      grade_category: 'elementary',
      school_id: 'sch-1',
      selected_subjects: ['算数'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(sampleStudent);

    // 3. deleteStudent
    await db.deleteStudent('std-mock-1');

    // 4. fetchCurriculumMasters & save & delete
    const masters = await db.fetchCurriculumMasters('算数');
    expect(masters.length).toBeGreaterThan(0);

    await db.saveCurriculumMasters(masters);
    await db.deleteCurriculumMaster('cm-mock-1');

    // 5. fetchLearningTasks & save & delete
    const tasks = await db.fetchLearningTasks('std-mock-1');
    expect(tasks).toBeDefined();

    const sampleTask: LearningTask = {
      id: 'task-mock-1',
      student_id: 'std-mock-1',
      subject: '算数',
      unit_name: '1章',
      lesson_range: '1-1',
      status: 'not_started',
      scheduled_date: '2026-09-17',
      period: 1,
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([sampleTask]);
    await db.deleteLearningTasksByDate('std-mock-1', '2026-09-17');
    await db.deleteLearningTasksByStudent('std-mock-1');

    // 6. getMilestonePlans & save
    const milestones = db.getMilestonePlans();
    expect(milestones).toBeDefined();
    await db.saveMilestonePlans([]);

    // 7. fetchMiniTestResults & save
    const miniTests = await db.fetchMiniTestResults('std-mock-1', '2026-09-17');
    expect(miniTests).toBeDefined();
    const sampleMini: MiniTestResult = {
      id: 'mini-1',
      student_id: 'std-mock-1',
      date: '2026-09-17',
      subject: '算数',
      test_content: '1章',
      score: 100,
      passed: true,
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(sampleMini);

    // 8. fetchHomeworkResults & save
    const homeworks = await db.fetchHomeworkResults('std-mock-1', '2026-09-17');
    expect(homeworks).toBeDefined();
    const sampleHw: HomeworkResult = {
      id: 'hw-1',
      student_id: 'std-mock-1',
      date: '2026-09-17',
      subject: '算数',
      assignment_content: 'ドリルP10',
      is_submitted: true,
      score: 90,
      created_at: new Date().toISOString()
    };
    await db.saveHomeworkResult(sampleHw);
    await db.saveHomeworkResults([sampleHw]);

    // 9. signInWithPassword with Supabase
    const authRes = await db.signInWithPassword('admin@tentoru.jp', 'admin123');
    expect(authRes.success).toBe(true);
    await db.signOut();

    // 10. Test Supabase error branches
    const errorSupabase = {
      from: vi.fn(() => createMockChain(null, true)),
      auth: {
        signInWithPassword: vi.fn(() => Promise.resolve({ data: null, error: { message: 'Invalid credentials' } })),
        signOut: vi.fn(() => Promise.resolve({ error: { message: 'Signout error' } }))
      }
    };
    (db as any).supabase = errorSupabase;

    await db.fetchStudents();
    await expect(db.saveStudent(sampleStudent)).rejects.toThrow();
    await expect(db.deleteStudent('std-mock-1')).rejects.toThrow();
    await db.fetchCurriculumMasters();
    await db.saveCurriculumMasters([]);
    await db.deleteCurriculumMaster('cm-1');
    await db.fetchLearningTasks();
    await expect(db.saveLearningTasks([sampleTask])).rejects.toThrow();
    await db.deleteLearningTasksByDate('std-1', '2026-09-17');
    await expect(db.deleteLearningTasksByStudent('std-1')).rejects.toThrow();
    db.getMilestonePlans();
    await expect(db.saveMilestonePlans([])).rejects.toThrow();
    await expect(db.fetchMiniTestResults('std-1')).rejects.toThrow();
    await expect(db.saveMiniTestResult(sampleMini)).rejects.toThrow();
    await expect(db.fetchHomeworkResults('std-1')).rejects.toThrow();
    await expect(db.saveHomeworkResult(sampleHw)).rejects.toThrow();
    await expect(db.saveHomeworkResults([sampleHw])).rejects.toThrow();
    await db.signInWithPassword('test@tentoru.jp', 'wrongpass');
    await db.signOut();
  });
});
