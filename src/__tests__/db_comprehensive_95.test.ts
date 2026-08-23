import { describe, it, expect, beforeEach } from 'vitest';
import { db, Student, CurriculumMaster, CurriculumUnit, LearningTask, MiniTestResult, HomeworkResult, LearningLog, StudentLessonProgress, TeacherCorrectionLog, MilestonePlan } from '../lib/db';

describe('db.ts Complete Pure Unit Coverage Boost', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('tests every single method, getter, and cache mutation logic in DatabaseService', async () => {
    // 1. Student Operations
    const student1: Student = {
      id: 'st-db-95-1',
      student_id: 'S951',
      name: 'DBテスト生1',
      grade: '中1',
      level: 'A',
      school_id: 'school-1',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['tuesday', 'friday'],
      selected_subjects: ['数学', '英語'],
      completed_lesson_ids: ['cm-1']
    };
    const student2: Student = {
      id: 'st-db-95-2',
      student_id: 'S952',
      name: 'DBテスト生2',
      grade: '小6',
      level: 'B',
      school_id: 'school-2',
      branch_id: 'branch-2',
      status: 'normal',
      period_count: 3,
      selected_days: ['monday', 'thursday'],
      selected_subjects: ['算数', '国語']
    };

    await db.saveStudent(student1);
    await db.saveStudent(student2);

    expect(db.getStudents().length).toBe(2);
    expect(await db.fetchStudents()).toHaveLength(2);

    // Update student
    student1.name = 'DBテスト生1(改)';
    await db.saveStudent(student1);
    expect(db.getStudents().find(s => s.id === 'st-db-95-1')?.name).toBe('DBテスト生1(改)');

    // 2. Curriculum Masters & Units
    const masters: CurriculumMaster[] = [
      { id: 'cm-db-1', subject: '数学', grade: '中1', unit_name: '正負の数', lesson_name: '加算', sort_order: 1, item_type: 'lesson' },
      { id: 'cm-db-2', subject: '数学', grade: '中1', unit_name: '正負の数', lesson_name: '確認テスト', sort_order: 2, item_type: 'unit_test' }
    ];
    await db.saveCurriculumMasters(masters);
    expect(db.getCurriculumMasters().length).toBeGreaterThanOrEqual(2);
    expect((await db.fetchCurriculumMasters()).length).toBeGreaterThanOrEqual(2);

    const units: CurriculumUnit[] = [
      { id: 'cu-db-1', school_id: 'school-1', subject: '数学', name: '正負の数', sequence_order: 1 }
    ];
    await db.saveCurriculumUnits(units);
    expect(db.getCurriculumUnits().length).toBeGreaterThanOrEqual(1);

    // 3. Learning Tasks
    const task: LearningTask = {
      id: 'task-db-1',
      student_id: student1.id,
      scheduled_date: '2026-09-01',
      period: 1,
      subject: '数学',
      unit_id: 'cm-db-1',
      status: 'unstarted',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);
    expect(db.getLearningTasks().filter(t => t.student_id === student1.id).length).toBe(1);
    expect((await db.fetchLearningTasks(student1.id)).length).toBe(1);

    await db.deleteLearningTasksForDate(student1.id, '2026-09-01');
    expect(db.getLearningTasks().filter(t => t.student_id === student1.id && t.scheduled_date === '2026-09-01').length).toBe(0);

    // 4. MiniTestResults
    const mini: MiniTestResult = {
      id: 'mini-db-1',
      student_id: student1.id,
      date: '2026-09-01',
      subject: '数学',
      test_type: 'unit_test',
      unit_name: '正負の数',
      test_content: '正負の数テスト',
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(mini);
    expect(db.getMiniTestResults().length).toBe(1);
    expect((await db.fetchMiniTestResults(student1.id, '2026-09-01')).length).toBe(1);

    await db.deleteMiniTestResult('mini-db-1');
    expect(db.getMiniTestResults().length).toBe(0);

    await db.saveMiniTestResult(mini);
    await db.deleteMiniTestResultByDate(student1.id, '2026-09-01');
    expect(db.getMiniTestResults().length).toBe(0);

    // 5. HomeworkResults
    const hw: HomeworkResult = {
      id: 'hw-db-1',
      student_id: student1.id,
      date: '2026-09-01',
      subject: '数学',
      homework_type: 'drill_2nd',
      homework_content: '演習ワーク',
      homework_deadline: '2026-09-05',
      status: 'incomplete',
      created_at: new Date().toISOString()
    };
    await db.saveHomeworkResult(hw);
    expect(db.getHomeworkResults().length).toBe(1);
    expect((await db.fetchHomeworkResults(student1.id, '2026-09-01')).length).toBe(1);

    await db.deleteHomeworkResult('hw-db-1');
    expect(db.getHomeworkResults().length).toBe(0);

    await db.saveHomeworkResult(hw);
    await db.deleteHomeworkResultsByDate(student1.id, '2026-09-01');
    expect(db.getHomeworkResults().length).toBe(0);

    // 6. StudentLessonProgress & TeacherCorrectionLog
    const progress: StudentLessonProgress = {
      id: 'slp-db-1',
      student_id: student1.id,
      subject: '数学',
      lesson_id: 'cm-db-1',
      lesson_name: '加算',
      task_id: 'task-db-1',
      date: '2026-09-01',
      status: 'completed',
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    await db.saveStudentLessonProgress(progress);
    expect(db.getStudentLessonProgressList(student1.id).length).toBe(1);

    const log: TeacherCorrectionLog = {
      id: 'tlog-db-1',
      student_id: student1.id,
      teacher_id: 't-1',
      date: '2026-09-01',
      action_type: 'reschedule',
      created_at: new Date().toISOString()
    };
    await db.addTeacherCorrectionLog(log);
    expect(db.getTeacherCorrectionsLogs().length).toBe(1);

    // 7. Teacher Options
    await db.addTeacherOption('先生A');
    expect(db.getTeacherOptions()).toContain('先生A');
    await db.updateTeacherOption('先生A', '先生A(変更)');
    expect(db.getTeacherOptions()).toContain('先生A(変更)');
    await db.removeTeacherOption('先生A(変更)');
    expect(db.getTeacherOptions()).not.toContain('先生A(変更)');

    // 8. Delete Student
    await db.deleteStudent(student1.id);
    await db.deleteStudent(student2.id);
    expect(db.getStudents().length).toBe(0);
  });
});
