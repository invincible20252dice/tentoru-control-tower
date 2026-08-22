import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { db, CurriculumMaster, Student } from '../lib/db';
import { ensureMathEnglishUnitTests, findNextUncompletedLessonForSubject, calculateLessonRangeForSlot } from '../lib/scheduler';
import TeacherDashboard from '../components/TeacherDashboard';

describe('Unit Test Auto Insertion and Curriculum Exclusion Feature', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('automatically inserts unit confirmation test after the last lesson of each unit for Math and English', () => {
    const sampleMasters: CurriculumMaster[] = [
      {
        id: 'm1',
        grade: '小5',
        subject: '算数',
        unit_name: '小数のかけ算',
        lesson_name: '小数の掛け算 STEP 1',
        sort_order: 10
      },
      {
        id: 'm2',
        grade: '小5',
        subject: '算数',
        unit_name: '小数のかけ算',
        lesson_name: '小数の掛け算 STEP 2',
        sort_order: 20
      },
      {
        id: 'm3',
        grade: '小5',
        subject: '算数',
        unit_name: '割算の筆算',
        lesson_name: '割算の筆算 STEP 1',
        sort_order: 30
      }
    ];

    const processed = ensureMathEnglishUnitTests(sampleMasters);

    // 小数のかけ算 の後に 1つの単元確認テスト、 割算の筆算 の後に 1つの単元確認テスト が挿入され、合計 5件になること
    expect(processed.length).toBe(5);

    const test1 = processed.find(p => p.unit_name === '小数のかけ算' && p.item_type === 'unit_test');
    expect(test1).toBeDefined();
    expect(test1?.lesson_name).toBe('小数のかけ算 - 単元確認テスト');

    const test2 = processed.find(p => p.unit_name === '割算の筆算' && p.item_type === 'unit_test');
    expect(test2).toBeDefined();
    expect(test2?.lesson_name).toBe('割算の筆算 - 単元確認テスト');
  });

  it('prevents duplicate unit test creation when unit test already exists in the unit group', () => {
    const sampleMasters: CurriculumMaster[] = [
      {
        id: 'm1',
        grade: '小5',
        subject: '算数',
        unit_name: '図形の性質',
        lesson_name: '図形 STEP 1',
        sort_order: 10
      },
      {
        id: 'm2',
        grade: '小5',
        subject: '算数',
        unit_name: '図形の性質',
        lesson_name: '図形の性質 - 単元確認テスト',
        item_type: 'unit_test',
        sort_order: 20
      }
    ];

    const processed = ensureMathEnglishUnitTests(sampleMasters);

    // 既に単元テストが存在するため二重追加されず合計2件に収まること
    expect(processed.length).toBe(2);
  });

  it('skips excluded lessons when finding next uncompleted lesson and calculating slots', () => {
    const student: Student = {
      id: 'st_ex_1',
      name: 'テスト除外生徒',
      grade: '小5',
      school_id: 'school_1',
      study_days: ['月', '水'],
      slots_per_day: 2,
      excluded_lesson_ids: ['m1'] // m1 を除外リストに設定
    };

    const masters: CurriculumMaster[] = [
      { id: 'm1', grade: '小5', subject: '算数', unit_name: '単元A', lesson_name: '授業1', sort_order: 10 },
      { id: 'm2', grade: '小5', subject: '算数', unit_name: '単元A', lesson_name: '授業2', sort_order: 20 },
      { id: 'm3', grade: '小5', subject: '算数', unit_name: '単元B', lesson_name: '授業3', sort_order: 30 }
    ];

    db.saveStudent(student);
    db.saveCurriculumMasters(masters);

    // m1 が除外されているため、nextUncompleted は m2 (授業2) を返すべき
    const nextLesson = findNextUncompletedLessonForSubject({
      subject: '算数',
      student,
      tasks: [],
      curriculumMasters: masters
    });
    expect(nextLesson.lessonId).toBe('m2');
    expect(nextLesson.lessonName).toContain('授業2');

    // コマ割りの算出も m2 からスタートすること
    const slotRange = calculateLessonRangeForSlot({
      subject: '算数',
      student,
      tasks: [],
      curriculumMasters: masters,
      curriculumUnits: [],
      lessonProgressList: []
    });

    expect(slotRange.start_lesson_name).toBe('単元A - 授業2');
  });

  it('renders timeline with per-item exclude button and updates excluded list upon click', async () => {
    const student: Student = {
      id: 'st_ui_1',
      name: 'UI除外検証生徒',
      grade: '小5',
      school_id: 'branch-1',
      study_days: ['月', '水'],
      slots_per_day: 2,
      completed_lesson_ids: [],
      excluded_lesson_ids: []
    };

    const masters: CurriculumMaster[] = [
      { id: 'master_1', grade: '小5', subject: '算数', unit_name: '分数のかけ算', lesson_name: 'STEP 1 基本計算', sort_order: 10 },
      { id: 'master_2', grade: '小5', subject: '算数', unit_name: '分数のかけ算', lesson_name: 'STEP 2 応用問題', sort_order: 20 }
    ];

    db.saveStudent(student);
    db.saveCurriculumMasters(masters);

    window.confirm = () => true;
    window.alert = () => {};

    render(<TeacherDashboard initialStudentId="st_ui_1" />);

    // 生徒が選択され、マイルストーンメニューを選択
    await waitFor(() => {
      expect(screen.getByText(/年間計画/i)).toBeInTheDocument();
    });
    const milestonesTab = screen.getByText(/年間計画/i);
    fireEvent.click(milestonesTab);

    // 除外ボタンが表示されていること
    await waitFor(() => {
      const excludeBtns = screen.getAllByTestId('timeline-exclude-btn');
      expect(excludeBtns.length).toBeGreaterThan(0);
    });

    // 最初のアイテムの除外ボタンをクリック
    const firstExcludeBtn = screen.getAllByTestId('timeline-exclude-btn')[0];
    fireEvent.click(firstExcludeBtn);

    // db 内の生徒データで excluded_lesson_ids が保存されたか確認
    await waitFor(() => {
      const updatedSt = db.getStudentById('st_ui_1');
      expect(updatedSt?.excluded_lesson_ids?.length).toBeGreaterThan(0);
    });
  });
});
