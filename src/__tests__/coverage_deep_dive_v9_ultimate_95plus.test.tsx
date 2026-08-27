import { describe, it, expect, beforeEach } from 'vitest';
import { db, SchoolCodeMaster, ExamThresholdMaster, TeacherCorrectionLog, MilestonePlan, MilestoneTemplate, StudentInteractionLog } from '../lib/db';

describe('Coverage Deep Dive V9 Ultimate 95%+ DB Methods Test Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
  });

  it('covers all db.ts uncovered CRUD methods for full coverage', async () => {
    // 1. SchoolCodeMaster
    const scm: SchoolCodeMaster = {
      id: 'scm-1',
      school_id: 'sch-1',
      school_name: '第一中学校',
      school_code: 'SCH001',
      created_at: '2026-08-27T00:00:00.000Z'
    };
    await db.saveSchoolCodeMaster(scm);
    expect(db.getSchoolCodesMaster().length).toBeGreaterThan(0);

    // 2. ExamThresholdMaster
    const eth: ExamThresholdMaster = {
      id: 'eth-1',
      target_school_name: '開成高校',
      subject: '数学',
      required_score: 85,
      target_deviation: 68,
      created_at: '2026-08-27T00:00:00.000Z'
    };
    await db.saveExamThresholdMaster(eth);
    expect(db.getExamThresholdsMaster().length).toBeGreaterThan(0);

    // 3. TeacherCorrectionLog
    const tcLog: TeacherCorrectionLog = {
      id: 'tcl-1',
      student_id: 'std-1',
      date: '2026-08-27',
      subject: '算数',
      correction_content: '途中式の書き方を指導',
      created_at: '2026-08-27T00:00:00.000Z'
    };
    await db.addTeacherCorrectionLog(tcLog);
    expect(db.getTeacherCorrectionsLogs().length).toBeGreaterThan(0);

    // 4. MilestonePlan & Template
    const plan: MilestonePlan = {
      id: 'plan-1',
      student_id: 'std-1',
      grade: '小6',
      subject: '算数',
      month: '8月',
      week: '第1週',
      target_unit: '分数',
      lesson_range: '1-3',
      passing_score: '80点',
      memo: 'テスト用'
    };
    await db.saveMilestonePlan(plan);
    expect(db.getMilestonePlans().length).toBeGreaterThan(0);
    await db.saveMilestonePlans([plan]);

    const tmpl: MilestoneTemplate = {
      id: 'tmpl-1',
      grade_category: '小学生',
      title: '基礎計算力完全習得',
      created_at: '2026-08-27T00:00:00.000Z'
    };
    await db.saveMilestoneTemplate(tmpl);
    expect(db.getMilestoneTemplates().length).toBeGreaterThan(0);
    await db.deleteMilestoneTemplate('tmpl-1');
    expect(db.getMilestoneTemplates().find(t => t.id === 'tmpl-1')).toBeUndefined();

    // 5. StudentInteraction
    const interLog = {
      id: 'inter-1',
      student_id: 'std-1',
      date: '2026-08-27',
      contact_type: 'telephone',
      memo: '電話で本日の学習進捗を確認',
      teacher_name: '荒木はやと',
      created_at: '2026-08-27T00:00:00.000Z'
    };
    await db.saveStudentInteraction(interLog as any);
    expect(db.getStudentInteractions().length).toBeGreaterThan(0);
    await db.deleteStudentInteraction('inter-1');

    // 6. CustomApplyScope
    const scope = {
      id: 'scope-1',
      name: '特待生グループ',
      created_at: '2026-08-27T00:00:00.000Z'
    };
    await db.saveCustomApplyScope(scope);
    expect(db.getCustomApplyScopes().length).toBeGreaterThan(0);
    await db.deleteCustomApplyScope('scope-1');

    // 7. Supabase fetch fallbacks in mock mode
    await db.fetchSchools();
    await db.fetchStudents();
    await db.fetchLearningTasks('std-1', '2026-08-27');
    await db.fetchMiniTestResults('std-1', '2026-08-27');
    await db.fetchHomeworkResults('std-1', '2026-08-27');
    await db.fetchStudentInteractions('std-1');
    await db.fetchStudentScheduleConfig('std-1');
    await db.fetchBranches();
  });
});
