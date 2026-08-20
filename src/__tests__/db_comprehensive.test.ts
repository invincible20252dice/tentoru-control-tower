import { db, Student, LearningTask, CurriculumMaster, CurriculumUnit, MiniTestResult, HomeworkResult, LearningLog, StudentScheduleConfig } from '../lib/db';

describe('Comprehensive DB & Scheduler Coverage Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('db.ts: Mock data getter/setter & localStorage fallback handling', () => {
    const emptyStudents = db.getStudents();
    expect(Array.isArray(emptyStudents)).toBe(true);

    const emptyMasters = db.getCurriculumMasters();
    expect(Array.isArray(emptyMasters)).toBe(true);

    const emptyUnits = db.getCurriculumUnits();
    expect(Array.isArray(emptyUnits)).toBe(true);

    const emptyTasks = db.getLearningTasks();
    expect(Array.isArray(emptyTasks)).toBe(true);

    const emptyTeacherOptions = db.getTeacherOptions();
    expect(Array.isArray(emptyTeacherOptions)).toBe(true);

    const emptyMiniResults = db.getMiniTestResults();
    expect(Array.isArray(emptyMiniResults)).toBe(true);

    const emptyHomework = db.getHomeworkResults();
    expect(Array.isArray(emptyHomework)).toBe(true);

    const emptyLogs = db.getLearningLogs();
    expect(Array.isArray(emptyLogs)).toBe(true);
  });

  test('db.ts: Student CRUD & Branch filter operations', async () => {
    const student1: Student = {
      id: 'std-branch-1',
      name: '生徒1',
      grade: '中1',
      login_id: 'std1',
      password: 'pass',
      status: 'normal',
      branch_id: 'branch-A',
      school_id: 'school-A',
      school_name: '第一中学',
      selected_subjects: ['数学', '英語'],
      created_at: new Date().toISOString()
    };

    const student2: Student = {
      id: 'std-branch-2',
      name: '生徒2',
      grade: '中2',
      login_id: 'std2',
      password: 'pass',
      status: 'withdrawal',
      branch_id: 'branch-B',
      created_at: new Date().toISOString()
    };

    await db.saveStudent(student1);
    await db.saveStudent(student2);

    const allStudents = db.getStudents();
    expect(allStudents.length).toBe(2);

    const branchAStudents = db.getStudents().filter(s => s.branch_id === 'branch-A');
    expect(branchAStudents.length).toBe(1);
    expect(branchAStudents[0].id).toBe('std-branch-1');

    await db.deleteStudent('std-branch-2');
    const remaining = db.getStudents();
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe('std-branch-1');
  });

  test('db.ts: Schedule Config CRUD operations', async () => {
    const config: StudentScheduleConfig = {
      id: 'cfg-1',
      student_id: 'std-branch-1',
      subject: '数学',
      day_of_week: 1, // Monday
      period: 2,
      start_lesson_id: 'cm-m-1',
      end_lesson_id: 'cm-m-2',
      created_at: new Date().toISOString()
    };

    await db.saveStudentScheduleConfig(config);
    const savedConfig = db.getStudentScheduleConfig('std-branch-1');
    expect(savedConfig).toBeDefined();
  });

  test('db.ts: MiniTest, Homework & LearningLog operations', async () => {
    const miniTest: MiniTestResult = {
      id: 'mini-cov-1',
      student_id: 'std-cov-1',
      date: '2026-08-20',
      test_content: '単元テスト1',
      score: 90,
      passed: true,
      created_at: new Date().toISOString()
    };

    const homework: HomeworkResult = {
      id: 'hw-cov-1',
      student_id: 'std-cov-1',
      date: '2026-08-20',
      homework_content: 'ワーク P10-15',
      status: 'completed',
      created_at: new Date().toISOString()
    };

    const log: LearningLog = {
      id: 'log-cov-1',
      student_id: 'std-cov-1',
      unit_id: 'cm-m-1',
      log_type: 'video_view',
      duration_seconds: 300,
      created_at: new Date().toISOString()
    };

    await db.saveMiniTestResult(miniTest);
    await db.saveHomeworkResult(homework);
    await db.addLearningLog(log);

    expect(db.getMiniTestResults('std-cov-1').length).toBeGreaterThanOrEqual(1);
    expect(db.getHomeworkResults('std-cov-1').length).toBeGreaterThanOrEqual(1);
    expect(db.getLearningLogs('std-cov-1').length).toBeGreaterThanOrEqual(1);

    // Filter by date
    expect(db.getMiniTestResults('std-cov-1', '2026-08-20').length).toBe(1);
    expect(db.getHomeworkResults('std-cov-1', '2026-08-20').length).toBe(1);
  });

  test('db.ts: TeacherOptions & PersonalityOptions CRUD', async () => {
    await db.addTeacherOption('テスト講師');
    await db.addPersonalityOption('集中力高い');

    const teachers = await db.fetchTeacherOptions();
    expect(teachers).toContain('テスト講師');

    const personalities = await db.fetchPersonalityOptions();
    expect(personalities).toContain('集中力高い');

    await db.removeTeacherOption('テスト講師');
    await db.deletePersonalityOption('集中力高い');

    const updatedTeachers = db.getTeacherOptions();
    expect(updatedTeachers).not.toContain('テスト講師');
  });

  test('db.ts: Cleanup legacy curriculum masters', async () => {
    const masters: CurriculumMaster[] = [
      { id: 'cm-old-1', grade: '小5', subject: '算数', unit_name: '旧単元', lesson_name: '旧レッスン1', sort_order: 1 },
      { id: 'cm-old-2', grade: '中1', subject: '数学', unit_name: '正の数・負の数', lesson_name: '計算', sort_order: 2 }
    ];

    await db.saveCurriculumMasters(masters);
    const currentMasters = db.getCurriculumMasters();
    expect(currentMasters.length).toBeGreaterThanOrEqual(2);

    await db.deleteCurriculumMastersByGrades(['小5']);
    const remaining = db.getCurriculumMasters();
    expect(remaining.some(m => m.grade === '小5')).toBe(false);
  });

  test('db.ts: AIReport, PromptSetting & TeacherCorrectionLog CRUD operations', async () => {
    const report = {
      id: 'rpt-cov-1',
      student_id: 'std-cov-1',
      report_month: '2026-08',
      summary: '非常に良好な進捗です',
      ai_comment: '計算力が定着しています',
      created_at: new Date().toISOString()
    };

    await db.saveAIReport(report);
    expect(db.getAIReports('std-cov-1').length).toBeGreaterThanOrEqual(1);

    const prompt = {
      id: 'prompt-1',
      setting_key: 'custom_instruction',
      prompt_text: '生徒のモチベーションを高める文章で記述すること',
      updated_at: new Date().toISOString()
    };
    await db.savePromptSetting(prompt);
    expect(db.getPromptSettings().length).toBeGreaterThanOrEqual(1);

    const correction = {
      id: 'corr-1',
      student_id: 'std-cov-1',
      report_month: '2026-08',
      original_ai_text: 'AI下書き',
      corrected_text: '講師の修正済み本文',
      created_at: new Date().toISOString()
    };
    await db.addTeacherCorrectionLog(correction);
    expect(db.getTeacherCorrectionsLogs().length).toBeGreaterThanOrEqual(1);
  });

  test('db.ts: CustomClass, MilestonePlan, MilestoneTemplate CRUD operations', async () => {
    const customClass = {
      id: 'cls-1',
      name: '夏期講習特訓クラス',
      grade: '中3',
      created_at: new Date().toISOString()
    };
    await db.saveCustomClass(customClass);
    expect(db.getCustomClasses().length).toBeGreaterThanOrEqual(1);
    await db.deleteCustomClass('cls-1');

    const plan = {
      id: 'plan-1',
      student_id: 'std-cov-1',
      subject: '数学',
      unit_name: '一次関数',
      scheduled_month: 7,
      scheduled_week: 2,
      created_at: new Date().toISOString()
    };
    await db.saveMilestonePlan(plan);
    expect(db.getMilestonePlans().filter(p => p.student_id === 'std-cov-1').length).toBe(1);

    const template = {
      id: 'tmpl-1',
      name: '中3数学標準ロードマップ',
      grade: '中3',
      subject: '数学',
      items: [{ month: 4, week: 1, unit_name: '展開と因数分解' }],
      created_at: new Date().toISOString()
    };
    await db.saveMilestoneTemplate(template);
    expect(db.getMilestoneTemplates().length).toBeGreaterThanOrEqual(1);
    await db.deleteMilestoneTemplate('tmpl-1');
  });

  test('db.ts: StudentInteraction, ExamThresholdMasters & BranchAIRules CRUD operations', async () => {
    const interaction = {
      id: 'inter-1',
      student_id: 'std-cov-1',
      teacher_name: '山田講師',
      interaction_type: '面談',
      note: '次回模擬試験に向けた学習計画のすり合わせを実施',
      created_at: new Date().toISOString()
    };
    await db.saveStudentInteraction(interaction);
    expect(db.getStudentInteractions('std-cov-1').length).toBeGreaterThanOrEqual(1);
    await db.deleteStudentInteraction('inter-1');

    const rules = {
      id: 'airules-1',
      branch_id: 'branch-1',
      tone: 'supportive' as const,
      custom_prompt: 'ポジティブなフィードバックを中心に記載',
      updated_at: new Date().toISOString()
    };
    await db.saveBranchAIRules(rules);
    expect(db.getBranchAIRules('branch-1')).toBeDefined();
  });

  test('db.ts: School, Branch, CurriculumUnit & LearningTask CRUD operations', async () => {
    const school = { id: 'sch-cov-1', name: '横浜第一中学', type: 'junior_high' as const, created_at: new Date().toISOString() };
    await db.saveSchool(school);
    expect(db.getSchools().some(s => s.id === 'sch-cov-1')).toBe(true);
    await db.deleteSchool('sch-cov-1');
    expect(db.getSchools().some(s => s.id === 'sch-cov-1')).toBe(false);

    const branch = { id: 'br-cov-1', name: '横浜校', code: 'YOK', is_active: true, created_at: new Date().toISOString() };
    await db.saveBranch(branch);
    expect(db.getBranches().some(b => b.id === 'br-cov-1')).toBe(true);

    const unit = { id: 'u-cov-1', school_id: 'sch-1', subject: '数学', unit_name: '因数分解応用', sort_order: 1, created_at: new Date().toISOString() };
    await db.saveCurriculumUnit(unit);
    expect(db.getCurriculumUnits('sch-1', '数学').some(u => u.id === 'u-cov-1')).toBe(true);

    const task = { id: 't-cov-1', student_id: 'std-1', unit_id: 'u-cov-1', scheduled_date: '2026-08-20', period: 1, status: 'unstarted' as const, video_watched: false, test_passed: false, created_at: new Date().toISOString() };
    await db.saveLearningTasks([task]);
    await db.deleteLearningTasksByDate('std-1', '2026-08-20');
  });
});
