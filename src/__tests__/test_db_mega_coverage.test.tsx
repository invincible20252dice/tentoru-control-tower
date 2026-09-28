import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../lib/db';
import { Student, CurriculumMaster, School, Branch, StudentLessonProgress, MilestonePlan, CustomClass, CurriculumUnit } from '../types';

describe('DatabaseService Mega Coverage 98%+ Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('covers all bulk deletion, progress manipulation, and custom entities in db.ts', async () => {
    // 1. Student Tasks & Student Deletion
    const student: Student = {
      id: 'std-mega-1',
      student_id: 'S_MEGA',
      name: 'メガ 生徒',
      grade: '中3',
      status: 'normal',
      created_at: new Date().toISOString()
    };
    db.saveStudent(student);
    expect(db.getStudents().some(s => s.id === 'std-mega-1')).toBe(true);

    await db.deleteStudent('std-mega-1');
    expect(db.getStudents().some(s => s.id === 'std-mega-1')).toBe(false);

    // 2. Custom Classes
    const cClass: CustomClass = {
      id: 'cc-mega-1',
      name: 'ハイレベル選抜特訓',
      subject: '数学',
      grade: '中3',
      description: '難関校対策演習',
      created_at: new Date().toISOString()
    };
    await db.saveCustomClass(cClass);
    expect(db.getCustomClasses().some(c => c.id === 'cc-mega-1')).toBe(true);
    await db.deleteCustomClass('cc-mega-1');
    expect(db.getCustomClasses().some(c => c.id === 'cc-mega-1')).toBe(false);

    // 3. Curriculum Units
    const unit: CurriculumUnit = {
      id: 'cu-mega-1',
      school_id: 'sch-1',
      grade: '中3',
      subject: '数学',
      unit_name: '円周角の定理',
      order: 10,
      created_at: new Date().toISOString()
    };
    await db.saveCurriculumUnit(unit);
    expect(db.getCurriculumUnits().some(u => u.id === 'cu-mega-1')).toBe(true);
    await db.deleteCurriculumUnit('cu-mega-1');
    expect(db.getCurriculumUnits().some(u => u.id === 'cu-mega-1')).toBe(false);

    // 4. Milestone Plans
    const plan: MilestonePlan = {
      id: 'plan-mega-1',
      grade: '中3',
      subject: '数学',
      course: 'A',
      month: 7,
      week_number: 1,
      unit_name: '二次方程式',
      target_sequence_order: 5,
      is_holiday: false,
      level: 'A'
    };
    await db.saveMilestonePlan(plan);
    expect(db.getMilestonePlans().some(p => p.id === 'plan-mega-1')).toBe(true);
    await db.saveMilestonePlans([plan]);

    // 5. Delete CurriculumMasters by Grades
    const masters: CurriculumMaster[] = [
      { id: 'cm-g1', subject: '算数', grade: '小1', unit_name: 'かず', lesson_name: '1', sort_order: 1 },
      { id: 'cm-g2', subject: '算数', grade: '小2', unit_name: 'たしざん', lesson_name: '1', sort_order: 1 }
    ];
    await db.saveCurriculumMasters(masters);
    const delRes = await db.deleteCurriculumMastersByGrades(['小1', '小2']);
    expect(delRes.success).toBe(true);

    // 6. Delete Mini Tests & Homeworks by Date
    await db.saveMiniTestResult({
      id: 'mini-d1',
      student_id: 'std-mega-1',
      date: '2026-09-28',
      subject: '数学',
      unit_name: '平方根',
      score: 100,
      passed: true,
      created_at: new Date().toISOString()
    });
    await db.deleteMiniTestResultByDate('std-mega-1', '2026-09-28');
    expect(db.getMiniTestResults('std-mega-1').length).toBe(0);

    await db.saveHomeworkResult({
      id: 'hw-d1',
      student_id: 'std-mega-1',
      date: '2026-09-28',
      subject: '数学',
      unit_name: '平方根ワーク',
      completed: true,
      created_at: new Date().toISOString()
    });
    await db.deleteHomeworkResultsByDate('std-mega-1', '2026-09-28');
    expect(db.getHomeworkResults('std-mega-1').some(h => h.id === 'hw-d1')).toBe(false);
  });
});
