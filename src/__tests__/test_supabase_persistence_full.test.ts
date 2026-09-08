import { describe, it, expect, beforeEach } from 'vitest';
import { db, Student, LearningTask } from '../lib/db';

describe('Supabase Full DB Persistence Test Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.signOut();
  });

  it('should initialize and export Supabase accessors properly', () => {
    expect(db.getSupabase).toBeDefined();
    expect(db.getIsMockMode).toBeDefined();
  });

  it('should save new student with UUID and persist properly', async () => {
    const studentUUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    const newStudent: Student = {
      id: studentUUID,
      student_id: 'student99999',
      name: '中尾 謙信',
      email: 'student99999@tentoru-student.com',
      grade: '中2',
      school_id: 'sch-test-1',
      school_name: 'テスト中学校',
      status: 'normal',
      start_unit_id: null,
      created_at: new Date().toISOString(),
      level: 'A'
    };

    const saved = await db.saveStudent(newStudent);
    expect(saved.id).toBe(studentUUID);
    expect(saved.name).toBe('中尾 謙信');

    const list = db.getStudents();
    const found = list.find(s => s.name === '中尾 謙信');
    expect(found).toBeDefined();
    expect(found?.student_id).toBe('student99999');
  });

  it('should update student details and reflect across getStudents', async () => {
    const studentUUID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
    const originalStudent: Student = {
      id: studentUUID,
      student_id: 'student88888',
      name: '中尾 謙信',
      email: 'student88888@tentoru-student.com',
      grade: '中2',
      school_id: 'sch-test-1',
      status: 'normal',
      start_unit_id: null,
      created_at: new Date().toISOString(),
      level: 'A'
    };

    await db.saveStudent(originalStudent);

    const updatedStudent: Student = {
      ...originalStudent,
      grade: '中3',
      level: 'B',
      personalities: ['集中力高い', '数学が得意']
    };

    const updated = await db.saveStudent(updatedStudent);
    expect(updated.grade).toBe('中3');
    expect(updated.level).toBe('B');
    expect(updated.personalities).toContain('数学が得意');

    const freshList = db.getStudents();
    const freshFound = freshList.find(s => s.id === studentUUID);
    expect(freshFound?.grade).toBe('中3');
  });

  it('should persist learning tasks and retrieve accurately for student', async () => {
    const studentId = 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f';
    const date = '2026-09-08';
    const tasks: LearningTask[] = [
      {
        id: `task-${studentId}-${date}-1`,
        student_id: studentId,
        scheduled_date: date,
        period: 1,
        subject: '数学',
        unit_id: 'unit-math-1',
        start_lesson_name: '一次関数 第1回',
        end_lesson_name: '一次関数 第2回',
        lesson_range: '一次関数 第1回〜第2回',
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        created_at: new Date().toISOString()
      },
      {
        id: `task-${studentId}-${date}-2`,
        student_id: studentId,
        scheduled_date: date,
        period: 2,
        subject: '英語',
        unit_id: 'unit-eng-1',
        start_lesson_name: '助動詞 will',
        end_lesson_name: '助動詞 will 演習',
        lesson_range: '助動詞 will',
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        created_at: new Date().toISOString()
      }
    ];

    await db.saveLearningTasks(tasks);

    const fetchedTasks = await db.fetchLearningTasks(studentId, date);
    expect(fetchedTasks.length).toBe(2);
    expect(fetchedTasks[0].subject).toBe('数学');
    expect(fetchedTasks[1].subject).toBe('英語');
  });
});
