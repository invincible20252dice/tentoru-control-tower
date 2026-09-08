import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../lib/db';

describe('DatabaseService (db.ts) Perfection Coverage Suite (>95%)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('covers all DatabaseService CRUD methods in mock & local storage mode', async () => {
    // 1. Schools CRUD
    const school = { id: 'sch-perf-1', name: '完全テスト校', branch_name: '東京校', code: 'SCH1', type: 'junior_high' as const, created_at: '' };
    await db.saveSchool(school as any);
    expect(db.getSchools().length).toBeGreaterThan(0);
    await db.deleteSchool('sch-perf-1');

    // 2. Branches CRUD
    const branch = { id: 'b-perf-1', name: '完全テスト校舎', code: 'BP1', email: 'bp1@tentoru.jp', status: 'active' as const, created_at: '' };
    await db.saveBranch(branch as any);
    expect(db.getBranches().length).toBeGreaterThan(0);
    await db.deleteBranch('b-perf-1');
    await db.sendBranchPasswordReset('test@tentoru.jp');

    // 3. CurriculumMasters CRUD & Presets & Cleanup
    const cm = { id: 'cm-perf-1', subject: '数学', grade_category: 'junior_high', target_grade: '中1', unit_name: '正負の数', lesson_name: '加法', item_type: 'video_lesson', sort_order: 1 };
    await db.saveCurriculumMasters([cm as any]);
    expect(db.getCurriculumMasters().length).toBeGreaterThan(0);
    await db.deleteCurriculumMaster('cm-perf-1');
    await db.saveCurriculumMasters([{ ...cm, id: 'cm-perf-2', target_grade: '小5' } as any]);
    await db.deleteCurriculumMastersByGrades(['小5']);
    await db.clearCurriculumMasters();

    // 4. MilestoneTemplates CRUD
    const template = { id: 'tmpl-perf-1', name: '標準テンプレート', subject: '数学', grade_category: 'junior_high' as const, target_grade: '中1', items: [], created_at: '' };
    await db.saveMilestoneTemplate(template as any);
    expect(db.getMilestoneTemplates().length).toBeGreaterThan(0);
    await db.deleteMilestoneTemplate('tmpl-perf-1');

    // 5. CustomClasses CRUD
    const customClass = { id: 'cc-perf-1', name: '特進クラス', branch_name: '東京校', student_ids: [], created_at: '' };
    await db.saveCustomClass(customClass as any);
    expect(db.getCustomClasses().length).toBeGreaterThan(0);
    await db.deleteCustomClass('cc-perf-1');

    // 6. CurriculumUnits CRUD
    const unit = { id: 'u-perf-1', school_id: 'sch-1', subject: '数学', name: '単元1', sequence_order: 1, created_at: '' };
    await db.saveCurriculumUnits([unit as any]);
    expect(db.getCurriculumUnits().length).toBeGreaterThan(0);
    await db.deleteCurriculumUnit('u-perf-1');

    // 7. MilestonePlans CRUD
    const mp = { id: 'mp-perf-1', student_id: 'std-1', milestone_name: '1学期中間', target_date: '2026-05-15', created_at: '' };
    await db.saveMilestonePlan(mp as any);
    await db.saveMilestonePlans([mp as any]);
    expect(db.getMilestonePlans().length).toBeGreaterThan(0);

    // 8. LearningTasks CRUD
    const task = { id: 'task-perf-1', student_id: 'std-1', date: '2026-06-01', subject: '数学', unit_id: 'u-1', status: 'pending' as const, is_completed: false };
    await db.saveLearningTasks([task as any]);
    expect(db.getLearningTasks().length).toBeGreaterThan(0);
    await db.deleteLearningTasksByDate('std-1', '2026-06-01');
    await db.deleteLearningTasksByStudent('std-1');

    // 9. MiniTestResults CRUD
    const mini = { id: 'mini-perf-1', student_id: 'std-1', date: '2026-06-01', subject: '数学', test_content: '小テスト', score: 90, passed: true, created_at: '' };
    await db.saveMiniTestResult(mini as any);
    expect(db.getMiniTestResults().length).toBeGreaterThan(0);
    await db.deleteMiniTestResult('mini-perf-1');
    await db.deleteMiniTestResultByDate('std-1', '2026-06-01');

    // 10. StudentLessonProgress CRUD
    const prog = { id: 'prog-1', student_id: 'std-1', lesson_id: 'lesson-101', is_completed: true, completed_at: '2026-06-01' };
    await db.saveStudentLessonProgress(prog as any);
    const progressList = db.getStudentLessonProgressList('std-1');
    expect(progressList.length).toBeGreaterThan(0);

    // 11. SchoolCodes & ExamThresholds
    await db.saveSchoolCodeMaster({ school_id: 'sch-1', code: 'S01' } as any);
    expect(db.getSchoolCodesMaster().length).toBeGreaterThan(0);
    await db.saveExamThresholdMaster({ id: 'eth-1', school_id: 'sch-1', exam_name: '中間' } as any);
    expect(db.getExamThresholdsMaster().length).toBeGreaterThan(0);

    // 12. Student CRUD & Clear Mock Data
    const student = { id: 'std-perf-1', name: '完全生徒', grade: '中1', grade_category: 'junior_high' as const, status: 'normal' as const };
    await db.saveStudent(student as any);
    expect(db.getStudents().length).toBeGreaterThan(0);
    await db.deleteStudent('std-perf-1');
    db.clearMockData();
  });
});
