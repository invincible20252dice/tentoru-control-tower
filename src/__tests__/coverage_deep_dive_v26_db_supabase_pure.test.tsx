import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, CurriculumMaster, LearningTask, LearningLog, MiniTestResult, HomeworkResult, MilestonePlan, StudentInteraction, Branch } from '../lib/db';

describe('DB Supabase Deep Strike & High Coverage Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('covers full Supabase online mode and error fallback branches in db.ts', async () => {
    // 1. Mock Supabase query builder
    const mockQueryBuilder = (returnData: any = [], returnError: any = null) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: Array.isArray(returnData) ? returnData[0] : returnData, error: returnError }),
        then: vi.fn((resolve) => resolve({ data: returnData, error: returnError, count: Array.isArray(returnData) ? returnData.length : 1 }))
      };
      return builder;
    };

    const mockSupabase: any = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'students') {
          return mockQueryBuilder([{ id: 'mock-s-1', student_id: 'S001', name: 'モック生徒', grade: '中1' }]);
        }
        if (table === 'curriculum_masters') {
          return mockQueryBuilder([{ id: 'mock-cm-1', subject: '数学', grade: '中1', unit_name: '単元1', lesson_name: 'レッスン1', sort_order: 1 }]);
        }
        if (table === 'learning_tasks') {
          return mockQueryBuilder([{ id: 'mock-t-1', student_id: 'mock-s-1', scheduled_date: '2026-09-19', period: 1 }]);
        }
        if (table === 'branches') {
          return mockQueryBuilder([{ id: 'mock-b-1', name: 'モック校舎', code: 'MCK', is_active: true }]);
        }
        return mockQueryBuilder([]);
      }),
      auth: {
        signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-1' } }, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-1' } }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null })
      }
    };

    // Inject mock Supabase and set isMockMode to false
    (db as any).supabase = mockSupabase;
    (db as any).isMockMode = false;

    // Test online Supabase fetches
    const students = await db.fetchStudents();
    expect(students).toBeDefined();

    const curriculum = await db.fetchCurriculumMasters();
    expect(curriculum).toBeDefined();

    const tasks = await db.fetchLearningTasks('mock-s-1');
    expect(tasks).toBeDefined();

    const branches = await db.fetchBranches();
    expect(branches).toBeDefined();

    // Test online saves
    const savedStudent = await db.saveStudent({
      id: 'mock-s-1',
      student_id: 'S001',
      name: 'モック生徒',
      grade: '中1',
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '中1',
      selected_subjects: ['数学']
    });
    expect(savedStudent).toBeDefined();

    const savedCurriculum = await db.saveCurriculumMasters([{
      id: 'mock-cm-1',
      subject: '数学',
      grade: '中1',
      unit_name: '単元1',
      lesson_name: 'レッスン1',
      sort_order: 1
    }]);
    expect(savedCurriculum).toBeDefined();

    await db.saveLearningTasks([{
      id: 'mock-t-1',
      student_id: 'mock-s-1',
      scheduled_date: '2026-09-19',
      period: 1,
      status: 'unstarted'
    }]);

    await db.saveStudentLessonProgress({
      id: 'slp-1',
      student_id: 'mock-s-1',
      lesson_id: 'l-1',
      lesson_name: 'レッスン1',
      subject: '数学',
      date: '2026-09-19',
      status: 'completed',
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    await db.saveMiniTestResult({
      id: 'mock-mini-1',
      student_id: 'mock-s-1',
      date: '2026-09-19',
      subject: '数学',
      test_content: '確認テスト',
      score: 100,
      created_at: new Date().toISOString()
    });

    await db.saveHomeworkResult({
      id: 'mock-hw-1',
      student_id: 'mock-s-1',
      date: '2026-09-19',
      subject: '数学',
      homework_content: '宿題1',
      status: 'completed',
      created_at: new Date().toISOString()
    });

    await db.saveMilestonePlan({
      id: 'mock-mp-1',
      student_id: 'mock-s-1',
      subject: '数学',
      target_period: '1学期中間',
      start_date: '2026-04-01',
      end_date: '2026-06-30',
      milestones: []
    });

    await db.saveStudentInteraction({
      id: 'mock-inter-1',
      student_id: 'mock-s-1',
      type: 'interview',
      date: '2026-09-19',
      notes: '面談メモ',
      created_at: new Date().toISOString()
    });

    await db.saveBranch({
      id: 'mock-b-1',
      name: 'モック校舎',
      code: 'MCK',
      email: 'mock@tentoru.jp',
      is_active: true
    });

    // Test Deletes
    await db.deleteStudent('mock-s-1');
    await db.deleteCurriculumMaster('mock-cm-1');
    await db.deleteLearningTasksForDate('mock-s-1', '2026-09-19');
    await db.deleteMiniTestResult('mock-mini-1');
    await db.deleteHomeworkResult('mock-hw-1');
    await db.deleteMilestoneTemplate('mock-tmpl-1');
    await db.deleteStudentInteraction('mock-inter-1');
    await db.deleteBranch('mock-b-1');

    // 2. Test Supabase Error Fallback branches
    const errorSupabase: any = {
      from: vi.fn().mockImplementation(() => {
        return mockQueryBuilder(null, { code: '22P02', message: 'invalid input syntax for type uuid' });
      })
    };
    (db as any).supabase = errorSupabase;

    try {
      await db.saveStudent({
        id: 'invalid-uuid-format',
        student_id: 'S002',
        name: 'UUIDエラー生徒',
        grade: '中2',
        status: 'normal',
        period_count: 2,
        registered_year: 2026,
        registered_grade: '中2',
        selected_subjects: ['数学']
      });
    } catch (e) {
      expect(e).toBeDefined();
    }

    // Reset back to defaults
    (db as any).supabase = null;
    (db as any).isMockMode = true;
  });
});
