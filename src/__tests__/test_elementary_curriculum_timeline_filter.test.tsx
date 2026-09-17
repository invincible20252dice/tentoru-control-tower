import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, CurriculumMaster } from '../lib/db';

describe('Elementary Curriculum Timeline Filtering and Bulk Registration', () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.clearCurriculumMasters();

    // 園児・小学生生徒と中学生生徒の登録
    const elemStudent: Student = {
      id: 'std-elem-test',
      name: '小学生 太郎',
      grade: '小5',
      grade_category: 'elementary',
      school_id: 'sch-1',
      selected_subjects: ['算数', '国語', '英語'],
      start_unit_math: 'cm-elem-m1',
      start_unit_english: 'cm-elem-en1',
      start_unit_japanese: 'cm-elem-jp1',
      target_schools: ['公立中学校'],
      created_at: new Date().toISOString()
    };

    const juniorStudent: Student = {
      id: 'std-junior-test',
      name: '中学生 花子',
      grade: '中3',
      grade_category: 'junior_high',
      school_id: 'sch-1',
      selected_subjects: ['数学', '英語'],
      created_at: new Date().toISOString()
    };

    await db.saveStudent(elemStudent);
    await db.saveStudent(juniorStudent);

    // 小学生カリキュラムマスターと中学生カリキュラムマスターの混在データ
    const masters: CurriculumMaster[] = [
      {
        id: 'cm-elem-m1',
        grade: '小5',
        subject: '算数',
        unit_name: '1章 小数と計算',
        lesson_name: '小数×小数の筆算',
        sort_order: 1,
        item_type: 'lesson',
        created_at: new Date().toISOString()
      },
      {
        id: 'cm-elem-m2',
        grade: '小5',
        subject: '算数',
        unit_name: '1章 小数と計算',
        lesson_name: '1章 小数と計算 単元確認テスト',
        sort_order: 2,
        item_type: 'unit_test',
        passing_line: '80%以上',
        created_at: new Date().toISOString()
      },
      {
        id: 'cm-elem-m3',
        grade: '小6',
        subject: '算数',
        unit_name: '1章 分数の乗除',
        lesson_name: '分数×分数の計算',
        sort_order: 3,
        item_type: 'lesson',
        created_at: new Date().toISOString()
      },
      {
        id: 'cm-jh-m1',
        grade: '中3',
        subject: '数学',
        unit_name: '1章 式の展開と因数分解',
        lesson_name: '多項式の乗法と公式①',
        sort_order: 1,
        item_type: 'lesson',
        created_at: new Date().toISOString()
      },
      {
        id: 'cm-jh-m2',
        grade: '中3',
        subject: '数学',
        unit_name: '1章 式の展開と因数分解',
        lesson_name: '1章 式の展開と因数分解 単元確認テスト',
        sort_order: 2,
        item_type: 'unit_test',
        passing_line: '80%以上',
        created_at: new Date().toISOString()
      }
    ];

    await db.saveCurriculumMasters(masters);
  });

  it('renders only elementary curriculum in elementary student timeline and excludes junior high units', async () => {
    render(
      <TeacherDashboard
        onLogout={vi.fn()}
        initialStudentId="std-elem-test"
        initialTab="milestones"
      />
    );

    // 小学生の無段階学習タイムラインが表示されていることを確認
    await waitFor(() => {
      expect(screen.getByText(/小学生向け進度タイムライン/i)).toBeInTheDocument();
    });

    // 小学生の算数単元が表示されていることを確認
    expect(screen.getByText(/小数×小数の筆算/i)).toBeInTheDocument();
    expect(screen.getByText(/分数×分数の計算/i)).toBeInTheDocument();

    // 中学生の数学単元（多項式の乗法と公式①）は小学生タイムラインに含まれていないことを確認
    expect(screen.queryByText(/多項式の乗法と公式①/i)).not.toBeInTheDocument();
  });
});
