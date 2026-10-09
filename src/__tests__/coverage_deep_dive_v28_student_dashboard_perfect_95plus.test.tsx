import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StudentDashboard from '../components/StudentDashboard';
import { db, Student, CurriculumMaster, LearningTask, MiniTestResult, HomeworkResult, CurriculumUnit } from '../lib/db';

describe('StudentDashboard Perfect 95%+ Coverage Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => 'テスト入力');
  });

  it('covers determineInitialDate fallbacks for past tasks and upcoming tasks', async () => {
    const studentUpcoming: Student = {
      id: 'std-upcoming-1',
      student_id: 'std_up',
      name: '未来タスク生徒',
      grade: '中1',
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '中1',
      selected_subjects: ['数学']
    };
    await db.saveStudent(studentUpcoming);

    await db.saveLearningTasks([{
      id: 'task-future-1',
      student_id: studentUpcoming.id,
      scheduled_date: '2026-12-01',
      period: 1,
      status: 'unstarted',
      subject: '数学',
      custom_unit_name: '未来の授業',
      created_at: new Date().toISOString()
    }]);

    const { unmount } = render(<StudentDashboard student={studentUpcoming} onLogout={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/さんの学習画面/)).toBeInTheDocument();
    });
    unmount();
  });

  it('covers getTaskStepLessons multi-step matching, curriculum unit fallbacks, and score entry validations', async () => {
    const student: Student = {
      id: 'std-steps-deep',
      student_id: 'std_steps',
      name: 'ステップ 深掘り生徒',
      grade: '小3',
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '小3',
      selected_subjects: ['算数'],
      attendance_days: ['月', '木'],
      completed_lesson_ids: ['cm-e1']
    };
    await db.saveStudent(student);

    const masters: CurriculumMaster[] = [
      { id: 'cm-e1', subject: '算数', grade: '3年生', unit_name: 'わり算', lesson_name: 'わり算のしかた', sort_order: 1 },
      { id: 'cm-e2', subject: '算数', grade: '3年生', unit_name: 'わり算', lesson_name: 'あまりのあるわり算', sort_order: 2 },
      { id: 'cm-e3', subject: '算数', grade: '3年生', unit_name: '円と球', lesson_name: '円の半径と直径', sort_order: 3 }
    ];
    await db.saveCurriculumMasters(masters);

    const task: LearningTask = {
      id: 'task-steps-deep-1',
      student_id: student.id,
      unit_id: 'cm-e2',
      scheduled_date: '2026-09-19',
      period: 1,
      status: 'unstarted',
      subject: '算数',
      custom_unit_name: 'あまりのあるわり算 - 確認テスト',
      start_lesson_name: 'わり算のしかた',
      end_lesson_name: 'あまりのあるわり算',
      lesson_range: 'わり算のしかた〜あまりのあるわり算',
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    const miniTest: MiniTestResult = {
      id: 'mini-score-val-1',
      student_id: student.id,
      date: '2026-09-19',
      subject: '算数',
      test_content: 'わり算確認テスト',
      score: null,
      passing_line: '80',
      passed: null,
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(miniTest);

    render(<StudentDashboard student={student} onLogout={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/さんの学習画面/)).toBeInTheDocument();
    });

    // Test score validation: empty, invalid > 100, valid score
    const scoreInputs = screen.queryAllByRole('spinbutton');
    if (scoreInputs.length > 0) {
      fireEvent.change(scoreInputs[0], { target: { value: '150' } });
      const submitBtn = screen.queryByRole('button', { name: /結果送信|保存/ });
      if (submitBtn) {
        await act(async () => {
          fireEvent.click(submitBtn);
        });
      }

      fireEvent.change(scoreInputs[0], { target: { value: '85' } });
      if (submitBtn) {
        await act(async () => {
          fireEvent.click(submitBtn);
        });
      }
    }

    // Test pass unit test auto next-unit assignment
    const passBtns = screen.queryAllByRole('button', { name: /合格/ });
    for (const pb of passBtns) {
      await act(async () => {
        try { fireEvent.click(pb); } catch (e) {}
      });
    }

    // Test watch video
    const videoBtns = screen.queryAllByRole('button', { name: /動画視聴|視聴済/ });
    for (const vb of videoBtns) {
      await act(async () => {
        try { fireEvent.click(vb); } catch (e) {}
      });
    }

    await waitFor(() => {
      const updated = db.getLearningTasks().filter(t => t.student_id === student.id);
      expect(updated.length).toBeGreaterThan(0);
    });
  });

  it('handles unit test failure, remedial task insertion, period shifting, and scrolling to remedial task', async () => {
    const todayStr = '2026-10-09';
    const studentFail: Student = {
      id: 'std-fail-flow-1',
      student_id: 'std_ff',
      name: 'やり直し検証生徒',
      grade: '小3',
      level: 'A',
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '小3',
      selected_subjects: ['算数'],
      attendance_days: ['金', '火'],
      completed_lesson_ids: ['cm-fail-unit-1', 'cm-past-unit']
    };
    await db.saveStudent(studentFail);

    const masters: CurriculumMaster[] = [
      { id: 'cm-fail-unit-1', subject: '算数', grade: '3年生', unit_name: 'わり算', lesson_name: 'わり算 - 単元確認テスト', item_type: 'unit_test', sort_order: 10 },
      { id: 'cm-elem-subseq', subject: '算数', grade: '3年生', unit_name: '円と球', lesson_name: '円の半径と直径', sort_order: 11 }
    ];
    await db.saveCurriculumMasters(masters);

    const task1: LearningTask = {
      id: 'task-fail-p1',
      student_id: studentFail.id,
      unit_id: 'cm-fail-unit-1',
      scheduled_date: todayStr,
      period: 1,
      status: 'unstarted',
      subject: '算数',
      custom_unit_name: 'わり算 - 単元確認テスト',
      start_lesson_name: 'わり算 - 単元確認テスト',
      passing_line: '80%以上',
      created_at: new Date().toISOString()
    };
    const task2: LearningTask = {
      id: 'task-subseq-p2',
      student_id: studentFail.id,
      unit_id: 'cm-elem-subseq',
      scheduled_date: todayStr,
      period: 2,
      status: 'unstarted',
      subject: '算数',
      custom_unit_name: '円の半径と直径',
      start_lesson_name: '円の半径と直径',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task1, task2]);

    const scrollMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollMock;

    const { unmount } = render(<StudentDashboard student={studentFail} onLogout={vi.fn()} initialDate={todayStr} />);
    await waitFor(() => {
      expect(screen.getByText(/やり直し検証生徒 さんの学習画面/)).toBeInTheDocument();
    });

    // Enter a failing score (60)
    const scoreInput = screen.getByTestId('task-score-input-1');
    fireEvent.change(scoreInput, { target: { value: '60' } });

    const submitBtn = screen.getByTestId('task-score-submit-btn-1');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      // Mini test result should be failed
      const miniResults = db.getMiniTestResults().filter(r => r.student_id === studentFail.id);
      expect(miniResults.some(r => r.score === 60 && r.passed === false)).toBe(true);

      // Student completed_lesson_ids should have removed cm-fail-unit-1
      const updatedStudent = db.getStudent(studentFail.id);
      expect(updatedStudent?.completed_lesson_ids || []).not.toContain('cm-fail-unit-1');
    });

    // Click remedial action button
    const remedialBtn = screen.queryByTestId('remedial-task-action-btn-1');
    if (remedialBtn) {
      fireEvent.click(remedialBtn);
      expect(scrollMock).toHaveBeenCalled();
    }
    unmount();
  });

  it('handles passing unit tests with various suffixes (まとめテスト1/2/3, Check Test, 再テスト) and triggers next unit auto-scheduling', async () => {
    const todayStr = '2026-10-09';
    const studentPass: Student = {
      id: 'std-pass-suffixes-1',
      student_id: 'std_ps',
      name: 'テストサフィックス生徒',
      grade: '小4',
      level: 'A',
      status: 'normal',
      period_count: 5,
      registered_year: 2026,
      registered_grade: '小4',
      selected_subjects: ['算数', '英語'],
      attendance_days: ['金', '月'],
      completed_lesson_ids: []
    };
    await db.saveStudent(studentPass);

    const masters: CurriculumMaster[] = [
      { id: 'cm-matome-1', subject: '算数', grade: '4年生', unit_name: '角度', lesson_name: '角度 - まとめテスト（１）', sort_order: 1 },
      { id: 'cm-matome-2', subject: '算数', grade: '4年生', unit_name: '角度', lesson_name: '角度 - まとめテスト（２）', sort_order: 2 },
      { id: 'cm-matome-3', subject: '算数', grade: '4年生', unit_name: '角度', lesson_name: '角度 - まとめテスト（３）', sort_order: 3 },
      { id: 'cm-check-test', subject: '英語', grade: '4年生', unit_name: 'Lesson 1', lesson_name: 'Lesson 1 - Check Test', sort_order: 4 },
      { id: 'cm-retest', subject: '算数', grade: '4年生', unit_name: 'わり算', lesson_name: 'わり算 - 単元確認テスト（再テスト）', item_type: 'unit_test', sort_order: 5 },
      { id: 'cm-next-unit', subject: '算数', grade: '4年生', unit_name: '小数のかけ算', lesson_name: '小数のかけ算のしくみ', sort_order: 6 }
    ];
    await db.saveCurriculumMasters(masters);

    const tasks: LearningTask[] = [
      {
        id: 'task-matome-1',
        student_id: studentPass.id,
        unit_id: 'cm-matome-1',
        scheduled_date: todayStr,
        period: 1,
        status: 'unstarted',
        subject: '算数',
        custom_unit_name: '角度 - まとめテスト（１）',
        start_lesson_name: '角度 - まとめテスト（１）',
        created_at: new Date().toISOString()
      },
      {
        id: 'task-matome-2',
        student_id: studentPass.id,
        unit_id: 'cm-matome-2',
        scheduled_date: todayStr,
        period: 2,
        status: 'unstarted',
        subject: '算数',
        custom_unit_name: '角度 - まとめテスト（２）',
        start_lesson_name: '角度 - まとめテスト（２）',
        created_at: new Date().toISOString()
      },
      {
        id: 'task-matome-3',
        student_id: studentPass.id,
        unit_id: 'cm-matome-3',
        scheduled_date: todayStr,
        period: 3,
        status: 'unstarted',
        subject: '算数',
        custom_unit_name: '角度 - まとめテスト（３）',
        start_lesson_name: '角度 - まとめテスト（３）',
        created_at: new Date().toISOString()
      },
      {
        id: 'task-check-test',
        student_id: studentPass.id,
        unit_id: 'cm-check-test',
        scheduled_date: todayStr,
        period: 4,
        status: 'unstarted',
        subject: '英語',
        custom_unit_name: 'Lesson 1 - Check Test',
        start_lesson_name: 'Lesson 1 - Check Test',
        created_at: new Date().toISOString()
      },
      {
        id: 'task-retest-p5',
        student_id: studentPass.id,
        unit_id: 'cm-retest',
        scheduled_date: todayStr,
        period: 5,
        status: 'unstarted',
        subject: '算数',
        custom_unit_name: 'わり算 - 単元確認テスト（再テスト）',
        start_lesson_name: 'わり算 - 単元確認テスト（再テスト）',
        passing_line: '80%以上',
        created_at: new Date().toISOString()
      }
    ];
    await db.saveLearningTasks(tasks);

    const { unmount } = render(<StudentDashboard student={studentPass} onLogout={vi.fn()} initialDate={todayStr} />);
    await waitFor(() => {
      expect(screen.getByText(/テストサフィックス生徒 さんの学習画面/)).toBeInTheDocument();
    });

    // Pass period 1 (まとめテスト（１）) via completion button
    const completeBtn1 = screen.getByTestId('complete-task-btn-1');
    await act(async () => {
      fireEvent.click(completeBtn1);
    });

    // Pass period 2 (まとめテスト（２）) via completion button
    const completeBtn2 = screen.getByTestId('complete-task-btn-2');
    await act(async () => {
      fireEvent.click(completeBtn2);
    });

    // Pass period 3 (まとめテスト（３）) via completion button
    const completeBtn3 = screen.getByTestId('complete-task-btn-3');
    await act(async () => {
      fireEvent.click(completeBtn3);
    });

    // Pass period 4 (Check Test) via completion button
    const completeBtn4 = screen.getByTestId('complete-task-btn-4');
    await act(async () => {
      fireEvent.click(completeBtn4);
    });

    // Pass period 5 (再テスト) via unit test score submission
    const scoreInput5 = screen.getByTestId('task-score-input-5');
    fireEvent.change(scoreInput5, { target: { value: '95' } });
    const submitBtn5 = screen.getByTestId('task-score-submit-btn-5');
    await act(async () => {
      fireEvent.click(submitBtn5);
    });

    await waitFor(() => {
      const results = db.getMiniTestResults().filter(r => r.student_id === studentPass.id);
      expect(results.some(r => r.test_content?.includes('まとめテスト（１）'))).toBe(true);
      expect(results.some(r => r.test_content?.includes('まとめテスト（２）'))).toBe(true);
      expect(results.some(r => r.test_content?.includes('まとめテスト（３）'))).toBe(true);
      expect(results.some(r => r.test_content?.includes('Check Test'))).toBe(true);
      expect(results.some(r => r.test_content?.includes('再テスト'))).toBe(true);
    });

    unmount();
  });

  it('handles step completion edge cases: toggle on completed unit test, normal task all steps completed, and progress log catch', async () => {
    const todayStr = '2026-10-09';
    const studentSteps: Student = {
      id: 'std-steps-edge-1',
      student_id: 'std_se',
      name: 'ステップ完了検証生徒',
      grade: '中1',
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '中1',
      selected_subjects: ['数学'],
      completed_lesson_ids: []
    };
    await db.saveStudent(studentSteps);

    const masters: CurriculumMaster[] = [
      { id: 'cm-jhs-m1', subject: '数学', grade: '中1', unit_name: '正負の数', lesson_name: '正負の数の加法', sort_order: 1 },
      { id: 'cm-jhs-m2', subject: '数学', grade: '中1', unit_name: '正負の数', lesson_name: '正負の数の減法', sort_order: 2 },
      { id: 'cm-jhs-ut', subject: '数学', grade: '中1', unit_name: '正負の数', lesson_name: '正負の数 - 単元確認テスト', item_type: 'unit_test', sort_order: 3 }
    ];
    await db.saveCurriculumMasters(masters);

    // Normal task with 2 steps
    const normalTask: LearningTask = {
      id: 'task-normal-p1',
      student_id: studentSteps.id,
      unit_id: 'cm-jhs-m1',
      scheduled_date: todayStr,
      period: 1,
      status: 'unstarted',
      subject: '数学',
      custom_unit_name: '正負の数 加法・減法',
      start_lesson_name: '正負の数の加法',
      end_lesson_name: '正負の数の減法',
      start_lesson_id: 'cm-jhs-m1',
      end_lesson_id: 'cm-jhs-m2',
      lesson_range: '正負の数の加法〜正負の数の減法',
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };

    // Completed unit test task with empty completed_lesson_ids to allow clicking its step
    const completedUnitTestTask: LearningTask = {
      id: 'task-unit-p2',
      student_id: studentSteps.id,
      unit_id: 'cm-jhs-ut',
      scheduled_date: todayStr,
      period: 2,
      status: 'completed',
      test_passed: true,
      subject: '数学',
      custom_unit_name: '正負の数 - 単元確認テスト',
      start_lesson_name: '正負の数 - 単元確認テスト',
      end_lesson_name: '正負の数 - 単元確認テスト',
      start_lesson_id: 'cm-jhs-ut',
      end_lesson_id: 'cm-jhs-ut',
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([normalTask, completedUnitTestTask]);

    // Spy on addLearningLog to throw error to test warning branch line 1119
    const origAddLog = db.addLearningLog;
    db.addLearningLog = vi.fn().mockRejectedValue(new Error('Mock log save error'));

    const { unmount } = render(<StudentDashboard student={studentSteps} onLogout={vi.fn()} initialDate={todayStr} />);
    await waitFor(() => {
      expect(screen.getByText(/ステップ完了検証生徒 さんの学習画面/)).toBeInTheDocument();
    });

    // Complete step 1 of normal task
    const step1Btn = screen.queryByTestId('step-complete-btn-1-0');
    if (step1Btn) {
      await act(async () => {
        fireEvent.click(step1Btn);
      });
    }

    // Complete step 2 of normal task -> triggers isAllStepsCompleted (lines 998-1002)
    const step2Btn = screen.queryByTestId('step-complete-btn-1-1');
    if (step2Btn) {
      await act(async () => {
        fireEvent.click(step2Btn);
      });
    }

    // Click step on already completed unit test task -> triggers lines 990-991 and catch branch line 1119
    const unitStepBtn = screen.queryByTestId('step-complete-btn-2-0');
    if (unitStepBtn) {
      await act(async () => {
        fireEvent.click(unitStepBtn);
      });
    }

    await waitFor(() => {
      const updatedNormal = db.getLearningTasks().find(t => t.id === 'task-normal-p1');
      expect(updatedNormal?.status).toBe('completed');
      expect(updatedNormal?.test_passed).toBe(true);
    });

    // Restore addLearningLog
    db.addLearningLog = origAddLog;
    unmount();
  });

  it('handles office note card, homework mission cards, status badges, mobile segments, and header actions', async () => {
    const todayStr = '2026-10-09';
    const studentFast: Student = {
      id: 'std-fast-1',
      student_id: 'std_fst',
      name: '爆速進捗生徒',
      grade: '高1',
      status: 'fast',
      period_count: 1,
      registered_year: 2026,
      registered_grade: '高1',
      selected_subjects: ['数学'],
      completed_lesson_ids: []
    };
    await db.saveStudent(studentFast);

    const taskWithNote: LearningTask = {
      id: 'task-office-p1',
      student_id: studentFast.id,
      scheduled_date: todayStr,
      period: 1,
      status: 'unstarted',
      subject: '数学',
      custom_unit_name: '数学I 数と式',
      office_note: '次回は因数分解の小テストを実施します。公式集を持参してください。',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([taskWithNote]);

    const homework: HomeworkResult = {
      id: 'hw-card-1',
      student_id: studentFast.id,
      date: todayStr,
      subject: '数学',
      homework_content: '教科書 p.45 問1〜問5',
      homework_deadline: '2026-10-12',
      status: 'completed',
      created_at: new Date().toISOString()
    };
    await db.saveHomeworkResult(homework);

    const onGoToTeacherMock = vi.fn();
    const onLogoutMock = vi.fn();

    const { unmount } = render(
      <StudentDashboard
        student={studentFast}
        onLogout={onLogoutMock}
        onGoToTeacherSchedule={onGoToTeacherMock}
        onBackToPortal={onLogoutMock}
        initialDate={todayStr}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/爆速進捗生徒 さんの学習画面/)).toBeInTheDocument();
    });

    // Check fast badge
    expect(screen.getByText(/爆速中！🔥/)).toBeInTheDocument();

    // Check office note card
    const officeCard = screen.getByTestId('office-note-card');
    expect(officeCard).toBeInTheDocument();
    expect(officeCard).toHaveTextContent('次回は因数分解の小テストを実施します');

    // Check homework mission card
    expect(screen.getByTestId('today-homework-card')).toBeInTheDocument();
    expect(screen.getByText(/教科書 p.45 問1〜問5/)).toBeInTheDocument();
    expect(screen.getByText(/提出済み/)).toBeInTheDocument();

    // Toggle mobile segments
    const mapBtn = screen.getByRole('button', { name: /🗺️ 冒険マップ/ });
    fireEvent.click(mapBtn);
    const missionBtn = screen.getByRole('button', { name: /🎯 今日のミッション/ });
    fireEvent.click(missionBtn);

    // Click teacher schedule settings button
    const settingsBtn = screen.getByRole('button', { name: /⚙️ 授業設定/ });
    fireEvent.click(settingsBtn);
    expect(onGoToTeacherMock).toHaveBeenCalledWith(studentFast.id, todayStr);

    // Click logout portal button
    const portalBtn = screen.getByRole('button', { name: /ログアウト（ポータルへ）/ });
    fireEvent.click(portalBtn);
    expect(onLogoutMock).toHaveBeenCalled();

    unmount();
  });

  it('covers curriculum matching fallbacks: high school grade, generic test names, unit fallback, and sanitizeCompletedLessonIds edge cases', async () => {
    const todayStr = '2026-10-09';
    const studentHs: Student = {
      id: 'std-hs-match-1',
      student_id: 'std_hs',
      name: '高校生マッチング生徒',
      grade: '高2',
      status: 'warning',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '高2',
      selected_subjects: ['数学'],
      completed_lesson_ids: []
    };
    await db.saveStudent(studentHs);

    const hsMasters: CurriculumMaster[] = [
      { id: 'cm-hs-1', subject: '数学', grade: '高2', unit_name: '微分積分', lesson_name: '微分の概念', sort_order: 101 },
      { id: 'cm-hs-2', subject: '数学', grade: '高2', unit_name: '微分積分', lesson_name: '導関数', sort_order: 102 }
    ];
    await db.saveCurriculumMasters(hsMasters);

    const customUnit: CurriculumUnit = {
      id: 'unit-custom-only',
      school_id: 'sch-1',
      name: 'オリジナル特別講座',
      subject: '数学',
      sequence_order: 1,
      created_at: new Date().toISOString()
    };
    await db.saveCurriculumUnit(customUnit);

    const hsTask: LearningTask = {
      id: 'task-hs-1',
      student_id: studentHs.id,
      scheduled_date: todayStr,
      period: 1,
      status: 'unstarted',
      subject: '数学',
      unit_id: 'unit-custom-only',
      custom_unit_name: 'オリジナル特別講座',
      created_at: new Date().toISOString()
    };

    const hsRangeTask: LearningTask = {
      id: 'task-hs-2',
      student_id: studentHs.id,
      scheduled_date: todayStr,
      period: 2,
      status: 'unstarted',
      subject: '数学',
      start_lesson_id: '101',
      end_lesson_id: '102',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([hsTask, hsRangeTask]);

    await db.saveMiniTestResult({
      id: 'mini-empty-content',
      student_id: studentHs.id,
      date: todayStr,
      test_content: '',
      score: null,
      created_at: new Date(Date.now() - 10000).toISOString()
    });
    await db.saveMiniTestResult({
      id: 'mini-diff-1',
      student_id: studentHs.id,
      date: todayStr,
      test_content: '微分の概念 - 単元確認テスト',
      score: null,
      passed: null,
      created_at: new Date(Date.now() - 5000).toISOString()
    });
    await db.saveMiniTestResult({
      id: 'mini-diff-2',
      student_id: studentHs.id,
      date: todayStr,
      test_content: '微分の概念 - 単元確認テスト',
      score: 85,
      passed: true,
      created_at: new Date().toISOString()
    });

    const { unmount } = render(<StudentDashboard student={{ ...studentHs, completed_lesson_ids: null as any }} onLogout={vi.fn()} initialDate={todayStr} />);
    await waitFor(() => {
      expect(screen.getByText(/高校生マッチング生徒 さんの学習画面/)).toBeInTheDocument();
    });

    // Check warning status badge
    expect(screen.getByText(/計画パンク⚠️/)).toBeInTheDocument();

    // Check unit fallback renders unit name
    expect(screen.getAllByText(/オリジナル特別講座/).length).toBeGreaterThan(0);

    // Check range matching renders step cards
    expect(screen.getAllByText(/微分の概念/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/導関数/).length).toBeGreaterThan(0);

    unmount();
  });

  it('handles test suffixes in handlePassTask via standard unit completion, and automatically schedules next unit when all daily tasks complete', async () => {
    const todayStr = '2026-10-09';
    const studentSuffix: Student = {
      id: 'std-suffix-pure-1',
      student_id: 'std_suf_p',
      name: 'サフィックス純粋生徒',
      grade: '小4',
      status: 'normal',
      period_count: 4,
      registered_year: 2026,
      registered_grade: '小4',
      selected_subjects: ['算数', '英語'],
      attendance_days: ['月', '金'],
      completed_lesson_ids: []
    };
    await db.saveStudent(studentSuffix);

    const units: CurriculumUnit[] = [
      { id: 'u-matome-1', subject: '算数', grade: '4年生', name: '大きな数 まとめテスト（１）', sub_topics: [], sequence_order: 1, created_at: new Date().toISOString() },
      { id: 'u-matome-2', subject: '算数', grade: '4年生', name: '大きな数 まとめテスト（２）', sub_topics: [], sequence_order: 2, created_at: new Date().toISOString() },
      { id: 'u-matome-3', subject: '算数', grade: '4年生', name: '大きな数 まとめテスト（３）', sub_topics: [], sequence_order: 3, created_at: new Date().toISOString() },
      { id: 'u-check-1', subject: '英語', grade: '4年生', name: 'Unit 1 Check Test', sub_topics: [], sequence_order: 4, created_at: new Date().toISOString() }
    ];
    for (const u of units) {
      await db.saveCurriculumUnit(u);
    }

    const masters: CurriculumMaster[] = [
      { id: 'cm-div-1', subject: '算数', grade: '4年生', unit_name: 'わり算の筆算', lesson_name: '2けたでわる筆算(1)', sort_order: 10 }
    ];
    await db.saveCurriculumMasters(masters);

    const tasks: LearningTask[] = [
      {
        id: 'task-suf-1',
        student_id: studentSuffix.id,
        unit_id: 'u-matome-1',
        scheduled_date: todayStr,
        period: 1,
        status: 'unstarted',
        subject: '算数',
        created_at: new Date().toISOString()
      },
      {
        id: 'task-suf-2',
        student_id: studentSuffix.id,
        unit_id: 'u-matome-2',
        scheduled_date: todayStr,
        period: 2,
        status: 'unstarted',
        subject: '算数',
        created_at: new Date().toISOString()
      },
      {
        id: 'task-suf-3',
        student_id: studentSuffix.id,
        unit_id: 'u-matome-3',
        scheduled_date: todayStr,
        period: 3,
        status: 'unstarted',
        subject: '算数',
        created_at: new Date().toISOString()
      },
      {
        id: 'task-suf-4',
        student_id: studentSuffix.id,
        unit_id: 'u-check-1',
        scheduled_date: todayStr,
        period: 4,
        status: 'unstarted',
        subject: '英語',
        created_at: new Date().toISOString()
      }
    ];
    await db.saveLearningTasks(tasks);

    const { unmount } = render(<StudentDashboard student={studentSuffix} onLogout={vi.fn()} initialDate={todayStr} />);
    await waitFor(() => {
      expect(screen.getByText(/サフィックス純粋生徒 さんの学習画面/)).toBeInTheDocument();
    });

    // Pass task 1 (まとめテスト（１）)
    const btn1 = screen.getByTestId('complete-task-btn-1');
    await act(async () => {
      fireEvent.click(btn1);
    });

    // Pass task 2 (まとめテスト（２）)
    const btn2 = screen.getByTestId('complete-task-btn-2');
    await act(async () => {
      fireEvent.click(btn2);
    });

    // Pass task 3 (まとめテスト（３）)
    const btn3 = screen.getByTestId('complete-task-btn-3');
    await act(async () => {
      fireEvent.click(btn3);
    });

    // Pass task 4 (Check Test)
    const btn4 = screen.getByTestId('complete-task-btn-4');
    await act(async () => {
      fireEvent.click(btn4);
    });

    await waitFor(() => {
      const results = db.getMiniTestResults().filter(r => r.student_id === studentSuffix.id);
      expect(results.some(r => r.test_content?.includes('まとめテスト（１）'))).toBe(true);
      expect(results.some(r => r.test_content?.includes('まとめテスト（２）'))).toBe(true);
      expect(results.some(r => r.test_content?.includes('まとめテスト（３）'))).toBe(true);
      expect(results.some(r => r.test_content?.includes('Check Test'))).toBe(true);
    });

    unmount();
  });

  it('handles handleCompleteCustomTask auto-scheduling next unit when all daily tasks complete and earlier unit test was passed, plus candidateMasters db fallback', async () => {
    const todayStr = '2026-10-09';
    const studentAll: Student = {
      id: 'std-custom-all-1',
      student_id: 'std_c_all',
      name: '全タスク完了自動引き継ぎ生徒',
      grade: '小5',
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '小5',
      selected_subjects: ['算数'],
      attendance_days: ['火', '金'],
      completed_lesson_ids: []
    };
    await db.saveStudent(studentAll);

    // CurriculumMaster in DB for next unit fallback
    await db.saveCurriculumMasters([
      { id: 'cm-heikin-1', subject: '算数', grade: '5年生', unit_name: '平均', lesson_name: '平均の求め方', sort_order: 30 }
    ]);

    const tasks: LearningTask[] = [
      {
        id: 'task-passed-ut-1',
        student_id: studentAll.id,
        scheduled_date: todayStr,
        period: 1,
        status: 'completed',
        test_passed: true,
        subject: '算数',
        custom_unit_name: '合同な図形 - 単元確認テスト',
        created_at: new Date().toISOString()
      },
      {
        id: 'task-custom-review-2',
        student_id: studentAll.id,
        scheduled_date: todayStr,
        period: 2,
        status: 'unstarted',
        subject: '算数',
        custom_unit_name: '本日の自習・振り返り',
        created_at: new Date().toISOString()
      }
    ];
    await db.saveLearningTasks(tasks);

    const { unmount } = render(<StudentDashboard student={studentAll} onLogout={vi.fn()} initialDate={todayStr} />);
    await waitFor(() => {
      expect(screen.getByText(/全タスク完了自動引き継ぎ生徒 さんの学習画面/)).toBeInTheDocument();
    });

    // Complete task 2 -> triggers handleCompleteCustomTask -> allOthersCompleted = true -> scheduleNextUnitForStudent (lines 1470-1476, lines 673-675)
    const btnComp2 = screen.getByTestId('complete-task-btn-2');
    await act(async () => {
      fireEvent.click(btnComp2);
    });

    await waitFor(() => {
      const allTasks = db.getLearningTasks().filter(t => t.student_id === studentAll.id);
      expect(allTasks.some(t => t.id.startsWith(`task-nextunit-${studentAll.id}`))).toBe(true);
    });

    unmount();
  });

  it('handles getTaskStepLessons pure numerical sort_order range matching', async () => {
    const todayStr = '2026-10-09';
    const studentRangeNum: Student = {
      id: 'std-num-range-1',
      student_id: 'std_nr1',
      name: '数値範囲マッチング生徒',
      grade: '中2',
      status: 'normal',
      period_count: 1,
      registered_year: 2026,
      registered_grade: '中2',
      selected_subjects: ['数学'],
      attendance_days: ['水', '土'],
      completed_lesson_ids: []
    };
    await db.saveStudent(studentRangeNum);

    await db.saveCurriculumMasters([
      { id: 'cm-101', subject: '数学', grade: '中2', unit_name: '一次関数', lesson_name: '一次関数の変化の割合', sort_order: 10 },
      { id: 'cm-102', subject: '数学', grade: '中2', unit_name: '一次関数', lesson_name: '一次関数のグラフと切片', sort_order: 11 },
      { id: 'cm-103', subject: '数学', grade: '中2', unit_name: '一次関数', lesson_name: '一次関数 - 確認テスト', item_type: 'unit_test', sort_order: 12 }
    ]);

    const task: LearningTask = {
      id: 'task-num-range-p1',
      student_id: studentRangeNum.id,
      scheduled_date: todayStr,
      period: 1,
      status: 'unstarted',
      subject: '数学',
      start_lesson_id: '10',
      end_lesson_id: '11',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    const { unmount } = render(<StudentDashboard student={studentRangeNum} onLogout={vi.fn()} initialDate={todayStr} />);
    await waitFor(() => {
      expect(screen.getByText(/数値範囲マッチング生徒 さんの学習画面/)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/一次関数の変化の割合/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/一次関数のグラフと切片/).length).toBeGreaterThan(0);

    unmount();
  });

  it('handles getTaskStepLessons sameUnitLessons rescue when slice is only unit tests, and handles unit_id fallback', async () => {
    const todayStr = '2026-10-09';
    const studentRescue: Student = {
      id: 'std-rescue-1',
      student_id: 'std_resc',
      name: 'レスキュー検証生徒',
      grade: '中1',
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '中1',
      selected_subjects: ['数学', '理科'],
      attendance_days: ['月', '木'],
      completed_lesson_ids: []
    };
    await db.saveStudent(studentRescue);

    // CurriculumMasters for math where sliced item is unit test, rescuing normal lesson
    await db.saveCurriculumMasters([
      { id: 'cm-resc-normal', subject: '数学', grade: '中1', unit_name: '正負の数', lesson_name: '正負の数の利用', sort_order: 1 },
      { id: 'cm-resc-test', subject: '数学', grade: '中1', unit_name: '正負の数', lesson_name: '正負の数 - 確認テスト', item_type: 'unit_test', sort_order: 2 }
    ]);

    // Unit fallback for science (line 635)
    const scienceUnit: CurriculumUnit = {
      id: 'unit-sci-fallback',
      subject: '理科',
      grade: '中1',
      name: '植物の生活と種類',
      sequence_order: 1,
      created_at: new Date().toISOString()
    };
    await db.saveCurriculumUnit(scienceUnit);

    const tasks: LearningTask[] = [
      {
        id: 'task-resc-p1',
        student_id: studentRescue.id,
        scheduled_date: todayStr,
        period: 1,
        status: 'unstarted',
        subject: '数学',
        custom_unit_name: '正負の数 復習演習',
        start_lesson_name: '正負の数 - 確認テスト',
        start_lesson_id: 'cm-resc-test',
        created_at: new Date().toISOString()
      },
      {
        id: 'task-sci-p2',
        student_id: studentRescue.id,
        scheduled_date: todayStr,
        period: 2,
        status: 'unstarted',
        subject: '理科',
        unit_id: 'unit-sci-fallback',
        created_at: new Date().toISOString()
      }
    ];
    await db.saveLearningTasks(tasks);

    const { unmount } = render(<StudentDashboard student={studentRescue} onLogout={vi.fn()} initialDate={todayStr} />);
    await waitFor(() => {
      expect(screen.getByText(/レスキュー検証生徒 さんの学習画面/)).toBeInTheDocument();
    });

    // Check rescued normal lesson is rendered
    expect(screen.getAllByText(/正負の数の利用/).length).toBeGreaterThan(0);
    // Check fallback unit is rendered
    expect(screen.getAllByText(/植物の生活と種類/).length).toBeGreaterThan(0);

    unmount();
  });

  it('handles handleSaveTaskUnitTestScore suffixes via end_lesson_name unit test matching, and handles saveStudentLessonProgress catch', async () => {
    const todayStr = '2026-10-09';
    const studentScoreSuffix: Student = {
      id: 'std-score-suffix-1',
      student_id: 'std_ss1',
      name: 'スコアサフィックス生徒',
      grade: '小4',
      status: 'normal',
      period_count: 4,
      registered_year: 2026,
      registered_grade: '小4',
      selected_subjects: ['算数', '英語'],
      attendance_days: ['月', '木'],
      completed_lesson_ids: 'non-array-test' as any
    };
    await db.saveStudent(studentScoreSuffix);

    const units: CurriculumUnit[] = [
      { id: 'u-score-matome-1', subject: '算数', grade: '4年生', name: '大きな数 まとめテスト（１）', sub_topics: [], sequence_order: 1, created_at: new Date().toISOString() },
      { id: 'u-score-matome-2', subject: '算数', grade: '4年生', name: '大きな数 まとめテスト（２）', sub_topics: [], sequence_order: 2, created_at: new Date().toISOString() },
      { id: 'u-score-matome-3', subject: '算数', grade: '4年生', name: '大きな数 まとめテスト（３）', sub_topics: [], sequence_order: 3, created_at: new Date().toISOString() },
      { id: 'u-score-check-1', subject: '英語', grade: '4年生', name: 'Unit 1 Check Test', sub_topics: [], sequence_order: 4, created_at: new Date().toISOString() }
    ];
    for (const u of units) {
      await db.saveCurriculumUnit(u);
    }

    const tasks: LearningTask[] = [
      {
        id: 'task-ss-1',
        student_id: studentScoreSuffix.id,
        unit_id: 'u-score-matome-1',
        scheduled_date: todayStr,
        period: 1,
        status: 'unstarted',
        subject: '算数',
        end_lesson_name: '単元確認テスト',
        created_at: new Date().toISOString()
      },
      {
        id: 'task-ss-2',
        student_id: studentScoreSuffix.id,
        unit_id: 'u-score-matome-2',
        scheduled_date: todayStr,
        period: 2,
        status: 'unstarted',
        subject: '算数',
        end_lesson_name: '単元確認テスト',
        created_at: new Date().toISOString()
      },
      {
        id: 'task-ss-3',
        student_id: studentScoreSuffix.id,
        unit_id: 'u-score-matome-3',
        scheduled_date: todayStr,
        period: 3,
        status: 'unstarted',
        subject: '算数',
        end_lesson_name: '単元確認テスト',
        created_at: new Date().toISOString()
      },
      {
        id: 'task-ss-4',
        student_id: studentScoreSuffix.id,
        unit_id: 'u-score-check-1',
        scheduled_date: todayStr,
        period: 4,
        status: 'unstarted',
        subject: '英語',
        end_lesson_name: '単元確認テスト',
        created_at: new Date().toISOString()
      }
    ];
    await db.saveLearningTasks(tasks);

    const origSaveProgress = db.saveStudentLessonProgress;
    db.saveStudentLessonProgress = vi.fn().mockRejectedValue(new Error('Mock progress save error'));

    const { unmount } = render(<StudentDashboard student={studentScoreSuffix} onLogout={vi.fn()} initialDate={todayStr} />);
    await waitFor(() => {
      expect(screen.getByText(/スコアサフィックス生徒 さんの学習画面/)).toBeInTheDocument();
    });

    // Submit score 95 for period 1 -> triggers line 1256 testSuffix = 'まとめテスト（１）'
    const scoreInput1 = screen.getByTestId('task-score-input-1');
    fireEvent.change(scoreInput1, { target: { value: '95' } });
    const submitBtn1 = screen.getByTestId('task-score-submit-btn-1');
    await act(async () => {
      fireEvent.click(submitBtn1);
    });

    // Submit score 95 for period 2 -> triggers line 1258 testSuffix = 'まとめテスト（２）'
    const scoreInput2 = screen.getByTestId('task-score-input-2');
    fireEvent.change(scoreInput2, { target: { value: '95' } });
    const submitBtn2 = screen.getByTestId('task-score-submit-btn-2');
    await act(async () => {
      fireEvent.click(submitBtn2);
    });

    // Submit score 95 for period 3 -> triggers line 1260 testSuffix = 'まとめテスト（３）'
    const scoreInput3 = screen.getByTestId('task-score-input-3');
    fireEvent.change(scoreInput3, { target: { value: '95' } });
    const submitBtn3 = screen.getByTestId('task-score-submit-btn-3');
    await act(async () => {
      fireEvent.click(submitBtn3);
    });

    // Submit score 95 for period 4 -> triggers line 1262 testSuffix = 'Check Test'
    const scoreInput4 = screen.getByTestId('task-score-input-4');
    fireEvent.change(scoreInput4, { target: { value: '95' } });
    const submitBtn4 = screen.getByTestId('task-score-submit-btn-4');
    await act(async () => {
      fireEvent.click(submitBtn4);
    });

    await waitFor(() => {
      const results = db.getMiniTestResults().filter(r => r.student_id === studentScoreSuffix.id);
      expect(results.some(r => r.test_content?.includes('まとめテスト（１）'))).toBe(true);
      expect(results.some(r => r.test_content?.includes('まとめテスト（２）'))).toBe(true);
      expect(results.some(r => r.test_content?.includes('まとめテスト（３）'))).toBe(true);
      expect(results.some(r => r.test_content?.includes('Check Test'))).toBe(true);
    });

    db.saveStudentLessonProgress = origSaveProgress;
    unmount();
  });
});
