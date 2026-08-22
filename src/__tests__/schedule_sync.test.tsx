import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { db, Student, LearningTask, MiniTestResult, HomeworkResult } from '../lib/db';
import StudentDashboard from '../components/StudentDashboard';

describe('Schedule and Timetable Synchronization Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('db.saveLearningTasks and db.fetchLearningTasks sync properly with localStorage and memory', async () => {
    const studentId = 'test-st-1';
    const date = '2026-08-18';
    const tasks: LearningTask[] = [
      {
        id: 't-1',
        student_id: studentId,
        unit_id: 'u-1',
        scheduled_date: date,
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '数学',
        lesson_range: '正負の数 第1講 〜 第3講',
        start_lesson_name: '正負の数 第1講',
        end_lesson_name: '正負の数 第3講',
        office_note: '計算ドリルP12-14も実施すること',
        created_at: new Date().toISOString()
      },
      {
        id: 't-2',
        student_id: studentId,
        unit_id: 'u-2',
        scheduled_date: date,
        period: 2,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '英語',
        custom_unit_name: '一般動詞の過去形 まとめ',
        office_note: '単語テスト準備',
        created_at: new Date().toISOString()
      }
    ];

    await db.saveLearningTasks(tasks);

    const fetched = await db.fetchLearningTasks(studentId, date);
    expect(fetched.length).toBe(2);
    expect(fetched[0].lesson_range).toBe('正負の数 第1講 〜 第3講');
    expect(fetched[0].office_note).toBe('計算ドリルP12-14も実施すること');
    expect(fetched[1].custom_unit_name).toBe('一般動詞の過去形 まとめ');
  });

  test('StudentDashboard displays teacher scheduled tasks on specified date', async () => {
    const student: Student = {
      id: 'st-schedule-test',
      student_id: 'ST0099',
      name: 'スケジュール同期確認生徒',
      grade: '中2',
      status: 'normal',
      branch_id: 'b-1',
      created_at: new Date().toISOString()
    };
    db.saveStudent(student);

    const targetDate = '2026-08-18';
    const tasks: LearningTask[] = [
      {
        id: 'task-sync-1',
        student_id: student.id,
        unit_id: 'unit-math-1',
        scheduled_date: targetDate,
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '数学',
        lesson_range: '連立方程式の解き方 第1講 〜 第2講',
        office_note: '途中式を丁寧にノートへ記入',
        created_at: new Date().toISOString()
      }
    ];
    await db.saveLearningTasks(tasks);

    const miniTest: MiniTestResult = {
      id: 'test-sync-1',
      student_id: student.id,
      date: targetDate,
      test_content: '連立方程式 計算小テスト (全10問)',
      score: null,
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(miniTest);

    const homework: HomeworkResult = {
      id: 'hw-sync-1',
      student_id: student.id,
      date: targetDate,
      homework_content: 'ワークブック P45〜P47',
      homework_deadline: '2026-08-20',
      status: 'incomplete',
      created_at: new Date().toISOString()
    };
    await db.saveHomeworkResult(homework);

    render(
      <StudentDashboard
        student={student}
        initialDate={targetDate}
      />
    );

    // Wait for data load
    await waitFor(() => {
      expect(screen.getAllByText('連立方程式の解き方 第1講 〜 第2講').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('数学').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/途中式を丁寧にノートへ記入/).length).toBeGreaterThan(0);
    expect(screen.getByText('連立方程式 計算小テスト (全10問)')).toBeInTheDocument();
    expect(screen.getByText('ワークブック P45〜P47')).toBeInTheDocument();
    expect(screen.getByText(/提出期限: 2026-08-20/)).toBeInTheDocument();
  });

  test('StudentDashboard auto-detects latest schedule date if today has no tasks', async () => {
    const student: Student = {
      id: 'st-autodate-test',
      student_id: 'ST0100',
      name: '自動日付検出生徒',
      grade: '中3',
      status: 'normal',
      branch_id: 'b-1',
      created_at: new Date().toISOString()
    };
    db.saveStudent(student);

    // Save schedule on a non-today date
    const futureDate = '2026-09-01';
    const tasks: LearningTask[] = [
      {
        id: 'task-future-1',
        student_id: student.id,
        unit_id: 'unit-eng-1',
        scheduled_date: futureDate,
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '英語',
        custom_unit_name: '関係代名詞 主格',
        office_note: '例文暗記テスト実施予定',
        created_at: new Date().toISOString()
      }
    ];
    await db.saveLearningTasks(tasks);

    render(
      <StudentDashboard
        student={student}
      />
    );

    // Should automatically navigate or find the closest schedule date
    await waitFor(() => {
      expect(screen.getAllByText('関係代名詞 主格').length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/本日はコマ割りがありません。直近の通塾予定日/)).toBeInTheDocument();
    expect(screen.getAllByText(/例文暗記テスト実施予定/).length).toBeGreaterThan(0);
  });

  test('Date picker switching works dynamically in StudentDashboard', async () => {
    const student: Student = {
      id: 'st-picker-test',
      student_id: 'ST0101',
      name: '日付切替確認生徒',
      grade: '中1',
      status: 'normal',
      branch_id: 'b-1',
      created_at: new Date().toISOString()
    };
    db.saveStudent(student);

    const dateA = '2026-08-18';
    const dateB = '2026-08-20';

    await db.saveLearningTasks([
      {
        id: 'task-a',
        student_id: student.id,
        unit_id: 'u-a',
        scheduled_date: dateA,
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '理科',
        custom_unit_name: '光の反射と屈折',
        created_at: new Date().toISOString()
      },
      {
        id: 'task-b',
        student_id: student.id,
        unit_id: 'u-b',
        scheduled_date: dateB,
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '社会',
        custom_unit_name: '古代文明の起こり',
        created_at: new Date().toISOString()
      }
    ]);

    render(
      <StudentDashboard
        student={student}
        initialDate={dateA}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('光の反射と屈折').length).toBeGreaterThan(0);
    });

    // Switch date with date picker
    const datePicker = screen.getByTestId('student-date-picker');
    fireEvent.change(datePicker, { target: { value: dateB } });

    await waitFor(() => {
      expect(screen.getAllByText('古代文明の起こり').length).toBeGreaterThan(0);
    });
  });

  test('Step complete button (🎯 完了にする) updates step status, count 0/2 -> 1/2 -> 2/2, promotes task, and turns Sugoroku green', async () => {
    const student: Student = {
      id: 'st-step-test',
      student_id: 'ST0102',
      name: '進捗ステップ検証生徒',
      grade: '中3',
      status: 'normal',
      branch_id: 'b-1',
      selected_subjects: ['数学', '英語'],
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    db.saveStudent(student);

    const testDate = '2026-08-18';
    const multiStepTask: LearningTask = {
      id: 'task-step-test-1',
      student_id: student.id,
      unit_id: 'u-1',
      scheduled_date: testDate,
      period: 1,
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      subject: '数学',
      start_lesson_id: 'cm-jhs-1',
      start_lesson_name: '多項式の乗法と公式①',
      end_lesson_id: 'cm-jhs-2',
      end_lesson_name: '乗法公式②③④と展開の工夫',
      lesson_range: '多項式の乗法と公式① 〜 乗法公式②③④と展開の工夫',
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([multiStepTask]);

    render(
      <StudentDashboard
        student={student}
        initialDate={testDate}
      />
    );

    // Initial state: 0 / 2 完了
    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('0 / 2 完了');
    });

    const step1Btn = screen.getByTestId('step-complete-btn-1-0');
    const step2Btn = screen.getByTestId('step-complete-btn-1-1');
    expect(step1Btn).toBeInTheDocument();
    expect(step2Btn).toBeInTheDocument();

    // Sugoroku node cm-jhs-1 should initially not be completed
    const videoNode1 = screen.getByTestId('sugoroku-video-cm-jhs-1');
    expect(videoNode1.className).not.toContain('stepCompleted');

    // 1. Click STEP 1 Complete button
    fireEvent.click(step1Btn);

    // Wait for STEP 1 to be done
    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('1 / 2 完了');
      expect(screen.getByTestId('step-done-badge-1-0')).toBeInTheDocument();
    });

    // Sugoroku node cm-jhs-1 should now be green (stepCompleted)
    await waitFor(() => {
      const updatedVideoNode1 = screen.getByTestId('sugoroku-video-cm-jhs-1');
      expect(updatedVideoNode1.className).toContain('stepCompleted');
    });

    // Task is not fully completed yet
    expect(screen.queryByTestId('task-completed-badge-1')).toBeNull();

    // Check DB student lesson progress
    const progressList1 = db.getStudentLessonProgressList(student.id);
    expect(progressList1.some(p => p.lesson_id === 'cm-jhs-1' && p.status === 'completed')).toBe(true);

    // 2. Click STEP 2 Complete button
    const activeStep2Btn = screen.getByTestId('step-complete-btn-1-1');
    fireEvent.click(activeStep2Btn);

    // Wait for STEP 2 to be done -> 2 / 2 完了
    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('2 / 2 完了');
      expect(screen.getByTestId('step-done-badge-1-1')).toBeInTheDocument();
      expect(screen.getByTestId('task-completed-badge-1')).toHaveTextContent('合格完了！');
    });

    // Sugoroku node cm-jhs-2 should also be green (stepCompleted)
    await waitFor(() => {
      const videoNode2 = screen.getByTestId('sugoroku-video-cm-jhs-2');
      expect(videoNode2.className).toContain('stepCompleted');
    });

    const progressList2 = db.getStudentLessonProgressList(student.id);
    expect(progressList2.some(p => p.lesson_id === 'cm-jhs-2' && p.status === 'completed')).toBe(true);
  });

  test('Batch completion button completes all steps and marks Sugoroku green', async () => {
    const student: Student = {
      id: 'st-batch-test',
      student_id: 'ST0103',
      name: '一括完了検証生徒',
      grade: '中3',
      status: 'normal',
      branch_id: 'b-1',
      selected_subjects: ['数学'],
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    db.saveStudent(student);

    const testDate = '2026-08-18';
    const multiStepTask: LearningTask = {
      id: 'task-batch-test-1',
      student_id: student.id,
      unit_id: 'u-1',
      scheduled_date: testDate,
      period: 1,
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      subject: '数学',
      start_lesson_id: 'cm-jhs-1',
      start_lesson_name: '多項式の乗法と公式①',
      end_lesson_id: 'cm-jhs-2',
      end_lesson_name: '乗法公式②③④と展開の工夫',
      lesson_range: '多項式の乗法と公式① 〜 乗法公式②③④と展開の工夫',
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([multiStepTask]);

    render(
      <StudentDashboard
        student={student}
        initialDate={testDate}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('0 / 2 完了');
    });

    const batchBtn = screen.getByTestId('complete-task-btn-1');
    expect(batchBtn).toHaveTextContent('このコマの全ステップを一括完了にする');
    fireEvent.click(batchBtn);

    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('2 / 2 完了');
      expect(screen.getByTestId('task-completed-badge-1')).toBeInTheDocument();
    });

    const videoNode1 = screen.getByTestId('sugoroku-video-cm-jhs-1');
    const videoNode2 = screen.getByTestId('sugoroku-video-cm-jhs-2');
    expect(videoNode1.className).toContain('stepCompleted');
    expect(videoNode2.className).toContain('stepCompleted');
  });

  test('Optimistic UI instantly updates step status and handles server error gracefully', async () => {
    const student: Student = {
      id: 'st-opt-err-test',
      student_id: 'ST0104',
      name: '楽観的UI検証生徒',
      grade: '中3',
      status: 'normal',
      branch_id: 'b-1',
      selected_subjects: ['数学'],
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    db.saveStudent(student);

    const testDate = '2026-08-18';
    const singleStepTask: LearningTask = {
      id: 'task-opt-test-1',
      student_id: student.id,
      unit_id: 'u-1',
      scheduled_date: testDate,
      period: 1,
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      subject: '数学',
      start_lesson_id: 'cm-jhs-1',
      start_lesson_name: '多項式の乗法と公式①',
      end_lesson_id: 'cm-jhs-1',
      end_lesson_name: '多項式の乗法と公式①',
      lesson_range: '多項式の乗法と公式①',
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([singleStepTask]);

    // Mock saveStudentLessonProgress to throw error
    const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const origSave = db.saveStudentLessonProgress;
    db.saveStudentLessonProgress = vi.fn().mockRejectedValueOnce(new Error('Network Save Failure'));

    render(
      <StudentDashboard
        student={student}
        initialDate={testDate}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('0 / 1 完了');
    });

    const stepBtn = screen.getByTestId('step-complete-btn-1-0');
    fireEvent.click(stepBtn);

    // Optimistic UI updates immediately despite server error
    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('1 / 1 完了');
      expect(screen.getByTestId('step-done-badge-1-0')).toBeInTheDocument();
      expect(screen.getByTestId('task-completed-badge-1')).toHaveTextContent('合格完了！');
    });

    // Error was logged and toast was shown
    expect(spyError).toHaveBeenCalled();
    spyError.mockRestore();
    db.saveStudentLessonProgress = origSave;
  });

  test('Multi-step task expansion: 4-lesson range (e.g. cm-elem-1 to cm-elem-4) renders all 4 steps (0/4 completed) and individual/batch completion tracks completed_lesson_ids', async () => {
    const student: Student = {
      id: 'st-multi-step-elem',
      student_id: 'ST0105',
      name: '小学生算数4ステップ検証生徒',
      grade: '小5',
      status: 'normal',
      branch_id: 'b-1',
      selected_subjects: ['算数'],
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    db.saveStudent(student);

    const testDate = '2026-08-19';
    // Task with 4 steps from cm-elem-1 to cm-elem-4
    const fourStepTask: LearningTask = {
      id: 'task-4steps-1',
      student_id: student.id,
      unit_id: 'cm-elem-1',
      scheduled_date: testDate,
      period: 1,
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      subject: '算数',
      start_lesson_id: 'cm-elem-1',
      start_lesson_name: '小数と10倍・100倍・1/10',
      end_lesson_id: 'cm-elem-4',
      end_lesson_name: '小数÷整数の計算',
      lesson_range: '小数と10倍・100倍・1/10 〜 小数÷整数の計算',
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([fourStepTask]);

    render(
      <StudentDashboard
        student={student}
        initialDate={testDate}
      />
    );

    // Should display 0 / 4 完了
    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('0 / 4 完了');
    });

    // Check that all 4 step complete buttons exist
    expect(screen.getByTestId('step-complete-btn-1-0')).toBeInTheDocument();
    expect(screen.getByTestId('step-complete-btn-1-1')).toBeInTheDocument();
    expect(screen.getByTestId('step-complete-btn-1-2')).toBeInTheDocument();
    expect(screen.getByTestId('step-complete-btn-1-3')).toBeInTheDocument();

    // Click step 1
    fireEvent.click(screen.getByTestId('step-complete-btn-1-0'));
    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('1 / 4 完了');
      expect(screen.getByTestId('step-done-badge-1-0')).toBeInTheDocument();
    });

    // Click step 2
    fireEvent.click(screen.getByTestId('step-complete-btn-1-1'));
    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('2 / 4 完了');
      expect(screen.getByTestId('step-done-badge-1-1')).toBeInTheDocument();
    });

    // Click step 3
    fireEvent.click(screen.getByTestId('step-complete-btn-1-2'));
    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('3 / 4 完了');
      expect(screen.getByTestId('step-done-badge-1-2')).toBeInTheDocument();
    });

    // Click step 4
    fireEvent.click(screen.getByTestId('step-complete-btn-1-3'));
    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('4 / 4 完了');
      expect(screen.getByTestId('step-done-badge-1-3')).toBeInTheDocument();
      expect(screen.getByTestId('task-completed-badge-1')).toBeInTheDocument();
    });

    // Verify all 4 lesson IDs are registered in student's completed lessons
    const updatedStudent = db.getStudents().find(s => s.id === student.id);
    expect(updatedStudent?.completed_lesson_ids).toContain('cm-elem-1');
    expect(updatedStudent?.completed_lesson_ids).toContain('cm-elem-2');
    expect(updatedStudent?.completed_lesson_ids).toContain('cm-elem-3');
    expect(updatedStudent?.completed_lesson_ids).toContain('cm-elem-4');
  });

  test('Next uncompleted lesson (From) auto-presetting accurately finds next step after completed lessons', async () => {
    const { findNextUncompletedLessonForSubject, calculateLessonRangeForSlot } = await import('../lib/scheduler');

    const student: Student = {
      id: 'st-next-lesson-test',
      student_id: 'ST0106',
      name: '次回開始授業自動特定生徒',
      grade: '小1',
      status: 'normal',
      branch_id: 'b-1',
      selected_subjects: ['算数'],
      // Completed lessons 1 through 3
      completed_lesson_ids: ['cm-p1-m1', 'cm-p1-m2', 'cm-p1-m3'],
      created_at: new Date().toISOString()
    };
    db.saveStudent(student);

    const masters = db.getCurriculumMasters('算数');
    const nextLesson = findNextUncompletedLessonForSubject({
      student,
      subject: '算数',
      tasks: [],
      curriculumMasters: masters,
      curriculumUnits: []
    });

    // cm-p1-m1, cm-p1-m2, cm-p1-m3 are done, so next should be cm-p1-m4 (sort_order: 4)
    expect(nextLesson.lessonId).toBe('cm-p1-m4');
    expect(nextLesson.lessonName).toContain('のこりはいくつ');

    // calculateLessonRangeForSlot should automatically set start_lesson_id to cm-p1-m4
    const range = calculateLessonRangeForSlot({
      subject: '算数',
      student,
      tasks: [],
      curriculumMasters: masters,
      curriculumUnits: []
    });

    expect(range.start_lesson_id).toBe('cm-p1-m4');
    expect(range.start_lesson_name).toContain('のこりはいくつ');
  });

  test('STEP 7..10 range expansion, optimistic completion, timeline (📍 現在地) sync to STEP 11, and next session From auto-preset', async () => {
    const { findNextUncompletedLessonForSubject, calculateLessonRangeForSlot } = await import('../lib/scheduler');
    const TeacherDashboard = (await import('../components/TeacherDashboard')).default;

    const student: Student = {
      id: 'st-step-7-10-sync',
      student_id: 'ST0107',
      name: '小1たしざん進度同期生徒',
      grade: '小1',
      status: 'normal',
      branch_id: 'b-1',
      school_id: 'sch-1',
      selected_days: ['tuesday', 'friday'],
      default_slots: 2,
      selected_subjects: ['算数'],
      // Initially completed STEP 1 to 6
      completed_lesson_ids: ['cm-p1-m1', 'cm-p1-m2', 'cm-p1-m3', 'cm-p1-m4', 'cm-p2-m1', 'cm-p2-m2'],
      created_at: new Date().toISOString()
    };
    db.saveStudent(student);

    const targetDate = '2026-08-18';
    // Task covering STEP 7 through STEP 10 (cm-p2-m3 to cm-p3-m2)
    const task: LearningTask = {
      id: 'task-step-7-10',
      student_id: student.id,
      unit_id: 'cm-p2-m3',
      scheduled_date: targetDate,
      period: 1,
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      subject: '算数',
      start_lesson_id: 'cm-p2-m3',
      end_lesson_id: 'cm-p3-m2',
      start_lesson_name: 'かけ算の意味と九九（前半 2〜5の段）',
      end_lesson_name: 'あまりのあるわり算',
      lesson_range: 'かけ算の意味と九九（前半 2〜5の段） 〜 あまりのあるわり算',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    // 1. Render StudentDashboard and verify 4 steps (STEP 7, 8, 9, 10) are expanded
    const { unmount } = render(<StudentDashboard student={student} onBackToPortal={() => {}} initialDate={targetDate} />);

    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('0 / 4 完了');
    });

    // Complete STEP 7, 8, 9, 10 one by one
    fireEvent.click(screen.getByTestId('step-complete-btn-1-0'));
    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('1 / 4 完了');
    });

    fireEvent.click(screen.getByTestId('step-complete-btn-1-1'));
    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('2 / 4 完了');
    });

    fireEvent.click(screen.getByTestId('step-complete-btn-1-2'));
    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('3 / 4 完了');
    });

    fireEvent.click(screen.getByTestId('step-complete-btn-1-3'));
    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('4 / 4 完了');
      expect(screen.getByTestId('task-completed-badge-1')).toBeInTheDocument();
    });

    // 2. Verify all completed IDs (STEP 1..10) are recorded
    const refreshedStudent = db.getStudents().find(s => s.id === student.id)!;
    expect(refreshedStudent.completed_lesson_ids).toContain('cm-p2-m3'); // STEP 7
    expect(refreshedStudent.completed_lesson_ids).toContain('cm-p2-m4'); // STEP 8
    expect(refreshedStudent.completed_lesson_ids).toContain('cm-p3-m1'); // STEP 9
    expect(refreshedStudent.completed_lesson_ids).toContain('cm-p3-m2'); // STEP 10

    unmount();

    // 3. Verify next uncompleted lesson auto-detection points to STEP 11 (cm-p3-m3)
    const masters = db.getCurriculumMasters('算数');
    const nextLesson = findNextUncompletedLessonForSubject({
      student: refreshedStudent,
      subject: '算数',
      tasks: db.getLearningTasks(),
      curriculumMasters: masters
    });
    expect(nextLesson.lessonId).toBe('cm-p3-m3'); // STEP 11
    expect(nextLesson.masterIndex).toBe(10); // 0-indexed index 10 = STEP 11

    // 4. Verify TeacherDashboard renders Elementary Timeline with STEP 1..10 completed and STEP 11 as 📍 現在地
    const timelineRender = render(
      <TeacherDashboard 
        students={[refreshedStudent]} 
        initialStudentId={refreshedStudent.id}
        initialTab="milestones"
      />
    );

    await waitFor(() => {
      // STEP 10 should show completed badge
      expect(timelineRender.getByTestId('timeline-item-cm-p3-m2')).toHaveTextContent('✓ 完了');
      // Verify timeline displays current position badge for the next item
      expect(timelineRender.getByText('📍 現在地（取り組み中）')).toBeInTheDocument();
    });

    timelineRender.unmount();

    // 5. Verify TeacherDashboard schedule tab auto-selects STEP 11 (cm-p3-m3) as From for next date (2026-08-21)
    const scheduleRender = render(
      <TeacherDashboard 
        students={[refreshedStudent]} 
        initialStudentId={refreshedStudent.id}
        initialTab="schedule"
        initialDate="2026-08-21"
      />
    );

    await waitFor(() => {
      const periodSelect = scheduleRender.getByTestId('period-unit-select-1') as HTMLSelectElement;
      expect(periodSelect.value).toBe('cm-p3-m3');
    });

    scheduleRender.unmount();
  });
});



