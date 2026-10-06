import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ensureMathEnglishUnitTests, findNextUncompletedLessonForSubject, calculateLessonRangeForSlot, normalizeGrade } from '../lib/scheduler';
import { CurriculumMaster, Student, LearningTask } from '../types';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';

describe('Elementary Review & Check Tests Specification', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. 算数 (Math) 全単元仕様', () => {
    it('全単元において「単元テスト」の直前に「まとめテスト（１）」「まとめテスト（２）」「まとめテスト（３）」が通常授業として追加されること', () => {
      const mathMasters: CurriculumMaster[] = [
        { id: 'cm-m-1', grade: '小1', subject: '算数', unit_name: 'かずと　すうじ', lesson_name: 'かずとすうじ', sort_order: 1 },
        { id: 'cm-m-2', grade: '小1', subject: '算数', unit_name: 'なんばんめ', lesson_name: 'なんばんめ(1)', sort_order: 10 }
      ];

      const processed = ensureMathEnglishUnitTests(mathMasters);

      // 単元1: かずと　すうじ (通常レッスン + まとめテスト1 + まとめテスト2 + まとめテスト3 + 単元確認テスト) = 5件
      // 単元2: なんばんめ (通常レッスン + まとめテスト1 + まとめテスト2 + まとめテスト3 + 単元確認テスト) = 5件
      // 合計 10件
      expect(processed.length).toBe(10);

      // 単元1 の順序確認
      const unit1Items = processed.filter(m => m.unit_name === 'かずと　すうじ');
      expect(unit1Items.length).toBe(5);
      expect(unit1Items[0].lesson_name).toBe('かずとすうじ');
      expect(unit1Items[0].item_type).toBeUndefined();

      expect(unit1Items[1].lesson_name).toBe('まとめテスト（１）');
      expect(unit1Items[1].item_type).toBe('lesson'); // 通常授業扱い

      expect(unit1Items[2].lesson_name).toBe('まとめテスト（２）');
      expect(unit1Items[2].item_type).toBe('lesson'); // 通常授業扱い

      expect(unit1Items[3].lesson_name).toBe('まとめテスト（３）');
      expect(unit1Items[3].item_type).toBe('lesson'); // 通常授業扱い

      expect(unit1Items[4].lesson_name).toContain('単元確認テスト');
      expect(unit1Items[4].item_type).toBe('unit_test'); // 単元テストのみ unit_test

      // 単元2 の順序確認
      const unit2Items = processed.filter(m => m.unit_name === 'なんばんめ');
      expect(unit2Items.length).toBe(5);
      expect(unit2Items[0].lesson_name).toBe('なんばんめ(1)');
      expect(unit2Items[1].lesson_name).toBe('まとめテスト（１）');
      expect(unit2Items[2].lesson_name).toBe('まとめテスト（２）');
      expect(unit2Items[3].lesson_name).toBe('まとめテスト（３）');
      expect(unit2Items[4].lesson_name).toContain('単元確認テスト');
    });

    it('算数のまとめテストは通常授業として順番に消化され、点数入力なしで未完了レッスンとして進むこと', () => {
      const mathMasters: CurriculumMaster[] = [
        { id: 'cm-m-1', grade: '小1', subject: '算数', unit_name: 'かずと　すうじ', lesson_name: 'かずとすうじ', sort_order: 1 }
      ];
      const processed = ensureMathEnglishUnitTests(mathMasters);

      const student: Student = {
        id: 'std-math-1',
        student_id: 'std-math-1',
        name: '算数生徒',
        grade: '小1',
        level: 'B',
        branch_id: 'b1',
        selected_subjects: ['算数'],
        completed_lesson_ids: ['cm-m-1'] // 通常レッスン完了
      };

      // STEP 1完了後の次回授業は「まとめテスト（１）」
      const next1 = findNextUncompletedLessonForSubject({
        student,
        subject: '算数',
        curriculumMasters: processed
      });
      expect(next1.lessonName).toContain('まとめテスト（１）');
      expect(next1.hasFailedUnitTest).toBeFalsy();

      // まとめテスト（１）完了後の次回授業は「まとめテスト（２）」
      const sum1Item = processed.find(m => m.lesson_name === 'まとめテスト（１）');
      student.completed_lesson_ids = ['cm-m-1', sum1Item!.id];
      const next2 = findNextUncompletedLessonForSubject({
        student,
        subject: '算数',
        curriculumMasters: processed
      });
      expect(next2.lessonName).toContain('まとめテスト（２）');

      // まとめテスト（１〜３）完了後に「単元確認テスト」へ進む
      const sum2Item = processed.find(m => m.lesson_name === 'まとめテスト（２）');
      const sum3Item = processed.find(m => m.lesson_name === 'まとめテスト（３）');
      student.completed_lesson_ids = ['cm-m-1', sum1Item!.id, sum2Item!.id, sum3Item!.id];
      const nextTest = findNextUncompletedLessonForSubject({
        student,
        subject: '算数',
        curriculumMasters: processed
      });
      expect(nextTest.lessonName).toContain('単元確認テスト');
    });
  });

  describe('2. 英語 (English) 全単元仕様', () => {
    it('全単元において「単元テスト」の直前に「Check Test」が通常授業として追加されること', () => {
      const englishMasters: CurriculumMaster[] = [
        { id: 'cm-e-1', grade: '小3', subject: '英語', unit_name: 'I am〜', lesson_name: 'STEP 1', sort_order: 1 },
        { id: 'cm-e-2', grade: '小3', subject: '英語', unit_name: 'I am〜', lesson_name: 'STEP 2', sort_order: 2 },
        { id: 'cm-e-3', grade: '小3', subject: '英語', unit_name: 'I am〜', lesson_name: 'STEP 3', sort_order: 3 },
        { id: 'cm-e-4', grade: '小3', subject: '英語', unit_name: 'I am〜', lesson_name: 'STEP 4', sort_order: 4 },
        { id: 'cm-e-5', grade: '小3', subject: '英語', unit_name: 'I am〜', lesson_name: 'STEP 5', sort_order: 5 },
        { id: 'cm-e-6', grade: '小3', subject: '英語', unit_name: 'You are〜', lesson_name: 'STEP 1', sort_order: 10 }
      ];

      const processed = ensureMathEnglishUnitTests(englishMasters);

      // 単元1: I am〜 (通常5件 + Check Test 1件 + 単元確認テスト 1件 = 7件)
      // 単元2: You are〜 (通常1件 + Check Test 1件 + 単元確認テスト 1件 = 3件)
      // 合計 10件
      expect(processed.length).toBe(10);

      const unit1Items = processed.filter(m => m.unit_name === 'I am〜');
      expect(unit1Items.length).toBe(7);
      expect(unit1Items[4].lesson_name).toBe('STEP 5');
      expect(unit1Items[5].lesson_name).toBe('Check Test');
      expect(unit1Items[5].item_type).toBe('lesson'); // 通常授業扱い
      expect(unit1Items[6].lesson_name).toContain('単元確認テスト');
      expect(unit1Items[6].item_type).toBe('unit_test');
    });

    it('Check Testは通常授業として消化され、その後に単元確認テストが待機すること', () => {
      const englishMasters: CurriculumMaster[] = [
        { id: 'cm-e-1', grade: '小3', subject: '英語', unit_name: 'I am〜', lesson_name: 'STEP 1', sort_order: 1 }
      ];
      const processed = ensureMathEnglishUnitTests(englishMasters);

      const student: Student = {
        id: 'std-eng-1',
        name: '英語生徒',
        grade: '小3',
        level: 'B',
        selected_subjects: ['英語'],
        completed_lesson_ids: ['cm-e-1']
      };

      const nextCheck = findNextUncompletedLessonForSubject({
        student,
        subject: '英語',
        curriculumMasters: processed
      });
      expect(nextCheck.lessonName).toContain('Check Test');

      const checkItem = processed.find(m => m.lesson_name === 'Check Test');
      student.completed_lesson_ids = ['cm-e-1', checkItem!.id];

      const nextTest = findNextUncompletedLessonForSubject({
        student,
        subject: '英語',
        curriculumMasters: processed
      });
      expect(nextTest.lessonName).toContain('単元確認テスト');
    });
  });

  describe('3. 国語 (Japanese) 全単元仕様', () => {
    it('全単元において各単元の最後に「まとめテスト（１）」「まとめテスト（２）」「まとめテスト（３）」が通常授業として追加されること（単元確認テストは追加されない）', () => {
      const japaneseMasters: CurriculumMaster[] = [
        { id: 'cm-j-1', grade: '小1', subject: '国語', unit_name: 'ふたとぶた', lesson_name: 'ふたとぶた', sort_order: 1 },
        { id: 'cm-j-2', grade: '小1', subject: '国語', unit_name: 'ねことねっこ', lesson_name: 'ねことねっこ', sort_order: 10 },
        { id: 'cm-j-3', grade: '小1', subject: '国語', unit_name: 'ことばあそび', lesson_name: 'ことばあそび', sort_order: 20 }
      ];

      const processed = ensureMathEnglishUnitTests(japaneseMasters);

      // 各単元にまとめテスト1, 2, 3が追加され、単元確認テストは追加されない
      // ふたとぶた: 4件 (ふたとぶた + まとめテスト1〜3)
      // ねことねっこ: 4件 (ねことねっこ + まとめテスト1〜3)
      // ことばあそび: 4件 (ことばあそび + まとめテスト1〜3)
      // 合計 12件
      expect(processed.length).toBe(12);

      const unit1Items = processed.filter(m => m.unit_name === 'ふたとぶた');
      expect(unit1Items.length).toBe(4);
      expect(unit1Items[0].lesson_name).toBe('ふたとぶた');
      expect(unit1Items[1].lesson_name).toBe('まとめテスト（１）');
      expect(unit1Items[2].lesson_name).toBe('まとめテスト（２）');
      expect(unit1Items[3].lesson_name).toBe('まとめテスト（３）');
      expect(unit1Items.every(m => m.item_type === 'lesson' || m.item_type === undefined)).toBe(true);

      const unit2Items = processed.filter(m => m.unit_name === 'ねことねっこ');
      expect(unit2Items.length).toBe(4);
      expect(unit2Items[0].lesson_name).toBe('ねことねっこ');
      expect(unit2Items[1].lesson_name).toBe('まとめテスト（１）');
      expect(unit2Items[2].lesson_name).toBe('まとめテスト（２）');
      expect(unit2Items[3].lesson_name).toBe('まとめテスト（３）');
    });
  });

  describe('4. 小学生進度タイムライン (TeacherDashboard) UI レンダリング検証', () => {
    it('タイムライン上で「まとめテスト」や「Check Test」は通常授業バッジになり、「単元確認テスト」のみに📝 単元テストバッジが表示されること', async () => {
      const mockStudent: Student = {
        id: 'std-elem-test4',
        student_id: 'S_TEST_4',
        name: '小学生テスト生',
        grade: '小1',
        status: 'normal',
        branch_id: 'branch-1',
        selected_subjects: ['算数', '英語', '国語'],
        selected_days: ['monday', 'thursday'],
        period_count: 2,
        default_slots: 2,
        created_at: new Date().toISOString()
      };

      const testMasters: CurriculumMaster[] = [
        { id: 'cm-m-1', grade: '小1', subject: '算数', unit_name: '1章 かずとすうじ', lesson_name: 'かずとすうじ', sort_order: 1, item_type: 'lesson' },
        { id: 'cm-m-2', grade: '小1', subject: '算数', unit_name: '1章 かずとすうじ', lesson_name: '1章 かずとすうじ 単元確認テスト', sort_order: 2, item_type: 'unit_test' },
      ];

      await db.saveStudent(mockStudent);
      await db.saveCurriculumMasters(testMasters);

      render(
        <TeacherDashboard
          teacherType="elementary"
          students={[mockStudent]}
          curriculumMasters={testMasters}
          initialStudentId={mockStudent.id}
          initialTab="milestones"
          onBackToPortal={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText(/無段階学習タイムライン/).length).toBeGreaterThan(0);
      });

      // 算数カリキュラムのまとめテスト（１）〜（３）が表示されること
      expect(screen.getByText(/1章 かずとすうじ - まとめテスト（１）/)).toBeInTheDocument();
      expect(screen.getByText(/1章 かずとすうじ - まとめテスト（２）/)).toBeInTheDocument();
      expect(screen.getByText(/1章 かずとすうじ - まとめテスト（３）/)).toBeInTheDocument();
      expect(screen.getByText(/1章 かずとすうじ - 単元確認テスト/)).toBeInTheDocument();

      // まとめテストには「📝 単元テスト」バッジはなく、単元確認テストにのみ1つ表示されること
      const unitTestBadges = screen.getAllByText('📝 単元テスト');
      expect(unitTestBadges.length).toBe(1);
    });
  });
});
