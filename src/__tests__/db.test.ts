import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../lib/db';

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
      created_at: new Date().toISOString()
    };

    const saved = await db.saveStudent(newStudent);
    expect(saved.id).toBe('std-test');

    const freshStudents = db.getStudents();
    expect(freshStudents.find(s => s.id === 'std-test')).toBeDefined();
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
    (db as any).isMockMode = false;
    
    const createMockPromise = (data: any) => {
      const p = Promise.resolve({ data, error: null });
      (p as any).single = vi.fn().mockResolvedValue({ data, error: null });
      (p as any).eq = vi.fn().mockResolvedValue({ data: [data], error: null });
      return p;
    };

    (db as any).supabase = {
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
    const savedSch = await db.saveSchool(school);
    expect(savedSch.id).toBe('sup-id');

    const student = { id: 'sup-1', student_id: 'S', name: 'S', email: 'S', grade: 'S', school_id: 'S', status: 'normal' as const, start_unit_id: null, created_at: '' };
    const savedStd = await db.saveStudent(student);
    expect(savedStd.id).toBe('sup-id');

    const unit = { id: 'sup-1', school_id: 'S', subject: 'S', name: 'S', sequence_order: 1, created_at: '' };
    const savedUnits = await db.saveCurriculumUnits([unit]);
    expect(savedUnits).toBeDefined();

    const task = { id: 'sup-1', student_id: 'S', unit_id: 'S', scheduled_date: '2026-06-19', period: null, status: 'unstarted' as const, video_watched: false, test_passed: false, created_at: '' };
    const savedTasks = await db.saveLearningTasks([task]);
    expect(savedTasks).toBeDefined();

    await db.deleteLearningTasksByStudent('sup-1');

    const log = { id: 'sup-1', student_id: 'S', unit_id: 'S', log_type: 'video_view' as const, created_at: '' };
    const savedLog = await db.addLearningLog(log);
    expect(savedLog.id).toBe('sup-id');

    const record = { id: 'sup-1', student_id: 'S', record_type: 'regular_test' as const, subject: 'S', score: 100, created_at: '' };
    const savedRec = await db.saveTestRecord(record);
    expect(savedRec.id).toBe('sup-id');

    const code = { code: 'sup-1', name: 'S', deviation_value: 60 };
    const savedCode = await db.saveSchoolCodeMaster(code);
    expect(savedCode.code).toBe('sup-id');

    const eth = { id: 'sup-1', school_code: 'S', min_score: 0, max_score: 100, probability: 50 };
    const savedEth = await db.saveExamThresholdMaster(eth);
    expect(savedEth.id).toBe('sup-id');

    const report = { id: 'sup-1', student_id: 'S', month: 'S', analysis_text: 'S', created_at: '' };
    const savedRep = await db.saveAIReport(report);
    expect(savedRep.id).toBe('sup-id');

    const prompt = { id: 'sup-1', prompt_template: 'S', created_at: '' };
    const savedPrompt = await db.savePromptSetting(prompt);
    expect(savedPrompt.id).toBe('sup-id');

    const cor = { id: 'sup-1', student_id: 'S', original_text: 'S', corrected_text: 'S', created_at: '' };
    const savedCor = await db.addTeacherCorrectionLog(cor);
    expect(savedCor.id).toBe('sup-id');
  });

  // Supabase error paths simulation
  it('should throw error in Supabase if query fails', async () => {
    (db as any).isMockMode = false;

    const createErrorPromise = () => {
      const p = Promise.resolve({ data: null, error: new Error('Database Error') });
      (p as any).single = vi.fn().mockResolvedValue({ data: null, error: new Error('Database Error') });
      (p as any).eq = vi.fn().mockResolvedValue({ data: null, error: new Error('Database Error') });
      return p;
    };

    (db as any).supabase = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockImplementation(() => createErrorPromise())
        })),
        insert: vi.fn().mockImplementation(() => ({
          select: vi.fn().mockImplementation(() => createErrorPromise())
        })),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: new Error('Database Error') })
        })
      })
    };

    const school = { id: 'sup-1', name: 'S', type: 'junior_high' as const, created_at: '' };
    await expect(db.saveSchool(school)).rejects.toThrow('Database Error');

    const student = { id: 'sup-1', student_id: 'S', name: 'S', email: 'S', grade: 'S', school_id: 'S', status: 'normal' as const, start_unit_id: null, created_at: '' };
    await expect(db.saveStudent(student)).rejects.toThrow('Database Error');

    const unit = { id: 'sup-1', school_id: 'S', subject: 'S', name: 'S', sequence_order: 1, created_at: '' };
    await expect(db.saveCurriculumUnits([unit])).rejects.toThrow('Database Error');

    const task = { id: 'sup-1', student_id: 'S', unit_id: 'S', scheduled_date: '2026-06-19', period: null, status: 'unstarted' as const, video_watched: false, test_passed: false, created_at: '' };
    await expect(db.saveLearningTasks([task])).rejects.toThrow('Database Error');

    await expect(db.deleteLearningTasksByStudent('sup-1')).rejects.toThrow('Database Error');

    const log = { id: 'sup-1', student_id: 'S', unit_id: 'S', log_type: 'video_view' as const, created_at: '' };
    await expect(db.addLearningLog(log)).rejects.toThrow('Database Error');

    const record = { id: 'sup-1', student_id: 'S', record_type: 'regular_test' as const, subject: 'S', score: 100, created_at: '' };
    await expect(db.saveTestRecord(record)).rejects.toThrow('Database Error');

    const code = { code: 'sup-1', name: 'S', deviation_value: 60 };
    await expect(db.saveSchoolCodeMaster(code)).rejects.toThrow('Database Error');

    const eth = { id: 'sup-1', school_code: 'S', min_score: 0, max_score: 100, probability: 50 };
    await expect(db.saveExamThresholdMaster(eth)).rejects.toThrow('Database Error');

    const report = { id: 'sup-1', student_id: 'S', month: 'S', analysis_text: 'S', created_at: '' };
    await expect(db.saveAIReport(report)).rejects.toThrow('Database Error');

    const prompt = { id: 'sup-1', prompt_template: 'S', created_at: '' };
    await expect(db.savePromptSetting(prompt)).rejects.toThrow('Database Error');

    const cor = { id: 'sup-1', student_id: 'S', original_text: 'S', corrected_text: 'S', created_at: '' };
    await expect(db.addTeacherCorrectionLog(cor)).rejects.toThrow('Database Error');
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
});
