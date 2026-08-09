import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, getSchoolYear, calculateCurrentGrade } from '../lib/db';
import { getGeminiApiKey, saveGeminiApiKey } from '@/lib/gemini';

describe('Database Service CRUD Tests', () => {
  beforeEach(() => {
    // デフォルトでMockModeに戻す
    (db as any).isMockMode = true;
    db.clearMockData();
  });

  it('should manage schools', async () => {
    const schools = db.getSchools();
    expect(schools.length).toBeGreaterThan(0);

    const newSchool = {
      id: 'sch-test',
      name: 'テスト中学校',
      type: 'junior_high' as const,
      created_at: new Date().toISOString()
    };

    const saved = await db.saveSchool(newSchool);
    expect(saved.id).toBe('sch-test');

    const freshSchools = db.getSchools();
    expect(freshSchools.find(s => s.id === 'sch-test')).toBeDefined();
  });

  it('should sanitize NEXT_PUBLIC_SUPABASE_URL removing /rest/v1 and trailing slashes', () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://oqwnciwyzstiqszdgekr.supabase.co/rest/v1/';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy_anon_key';
    
    const ServiceClass = (db as any).constructor;
    const instance = new ServiceClass();
    expect((instance as any).isMockMode).toBe(false);
    
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });

  it('should manage students', async () => {
    const students = db.getStudents();
    expect(students.length).toBeGreaterThan(0);

    const newStudent = {
      id: 'std-test',
      student_id: 'student_t',
      name: 'テスト生徒',
      email: 'student_t@tentoru.com',
      grade: '中1',
      school_id: 'sch-1',
      status: 'normal' as const,
      start_unit_id: null,
      created_at: new Date().toISOString(),
      weekly_sessions_count: '2回',
      weekly_duration_minutes: '120分'
    };

    const saved = await db.saveStudent(newStudent);
    expect(saved.id).toBe('std-test');
    expect(saved.weekly_sessions_count).toBe('2回');
    expect(saved.weekly_duration_minutes).toBe('120分');

    const freshStudents = db.getStudents();
    const found = freshStudents.find(s => s.id === 'std-test');
    expect(found).toBeDefined();
    expect(found?.weekly_sessions_count).toBe('2回');
    expect(found?.weekly_duration_minutes).toBe('120分');
  });

  it('should manage curriculum units', async () => {
    const units = db.getCurriculumUnits();
    expect(units.length).toBeGreaterThan(0);

    const newUnit = {
      id: 'unit-test',
      school_id: 'sch-1',
      subject: '数学',
      name: 'テスト単元',
      sequence_order: 99,
      created_at: new Date().toISOString()
    };

    const saved = await db.saveCurriculumUnits([newUnit]);
    expect(saved[0].id).toBe('unit-test');

    const freshUnits = db.getCurriculumUnits();
    expect(freshUnits.find(u => u.id === 'unit-test')).toBeDefined();

    // 単一の curriculum unit の操作 (LocalStorage モックモード)
    const singleCU = { id: 'unit-single-test', school_id: 'sch-1', subject: '数学', name: '単体テスト単元', sequence_order: 100, created_at: '' };
    const savedSingle = await db.saveCurriculumUnit(singleCU);
    expect(savedSingle.id).toBe('unit-single-test');
    await db.deleteCurriculumUnit('unit-single-test');
    const remains = db.getCurriculumUnits();
    expect(remains.find(u => u.id === 'unit-single-test')).toBeUndefined();
  });

  it('should manage learning tasks', async () => {
    const tasks = db.getLearningTasks();
    expect(tasks.length).toBeGreaterThan(0);

    const newTask = {
      id: 'task-test',
      student_id: 'std-1',
      unit_id: 'unit-101',
      scheduled_date: '2026-06-25',
      period: null,
      status: 'unstarted' as const,
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };

    const saved = await db.saveLearningTasks([newTask]);
    expect(saved[0].id).toBe('task-test');

    const freshTasks = db.getLearningTasks();
    expect(freshTasks.find(t => t.id === 'task-test')).toBeDefined();

    // Delete tasks for student
    await db.deleteLearningTasksByStudent('std-1');
    const remainingTasks = db.getLearningTasks();
    expect(remainingTasks.filter(t => t.student_id === 'std-1').length).toBe(0);
  });

  it('should manage learning logs', async () => {
    const newLog = {
      id: 'log-test',
      student_id: 'std-1',
      unit_id: 'unit-101',
      log_type: 'video_view' as const,
      duration_seconds: 500,
      created_at: new Date().toISOString()
    };

    const saved = await db.addLearningLog(newLog);
    expect(saved.id).toBe('log-test');

    const logs = db.getLearningLogs();
    expect(logs.find(l => l.id === 'log-test')).toBeDefined();
  });

  it('should manage test records', async () => {
    const newRecord = {
      id: 'tr-test',
      student_id: 'std-1',
      record_type: 'regular_test' as const,
      subject: '数学',
      score: 95,
      created_at: new Date().toISOString()
    };

    const saved = await db.saveTestRecord(newRecord);
    expect(saved.id).toBe('tr-test');

    // Update branch cover (idx >= 0)
    const updated = await db.saveTestRecord({ ...saved, score: 99 });
    expect(updated.score).toBe(99);

    const records = db.getTestRecords();
    expect(records.find(r => r.id === 'tr-test')?.score).toBe(99);
  });

  it('should manage school codes', async () => {
    const newCode = {
      code: 'code-test',
      name: 'テスト高校',
      deviation_value: 65
    };

    const saved = await db.saveSchoolCodeMaster(newCode);
    expect(saved.code).toBe('code-test');

    // Update branch cover (idx >= 0)
    const updated = await db.saveSchoolCodeMaster({ ...saved, deviation_value: 70 });
    expect(updated.deviation_value).toBe(70);

    const codes = db.getSchoolCodesMaster();
    expect(codes.find(c => c.code === 'code-test')?.deviation_value).toBe(70);
  });

  it('should manage exam thresholds', async () => {
    const newEth = {
      id: 'eth-test',
      school_code: 'schcode-A',
      min_score: 400,
      max_score: 450,
      probability: 75
    };

    const saved = await db.saveExamThresholdMaster(newEth);
    expect(saved.id).toBe('eth-test');

    // Update branch cover (idx >= 0)
    const updated = await db.saveExamThresholdMaster({ ...saved, probability: 80 });
    expect(updated.probability).toBe(80);

    const thresholds = db.getExamThresholdsMaster();
    expect(thresholds.find(e => e.id === 'eth-test')?.probability).toBe(80);
  });

  it('should manage prompt settings', async () => {
    const newPrompt = {
      id: 'prompt-test',
      prompt_template: 'テンプレートテスト',
      created_at: new Date().toISOString()
    };

    const saved = await db.savePromptSetting(newPrompt);
    expect(saved.id).toBe('prompt-test');

    // Update branch cover (idx >= 0)
    const updated = await db.savePromptSetting({ ...saved, prompt_template: '更新テンプレート' });
    expect(updated.prompt_template).toBe('更新テンプレート');

    const prompts = db.getPromptSettings();
    expect(prompts.find(p => p.id === 'prompt-test')?.prompt_template).toBe('更新テンプレート');
  });

  it('should manage AI reports', async () => {
    const newReport = {
      id: 'rep-test',
      student_id: 'std-1',
      month: '2026-07',
      analysis_text: '分析テキスト',
      created_at: new Date().toISOString()
    };

    const saved = await db.saveAIReport(newReport);
    expect(saved.id).toBe('rep-test');

    // Update branch cover (idx >= 0)
    const updated = await db.saveAIReport({ ...saved, analysis_text: '更新分析' });
    expect(updated.analysis_text).toBe('更新分析');

    const reports = db.getAIReports();
    expect(reports.find(r => r.id === 'rep-test')?.analysis_text).toBe('更新分析');
  });

  it('should manage teacher correction logs', async () => {
    const newLog = {
      id: 'cor-test',
      student_id: 'std-1',
      original_text: 'オリジナル',
      corrected_text: '修正',
      created_at: new Date().toISOString()
    };

    const saved = await db.addTeacherCorrectionLog(newLog);
    expect(saved.id).toBe('cor-test');

    const logs = db.getTeacherCorrectionsLogs();
    expect(logs.find(l => l.id === 'cor-test')).toBeDefined();
  });

  // non-browser fallback simulation
  it('should early return in clearMockData if not in browser', () => {
    const originalIsBrowser = (db as any).isBrowser;
    (db as any).isBrowser = () => false;

    // should not throw error or delete items
    db.clearMockData();

    (db as any).isBrowser = originalIsBrowser;
  });

  // Supabase CRUD paths simulation
  it('should cover Supabase CRUD paths when not in mock mode', async () => {
    const localDb = new (db.constructor as any)();
    (localDb as any).isMockMode = false;
    
    const createMockPromise = (data: any) => {
      const p = Promise.resolve({ data, error: null });
      (p as any).single = vi.fn().mockResolvedValue({ data, error: null });
      (p as any).eq = vi.fn().mockResolvedValue({ data: [data], error: null });
      return p;
    };

    (localDb as any).supabase = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockImplementation(() => createMockPromise({ id: 'sup-id', code: 'sup-id' }))
        })),
        insert: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockImplementation(() => createMockPromise({ id: 'sup-id', code: 'sup-id' }))
        })),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      })
    };

    const school = { id: 'sup-1', name: 'S', type: 'junior_high' as const, created_at: '' };
    const savedSch = await localDb.saveSchool(school);
    expect(savedSch.id).toBe('sup-id');

    const student = { id: 'sup-1', student_id: 'S', name: 'S', email: 'S', grade: 'S', school_id: 'S', status: 'normal' as const, start_unit_id: null, created_at: '' };
    const savedStd = await localDb.saveStudent(student);
    expect(savedStd.id).toBe('sup-id');

    const unit = { id: 'sup-1', school_id: 'S', subject: 'S', name: 'S', sequence_order: 1, created_at: '' };
    const savedUnits = await localDb.saveCurriculumUnits([unit]);
    expect(savedUnits).toBeDefined();

    const savedUnit = await localDb.saveCurriculumUnit(unit);
    expect(savedUnit.id).toBe('sup-id');
    await localDb.deleteCurriculumUnit('sup-1');

    const task = { id: 'sup-1', student_id: 'S', unit_id: 'S', scheduled_date: '2026-06-19', period: null, status: 'unstarted' as const, video_watched: false, test_passed: false, created_at: '' };
    const savedTasks = await localDb.saveLearningTasks([task]);
    expect(savedTasks).toBeDefined();

    await localDb.deleteLearningTasksByStudent('sup-1');

    const log = { id: 'sup-1', student_id: 'S', unit_id: 'S', log_type: 'video_view' as const, created_at: '' };
    const savedLog = await localDb.addLearningLog(log);
    expect(savedLog.id).toBe('sup-id');

    const record = { id: 'sup-1', student_id: 'S', record_type: 'regular_test' as const, subject: 'S', score: 100, created_at: '' };
    const savedRec = await localDb.saveTestRecord(record);
    expect(savedRec.id).toBe('sup-id');

    const code = { code: 'sup-1', name: 'S', deviation_value: 60 };
    const savedCode = await localDb.saveSchoolCodeMaster(code);
    expect(savedCode.code).toBe('sup-id');

    const eth = { id: 'sup-1', school_code: 'S', min_score: 0, max_score: 100, probability: 50 };
    const savedEth = await localDb.saveExamThresholdMaster(eth);
    expect(savedEth.id).toBe('sup-id');

    const report = { id: 'sup-1', student_id: 'S', month: 'S', analysis_text: 'S', created_at: '' };
    const savedRep = await localDb.saveAIReport(report);
    expect(savedRep.id).toBe('sup-id');

    const prompt = { id: 'sup-1', prompt_template: 'S', created_at: '' };
    const savedPrompt = await localDb.savePromptSetting(prompt);
    expect(savedPrompt.id).toBe('sup-id');

    const cor = { id: 'sup-1', student_id: 'S', original_text: 'S', corrected_text: 'S', created_at: '' };
    const savedCor = await localDb.addTeacherCorrectionLog(cor);
    expect(savedCor.id).toBe('sup-id');

    const miniRes = { id: 'sup-1', student_id: 'S', date: '2026-06-19', test_content: 'S', score: 100, created_at: '' };
    const savedMini = await localDb.saveMiniTestResult(miniRes);
    expect(savedMini.id).toBe('sup-id');

    await localDb.deleteMiniTestResult('sup-1');

    const hwRes = { id: 'sup-1', student_id: 'S', date: '2026-06-19', homework_content: 'S', homework_deadline: '2026-06-20', status: 'incomplete' as const, created_at: '' };
    const savedHw = await localDb.saveHomeworkResult(hwRes);
    expect(savedHw.id).toBe('sup-id');

    const savedHws = await localDb.saveHomeworkResults([hwRes]);
    expect(savedHws).toBeDefined();

    await localDb.deleteHomeworkResult('sup-1');

    const mp = { id: 'sup-1', grade: '中3', subject: '数学', course: 'standard' as const, month: 6, week_number: 1, is_holiday: false };
    const savedMp = await localDb.saveMilestonePlan(mp);
    expect(savedMp.id).toBe('sup-id');

    const savedMps = await localDb.saveMilestonePlans([mp]);
    expect(savedMps).toBeDefined();

    const interaction = { id: 'sup-1', student_id: 'S', category: 'S', memo: 'S', date: '2026-06-19', staff_name: 'S', created_at: '' };
    const savedInt = await localDb.saveStudentInteraction(interaction);
    expect(savedInt.id).toBe('sup-id');

    await localDb.deleteStudentInteraction('sup-1');

    const addedPersonality = await localDb.addPersonalityOption('S');
    expect(addedPersonality).toBe('S');
  });

  // Supabase error paths simulation
  it('should throw error in Supabase if query fails', async () => {
    const localDb = new (db.constructor as any)();
    (localDb as any).isMockMode = false;

    const createErrorPromise = () => {
      const p = Promise.resolve({ data: null, error: new Error('Database Error') });
      (p as any).single = vi.fn().mockResolvedValue({ data: null, error: new Error('Database Error') });
      (p as any).eq = vi.fn().mockImplementation(() => createErrorPromise());
      (p as any).select = vi.fn().mockImplementation(() => createErrorPromise());
      return p;
    };

    (localDb as any).supabase = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation(() => createErrorPromise()),
        update: vi.fn().mockImplementation(() => createErrorPromise()),
        insert: vi.fn().mockImplementation(() => createErrorPromise()),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: new Error('Database Error') })
        })
      })
    };

    const school = { id: 'sup-1', name: 'S', type: 'junior_high' as const, created_at: '' };
    await expect(localDb.saveSchool(school)).rejects.toThrow('Database Error');

    const student = { id: 'sup-1', student_id: 'S', name: 'S', email: 'S', grade: 'S', school_id: 'S', status: 'normal' as const, start_unit_id: null, created_at: '' };
    await expect(localDb.saveStudent(student)).rejects.toThrow('Database Error');

    const unit = { id: 'sup-1', school_id: 'S', subject: 'S', name: 'S', sequence_order: 1, created_at: '' };
    await expect(localDb.saveCurriculumUnits([unit])).rejects.toThrow('Database Error');

    await expect(localDb.saveCurriculumUnit(unit)).rejects.toThrow('Database Error');
    await expect(localDb.deleteCurriculumUnit('sup-1')).rejects.toThrow('Database Error');

    const task = { id: 'sup-1', student_id: 'S', unit_id: 'S', scheduled_date: '2026-06-19', period: null, status: 'unstarted' as const, video_watched: false, test_passed: false, created_at: '' };
    await expect(localDb.saveLearningTasks([task])).rejects.toThrow('Database Error');

    await expect(localDb.deleteLearningTasksByStudent('sup-1')).rejects.toThrow('Database Error');

    const log = { id: 'sup-1', student_id: 'S', unit_id: 'S', log_type: 'video_view' as const, created_at: '' };
    await expect(localDb.addLearningLog(log)).rejects.toThrow('Database Error');

    const record = { id: 'sup-1', student_id: 'S', record_type: 'regular_test' as const, subject: 'S', score: 100, created_at: '' };
    await expect(localDb.saveTestRecord(record)).rejects.toThrow('Database Error');

    const code = { code: 'sup-1', name: 'S', deviation_value: 60 };
    await expect(localDb.saveSchoolCodeMaster(code)).rejects.toThrow('Database Error');

    const eth = { id: 'sup-1', school_code: 'S', min_score: 0, max_score: 100, probability: 50 };
    await expect(localDb.saveExamThresholdMaster(eth)).rejects.toThrow('Database Error');

    const report = { id: 'sup-1', student_id: 'S', month: 'S', analysis_text: 'S', created_at: '' };
    await expect(localDb.saveAIReport(report)).rejects.toThrow('Database Error');

    const prompt = { id: 'sup-1', prompt_template: 'S', created_at: '' };
    await expect(localDb.savePromptSetting(prompt)).rejects.toThrow('Database Error');

    const cor = { id: 'sup-1', student_id: 'S', original_text: 'S', corrected_text: 'S', created_at: '' };
    await expect(localDb.addTeacherCorrectionLog(cor)).rejects.toThrow('Database Error');

    const miniRes = { id: 'sup-1', student_id: 'S', date: '2026-06-19', test_content: 'S', score: 100, created_at: '' };
    await expect(localDb.saveMiniTestResult(miniRes)).rejects.toThrow('Database Error');
    await expect(localDb.deleteMiniTestResult('sup-1')).rejects.toThrow('Database Error');

    const hwRes = { id: 'sup-1', student_id: 'S', date: '2026-06-19', homework_content: 'S', homework_deadline: '2026-06-20', status: 'incomplete' as const, created_at: '' };
    await expect(localDb.saveHomeworkResult(hwRes)).rejects.toThrow('Database Error');
    await expect(localDb.saveHomeworkResults([hwRes])).rejects.toThrow('Database Error');
    await expect(localDb.deleteHomeworkResult('sup-1')).rejects.toThrow('Database Error');

    const mp = { id: 'sup-1', grade: '中3', subject: '数学', course: 'standard' as const, month: 6, week_number: 1, is_holiday: false };
    await expect(localDb.saveMilestonePlan(mp)).rejects.toThrow('Database Error');
    await expect(localDb.saveMilestonePlans([mp])).rejects.toThrow('Database Error');

    const interaction = { id: 'sup-1', student_id: 'S', category: 'S', memo: 'S', date: '2026-06-19', staff_name: 'S', created_at: '' };
    await expect(localDb.saveStudentInteraction(interaction)).rejects.toThrow('Database Error');
    await expect(localDb.deleteStudentInteraction('sup-1')).rejects.toThrow('Database Error');
    await expect(localDb.addPersonalityOption('S')).rejects.toThrow('Database Error');
  });

  // JSON parse error cover
  it('should fallback to seed data when localstorage has invalid JSON', () => {
    localStorage.setItem('tentoru_schools', 'invalid-json-{');
    const schools = db.getSchools();
    expect(schools.length).toBeGreaterThan(0); // fallback successful
  });

  // Constructor error cover
  it('should fallback to mock mode if Supabase fails to initialize', () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    // Setting invalid values to trigger initialization error paths
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'invalid-url';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'invalid-key';

    const CustomDB = db.constructor as any;
    const testDbInstance = new CustomDB();
    expect(testDbInstance).toBeDefined();

    // Cleanup
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });

  // Non-browser path cover
  it('should handle non-browser environment', async () => {
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;
    
    // In Node environment, getMockData should just return initialData and not call localStorage
    const schools = db.getSchools();
    expect(schools).toBeDefined();

    // Trigger saveMockData non-browser path
    const school = { id: 'sch-node-test', name: 'Node校舎', type: 'junior_high' as const, created_at: '' };
    await db.saveSchool(school);

    // Cleanup
    global.window = originalWindow;
  });

  // Overwrite path cover for CRUDs
  it('should overwrite existing school when saving school with existing id', async () => {
    const school = { id: 'sch-1', name: '既存の校舎', type: 'junior_high' as const, created_at: '' };
    const saved1 = await db.saveSchool(school);
    expect(saved1.name).toBe('既存の校舎');

    const updatedSchool = { id: 'sch-1', name: '更新された校舎', type: 'junior_high' as const, created_at: '' };
    const saved2 = await db.saveSchool(updatedSchool);
    expect(saved2.name).toBe('更新された校舎');
  });

  it('should manage mini test results and homework results in Mock mode', async () => {
    // MiniTestResult CRUD
    const mini = {
      id: 'mini-test-1',
      student_id: 'std-1',
      date: '2026-06-19',
      test_content: 'テスト内容',
      score: null,
      created_at: new Date().toISOString()
    };
    const savedMini = await db.saveMiniTestResult(mini);
    expect(savedMini.id).toBe('mini-test-1');

    const miniResults = db.getMiniTestResults();
    expect(miniResults.find(m => m.id === 'mini-test-1')).toBeDefined();

    // overwrite
    const updatedMini = await db.saveMiniTestResult({ ...mini, score: 90 });
    expect(updatedMini.score).toBe(90);

    await db.deleteMiniTestResult('mini-test-1');
    expect(db.getMiniTestResults().find(m => m.id === 'mini-test-1')).toBeUndefined();

    // HomeworkResult CRUD
    const hw = {
      id: 'hw-test-1',
      student_id: 'std-1',
      date: '2026-06-19',
      homework_content: '宿題内容',
      homework_deadline: '2026-06-20',
      status: 'incomplete' as const,
      created_at: new Date().toISOString()
    };
    const savedHw = await db.saveHomeworkResult(hw);
    expect(savedHw.id).toBe('hw-test-1');

    const hwResults = db.getHomeworkResults();
    expect(hwResults.find(h => h.id === 'hw-test-1')).toBeDefined();

    // overwrite
    const updatedHw = await db.saveHomeworkResult({ ...hw, status: 'completed' as const });
    expect(updatedHw.status).toBe('completed');

    // saveHomeworkResults
    const hw2 = { ...hw, id: 'hw-test-2' };
    const savedHws = await db.saveHomeworkResults([hw2]);
    expect(savedHws[0].id).toBe('hw-test-2');
    expect(db.getHomeworkResults().find(h => h.id === 'hw-test-2')).toBeDefined();

    // saveHomeworkResults overwrite
    const hw2_updated = { ...hw2, homework_content: '更新された宿題2' };
    const savedHwsUpdated = await db.saveHomeworkResults([hw2_updated]);
    expect(savedHwsUpdated[0].homework_content).toBe('更新された宿題2');

    await db.deleteHomeworkResult('hw-test-1');
    expect(db.getHomeworkResults().find(h => h.id === 'hw-test-1')).toBeUndefined();
    await db.deleteHomeworkResult('hw-test-2');
  });

  it('should manage milestone plans in Mock mode', async () => {
    const mp = {
      id: 'mp-test-1',
      grade: '中3',
      subject: '数学',
      course: 'standard' as const,
      month: 6,
      week_number: 1,
      unit_name: 'テスト単元',
      target_sequence_order: 10,
      is_holiday: false
    };
    const savedMp = await db.saveMilestonePlan(mp);
    expect(savedMp.id).toBe('mp-test-1');

    const mps = db.getMilestonePlans();
    expect(mps.find(m => m.id === 'mp-test-1')).toBeDefined();

    // overwrite
    const updatedMp = await db.saveMilestonePlan({ ...mp, target_sequence_order: 12 });
    expect(updatedMp.target_sequence_order).toBe(12);
  });

  it('should ignore duplicate error code 23505 when adding personality option in Supabase', async () => {
    const localDb = new (db.constructor as any)();
    (localDb as any).isMockMode = false;
    (localDb as any).supabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockImplementation(() => 
          Promise.resolve({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } })
        )
      })
    };

    const res = await localDb.addPersonalityOption('すでに存在する個性');
    expect(res).toBe('すでに存在する個性');
  });

  it('should cover student interaction extra mock methods', async () => {
    // 1. getStudentInteractions without parameter
    const allInteractions = db.getStudentInteractions();
    expect(allInteractions.length).toBeGreaterThan(0);

    // 2. deleteStudentInteraction & overwrite saveStudentInteraction
    const mockInteraction = {
      id: 'inter-temp-1',
      student_id: 'std-2',
      category: 'その他' as const,
      memo: 'テスト用メモ',
      date: '2026-06-24',
      staff_name: '福田',
      created_at: new Date().toISOString()
    };
    await db.saveStudentInteraction(mockInteraction);
    expect(db.getStudentInteractions('std-2').find(i => i.id === 'inter-temp-1')).toBeDefined();

    // overwrite (idx >= 0 path in db.ts:1281)
    const updatedMock = { ...mockInteraction, memo: '更新したメモ' };
    await db.saveStudentInteraction(updatedMock);
    expect(db.getStudentInteractions('std-2').find(i => i.id === 'inter-temp-1')?.memo).toBe('更新したメモ');

    await db.deleteStudentInteraction('inter-temp-1');
    expect(db.getStudentInteractions('std-2').find(i => i.id === 'inter-temp-1')).toBeUndefined();

    // 3. addPersonalityOption with already existing name (db.ts:1319 false path)
    const res = await db.addPersonalityOption('班長');
    expect(res).toBe('班長');
  });

  it('should cover fallback paths in student grade/year calculation and saves', async () => {
    // 1. registered_year, registered_grade が存在しない生徒オブジェクト (db.ts 515-516 ?? カバー)
    // 直接モックストレージに書き込むことで、saveStudent の手動リセットロジックをバイパスする
    const rawStudents = (db as any).getMockData('students', []);
    const legacyStudent = {
      id: 'legacy-std-1',
      student_id: 'legacy999',
      name: '歴史生徒',
      grade: '中3' as const,
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      level: 'A' as const,
      status: 'normal' as const,
      created_at: '2025-05-15T10:00:00Z', // 2025年度
      registered_year: undefined,
      registered_grade: undefined
    };
    rawStudents.push(legacyStudent);
    (db as any).saveMockData('students', rawStudents);

    // getStudents 時に ?? の右側（フォールバック）を通過
    const studentsList = db.getStudents();
    const loadedLegacy = studentsList.find(s => s.id === 'legacy-std-1');
    expect(loadedLegacy).toBeDefined();
    expect(loadedLegacy?.registered_year).toBe(2025);
    expect(loadedLegacy?.registered_grade).toBe('中3');

    // 2. registered_grade や registered_year が Falsy (undefined/null) の場合の expectedGrade ロジック (db.ts 693-694, 699-700 カバー)
    const fakeStudent = {
      id: 'fake-std-1',
      student_id: 'fake999',
      name: 'フェイク生徒',
      grade: '小6' as const,
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      level: 'A' as const,
      status: 'normal' as const,
      registered_grade: undefined,
      registered_year: undefined,
      created_at: undefined
    };
    await db.saveStudent(fakeStudent);
    const loadedFake = db.getStudents().find(s => s.id === 'fake-std-1');
    expect(loadedFake).toBeDefined();
    expect(loadedFake?.registered_year).toBe(2026);
    expect(loadedFake?.registered_grade).toBe('小6');

    // getSchoolYear と calculateCurrentGrade のエッジケースカバー (db.ts 61, 68)
    // 1〜3月の getSchoolYear
    const janYear = getSchoolYear('2026-02-15T12:00:00Z');
    expect(janYear).toBe(2025);
    
    // 無効な学年の calculateCurrentGrade
    const invalidGrade = calculateCurrentGrade('無効な学年', 2025, 2026);
    expect(invalidGrade).toBe('無効な学年');
  });

  it('should cover CustomApplyScope CRUD methods in db.ts', async () => {
    // 1. getCustomApplyScopes initial
    const initialScopes = db.getCustomApplyScopes();
    expect(Array.isArray(initialScopes)).toBe(true);

    // 2. saveCustomApplyScope (create)
    const newScope = {
      id: 'custom_scope_test1',
      label: '特進Aクラス',
      created_at: new Date().toISOString()
    };
    await db.saveCustomApplyScope(newScope);
    let scopes = db.getCustomApplyScopes();
    expect(scopes.find(s => s.id === 'custom_scope_test1')?.label).toBe('特進Aクラス');

    // 3. saveCustomApplyScope (update)
    const updatedScope = { ...newScope, label: '特進Sクラス' };
    await db.saveCustomApplyScope(updatedScope);
    scopes = db.getCustomApplyScopes();
    expect(scopes.find(s => s.id === 'custom_scope_test1')?.label).toBe('特進Sクラス');

    // 4. deleteCustomApplyScope
    await db.deleteCustomApplyScope('custom_scope_test1');
    scopes = db.getCustomApplyScopes();
    expect(scopes.find(s => s.id === 'custom_scope_test1')).toBeUndefined();

    // 5. Supabase non-mock mode test
    const localDb = new (db.constructor as any)();
    (localDb as any).isMockMode = false;
    (localDb as any).supabase = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: newScope, error: null })
          })
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      })
    };
    const savedScope = await localDb.saveCustomApplyScope(newScope);
    expect(savedScope.id).toBe('custom_scope_test1');
    await expect(localDb.deleteCustomApplyScope('custom_scope_test1')).resolves.not.toThrow();
  });

  it('should cover teacher options CRUD and saveStudentScheduleConfig branches', async () => {
    // 1. teacher options CRUD in mock mode
    const teacherList = ['福田 尚弘', '佐藤 講師'];
    (db as any).saveMockData('teacher_options', teacherList);
    const addedName = await db.addTeacherOption('高橋 講師');
    expect(addedName).toBe('高橋 講師');
    const updatedName = await db.updateTeacherOption('福田 尚弘', '福田 主任講師');
    expect(updatedName).toBe('福田 主任講師');
    await db.removeTeacherOption('佐藤 講師');

    // 2. getStudentScheduleConfig for non-existent student (fallback defaults)
    const fallbackConfig = db.getStudentScheduleConfig('std-unknown-999');
    expect(fallbackConfig.weekly_frequency).toBe('2回');
    expect(fallbackConfig.weekly_duration).toBe('120分');

    // 3. saveStudentScheduleConfig in Supabase non-mock mode
    const localDb = new (db.constructor as any)();
    (localDb as any).isMockMode = false;
    (localDb as any).supabase = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      })
    };
    await localDb.addTeacherOption('Supabase講師');
    await localDb.updateTeacherOption('Supabase講師', 'Supabase主任');
    await localDb.removeTeacherOption('Supabase主任');

    const configToSave = {
      student_id: 'std-1',
      weekly_frequency: '3回',
      weekly_duration: '180分',
      selected_days: ['monday', 'wednesday', 'friday'],
      default_slots: 3
    };
    await localDb.saveStudentScheduleConfig(configToSave);

    // Supabase error branch
    (localDb as any).supabase = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockRejectedValue(new Error('Supabase Config Error'))
      })
    };
    await localDb.saveStudentScheduleConfig(configToSave);
  });

  it('should cover fetchStudentScheduleConfig in mock and Supabase modes', async () => {
    const config = await db.fetchStudentScheduleConfig('std-1');
    expect(config.student_id).toBe('std-1');

    const mockDb = new (db.constructor as any)();
    (mockDb as any).isMockMode = false;
    (mockDb as any).supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                student_id: 'std-sup-1',
                weekly_frequency: '3回',
                weekly_duration: '180分',
                selected_days: ['monday', 'wednesday'],
                default_slots: 3
              },
              error: null
            })
          })
        })
      })
    };

    const fetchedSupConfig = await mockDb.fetchStudentScheduleConfig('std-sup-1');
    expect(fetchedSupConfig.student_id).toBe('std-sup-1');
    expect(fetchedSupConfig.weekly_frequency).toBe('3回');

    // Supabase exception path
    (mockDb as any).supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(new Error('Supabase Fetch Error'))
          })
        })
      })
    };
    const fetchedErrConfig = await mockDb.fetchStudentScheduleConfig('std-sup-err');
    expect(fetchedErrConfig.student_id).toBe('std-sup-err');
  });

  it('should support Branch & Multi-tenant RBAC operations in DatabaseService', async () => {
    // 1. getBranches seed check
    const branches = db.getBranches();
    expect(branches.length).toBeGreaterThanOrEqual(4);
    expect(branches.some(b => b.name === '恵比寿教室')).toBe(true);

    // 2. createBranchAccount
    const created = await db.createBranchAccount({
      name: '町田教室',
      email: 'machida@tentoru.jp',
      code: 'MACHIDA',
      phone: '042-123-4567',
      address: '東京都町田市原町田1-1-1'
    });
    expect(created.name).toBe('町田教室');
    expect(created.code).toBe('MACHIDA');
    expect(created.status).toBe('active');

    // 3. toggleBranchStatus
    const toggled = await db.toggleBranchStatus(created.id);
    expect(toggled.status).toBe('suspended');

    const toggledBack = await db.toggleBranchStatus(created.id);
    expect(toggledBack.status).toBe('active');

    // 4. saveBranch (update)
    const updated = await db.saveBranch({ ...created, phone: '042-999-8888' });
    expect(updated.phone).toBe('042-999-8888');

    // 5. sendBranchPasswordReset
    const resetRes = await db.sendBranchPasswordReset(created.email);
    expect(resetRes.success).toBe(true);

    // 6. deleteBranch
    await db.deleteBranch(created.id);
    const afterDelete = db.getBranches();
    expect(afterDelete.find(b => b.id === created.id)).toBeUndefined();

    // 7. Role methods
    db.setCurrentUserRole('branch', 'branch-1', '恵比寿教室');
    const curRole = db.getCurrentUserRole();
    expect(curRole.role).toBe('branch');
    expect(curRole.branch_id).toBe('branch-1');

    db.setCurrentUserRole('admin', null, '本部統括管理者');
    const adminRole = db.getCurrentUserRole();
    expect(adminRole.role).toBe('admin');

    // 8. Supabase non-mock branch methods
    const localDb = new (db.constructor as any)();
    (localDb as any).isMockMode = false;
    (localDb as any).supabase = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: created, error: null })
          })
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      }),
      auth: {
        resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null })
      }
    };
    await expect(localDb.saveBranch(created)).resolves.toBeDefined();
    await expect(localDb.deleteBranch('branch-1')).resolves.not.toThrow();
    await expect(localDb.sendBranchPasswordReset('test@branch.jp')).resolves.toBeDefined();
  });
});

describe('Gemini API Key Utility Tests', () => {
  it('should cover all branches in getGeminiApiKey and saveGeminiApiKey', () => {
    saveGeminiApiKey('sample-key-999');
    expect(getGeminiApiKey()).toBe('sample-key-999');

    saveGeminiApiKey('');
    expect(localStorage.getItem('tentoru_gemini_api_key')).toBeNull();
  });
});
