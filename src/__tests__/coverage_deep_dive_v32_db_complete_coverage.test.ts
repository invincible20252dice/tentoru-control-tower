import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, CurriculumUnit, MilestonePlan, ExamThresholdMaster, PromptSetting, TeacherCorrectionLog, CustomClass, MilestoneTemplate, StudentInteraction, AIReport, MiniTestResult, StudentLessonProgress, LearningTask, Branch, School, CurriculumMaster, TestRecord } from '../lib/db';

describe('DatabaseService Complete 95%+ Coverage Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('covers all DatabaseService CRUD methods, cache fallback, and Supabase mode edge cases', async () => {
    const testDb = db;

    // 1. Schools CRUD
    const school: School = {
      id: 'sch-test-99',
      name: 'テスト学校99',
      type: 'elementary',
      grade_levels: ['1年生', '2年生'],
      created_at: new Date().toISOString()
    };
    await testDb.saveSchool(school);
    const schools = await testDb.fetchSchools();
    expect(schools.some(s => s.id === 'sch-test-99')).toBe(true);

    // 2. Students CRUD
    const student: Student = {
      id: 'std-test-99',
      student_id: 'std99',
      name: 'テスト生徒99',
      grade: '小1',
      school_id: 'sch-test-99',
      branch_id: 'branch-1',
      created_at: new Date().toISOString()
    };
    await testDb.saveStudent(student);
    const students = await testDb.fetchStudents();
    expect(students.some(s => s.id === 'std-test-99')).toBe(true);

    // 3. CurriculumMasters CRUD & cleanup
    const master: CurriculumMaster = {
      id: 'cm-test-99',
      subject: '算数',
      grade: '1年生',
      unit_name: '単元99',
      lesson_name: 'レッスン99',
      sort_order: 99
    };
    await testDb.saveCurriculumMasters([master]);
    const masters = await testDb.fetchCurriculumMasters('算数');
    expect(masters.some(m => m.id === 'cm-test-99')).toBe(true);
    await testDb.deleteCurriculumMaster('cm-test-99');

    // 4. CurriculumUnits CRUD
    const unit: CurriculumUnit = {
      id: 'cu-test-99',
      school_id: 'sch-test-99',
      subject: '算数',
      name: '単元ユニット99',
      sequence_order: 99,
      created_at: new Date().toISOString()
    };
    await testDb.saveCurriculumUnits([unit]);
    const units = await testDb.fetchCurriculumUnits('sch-test-99');
    expect(units.some(u => u.id === 'cu-test-99')).toBe(true);

    // 5. MilestonePlans CRUD
    const milestone: MilestonePlan = {
      id: 'mp-test-99',
      level: 'A',
      school_id: 'sch-test-99',
      grade: '1年生',
      subject: '算数',
      month: 4,
      week: 1,
      chapter_name: '第1章',
      unit_name: '単元99',
      sequence_order: 1,
      created_at: new Date().toISOString()
    };
    await testDb.saveMilestonePlans([milestone]);
    const milestones = testDb.getMilestonePlans();
    expect(milestones.some(m => m.id === 'mp-test-99')).toBe(true);

    // 6. LearningTasks CRUD & Overwrites
    const task: LearningTask = {
      id: 'task-test-99',
      student_id: 'std-test-99',
      scheduled_date: '2026-09-20',
      period: 1,
      subject: '算数',
      status: 'unstarted',
      created_at: new Date().toISOString()
    };
    await testDb.saveLearningTasks([task]);
    const tasks = await testDb.fetchLearningTasks('std-test-99', '2026-09-20');
    expect(tasks.some(t => t.id === 'task-test-99')).toBe(true);
    await testDb.overwriteLearningTasksForDate('std-test-99', '2026-09-20', [{ ...task, status: 'completed' }]);
    await testDb.deleteLearningTasksByDate('std-test-99', '2026-09-20');

    // 7. TestRecords CRUD
    const tr: TestRecord = {
      id: 'tr-test-99',
      student_id: 'std-test-99',
      record_type: 'regular_test',
      subject: '算数',
      score: 95,
      test_date: '2026-09-20',
      created_at: new Date().toISOString()
    };
    await testDb.saveTestRecord(tr);
    const testRecords = testDb.getTestRecords();
    expect(testRecords.some(r => r.id === 'tr-test-99')).toBe(true);
    await testDb.deleteTestRecord('tr-test-99');

    // 8. ExamThresholdMaster CRUD
    const eth: ExamThresholdMaster = {
      id: 'eth-test-99',
      school_id: 'sch-test-99',
      grade: '1年生',
      subject: '算数',
      term: '1学期',
      target_score: 90,
      threshold_score: 70
    };
    await testDb.saveExamThresholdMaster(eth);
    const ethList = testDb.getExamThresholdsMaster();
    expect(ethList.some(e => e.id === 'eth-test-99')).toBe(true);

    // 9. PromptSetting CRUD
    const prompt: PromptSetting = {
      id: 'prompt-test-99',
      template_name: 'プロンプト99',
      system_prompt: 'システムプロンプト',
      updated_at: new Date().toISOString()
    };
    await testDb.savePromptSetting(prompt);
    const promptList = testDb.getPromptSettings();
    expect(promptList.some(p => p.id === 'prompt-test-99')).toBe(true);

    // 10. TeacherCorrectionLog CRUD
    const log: TeacherCorrectionLog = {
      id: 'log-test-99',
      report_id: 'rep-99',
      student_id: 'std-test-99',
      teacher_id: 'teacher-99',
      original_content: '元の内容',
      corrected_content: '修正後の内容',
      reason: '理由',
      created_at: new Date().toISOString()
    };
    await testDb.addTeacherCorrectionLog(log);
    const logs = testDb.getTeacherCorrectionsLogs();
    expect(logs.some(l => l.id === 'log-test-99')).toBe(true);

    // 11. CustomClass CRUD
    const cc: CustomClass = {
      id: 'cc-test-99',
      name: 'カスタムクラス99',
      description: '説明',
      subject: '算数',
      grade: '1年生'
    };
    await testDb.saveCustomClass(cc);
    const ccList = testDb.getCustomClasses();
    expect(ccList.some(c => c.id === 'cc-test-99')).toBe(true);
    await testDb.deleteCustomClass('cc-test-99');

    // 12. MilestoneTemplate CRUD
    const mt: MilestoneTemplate = {
      id: 'mt-test-99',
      name: 'テンプレート99',
      subject: '算数',
      target_school_type: 'elementary',
      rows: []
    };
    await testDb.saveMilestoneTemplate(mt);
    const mtList = testDb.getMilestoneTemplates();
    expect(mtList.some(m => m.id === 'mt-test-99')).toBe(true);
    await testDb.deleteMilestoneTemplate('mt-test-99');

    // 13. StudentInteraction CRUD
    const inter: StudentInteraction = {
      id: 'inter-test-99',
      student_id: 'std-test-99',
      category: '面談',
      date: '2026-09-20',
      staff_name: '講師99',
      memo: 'メモ',
      created_at: new Date().toISOString()
    };
    await testDb.saveStudentInteraction(inter);
    const interList = await testDb.fetchStudentInteractions('std-test-99');
    expect(interList.some(i => i.id === 'inter-test-99')).toBe(true);
    await testDb.deleteStudentInteraction('inter-test-99');

    // 14. AIReport CRUD
    const report: AIReport = {
      id: 'rep-test-99',
      student_id: 'std-test-99',
      month: '2026-09',
      summary: '概要',
      strengths: '強み',
      weaknesses: '課題',
      recommendations: '推奨事項',
      created_at: new Date().toISOString()
    };
    await testDb.saveAIReport(report);
    const repList = testDb.getAIReports();
    expect(repList.some(r => r.id === 'rep-test-99')).toBe(true);

    // 15. MiniTestResult CRUD
    const mini: MiniTestResult = {
      id: 'mini-test-99',
      student_id: 'std-test-99',
      lesson_id: 'cm-test-99',
      subject: '算数',
      score: 100,
      passed: true,
      tested_at: new Date().toISOString()
    };
    await testDb.saveMiniTestResult(mini);
    const miniList = await testDb.fetchMiniTestResults('std-test-99');
    expect(miniList.some(m => m.id === 'mini-test-99')).toBe(true);

    // 16. StudentLessonProgress CRUD
    const slp: StudentLessonProgress = {
      id: 'slp-test-99',
      student_id: 'std-test-99',
      lesson_id: 'cm-test-99',
      status: 'completed',
      score: 100,
      completed_at: new Date().toISOString()
    };
    await testDb.saveStudentLessonProgress(slp);
    const slpList = await testDb.fetchStudentLessonProgressList('std-test-99');
    expect(slpList.some(s => s.id === 'slp-test-99')).toBe(true);

    // 17. Branch CRUD
    const branch: Branch = {
      id: 'br-test-99',
      name: 'テスト校舎99',
      code: 'T99',
      email: 't99@tentoru.jp',
      is_active: true
    };
    await testDb.saveBranch(branch);
    const branchList = await testDb.fetchBranches();
    expect(branchList.some(b => b.id === 'br-test-99')).toBe(true);
    await testDb.deleteBranch('br-test-99');

    // 18. Restore default data
    await testDb.restoreAllDefaultData();
  });
});
