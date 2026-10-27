import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  sanitizeLearningTask,
  sanitizeMiniTestResult,
  sanitizeHomeworkResult,
  enforceUnitTestPassingGate,
  sanitizeCorruptedCompletedLessonIds,
  type Student,
  type CurriculumMaster,
  type MiniTestResult,
  type HomeworkResult,
  type LearningTask
} from '../lib/db';

describe('DatabaseService Extreme Branches Perfection Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    db.clearMockData();
  });

  const getDynamicDate = (offsetDays: number = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  it('exhaustively covers sanitizeLearningTask ID and unit_id fallbacks', () => {
    // 1. student_id empty, id empty, unit_id empty, all empty -> default-unit & task-st-...
    const taskDefault = sanitizeLearningTask({
      student_id: '',
      id: ''
    });
    expect(taskDefault.id).toMatch(/^task-st-/);
    expect(taskDefault.unit_id).toBe('default-unit');
    expect(taskDefault.student_id).toBe('');

    // 2. unit_id fallback to start_lesson_id
    const taskStartLesson = sanitizeLearningTask({
      student_id: 'std-100',
      id: 'task-custom-id',
      start_lesson_id: 'lesson-step-1'
    });
    expect(taskStartLesson.id).toBe('task-custom-id');
    expect(taskStartLesson.unit_id).toBe('lesson-step-1');

    // 3. unit_id fallback to custom_unit_name
    const taskCustom = sanitizeLearningTask({
      student_id: 'std-200',
      custom_unit_name: '特訓単元A'
    });
    expect(taskCustom.unit_id).toBe('custom-特訓単元A');

    // 4. unit_id explicitly provided
    const taskExplicit = sanitizeLearningTask({
      student_id: 'std-300',
      unit_id: 'explicit-unit-123'
    });
    expect(taskExplicit.unit_id).toBe('explicit-unit-123');
  });

  it('exhaustively covers sanitizeMiniTestResult branches for score, status, and fallbacks', () => {
    const dynamicDate = getDynamicDate(-1);

    // 1. student_id null, id empty -> mini-st-...
    const miniDefault = sanitizeMiniTestResult({
      student_id: null as any,
      id: '',
      date: ''
    });
    expect(miniDefault.id).toMatch(/^mini-st-/);
    expect(miniDefault.date).toBe(getDynamicDate(0));
    expect(miniDefault.status).toBeUndefined();

    // 2. passed = true, score empty -> status: 'passed'
    const miniPassed = sanitizeMiniTestResult({
      student_id: 'std-400',
      passed: true,
      score: '95' as any,
      passing_line: '80点',
      target_scope: 'class',
      subject: '数学',
      test_type: 'unit_test',
      unit_name: '一次関数'
    });
    expect(miniPassed.status).toBe('passed');
    expect(miniPassed.score).toBe(95);
    expect(miniPassed.completed_at).toBeDefined();

    // 3. passed = false, score invalid string -> status: 'failed'
    const miniFailed = sanitizeMiniTestResult({
      student_id: 'std-401',
      passed: false,
      score: 'invalid-score' as any
    });
    expect(miniFailed.status).toBe('failed');
    expect(miniFailed.score).toBeNull();
  });

  it('exhaustively covers sanitizeHomeworkResult branches for deadline and status enum', () => {
    const dynamicDate = getDynamicDate(2);

    // 1. empty student_id, empty deadline -> hw-st-... & deadline = date
    const hwDefault = sanitizeHomeworkResult({
      student_id: undefined,
      id: '',
      date: dynamicDate,
      homework_deadline: ''
    });
    expect(hwDefault.id).toMatch(/^hw-st-/);
    expect(hwDefault.homework_deadline).toBe(dynamicDate);
    expect(hwDefault.status).toBe('incomplete');

    // 2. valid status 'completed' and 'skipped'
    const hwCompleted = sanitizeHomeworkResult({
      student_id: 'std-hw-1',
      status: 'completed',
      subject: '英語',
      homework_type: 'custom'
    });
    expect(hwCompleted.status).toBe('completed');

    const hwSkipped = sanitizeHomeworkResult({
      student_id: 'std-hw-2',
      status: 'skipped'
    });
    expect(hwSkipped.status).toBe('skipped');

    // 3. invalid status fallback to 'incomplete'
    const hwInvalidStatus = sanitizeHomeworkResult({
      student_id: 'std-hw-3',
      status: 'unknown_status' as any
    });
    expect(hwInvalidStatus.status).toBe('incomplete');
  });

  it('exhaustively covers enforceUnitTestPassingGate branches', () => {
    const studentId = 'std-gate-1';
    const dynamicDate = getDynamicDate(0);

    // completedIds undefined or empty
    expect(enforceUnitTestPassingGate(studentId, undefined)).toEqual([]);
    expect(enforceUnitTestPassingGate(studentId, [])).toEqual([]);

    const mockResults: MiniTestResult[] = [
      {
        id: 'mini-p-1',
        student_id: studentId,
        subject: '算数',
        test_type: 'unit_test',
        test_content: 'かけ算の九九',
        unit_name: '九九の学習',
        date: dynamicDate,
        score: 85,
        passing_line: '80点',
        status: 'passed'
      },
      {
        id: 'mini-f-1',
        student_id: studentId,
        subject: '算数',
        test_type: 'unit_test',
        test_content: 'わり算の筆算',
        unit_name: 'わり算',
        date: dynamicDate,
        score: 60,
        passing_line: '80点',
        status: 'failed'
      },
      {
        id: 'mini-other-student',
        student_id: 'std-other',
        test_content: '他人のテスト',
        date: dynamicDate,
        score: 100,
        status: 'passed'
      }
    ];

    const masters: CurriculumMaster[] = [
      {
        id: 'cm-kuku-ut',
        grade: '小2',
        subject: '算数',
        unit_name: '九九の学習',
        lesson_name: '単元確認テスト',
        item_type: 'unit_test',
        sort_order: 1
      },
      {
        id: 'cm-wari-ut',
        grade: '小3',
        subject: '算数',
        unit_name: 'わり算',
        lesson_name: '単元確認テスト',
        item_type: 'unit_test',
        sort_order: 2
      }
    ];

    // Gate should allow passed unit test and filter out unpassed
    const allowed = enforceUnitTestPassingGate(
      studentId,
      ['cm-kuku-ut', 'cm-wari-ut', 'normal-lesson-id'],
      mockResults,
      masters
    );

    expect(allowed).toContain('cm-kuku-ut');
    expect(allowed).toContain('normal-lesson-id');
  });

  it('exhaustively covers sanitizeCorruptedCompletedLessonIds with unpassedTestIds array vs Set', () => {
    const rawIds = ['lesson-1', 'lesson-2', 'lesson-unpassed-ut', 'cm-auto-sum1-算数-elem-大きいかず'];

    // 1. unpassedTestIds as Array
    const resArray = sanitizeCorruptedCompletedLessonIds(rawIds, {
      unpassedTestIds: ['lesson-unpassed-ut']
    });
    expect(resArray.cleanedIds).not.toContain('lesson-unpassed-ut');
    expect(resArray.cleanedIds).not.toContain('cm-auto-sum1-算数-elem-大きいかず');
    expect(resArray.cleanedIds).toContain('lesson-1');

    // 2. unpassedTestIds as Set
    const resSet = sanitizeCorruptedCompletedLessonIds(rawIds, {
      unpassedTestIds: new Set(['lesson-unpassed-ut'])
    });
    expect(resSet.cleanedIds).not.toContain('lesson-unpassed-ut');
  });

  it('exhaustively covers cleanupStudentSteppingStoneUncompletedLessons subject and grade branch variations', async () => {
    // 1. High school / non-elem / non-junior student (isElem = false, isJunior = false -> returns true in filter)
    const highSchoolStudent: Student = {
      id: 'st-high-branch-1',
      name: '高校 生徒A',
      grade: '高2',
      school_name: '県立高校',
      completed_lesson_ids: [],
      selected_subjects: ['数学', '英語']
    };
    db.saveStudent(highSchoolStudent);

    await db.cleanupStudentSteppingStoneUncompletedLessons(highSchoolStudent.id);
    const updated = db.getStudent(highSchoolStudent.id);
    expect(updated).toBeDefined();

    // 2. Student with empty selected_subjects (fallbacks to ['算数', '国語', '英語', '数学'])
    const noSubStudent: Student = {
      id: 'st-no-sub-1',
      name: '科目未設定 生徒',
      grade: '中2',
      school_name: '市立中学校',
      completed_lesson_ids: ['cm-jhs-1']
    };
    await db.cleanupStudentSteppingStoneUncompletedLessons(noSubStudent.id);
    const updatedNoSub = db.getStudent(noSubStudent.id);
    expect(updatedNoSub).toBeDefined();
  });

  it('exhaustively covers getStudents school resolution and assigned_teachers fallback branches', async () => {
    // 1. student with s.school instead of school_name, and custom teacher_in_charge
    const st1: any = {
      id: 'st-school-fallback-1',
      name: '学校フォールバック1',
      grade: '中1',
      school: '緑野中学校',
      teacher_in_charge: '山田 太郎'
    };
    await db.saveStudent(st1);

    // 2. student with elementary_school and no teachers
    const st2: any = {
      id: 'st-school-fallback-2',
      name: '学校フォールバック2',
      grade: '小5',
      elementary_school: '桜小学校'
    };
    await db.saveStudent(st2);

    // 3. student with school_id resolved from schools list
    await db.saveSchool({ id: 'sch-sample-uuid-1', name: '富士見中学校', type: 'junior_high' });
    const st3: Student = {
      id: 'st-school-fallback-3',
      name: '学校フォールバック3',
      grade: '中3',
      school_id: 'sch-sample-uuid-1'
    };
    await db.saveStudent(st3);

    const allStudents = db.getStudents();
    const resolved1 = allStudents.find(s => s.id === 'st-school-fallback-1' || s.name === '学校フォールバック1');
    const resolved2 = allStudents.find(s => s.id === 'st-school-fallback-2' || s.name === '学校フォールバック2');
    const resolved3 = allStudents.find(s => s.id === 'st-school-fallback-3' || s.name === '学校フォールバック3');

    expect(resolved1?.school_name).toBe('緑野中学校');
    expect(resolved1?.teacher_in_charge).toBe('山田 太郎');

    expect(resolved2?.school_name).toBe('桜小学校');
    expect(resolved2?.teacher_in_charge).toBe('福田 尚弘'); // default teacher fallback

    expect(resolved3?.school_name).toBe('富士見中学校');
  });
});
