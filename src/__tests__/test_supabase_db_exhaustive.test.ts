import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  db,
  Student,
  CurriculumMaster,
  CurriculumUnit,
  LearningTask,
  MiniTestResult,
  HomeworkResult,
  TestRecord,
  SchoolCodeMaster,
  ExamThresholdMaster,
  PromptSetting,
  AIReport,
  TeacherCorrectionLog,
  StudentLessonProgress,
  MilestonePlan,
  Branch,
  School
} from '../lib/db';

describe('Supabase Mode DatabaseService Exhaustive Coverage Suite', () => {
  let mockSupabase: any;

  beforeEach(() => {
    localStorage.clear();

    const createChain = (returnData: any = null, returnError: any = null) => {
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
        then: (resolve: any) => resolve({ data: Array.isArray(returnData) ? returnData : (returnData ? [returnData] : []), error: returnError })
      };
      return chain;
    };

    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'students') {
          return createChain({
            id: 'st-sb-01',
            student_id: 'S_SB_01',
            name: 'Supabase生',
            grade: '中1',
            grade_category: '中学生',
            level: 'A',
            school_id: 'sch-1',
            school_name: '第一中',
            period_count: 2,
            selected_days: ['monday'],
            selected_subjects: ['数学'],
            teacher_in_charge: '荒木先生',
            assigned_teachers: ['荒木先生'],
            personality_tags: ['集中力高い']
          });
        }
        if (table === 'schools') {
          return createChain({ id: 'sch-sb-01', name: '第一中学校', type: 'junior_high' });
        }
        if (table === 'curriculum_masters') {
          return createChain([
            { id: 'cm-sb-01', subject: '数学', grade: '中1', unit_name: '正の数', lesson_name: '加法', sort_order: 1, item_type: 'lesson' }
          ]);
        }
        if (table === 'curriculum_units') {
          return createChain({ id: 'cu-sb-01', school_id: 'sch-1', subject: '数学', name: '正の数', sequence_order: 1 });
        }
        if (table === 'learning_tasks') {
          return createChain([
            { id: 'lt-sb-01', student_id: 'st-sb-01', scheduled_date: '2026-09-10', period: 1, subject: '数学', unit_id: 'cm-sb-01', status: 'unstarted' }
          ]);
        }
        if (table === 'mini_test_results') {
          return createChain({ id: 'mtr-sb-01', student_id: 'st-sb-01', date: '2026-09-10', subject: '数学', test_type: 'unit_test', unit_name: '正の数', test_content: '確認テスト' });
        }
        if (table === 'homework_results') {
          return createChain({ id: 'hr-sb-01', student_id: 'st-sb-01', date: '2026-09-10', subject: '数学', homework_content: 'ワーク', homework_deadline: '2026-09-15', status: 'done' });
        }
        if (table === 'milestone_plans') {
          return createChain([{ id: 'mp-sb-01', grade: '中1', subject: '数学', course: '標準', month: 4, week_number: 1, unit_name: '正の数', is_holiday: false }]);
        }
        if (table === 'branches') {
          return createChain([{ id: 'branch-sb-01', name: '恵比寿校', email: 'ebisu@tentoru.jp', status: 'active' }]);
        }
        if (table === 'branch_ai_rules') {
          return createChain({ branch_id: 'branch-sb-01', test_prep_weeks_before: 3, punk_threshold_slots: 4, review_slot_interval: 4 });
        }
        if (table === 'student_lesson_progress') {
          return createChain([{ id: 'slp-sb-01', student_id: 'st-sb-01', curriculum_master_id: 'cm-sb-01', status: 'passed' }]);
        }
        if (table === 'personality_options') {
          return createChain([{ name: '集中力高い' }, { name: '粘り強い' }]);
        }
        if (table === 'teacher_options') {
          return createChain([{ name: '荒木先生' }, { name: '福田先生' }]);
        }
        if (table === 'learning_logs') {
          return createChain({ id: 'll-sb-01', student_id: 'st-sb-01', task_id: 'lt-sb-01', status: 'pass' });
        }
        if (table === 'test_records') {
          return createChain({ id: 'tr-sb-01', student_id: 'st-sb-01', term: '中間', subject: '数学', score: 90 });
        }
        if (table === 'prompt_settings') {
          return createChain({ id: 'ps-sb-01', category: 'regular_report', prompt_template: 'テンプレート' });
        }
        if (table === 'ai_reports') {
          return createChain({ id: 'rep-sb-01', student_id: 'st-sb-01', report_text: 'レポート' });
        }
        if (table === 'teacher_corrections_log') {
          return createChain({ id: 'tcl-sb-01', report_id: 'rep-sb-01', original_text: '原文', corrected_text: '修正文' });
        }
        return createChain({});
      }),
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            user: { id: 'usr-sb-01', email: 'headquarters@tentoru.jp', user_metadata: { role: 'admin', name: '管理者' } },
            session: { access_token: 'sb-access-token' }
          },
          error: null
        }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null })
      }
    };

    // Inject mockSupabase into DatabaseService instance
    (db as any).supabase = mockSupabase;
    (db as any).isMockMode = false;
  });

  it('covers all Supabase CRUD queries across every entity in DatabaseService', async () => {
    // 1. Schools
    const school: School = { id: 'sch-sb-01', name: '第一中学校', type: 'junior_high', created_at: new Date().toISOString() };
    await db.saveSchool(school);
    await db.fetchSchools();
    await db.deleteSchool('sch-sb-01');

    // 2. Students
    const student: Student = {
      id: 'st-sb-01',
      student_id: 'S_SB_01',
      name: 'Supabase生',
      grade: '中1',
      grade_category: '中学生',
      level: 'A',
      school_id: 'sch-sb-01',
      school_name: '第一中',
      period_count: 2,
      selected_days: ['monday'],
      selected_subjects: ['数学'],
      teacher_in_charge: '荒木先生',
      assigned_teachers: ['荒木先生'],
      personality_tags: ['集中力高い']
    };
    await db.saveStudent(student);
    await db.fetchStudents();
    await db.fetchStudent('st-sb-01');
    await db.deleteStudent('st-sb-01');

    // 3. Curriculum Units & Masters
    const unit: CurriculumUnit = { id: 'cu-sb-01', school_id: 'sch-sb-01', subject: '数学', name: '正の数', sequence_order: 1 };
    await db.saveCurriculumUnit(unit);
    await db.saveCurriculumUnits([unit]);
    await db.deleteCurriculumUnit('cu-sb-01');

    const master: CurriculumMaster = { id: 'cm-sb-01', subject: '数学', grade: '中1', unit_name: '正の数', lesson_name: '加法', sort_order: 1, item_type: 'lesson' };
    await db.saveCurriculumMasters([master]);
    await db.fetchCurriculumMasters();
    await db.deleteCurriculumMastersByGrades(['中1']);

    // 4. Learning Tasks & Logs
    const task: LearningTask = { id: 'lt-sb-01', student_id: 'st-sb-01', scheduled_date: '2026-09-10', period: 1, subject: '数学', unit_id: 'cm-sb-01', status: 'unstarted', created_at: new Date().toISOString() };
    await db.saveLearningTasks([task]);
    await db.fetchLearningTasks('st-sb-01', '2026-09-10');
    await db.overwriteLearningTasksForDate('st-sb-01', '2026-09-10', [task]);
    await db.deleteLearningTasksForDate('st-sb-01', '2026-09-10');
    await db.deleteLearningTasksByDate('st-sb-01', '2026-09-10');
    await db.deleteLearningTasksByStudent('st-sb-01');

    await db.addLearningLog({ id: 'll-sb-01', student_id: 'st-sb-01', task_id: 'lt-sb-01', status: 'pass', timestamp: new Date().toISOString(), created_at: new Date().toISOString() });

    // 5. Mini Tests & Homeworks
    const mini: MiniTestResult = { id: 'mtr-sb-01', student_id: 'st-sb-01', date: '2026-09-10', subject: '数学', test_type: 'unit_test', unit_name: '正の数', test_content: '確認テスト', created_at: new Date().toISOString() };
    await db.saveMiniTestResult(mini);
    await db.fetchMiniTestResults('st-sb-01', '2026-09-10');
    await db.deleteMiniTestResult('mtr-sb-01');
    await db.deleteMiniTestResultByDate('st-sb-01', '2026-09-10');

    const hr: HomeworkResult = { id: 'hr-sb-01', student_id: 'st-sb-01', date: '2026-09-10', subject: '数学', homework_content: 'ワーク', homework_deadline: '2026-09-15', status: 'done', created_at: new Date().toISOString() };
    await db.saveHomeworkResult(hr);
    await db.saveHomeworkResults([hr]);
    await db.fetchHomeworkResults('st-sb-01', '2026-09-10');
    await db.deleteHomeworkResult('hr-sb-01');
    await db.deleteHomeworkResultsByDate('st-sb-01', '2026-09-10');

    // 6. Test Records, School Codes, Exam Thresholds, Prompt, AI Report, Teacher Corrections
    await db.saveTestRecord({ id: 'tr-sb-01', student_id: 'st-sb-01', term: '中間', subject: '数学', score: 90 });
    await db.deleteTestRecord('tr-sb-01');

    await db.saveSchoolCodeMaster({ id: 'scm-sb-01', code: 'J01', name: '第一中', region: '東京' });
    await db.saveExamThresholdMaster({ id: 'etm-sb-01', school_id: 'sch-sb-01', passing_score: 80, excellence_score: 95 });
    await db.savePromptSetting({ id: 'ps-sb-01', category: 'regular_report', prompt_template: 'テンプレート', updated_at: new Date().toISOString() });
    await db.saveAIReport({ id: 'rep-sb-01', student_id: 'st-sb-01', report_text: 'レポート', generated_at: new Date().toISOString() });
    await db.addTeacherCorrectionLog({ id: 'tcl-sb-01', report_id: 'rep-sb-01', original_text: '原文', corrected_text: '修正文', corrected_at: new Date().toISOString() });

    // 7. Milestone Plans & Templates
    const plan: MilestonePlan = { id: 'mp-sb-01', grade: '中1', subject: '数学', course: '標準', month: 4, week_number: 1, unit_name: '正の数', is_holiday: false };
    await db.saveMilestonePlan(plan);
    await db.saveMilestonePlans([plan]);

    // 8. Progress, Personality, Teachers, Branches, Rules
    await db.saveStudentLessonProgress({ id: 'slp-sb-01', student_id: 'st-sb-01', curriculum_master_id: 'cm-sb-01', status: 'passed', updated_at: new Date().toISOString() });
    await db.fetchStudentLessonProgressList('st-sb-01');

    await db.addPersonalityOption('粘り強い');
    await db.fetchPersonalityOptions();
    await db.deletePersonalityOption('粘り強い');

    await db.addTeacherOption('荒木先生');
    await db.fetchTeacherOptions();
    await db.deleteTeacherOption('荒木先生');

    const branch: Branch = { id: 'branch-sb-01', name: '恵比寿校', email: 'ebisu@tentoru.jp', status: 'active', created_at: new Date().toISOString() };
    await db.saveBranch(branch);
    await db.fetchBranches();
    await db.deleteBranch('branch-sb-01');

    await db.saveBranchAIRules('branch-sb-01', { branch_id: 'branch-sb-01', test_prep_weeks_before: 3, punk_threshold_slots: 4, review_slot_interval: 4 });

    // 9. Auth & Session in Supabase Mode
    const loginRes = await db.signInWithPassword('headquarters@tentoru.jp', 'admin123');
    expect(loginRes.success).toBe(true);
    await db.sendBranchPasswordReset('headquarters@tentoru.jp');
    await db.signOut();
  });
});
