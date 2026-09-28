import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../lib/db';
import {
  Student,
  SchoolMaster,
  CurriculumMaster,
  CurriculumUnit,
  HomeworkResult,
  MiniTestResult,
  Branch,
  CustomClass,
  InteractionMemo,
  TestRecord,
  ExamThresholdMaster,
  SchoolCodeMaster,
  PromptSetting,
  AIReport
} from '../types';

describe('db.ts Full Perfection 99%+ Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('exercises all public methods and CRUD operations in db.ts to reach 98%+ coverage', async () => {
    // 1. Clear & Reset
    db.clearLocalMockCache();
    await db.clearCurriculumMasters();
    db.clearMockData();

    // 2. Custom class & custom apply scope
    const initCc = db.getCustomClasses().length;
    const cc: CustomClass = { id: 'cc-test-1', name: '英検対策講座', created_at: new Date().toISOString() };
    await db.saveCustomClass(cc);
    expect(db.getCustomClasses().length).toBe(initCc + 1);
    await db.deleteCustomClass(cc.id);
    expect(db.getCustomClasses().length).toBe(initCc);

    const initScope = db.getCustomApplyScopes().length;
    await db.saveCustomApplyScope('特進選抜クラス');
    expect(db.getCustomApplyScopes().length).toBe(initScope + 1);
    await db.deleteCustomApplyScope('特進選抜クラス');

    // 3. School & Curriculum Unit
    const sch: SchoolMaster = { id: 'sch-test-99', name: 'DBテスト校', type: 'junior_high' };
    await db.saveSchool(sch);
    const schools = await db.fetchSchools();
    expect(schools.some(s => s.id === sch.id)).toBe(true);

    const unit: CurriculumUnit = { id: 'u-test-99', school_id: sch.id, grade: '中3', subject: '数学', name: '1章 展開', sequence_order: 1 };
    await db.saveCurriculumUnit(unit);
    await db.saveCurriculumUnits([unit]);
    const units = await db.fetchCurriculumUnits(sch.id);
    expect(units.length).toBeGreaterThanOrEqual(1);
    await db.deleteCurriculumUnit(unit.id);
    await db.deleteSchool(sch.id);

    // 4. Student CRUD
    const st: Student = {
      id: 'std-test-99',
      student_id: 'S_TEST_99',
      name: 'テスト 生徒99',
      grade: '中3',
      status: 'normal',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      selected_days: ['monday'],
      selected_subjects: ['数学']
    };
    await db.saveStudent(st);
    expect(db.getStudentById(st.id)?.name).toBe(st.name);
    expect((await db.fetchStudent(st.id))?.name).toBe(st.name);
    await db.deleteStudent(st.id);

    // 5. Test records, SchoolCodeMaster, ExamThresholdMaster
    const tr: TestRecord = {
      id: 'tr-99',
      student_id: 'std-test-99',
      exam_name: '中間テスト',
      math_score: 95,
      math_target: 90
    };
    await db.saveTestRecord(tr);
    expect(db.getTestRecords().some(r => r.id === tr.id)).toBe(true);
    await db.deleteTestRecord(tr.id);

    const scm: SchoolCodeMaster = { id: 'scm-99', code: 'SC99', name: 'コード校' };
    await db.saveSchoolCodeMaster(scm);
    expect(db.getSchoolCodesMaster().some(c => c.id === scm.id)).toBe(true);

    const eth: ExamThresholdMaster = { id: 'eth-99', school_name: '第一高校', target_score: 400 };
    await db.saveExamThresholdMaster(eth);
    expect(db.getExamThresholdsMaster().some(e => e.id === eth.id)).toBe(true);

    // 6. AI Report & Prompt Settings
    const prompt: PromptSetting = { id: 'prompt-1', role_name: 'teacher', prompt_template: 'テンプレート' };
    await db.savePromptSetting(prompt);
    expect(db.getPromptSettings().length).toBeGreaterThan(0);

    const report: AIReport = {
      id: 'rep-99',
      student_id: 'std-test-99',
      student_name: 'テスト 生徒99',
      report_date: '2026-04-15',
      subject: '数学',
      overall_summary: '順調です',
      created_at: new Date().toISOString()
    };
    await db.saveAIReport(report);
    expect(db.getAIReports('std-test-99').length).toBeGreaterThanOrEqual(1);

    db.addTeacherCorrectionLog({ id: 'tcl-1', student_id: 'std-test-99', original_text: 'A', corrected_text: 'B', corrected_at: new Date().toISOString() });
    expect(db.getTeacherCorrectionsLogs().length).toBeGreaterThan(0);

    // 7. Mini Test Results & Homework Results
    const mini: MiniTestResult = {
      id: 'mini-99',
      student_id: 'std-test-99',
      date: '2026-04-15',
      subject: '数学',
      unit_name: '1章',
      status: 'pending',
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(mini);
    expect((await db.fetchMiniTestResults('std-test-99')).length).toBeGreaterThanOrEqual(1);
    await db.deleteMiniTestResult(mini.id);
    await db.deleteMiniTestResultByDate('std-test-99', '2026-04-15');

    const hw: HomeworkResult = {
      id: 'hw-99',
      student_id: 'std-test-99',
      date: '2026-04-15',
      subject: '数学',
      unit_name: '1章',
      status: 'incomplete',
      created_at: new Date().toISOString()
    };
    await db.saveHomeworkResult(hw);
    await db.saveHomeworkResults([hw]);
    expect((await db.fetchHomeworkResults('std-test-99')).length).toBeGreaterThanOrEqual(1);
    await db.deleteHomeworkResult(hw.id);
    await db.deleteHomeworkResultsByDate('std-test-99', '2026-04-15');

    // 8. Milestone plans & templates
    await db.saveMilestonePlan({ id: 'mp-99', student_id: 'std-test-99', subject: '数学', month: 4, week: 1, chapter: '1章' });
    await db.saveMilestonePlans([{ id: 'mp-99b', student_id: 'std-test-99', subject: '数学', month: 4, week: 2, chapter: '1章' }]);
    expect(db.getMilestonePlans('std-test-99').length).toBeGreaterThanOrEqual(1);

    const tmpl = { id: 'tmpl-99', name: '標準テンプレート', grade: '中3', level: 'A', subject: '数学', plans: [] };
    await db.saveMilestoneTemplate(tmpl);
    expect(db.getMilestoneTemplates().some(t => t.id === tmpl.id)).toBe(true);
    await db.deleteMilestoneTemplate(tmpl.id);

    // 9. Curriculum Masters
    const cm: CurriculumMaster = { id: 'cm-99', grade: '中3', subject: '数学', unit_name: '1章', lesson_name: 'L1', sort_order: 1 };
    await db.saveCurriculumMasters([cm]);
    expect((await db.fetchCurriculumMasters()).some(m => m.id === cm.id)).toBe(true);
    await db.deleteCurriculumMaster(cm.id);
    await db.deleteCurriculumMastersByGrades(['中3'], '数学');

    // 10. Student Interactions & Personality & Teacher Options
    const memo: InteractionMemo = { id: 'im-99', student_id: 'std-test-99', date: '2026-04-15', staff_name: '福田', memo: 'メモ' };
    await db.saveStudentInteraction(memo);
    expect((await db.fetchStudentInteractions('std-test-99')).length).toBeGreaterThanOrEqual(1);
    await db.deleteStudentInteraction(memo.id);

    await db.addPersonalityOption('チャレンジ精神');
    expect((await db.fetchPersonalityOptions()).includes('チャレンジ精神')).toBe(true);
    await db.removePersonalityOption('チャレンジ精神');
    await db.deletePersonalityOption('チャレンジ精神');

    await db.addTeacherOption('新規 先生');
    expect((await db.fetchTeacherOptions()).includes('新規 先生')).toBe(true);
    await db.updateTeacherOption('新規 先生', '更新 先生');
    await db.removeTeacherOption('更新 先生');
    await db.deleteTeacherOption('更新 先生');

    // 11. Branches & AI Rules
    const br: Branch = { id: 'br-99', name: 'テスト校舎99', code: 'B99', email: 'test99@tentoru.jp', status: 'active', created_at: new Date().toISOString() };
    await db.saveBranch(br);
    expect((await db.fetchBranches()).some(b => b.id === br.id)).toBe(true);
    await db.toggleBranchStatus(br.id);
    await db.saveBranchAIRules(br.id, { lessons_per_slot: 3 });
    expect(db.getBranchAIRules(br.id).lessons_per_slot).toBe(3);
    await db.deleteBranch(br.id);

    // 12. Learning logs & Schedule config & Lesson progress
    db.addLearningLog({ id: 'll-99', student_id: 'std-test-99', date: '2026-04-15', subject: '数学', start_time: '18:00', end_time: '19:30' });
    expect(db.getLearningLogs('std-test-99').length).toBeGreaterThanOrEqual(1);

    await db.saveStudentScheduleConfig('std-test-99', { day_of_week: 'monday', subject: '数学', period: 1 });
    expect(db.getStudentScheduleConfig('std-test-99')).toBeDefined();

    // 13. Student Lesson Progress
    const prog = { id: 'prog-1', student_id: 'std-test-99', lesson_id: 'cm-99', status: 'completed' as const, completed_at: new Date().toISOString() };
    await db.saveStudentLessonProgress(prog);
    expect(db.getStudentLessonProgressList('std-test-99').length).toBeGreaterThan(0);
    expect((await db.fetchStudentLessonProgressList('std-test-99')).length).toBeGreaterThan(0);

    // 14. Learning Tasks
    await db.deleteLearningTasksByStudent('std-test-99');

    // 15. Role & Session
    db.setCurrentUserRole('admin', null, '本部統括管理者');
    expect(db.getCurrentUserRole().role).toBe('admin');
    await db.signOut();
    expect(db.getSession()).toBeNull();
  });
});
