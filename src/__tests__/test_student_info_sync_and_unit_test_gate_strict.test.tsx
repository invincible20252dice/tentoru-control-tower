import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import { Student, CurriculumMaster, MiniTestResult, LearningTask } from '../types';
import {
  findNextUncompletedLessonForSubject,
  calculateLessonRangeForSlot,
  generateSlotsForSelectedSubjects
} from '../lib/scheduler';

describe('生徒情報（学校名・個性タグ）完全同期 ＆ 単元テスト合否ゲート強制停止テスト', () => {
  const mockStudent: Student = {
    id: 'std-test-gate-1',
    student_id: 'student103',
    name: '中尾 謙信',
    email: 'student103@tentoru-student.com',
    grade: '小5',
    school_id: 'sch-2',
    school_name: 'テントル小学校',
    status: 'normal',
    personalities: ['集中力高い'],
    personality_tags: ['集中力高い'],
    selected_subjects: ['算数'],
    selected_days: ['tuesday', 'friday'],
    period_count: 2,
    created_at: new Date().toISOString()
  };

  const sampleCurriculum: CurriculumMaster[] = [
    {
      id: 'cm-step-17',
      grade: '小5',
      subject: '算数',
      unit_name: '小数のかけ算',
      lesson_name: '第1講 小数×整数',
      sort_order: 17
    },
    {
      id: 'cm-step-18',
      grade: '小5',
      subject: '算数',
      unit_name: '小数のかけ算',
      lesson_name: '第2講 小数×小数',
      sort_order: 18
    },
    {
      id: 'cm-step-19-test',
      grade: '小5',
      subject: '算数',
      unit_name: '小数のかけ算',
      lesson_name: '小数のかけ算 - 単元確認テスト',
      item_type: 'unit_test',
      sort_order: 19,
      passing_line: '80%以上'
    },
    {
      id: 'cm-step-20',
      grade: '小5',
      subject: '算数',
      unit_name: '小数のわり算',
      lesson_name: '第1講 小数÷整数',
      sort_order: 20
    },
    {
      id: 'cm-step-21',
      grade: '小5',
      subject: '算数',
      unit_name: '小数のわり算',
      lesson_name: '第2講 小数÷小数',
      sort_order: 21
    }
  ];

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);

    await db.saveStudent(mockStudent);
    localStorage.setItem('tentoru_curriculum_masters', JSON.stringify(sampleCurriculum));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. 生徒情報：学校名保存整合性 ＆ 個性タグ追加', () => {
    it('学校名を「飽田南小学校」に変更して保存時、生徒一覧カードでも未所属にならず飽田南小学校が表示される', async () => {
      let renderResult: any;
      await act(async () => {
        renderResult = render(
          <TeacherDashboard
            initialStudentId={mockStudent.id}
            teacherType="elementary"
            initialTab="student-detail"
          />
        );
      });

      // 1. 学校名入力欄を「飽田南小学校」に変更
      const schoolInput = screen.getByTestId('student-school-name-input');
      fireEvent.change(schoolInput, { target: { value: '飽田南小学校' } });
      expect((schoolInput as HTMLInputElement).value).toBe('飽田南小学校');

      // 2. 「変更を保存する」ボタン押下
      const submitBtn = screen.getByRole('button', { name: /変更を保存する/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // 3. 生徒一覧タブに切り替えて、生徒一覧カードの学校名表示を確認
      const studentListTab = screen.getByRole('button', { name: /生徒一覧/i });
      await act(async () => {
        fireEvent.click(studentListTab);
      });

      const studentCard = screen.getByTestId(`student-card-${mockStudent.id}`);
      const studentCardSchool = within(studentCard).getByText('飽田南小学校');
      expect(studentCardSchool).toBeInTheDocument();
      expect(screen.queryByText('未所属')).not.toBeInTheDocument();

      // 4. db.getStudents() からも正しく school_name が保持されていることを確認
      const savedStudent = db.getStudents().find(s => s.id === mockStudent.id);
      expect(savedStudent?.school_name).toBe('飽田南小学校');
    });

    it('個性の「新しく書いて追加」で入力したテキストが「＋ 追加」押下時に即時バッジ描画され、保存後に永続化される', async () => {
      await act(async () => {
        render(
          <TeacherDashboard
            initialStudentId={mockStudent.id}
            teacherType="elementary"
            initialTab="student-detail"
          />
        );
      });

      // 1. 新しい個性を入力
      const personalityInput = screen.getByTestId('new-personality-input');
      fireEvent.change(personalityInput, { target: { value: '自分から質問するのが苦手' } });
      expect((personalityInput as HTMLInputElement).value).toBe('自分から質問するのが苦手');

      // 2. 「＋ 追加」ボタン押下
      const addBtn = screen.getByTestId('add-personality-btn');
      await act(async () => {
        fireEvent.click(addBtn);
      });

      // 3. 画面にタグバッジが即時描画されることを確認（バッジ削除ボタンの存在で検証）
      const removeBadgeBtn = screen.getByTestId('remove-personality-tag-自分から質問するのが苦手');
      expect(removeBadgeBtn).toBeInTheDocument();
      expect(screen.getAllByText('自分から質問するのが苦手').length).toBeGreaterThanOrEqual(1);

      // 4. 「変更を保存する」ボタン押下
      const submitBtn = screen.getByRole('button', { name: /変更を保存する/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      // 5. db.getStudents() からも personalities 配列に永続化されていることを確認
      const savedStudent = db.getStudents().find(s => s.id === mockStudent.id);
      expect(savedStudent?.personalities).toContain('自分から質問するのが苦手');
      expect(savedStudent?.personality_tags).toContain('自分から質問するのが苦手');
    });
  });

  describe('2. カリキュラム：単元テストのとばし防止と強制ゲート停止', () => {
    it('単元確認テストが未合格（未受験）の場合、STEP 20などの通常授業を「現在地（取り組み中）」に設定することを厳格に禁止し、単元テストが現在地となる', async () => {
      // STEP 17 と STEP 18 は完了済みとする
      const studentWithStep18Completed: Student = {
        ...mockStudent,
        completed_lesson_ids: ['cm-step-17', 'cm-step-18']
      };
      await db.saveStudent(studentWithStep18Completed);

      // コマ割りに誤って STEP 20 のタスクが設定されていたとしても、STEP 19 が未合格なら合否ゲートが発動
      const taskPastGate: LearningTask = {
        id: 'task-step-20-leak',
        student_id: studentWithStep18Completed.id,
        scheduled_date: '2026-10-05',
        period: 1,
        subject: '算数',
        unit_id: 'cm-step-20',
        start_lesson_id: 'cm-step-20',
        end_lesson_id: 'cm-step-20',
        start_lesson_name: '第1講 小数÷整数',
        end_lesson_name: '第1講 小数÷整数',
        lesson_range: '第1講 小数÷整数',
        status: 'unstarted',
        created_at: new Date().toISOString()
      };
      await db.saveLearningTasks([taskPastGate]);

      let renderResult: any;
      await act(async () => {
        renderResult = render(
          <TeacherDashboard
            initialStudentId={studentWithStep18Completed.id}
            teacherType="elementary"
            initialTab="milestones"
          />
        );
      });

      // タイムライン上で STEP 19（単元確認テスト）が「📍 現在地（取り組み中）」として停止していること
      const step19Item = renderResult.container.querySelector('[data-test-unit-id="cm-step-19-test"]')?.closest('div');
      expect(step19Item).toBeDefined();

      // STEP 20 が「📍 現在地（取り組み中）」になっていないことを厳格に検証
      const step20Item = renderResult.container.querySelector('[data-test-unit-id="cm-step-20"]')?.closest('div');
      expect(step20Item).toBeDefined();
      expect(step20Item).not.toHaveTextContent('📍 現在地（取り組み中）');
      expect(step20Item).toHaveTextContent('○ 予定');
    });

    it('自動リスケ実行時に、単元テストに到達した時点でループがブレークし、From〜To は単元テストまでで終了する', () => {
      const studentAtStep17: Student = {
        ...mockStudent,
        level: 'A', // レベルAは通常4レッスン進む
        completed_lesson_ids: []
      };

      // STEP 17 からスタート（4レッスン進むと STEP 20 まで進んでしまう設定）
      const range = calculateLessonRangeForSlot({
        subject: '算数',
        startLessonId: 'cm-step-17',
        student: studentAtStep17,
        curriculumMasters: sampleCurriculum
      });

      // 単元テスト（cm-step-19-test）で必ずストップし、STEP 20 にまたがないこと
      expect(range.start_lesson_id).toBe('cm-step-17');
      expect(range.end_lesson_id).toBe('cm-step-19-test');
      expect(range.end_lesson_name).toContain('単元確認テスト');
    });

    it('該当の単元テストに「合格（passed）」の記録が存在する場合のみ、次の単元（STEP 20〜）がスケジュール対象としてアンロックされる', () => {
      const studentWithStep18Completed: Student = {
        ...mockStudent,
        completed_lesson_ids: ['cm-step-17', 'cm-step-18']
      };

      // 1. テスト未受験・未合格のとき: findNextUncompletedLessonForSubject は単元テスト（STEP 19）を返す
      const nextUnpassed = findNextUncompletedLessonForSubject({
        student: studentWithStep18Completed,
        subject: '算数',
        curriculumMasters: sampleCurriculum,
        miniTestResults: []
      });
      expect(nextUnpassed.lessonId).toBe('cm-step-19-test');
      expect(nextUnpassed.lessonName).toContain('単元確認テスト');

      // 2. テスト合格記録（score: 95, passed: true, status: 'passed'）を投入
      const passedMiniTest: MiniTestResult = {
        id: 'mt-pass-19',
        student_id: studentWithStep18Completed.id,
        date: '2026-10-04',
        subject: '算数',
        unit_name: '小数のかけ算',
        test_content: '小数のかけ算 - 単元確認テスト',
        score: 95,
        passed: true,
        status: 'passed',
        passing_line: '80%以上'
      };

      // 3. テスト合格後は合否ゲートが解除され、次単元の第1講（STEP 20）がアンロックされる
      const nextUnlocked = findNextUncompletedLessonForSubject({
        student: studentWithStep18Completed,
        subject: '算数',
        curriculumMasters: sampleCurriculum,
        miniTestResults: [passedMiniTest]
      });
      expect(nextUnlocked.lessonId).toBe('cm-step-20');
      expect(nextUnlocked.lessonName).toContain('第1講 小数÷整数');

      // 4. generateSlotsForSelectedSubjects でも STEP 20 からの割り当てが解禁される
      const slots = generateSlotsForSelectedSubjects({
        student: studentWithStep18Completed,
        periodCount: 1,
        selectedSubjects: ['算数'],
        curriculumMasters: sampleCurriculum,
        miniTestResults: [passedMiniTest]
      });
      expect(slots[1].startLessonId).toBe('cm-step-20');
      expect(slots[1].startLessonName).toContain('第1講 小数÷整数');
    });
  });
});
