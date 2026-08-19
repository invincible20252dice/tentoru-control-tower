import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import SugorokuMap from '../components/SugorokuMap';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import Portal from '../app/page';
import { db, CurriculumUnit, LearningTask, Student, CustomClass, MiniTestResult, CurriculumMaster } from '../lib/db';
import { TestScoreRadarChart } from '../components/TestScoreRadarChart';
import { WeeklyScheduleViewer } from '../components/WeeklyScheduleViewer';
import { StudentScheduleConfigForm } from '../components/StudentScheduleConfigForm';
import { CurriculumCsvImport } from '../components/CurriculumCsvImport';
import { saveGeminiApiKey, getGeminiApiKey, analyzeReportCardImage } from '../lib/gemini';
import { calculateProgressGap, rescheduleFutureUncompletedTasks, getYearMonthWeek } from '../lib/scheduler';

// Mock html2canvas since it does not work in jsdom environment easily
vi.mock('html2canvas', () => {
  return {
    default: vi.fn().mockResolvedValue({
      toDataURL: () => 'data:image/png;base64,mockImage'
    })
  };
});

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: function(apiKey) {
      return {
        getGenerativeModel: () => {
          return {
            generateContent: async () => {
              if (apiKey === 'trigger-json-error') {
                return {
                  response: {
                    text: () => 'Invalid non-JSON response string!'
                  }
                };
              }
              return {
                response: {
                  text: () => JSON.stringify({
                    test_name: '期末テスト',
                    score_japanese: 80,
                    score_math: 90,
                    score_english: 85,
                    score_social: 75,
                    score_science: 85,
                    score_total: 415,
                    class_rank: '5',
                    school_rank: '10',
                    deviation_value: 61.2
                  })
                }
              };
            }
          };
        }
      };
    }
  };
});

describe('UI Components Render & Interaction Tests', () => {
  const mockUnits: CurriculumUnit[] = [
    { id: 'u-1', school_id: 'sch-1', subject: '数学', name: '単元1', sequence_order: 1, created_at: '' },
    { id: 'u-2', school_id: 'sch-1', subject: '数学', name: '単元2', sequence_order: 2, created_at: '' }
  ];

  const mockTasks: LearningTask[] = [
    { id: 't-1', student_id: 'std-1', unit_id: 'u-1', scheduled_date: '2026-06-19', period: 1, status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
    { id: 't-2', student_id: 'std-1', unit_id: 'u-2', scheduled_date: '2026-06-19', period: 2, status: 'unstarted', video_watched: false, test_passed: false, created_at: '' }
  ];

  const mockStudent: Student = {
    id: 'std-1',
    student_id: 'student101',
    name: '佐藤 拓海',
    email: 'student101@tentoru.com',
    grade: '中3',
    school_id: 'sch-1',
    status: 'normal',
    start_unit_id: null,
    created_at: ''
  };

  let alertMock = vi.fn();

  beforeEach(() => {
    alertMock = vi.fn();
    window.alert = alertMock;
    (global as any).alert = alertMock;
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
    db.clearMockData();
    // Seed initial demo data inside Mock LocalStorage
    db.getSchools();
    db.getCurriculumUnits();
    db.getStudents();
    db.getLearningTasks();
    db.getSchoolCodesMaster();
    db.getExamThresholdsMaster();
    db.getPromptSettings();
    db.getAIReports();
  });

  // 1. SugorokuMap
  it('should render SugorokuMap component with correct step states', () => {
    render(
      <SugorokuMap 
         subject="数学" 
         units={mockUnits} 
         tasks={mockTasks} 
      />
    );
    expect(screen.getByText(/数学の学習マップ/)).toBeInTheDocument();
    expect(screen.getByText(/多項式の乗法と公式①|単元1/)).toBeInTheDocument();

    // Edge Case: empty tasks (no tasks matching unit)
    const { container: container1 } = render(
      <SugorokuMap subject="数学" units={mockUnits} tasks={[]} />
    );
    expect(container1).toBeDefined();

    // Edge Case: all tasks completed
    const completedTasks = mockTasks.map(t => ({ ...t, status: 'completed' as const, video_watched: true, test_passed: true }));
    const { container: container2 } = render(
      <SugorokuMap subject="数学" units={mockUnits} tasks={completedTasks} />
    );
    expect(container2).toBeDefined();

    // Edge Case: video watched but test not passed (Line 116 branch) and theme='dark' (Line 64 branch)
    const watchedOnlyTasks = [
      { id: 't-1', student_id: 'std-1', unit_id: 'u-1', scheduled_date: '2026-06-19', period: 1, status: 'unstarted' as const, video_watched: true, test_passed: false, created_at: '' }
    ];
    const { container: container3 } = render(
      <SugorokuMap subject="数学" units={mockUnits} tasks={watchedOnlyTasks} theme="dark" />
    );
    expect(container3).toBeDefined();
  });

  // 2. StudentDashboard Interactions
  it('should handle student watch video and test pass/fail buttons', async () => {
    // Add custom tasks to cover line 30 (|| 0), line 252 (!unit return null), and line 43 (status !== 'unstarted')
    const customTasksForDash: LearningTask[] = [
      { id: 't-undef', student_id: 'std-1', unit_id: 'u-invalid', scheduled_date: '2026-06-19', period: undefined as any, status: 'unstarted' as const, video_watched: false, test_passed: false, created_at: '' },
      { id: 't-undef-2', student_id: 'std-1', unit_id: 'u-invalid', scheduled_date: '2026-06-19', period: undefined as any, status: 'unstarted' as const, video_watched: false, test_passed: false, created_at: '' },
      { id: 't-failed-view', student_id: 'std-1', unit_id: 'unit-102-1', scheduled_date: '2026-06-19', period: 3, status: 'failed' as const, video_watched: false, test_passed: false, created_at: '' }
    ];
    const originalTasks = db.getLearningTasks();
    await db.saveLearningTasks([...originalTasks, ...customTasksForDash]);

    // Mock location reload for simulator test
    const originalLocation = window.location;
    const reloadMock = vi.fn();
    delete (window as any).location;
    window.location = { ...originalLocation, reload: reloadMock } as any;

    render(
      <StudentDashboard 
        student={mockStudent} 
        onBackToPortal={() => {}}
      />
    );

    // Initial state check
    expect(screen.getByText(/佐藤 拓海 さんの学習画面/)).toBeInTheDocument();

    // Toggle schedule config modal in StudentDashboard
    const configBtn = screen.getByText(/通塾設定/i);
    fireEvent.click(configBtn);
    fireEvent.click(configBtn);

    // Watch video for failed status task (Line 43 status !== 'unstarted')
    const watchFailedBtn = screen.getAllByText('動画を視聴する (10分)')[1];
    fireEvent.click(watchFailedBtn);
    await waitFor(() => {
      expect(screen.getByText('動画視聴済み')).toBeInTheDocument();
    });

    // 1. Watch video for task-3
    const watchButtons = screen.getAllByText('動画を視聴する (10分)');
    fireEvent.click(watchButtons[0]);
    await waitFor(() => {
      expect(screen.getAllByText('動画視聴済み').length).toBeGreaterThanOrEqual(2);
    });

    // 2. Test pass
    const passButton = screen.getAllByText('単元テストを受ける (合格)')[0];
    fireEvent.click(passButton);
    await waitFor(() => {
      expect(screen.getByText('合格完了！')).toBeInTheDocument();
    });

    // 3. Test fail on second unit
    const failButton = screen.getAllByText('テストを受ける (不合格)')[0];
    fireEvent.click(failButton);
    await waitFor(() => {
      expect(screen.getByText('不合格 (再挑戦)')).toBeInTheDocument();
    });

    // 4. Simulator action (2 days failure)
    const simFailBtn = screen.getByText('⚠️ 2日連続未達成を作る');
    fireEvent.click(simFailBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalled();
    });

    window.location = originalLocation;
  });

  it('should render correct badges for fast/warning students in StudentDashboard', () => {
    // 1. Fast Student
    const fastStudent = { ...mockStudent, status: 'fast' as const };
    render(<StudentDashboard student={fastStudent} onBackToPortal={() => {}} />);
    expect(screen.getByText(/爆速中！/)).toBeInTheDocument();

    // 2. Warning Student
    const warningStudent = { ...mockStudent, status: 'warning' as const };
    render(<StudentDashboard student={warningStudent} onBackToPortal={() => {}} />);
    expect(screen.getByText(/計画パンク/)).toBeInTheDocument();
  });

  it('should trigger fast forward mode when all tasks completed early in StudentDashboard', async () => {
    // クリーンなセットアップ
    db.clearMockData();
    localStorage.setItem('tentoru_learning_tasks', JSON.stringify([]));
    localStorage.setItem('tentoru_curriculum_units', JSON.stringify([]));
    localStorage.setItem('tentoru_students', JSON.stringify([]));
    localStorage.setItem('tentoru_schools', JSON.stringify([]));
    
    const school = { id: 'sch-1', name: 'テスト中学校', type: 'junior_high' as const, created_at: '' };
    await db.saveSchool(school);

    const unit1 = { id: 'unit-103-1', school_id: 'sch-1', subject: '数学', name: '一次方程式', sequence_order: 1, created_at: '' };
    const unit2 = { id: 'unit-104-1', school_id: 'sch-1', subject: '数学', name: '比例と反比例', sequence_order: 2, created_at: '' };
    await db.saveCurriculumUnits([unit1, unit2]);

    await db.saveStudent(mockStudent);

    const customTasks: LearningTask[] = [
      // 今週のタスク (6/19 今日)
      { id: 'ct-1', student_id: 'std-1', unit_id: 'unit-103-1', scheduled_date: '2026-06-19', period: 1, status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
      // 来週のタスク (6/26 未来と 6/25 未来の2点を用意して sort を発火させる)
      { id: 'ct-2', student_id: 'std-1', unit_id: 'unit-104-1', scheduled_date: '2026-06-26', period: null, status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
      { id: 'ct-3', student_id: 'std-1', unit_id: 'unit-104-1', scheduled_date: '2026-06-25', period: null, status: 'unstarted', video_watched: false, test_passed: false, created_at: '' }
    ];
    await db.saveLearningTasks(customTasks);

    render(
      <StudentDashboard 
        student={mockStudent} 
        onBackToPortal={() => {}}
      />
    );

    // テストを受ける (合格) をクリックして完了させる
    const passBtn = screen.getAllByText('単元テストを受ける (合格)')[0];
    fireEvent.click(passBtn);

    // 爆速モードの alert が呼ばれるのを待つ
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('爆速モード突入'));
    });
  });

  it('should handle edge cases in StudentDashboard (no future tasks, elementary student)', async () => {
    // 1. 今週タスクを完了するが未来のタスクが存在しないケース (Line 109 else cover)
    db.clearMockData();
    localStorage.setItem('tentoru_learning_tasks', JSON.stringify([]));
    localStorage.setItem('tentoru_curriculum_units', JSON.stringify([]));
    localStorage.setItem('tentoru_students', JSON.stringify([]));
    localStorage.setItem('tentoru_schools', JSON.stringify([]));

    const school = { id: 'sch-1', name: 'テスト中学校', type: 'junior_high' as const, created_at: '' };
    await db.saveSchool(school);
    const unit1 = { id: 'u-1', school_id: 'sch-1', subject: '数学', name: '単元1', sequence_order: 1, created_at: '' };
    await db.saveCurriculumUnits([unit1]);

    const student = { ...mockStudent };
    const customTasks: LearningTask[] = [
      { id: 'ct-1', student_id: 'std-1', unit_id: 'u-1', scheduled_date: '2026-06-19', period: 1, status: 'unstarted', video_watched: false, test_passed: false, created_at: '' }
    ];
    await db.saveLearningTasks(customTasks);
    
    const { unmount } = render(
      <StudentDashboard 
        student={student} 
        onBackToPortal={() => {}}
      />
    );
    
    const passBtn = screen.getByText('単元テストを受ける (合格)');
    fireEvent.click(passBtn);
    // この時、alertMock は「爆速モード突入」で呼ばれないこと (未来のタスクがないため)
    expect(alertMock).not.toHaveBeenCalled();
    unmount();

    // 2. 小学生の生徒のすごろくマップ描画 (Line 340 else cover)
    const elemStudent: Student = {
      id: 'std-elem',
      student_id: 'student_el',
      name: '小学生生徒',
      email: 'elem@tentoru.com',
      grade: '小5',
      school_id: 'sch-2',
      status: 'normal',
      start_unit_id: null,
      created_at: ''
    };
    render(
      <StudentDashboard 
        student={elemStudent} 
        onBackToPortal={() => {}}
      />
    );
    expect(screen.getByText(/算数の学習マップ/)).toBeInTheDocument();
  });

  // 3. TeacherDashboard Interactions
  it('should support full features in TeacherDashboard', async () => {
    // Add invalidTask (with invalid unit_id) to cover TeacherDashboard line 864
    const invalidTask: LearningTask = {
      id: 't-invalid',
      student_id: 'std-1',
      unit_id: 'u-invalid',
      scheduled_date: '2026-06-19',
      period: 3,
      status: 'unstarted' as const,
      video_watched: false,
      test_passed: false,
      created_at: ''
    };
    const failedTask: LearningTask = {
      id: 't-failed-teacher',
      student_id: 'std-1',
      unit_id: 'unit-102-1',
      scheduled_date: '2026-06-19',
      period: 4,
      status: 'failed' as const,
      video_watched: true,
      test_passed: false,
      created_at: ''
    };
    const currentTasks = db.getLearningTasks();
    await db.saveLearningTasks([...currentTasks, invalidTask, failedTask]);

    await db.addLearningLog({ id: 'fuzz-log-1', student_id: 'std-1', unit_id: 'unit-102-1', log_type: 'video_view', created_at: new Date().toISOString() });
    await db.addLearningLog({ id: 'fuzz-log-2', student_id: 'std-1', unit_id: 'unit-102-1', log_type: 'test_result', created_at: new Date().toISOString() });

    const studentsList = db.getStudents();
    const std2Idx = studentsList.findIndex(s => s.id === 'std-2');
    if (std2Idx >= 0) {
      studentsList[std2Idx].status = 'fast';
      await db.saveStudent(studentsList[std2Idx]);
    }

    const { container } = render(
      <TeacherDashboard 
        onBackToPortal={() => {}}
      />
    );

    expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();

    // 1. Create a student account
    // Switch to create student tab
    const createStudentTabBtn = screen.getAllByText('新規生徒アカウント発行')[0];
    fireEvent.click(createStudentTabBtn);

    const inputName = screen.getByPlaceholderText('例: 佐藤 拓海');
    
    // 名前が空の状態でアカウント発行を試みてガードを通す
    const newStudentForm = screen.getByText('1クリックアカウント発行').closest('form')!;
    const submitBtn = screen.getByText('1クリックアカウント発行');
    fireEvent.submit(newStudentForm);
    expect(alertMock).not.toHaveBeenCalled();

    fireEvent.change(inputName, { target: { value: '山田 太郎' } });

    // Change new student grade and school selects (Line 637, 651 cover)
    const formSelects = newStudentForm.querySelectorAll('select');
    // formSelects[0] is grade, formSelects[1] is school
    fireEvent.change(formSelects[0], { target: { value: '中2' } });
    fireEvent.change(formSelects[1], { target: { value: 'sch-1' } });
    
    fireEvent.submit(submitBtn.closest('form')!);
    
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('生徒アカウントを発行しました'));
    });

    // 小学生の生徒アカウントも発行して else 分岐をカバー
    fireEvent.change(inputName, { target: { value: '小学生 太郎' } });
    fireEvent.change(formSelects[0], { target: { value: '小6' } });
    fireEvent.change(formSelects[1], { target: { value: 'sch-2' } });
    fireEvent.submit(submitBtn.closest('form')!);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('生徒アカウントを発行しました'));
    });

    // Go back to student list view
    const studentListTabBtn = screen.getAllByText('生徒一覧')[0];
    fireEvent.click(studentListTabBtn);

    // Select newly created student to cover Line 690 (st.start_unit_id || '') empty check
    const studentItemTaro = screen.getByText(/山田 太郎/);
    fireEvent.click(studentItemTaro);
    await waitFor(() => {
      expect(screen.getByText(/山田 太郎 \(ID: student/)).toBeInTheDocument();
    });

    // 佐藤 拓海のAIReportを、teacher_notes と final_text が空の状態で保存
    await db.saveAIReport({
      id: 'rep-1',
      student_id: 'std-1',
      month: '2026-06',
      analysis_text: '佐藤君は今月、数学の「文字式」において非常に意欲的に取り組みました！動画を合計20分視聴し、その後の単元テストでは85%という素晴らしい高得点で一発合格を果たしています。',
      teacher_notes: undefined as any,
      final_text: undefined as any,
      created_at: new Date().toISOString()
    });



    // 2. Select student to load details
    fireEvent.click(studentListTabBtn);
    const studentItem = screen.getByText(/佐藤 拓海/);
    fireEvent.click(studentItem);
    await waitFor(() => {
      expect(screen.getByText(/佐藤 拓海 \(ID: student101\)/)).toBeInTheDocument();
    });

    // Select std-2 (Suzuki Yui) who does not have an AI report for 2026-06 to cover line 144 else branch
    fireEvent.click(studentListTabBtn);
    const studentItemYui = screen.getByText(/鈴木 結衣/);
    fireEvent.click(studentItemYui);
    await waitFor(() => {
      expect(screen.getByText(/鈴木 結衣 \(ID: student102\)/)).toBeInTheDocument();
    });
    // Switch to AI report tab to render empty preview default text (covers Line 1171 branch)
    const tabAIYui = screen.getByText('AI指導報告書');
    fireEvent.click(tabAIYui);
    await waitFor(() => {
      expect(screen.getByText(/「自動生成」を実行してください。/)).toBeInTheDocument();
    });

    // 鈴木結衣（学習ログなし）で自動生成を実行して Falsy / 0 パスをカバー
    alertMock.mockClear();
    const generateBtnYui = screen.getByText(/今月の学習ログから報告書を自動生成/);
    fireEvent.click(generateBtnYui);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('AI報告書の文章を自動生成しました！');
    }, { timeout: 2500 });

    // レポートが空の状態で保存を試みてガード (!aiReportText return) を通す
    alertMock.mockClear();
    const yuiReportTextarea = Array.from(container.querySelectorAll('textarea')).find(ta => 
      !ta.placeholder && ta.value.includes('鈴木 結衣')
    )!;
    const saveReportBtnYui = screen.getByText('報告書を保存 ＆ 修正履歴を学習 (パターンB)');
    fireEvent.change(yuiReportTextarea, { target: { value: '' } });
    fireEvent.click(saveReportBtnYui);
    expect(alertMock).not.toHaveBeenCalled();

    // Switch back to schedule tab to keep flow clean
    const tabScheduleYui = screen.getByText('学習計画・コマ割り');
    fireEvent.click(tabScheduleYui);

    // Select std-1 back to continue original flow
    fireEvent.click(studentListTabBtn);
    const studentItemBack = screen.getByText(/佐藤 拓海/);
    fireEvent.click(studentItemBack);
    await waitFor(() => {
      expect(screen.getByText(/佐藤 拓海 \(ID: student101\)/)).toBeInTheDocument();
    });

    // 3. Tab: Curriculum Management
    const tabCurriculum = screen.getByText('学校カリキュラム管理');
    fireEvent.click(tabCurriculum);
    await waitFor(() => {
      expect(screen.getByText(/学校単位のマスターカリキュラム設定/)).toBeInTheDocument();
    });

    // Change School and Subject (Line 896, 908 cover)
    const schoolLabel = screen.getByText('対象学校');
    const schoolSelectElement = schoolLabel.parentElement!.querySelector('select')!;
    const subjectLabel = screen.getByText('対象教科');
    const subjectSelectElement = subjectLabel.parentElement!.querySelector('select')!;
    fireEvent.change(schoolSelectElement, { target: { value: 'sch-1' } }); // school change handler (896)
    fireEvent.change(subjectSelectElement, { target: { value: '英語' } }); // subject change handler (908)

    // Move curriculum unit down (Line 941 cover - down button)
    const downBtns = container.querySelectorAll('button[title="下へ移動"]');
    if (downBtns.length > 0) {
      fireEvent.click(downBtns[0]); // Click first unit down button
      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('未来の学習計画を再編しました'));
      });
      // 境界値ガードのテスト：最後のボタンの下へ移動 (disabledを解除してクリック)
      const lastDownBtn = downBtns[downBtns.length - 1];
      lastDownBtn.removeAttribute('disabled');
      fireEvent.click(lastDownBtn);
    }

    // Move curriculum unit
    const upBtns = container.querySelectorAll('button[title="上へ移動"]');
    if (upBtns.length > 1) {
      fireEvent.click(upBtns[1]); // Click second unit up button
      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('未来の学習計画を再編しました'));
      });
      // 境界値ガードのテスト：最初のボタンの上へ移動 (disabledを解除してクリック)
      upBtns[0].removeAttribute('disabled');
      fireEvent.click(upBtns[0]);
    }

    // 4. Tab: Tests and Grades
    const tabTests = screen.getByText('定期テスト・模試');
    fireEvent.click(tabTests);
    await waitFor(() => {
      expect(screen.getByText(/定期テスト・模試成績管理/)).toBeInTheDocument();
    });

    // Save regular test score (and fill all form values to cover handlers)
    const regularForm = screen.getByText('定期テスト結果記録').closest('div')!;
    
    // 得点やテスト名などが空欄の状態で保存を試みてガードを通す
    const saveRegularBtn = screen.getByText('定期テスト結果を記録');
    alertMock.mockClear();
    fireEvent.submit(saveRegularBtn.closest('form')!);
    expect(alertMock).not.toHaveBeenCalled();

    // 全ての値を埋めて保存
    const regularInputs = regularForm.querySelectorAll('input');
    // 0番目は テスト名
    fireEvent.change(regularInputs[0], { target: { value: '1学期中間テスト' } });
    // 1番目は 国語
    fireEvent.change(regularInputs[1], { target: { value: '75' } });
    // 2番目は 数学
    fireEvent.change(regularInputs[2], { target: { value: '85' } });
    // 3番目は 英語
    fireEvent.change(regularInputs[3], { target: { value: '95' } });
    // 4番目は 社会
    fireEvent.change(regularInputs[4], { target: { value: '80' } });
    // 5番目は 理科
    fireEvent.change(regularInputs[5], { target: { value: '90' } });
    // 6番目は 合計点
    fireEvent.change(regularInputs[6], { target: { value: '425' } });
    // 7番目は クラス順位
    fireEvent.change(regularInputs[7], { target: { value: '3' } });
    // 8番目は 学年順位
    fireEvent.change(regularInputs[8], { target: { value: '10' } });
    // 9番目は 偏差値
    fireEvent.change(regularInputs[9], { target: { value: '64.5' } });

    // 改善点 (Line 1002 cover)
    const regularTextarea = regularForm.querySelector('textarea')!;
    fireEvent.change(regularTextarea, { target: { value: '計算練習を増やす' } });

    fireEvent.submit(saveRegularBtn.closest('form')!);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('定期テスト結果を記録しました。');
    });

    // Save mock test score
    const mockForm = screen.getByText('模試結果 ＆ 志望校判定').closest('div')!;
    const saveMockBtn = screen.getByText('模試点数を入力して合格判定算出');

    // 得点や志望校が空欄の状態で保存を試みてガードを通す
    alertMock.mockClear();
    fireEvent.submit(saveMockBtn.closest('form')!);
    expect(alertMock).not.toHaveBeenCalled();
    
    // Change mock subject name (Line 1014 cover)
    const mockSubjectInput = mockForm.querySelector('input[type="text"]')!;
    fireEvent.change(mockSubjectInput, { target: { value: '第1回五ツ木模試' } });

    const mockScoreInput = mockForm.querySelector('input[type="number"]')!;
    fireEvent.change(mockScoreInput, { target: { value: '340' } });
    const selectSchool = mockForm.querySelector('select')!;
    fireEvent.change(selectSchool, { target: { value: 'schcode-A' } });
    fireEvent.submit(saveMockBtn.closest('form')!);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('模試結果を記録しました'));
    });

    // 5. Tab: AI Report
    const tabAI = screen.getByText('AI指導報告書');
    fireEvent.click(tabAI);
    await waitFor(() => {
      expect(screen.getByText(/AI指導報告書生成機能/)).toBeInTheDocument();
    });

    // Edit AI prompt template (Line 1093 cover)
    const tuningBtn = screen.getByText('校舎長プロンプト調整 (パターンA)');
    fireEvent.click(tuningBtn);
    const promptArea = container.querySelector('textarea')!;
    fireEvent.change(promptArea, { target: { value: '新しいプロンプトテンプレート {video_duration}' } });
    const savePromptBtn = screen.getByText('プロンプトテンプレートを保存');
    fireEvent.click(savePromptBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('AIプロンプトテンプレートを更新しました！');
    });

    // Cover prompts.length <= 0 branch in handleSavePromptTemplate
    alertMock.mockClear();
    localStorage.setItem('tentoru_prompt_settings', '[]');
    fireEvent.click(savePromptBtn);
    expect(alertMock).not.toHaveBeenCalled();
    localStorage.removeItem('tentoru_prompt_settings');
    db.getPromptSettings(); // reload seed

    // Close tuning area to keep only report textareas visible
    fireEvent.click(tuningBtn);

    // Auto generate report
    alertMock.mockClear();
    const generateBtn = screen.getByText(/今月の学習ログから報告書を自動生成/);
    fireEvent.click(generateBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('AI報告書の文章を自動生成しました！');
    }, { timeout: 2500 });

    // Edit generated text and teacher notes (Line 1122 and 1135 cover)
    const reportTextarea = Array.from(container.querySelectorAll('textarea')).find(ta => 
      !ta.placeholder && ta.value.includes('佐藤 拓海')
    )!;
    const teacherNotesTextarea = screen.getByPlaceholderText(/二者面談を実施し/);
    fireEvent.change(reportTextarea, { target: { value: '手動でトーンを書き直したポジティブ文章！' } });
    fireEvent.change(teacherNotesTextarea, { target: { value: '三者面談で今月の目標を話しました。' } });

    // Click Save AI report (Line 523 cover)
    const saveReportBtn = screen.getByText('報告書を保存 ＆ 修正履歴を学習 (パターンB)');
    fireEvent.click(saveReportBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('指導報告書を保存し'));
    });

    // Auto generate report again (to cover corrections log filters on TeacherDashboard lines 482-483)
    alertMock.mockClear();
    fireEvent.click(generateBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('AI報告書の文章を自動生成しました！'));
    }, { timeout: 2500 });

    // Save again without editing (covers line 528: aiReportText === originalAiText path)
    fireEvent.click(saveReportBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('指導報告書を保存し'));
    });

    // Export as image (Line 569 cover)
    const exportBtn = screen.getByText(/LINE送信用画像ファイルで出力/);
    fireEvent.click(exportBtn);

    const currentTasksForSkip = db.getLearningTasks();
    const taskIdx = currentTasksForSkip.findIndex(t => t.id === 'task-3');
    if (taskIdx >= 0) {
      currentTasksForSkip[taskIdx].status = 'skipped';
      await db.saveLearningTasks(currentTasksForSkip);
    }
    // 6. Tab: Schedule and Timetable setup
    const tabSchedule = screen.getByText('学習計画・コマ割り');
    fireEvent.click(tabSchedule);
    await waitFor(() => {
      expect(screen.getByText(/学習計画の個別管理/)).toBeInTheDocument();
    });

    // Set unit-103-1 status to skipped temporarily to cover the reset branch
    const startTasks = db.getLearningTasks();
    const t31Idx = startTasks.findIndex(t => t.unit_id === 'unit-103-1' && t.student_id === 'std-1');
    if (t31Idx >= 0) {
      startTasks[t31Idx].status = 'skipped';
      await db.saveLearningTasks(startTasks);
    }

    // Trigger reload by changing schedule date temporarily
    const dateInputReloadForSkip = container.querySelector('input[type="date"]')!;
    fireEvent.change(dateInputReloadForSkip, { target: { value: '2026-06-20' } });
    fireEvent.change(dateInputReloadForSkip, { target: { value: '2026-06-19' } });

    // Change Schedule Date (Line 811 cover)
    const dateInput = container.querySelector('input[type="date"]')!;
    fireEvent.change(dateInput, { target: { value: '2026-06-20' } });

    // Change Timetable selections and notes (Line 825, 840 cover)
    const timetableContainer = screen.getByText('コマ割り設定 (標準2コマ / 最大10コマ)').parentElement!;
    
    // Check initial select elements count is 2 (student's default period_count is 2)
    let periodSelects = Array.from(timetableContainer.querySelectorAll('select')).filter(s => s.getAttribute('data-testid') !== 'apply-scope-select');
    expect(periodSelects.length).toBe(2);

    // Click "➕ コマ数を追加 (最大10コマ)" button to increase period count
    const addPeriodBtn = screen.getByText('➕ コマ数を追加 (最大10コマ)');
    fireEvent.click(addPeriodBtn);

    // Verify it increases to 3 select elements
    periodSelects = Array.from(timetableContainer.querySelectorAll('select')).filter(s => s.getAttribute('data-testid') !== 'apply-scope-select');
    expect(periodSelects.length).toBe(3);

    fireEvent.change(periodSelects[0], { target: { value: 'unit-103-1' } });
    fireEvent.change(periodSelects[1], { target: { value: 'unit-102-1' } });
    fireEvent.change(periodSelects[2], { target: { value: 'unit-101-1' } }); // using one of the split math themes

    // Set common office note
    const officeNoteTextarea = timetableContainer.querySelector('textarea')!;
    fireEvent.change(officeNoteTextarea, { target: { value: 'ワーク提出あり' } });

    // Save timetable
    const saveTimetableBtn = screen.getByText('時間割コマ割りを保存');
    fireEvent.click(saveTimetableBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('今日の時間割コマ割りを保存しました！');
    });

    // Trigger normal delayed reschedule (Line 388 branch)
    // Yesterday (6/18) task status to unstarted to make it uncompleted.
    const normalTasks = db.getLearningTasks();
    const t2Idx = normalTasks.findIndex(t => t.id === 'task-2');
    if (t2Idx >= 0) {
      normalTasks[t2Idx].status = 'unstarted';
      await db.saveLearningTasks(normalTasks);
    }
    // Trigger reload
    const dateInputReloadNormal = container.querySelector('input[type="date"]')!;
    fireEvent.change(dateInputReloadNormal, { target: { value: '2026-06-20' } });
    fireEvent.change(dateInputReloadNormal, { target: { value: '2026-06-19' } });

    // Click auto reschedule button (should succeed and alert normal message)
    const normalReschedBtn = screen.getByText(/遅れチェック/);
    fireEvent.click(normalReschedBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('2日連続未達成を検出し、自動リスケジュールを実行しました。未達成タスクを残りの日程に均等配分しました。');
    });

    // Setup 16 uncompleted tasks to trigger punk alert (386 cover)
    // Yesterday (6/18) and Today (6/19) tasks must be uncompleted to trigger rescheduling.
    const punkTasks: LearningTask[] = [];
    punkTasks.push({ id: 'pt-yesterday', student_id: 'std-1', unit_id: 'unit-102-1', scheduled_date: '2026-06-18', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' });
    punkTasks.push({ id: 'pt-today', student_id: 'std-1', unit_id: 'unit-103-1', scheduled_date: '2026-06-19', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' });
    for (let i = 0; i < 14; i++) {
      punkTasks.push({
        id: `pt-future-${i}`,
        student_id: 'std-1',
        unit_id: 'unit-104-1',
        scheduled_date: '2026-06-20',
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        created_at: ''
      });
    }
    await db.deleteLearningTasksByStudent('std-1');
    await db.saveLearningTasks(punkTasks);
    // Trigger reload by changing schedule date temporarily
    const dateInputReload = container.querySelector('input[type="date"]')!;
    fireEvent.change(dateInputReload, { target: { value: '2026-06-20' } });
    fireEvent.change(dateInputReload, { target: { value: '2026-06-19' } });

    // Auto reschedule - this should trigger punk alert warning since we have 16 uncompleted tasks for 5 future dates (16/5 = 3.2 -> 4 tasks/day > max limit 3)
    const autoReschedBtn = screen.getByText(/遅れチェック/);
    fireEvent.click(autoReschedBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('計画パンクアラート発火'));
    });
  }, 15000);

  // 4. Portal Interactions (page.tsx)
  it('should support portal operations and routing simulation', async () => {
    db.saveSession({
      user: {
        id: 'admin-1',
        email: 'admin@tentoru.jp',
        role: 'admin',
        name: '本部統括管理者'
      },
      logged_in_at: new Date().toISOString()
    });

    render(<Portal />);

    // Starts on TeacherDashboard directly, navigate to portal
    fireEvent.click(screen.getByText('ポータルへ戻る'));

    expect(screen.getByText('TENTORU')).toBeInTheDocument();

    // 1. Theme toggle to Dark
    const themeBtn = screen.getByText('ダークモードにする');
    fireEvent.click(themeBtn);
    expect(screen.getByText('ライトモードにする')).toBeInTheDocument();

    // 2. Teacher login under Dark theme (covers page.tsx line 57 theme === 'dark')
    const teacherLoginCard = screen.getByText('講師・管理者');
    fireEvent.click(teacherLoginCard);
    fireEvent.click(screen.getByText('中学生'));
    expect(screen.getByText('【中学生】テントル 司令塔ダッシュボード (講師用)')).toBeInTheDocument();

    // Back to portal
    const backBtn = screen.getByText('ポータルへ戻る');
    fireEvent.click(backBtn);
    expect(screen.getByText('TENTORU')).toBeInTheDocument();

    // 3. Student select login with selection under Dark theme (covers page.tsx line 66 theme === 'dark')
    const selectEl = screen.getByRole('combobox');
    fireEvent.change(selectEl, { target: { value: 'std-1' } });
    
    const studentLoginBtn = screen.getByText('生徒画面へ入る ➔');
    fireEvent.click(studentLoginBtn);
    expect(screen.getByText(/佐藤 拓海 さんの学習画面/)).toBeInTheDocument();

    // Back to portal
    const logoutBtn = screen.getByText('ログアウト（ポータルへ）');
    fireEvent.click(logoutBtn);
    expect(screen.getByText('TENTORU')).toBeInTheDocument();

    // 4. Toggle theme back to Light
    fireEvent.click(screen.getByText('ライトモードにする'));
    expect(screen.getByText('ダークモードにする')).toBeInTheDocument();

    // 4b. Teacher login under Light theme (covers page.tsx line 57 theme === 'light')
    const teacherLoginCardLight = screen.getByText('講師・管理者');
    fireEvent.click(teacherLoginCardLight);
    fireEvent.click(screen.getByText('中学生'));
    expect(screen.getByText('【中学生】テントル 司令塔ダッシュボード (講師用)')).toBeInTheDocument();
    
    // Back to portal
    const backBtnLight = screen.getByText('ポータルへ戻る');
    fireEvent.click(backBtnLight);
    expect(screen.getByText('TENTORU')).toBeInTheDocument();

    // 4c. Student login under Light theme (covers page.tsx line 66 theme === 'light')
    const selectElLight = screen.getByRole('combobox');
    fireEvent.change(selectElLight, { target: { value: 'std-1' } });
    const studentLoginBtnLight = screen.getByText('生徒画面へ入る ➔');
    fireEvent.click(studentLoginBtnLight);
    expect(screen.getByText(/佐藤 拓海 さんの学習画面/)).toBeInTheDocument();

    // Logout
    const logoutBtnLight = screen.getByText('ログアウト（ポータルへ）');
    fireEvent.click(logoutBtnLight);
    expect(screen.getByText('TENTORU')).toBeInTheDocument();

    // 5. Student select login without student selection (error alert path cover)
    const studentLoginBtnError = screen.getByText('生徒画面へ入る ➔');
    fireEvent.click(studentLoginBtnError);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('生徒を選択してください。');
    });

    // 6. Student select login with invalid student selection (if (student) false path cover)
    // Append a dummy option to select element to simulate invalid student state selection
    const selectElError = screen.getByRole('combobox');
    const opt = document.createElement('option');
    opt.value = 'std-invalid';
    opt.text = '無効な生徒';
    selectElError.appendChild(opt);

    fireEvent.change(selectElError, { target: { value: 'std-invalid' } });
    const studentLoginBtnError2 = screen.getByText('生徒画面へ入る ➔');
    fireEvent.click(studentLoginBtnError2);
    
    // Page should still remain on Portal because the transition was guarded (if (student) is falsy)
    expect(screen.getByText('TENTORU')).toBeInTheDocument();
  });

  it('should handle TeacherDashboard fallback when school list is empty', () => {
    localStorage.setItem('tentoru_schools', JSON.stringify([]));
    const { unmount } = render(<TeacherDashboard onBackToPortal={() => {}} />);
    unmount();
    db.clearMockData();
    db.getSchools();
  });

  it('should support period selection, homework, test config saves in TeacherDashboard and reflect in StudentDashboard', async () => {
    await db.saveMiniTestResult({
      id: 'mini-std-1-yesterday',
      student_id: 'std-1',
      date: '2026-06-18',
      test_content: '過去のテスト',
      score: 70,
      homework_content: '宿題その1',
      homework_deadline: '2026-06-19',
      created_at: new Date().toISOString()
    });

    const { unmount: unmountTeacher } = render(<TeacherDashboard initialDate="2026-06-19" onBackToPortal={() => {}} />);
    
    const studentItem = screen.getByText(/佐藤 拓海/);
    fireEvent.click(studentItem);
    
    const tabSchedule = screen.getByText('学習計画・コマ割り');
    fireEvent.click(tabSchedule);

    const tabMiniTests = screen.getByText('小テスト結果');
    expect(tabMiniTests).toBeInTheDocument();

    const cellNum1 = screen.getByText('1', { selector: 'span' });
    const period1Select = cellNum1.parentElement!.querySelector('select')!;
    fireEvent.change(period1Select, { target: { value: 'その他' } });
    const customThemeInput = screen.getByPlaceholderText('テーマを入力（例: 面談、宿題指導）');
    fireEvent.change(customThemeInput, { target: { value: '電流の性質' } });

    const officeNoteTextarea = screen.getByPlaceholderText('業務連絡（例：提出ワーク忘れずに）');
    fireEvent.change(officeNoteTextarea, { target: { value: '持ち物：実験道具' } });

    // テストを2つ追加して1つ削除
    const addTestBtn = screen.getByText('➕ テストを追加');
    fireEvent.click(addTestBtn);
    fireEvent.click(addTestBtn);
    const testInputs = screen.getAllByPlaceholderText('例: 二次方程式10問');
    fireEvent.change(testInputs[0], { target: { value: '数学小テスト（一次方程式）' } });
    fireEvent.change(testInputs[1], { target: { value: '削除するテスト' } });
    const deleteTestBtn = testInputs[1].closest('div')!.querySelector('button')!;
    fireEvent.click(deleteTestBtn); // 2つ目のテストを削除

    // 宿題を2つ追加して1つ削除
    const addHwBtn = screen.getByText('➕ 宿題を追加');
    fireEvent.click(addHwBtn);
    fireEvent.click(addHwBtn);
    const hwContentInputs = screen.getAllByPlaceholderText('宿題の内容を入力（例：ワークP24-25）');
    // 親要素経由で2つの日付入力フィールドを取得
    const hwDeadlineInputs = hwContentInputs[0].closest('div')!.parentElement!.parentElement!.querySelectorAll('input[type="date"]');
    
    fireEvent.change(hwContentInputs[0], { target: { value: '数学ワークP45' } });
    fireEvent.change(hwDeadlineInputs[0], { target: { value: '2026-06-25' } });
    fireEvent.change(hwContentInputs[1], { target: { value: '削除する宿題' } });
    fireEvent.change(hwDeadlineInputs[1], { target: { value: '2026-06-26' } });
    
    const deleteHwBtn = hwContentInputs[1].closest('div')!.querySelector('button')!;
    fireEvent.click(deleteHwBtn); // 2つ目の宿題を削除

    const testInput = testInputs[0];
    const hwContentInput = hwContentInputs[0];
    const hwDeadlineInput = hwDeadlineInputs[0];

    const saveBtn = screen.getByText('時間割コマ割りを保存');
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('今日の時間割コマ割りを保存しました！');
    });

    const miniResults = db.getMiniTestResults();
    const testResult = miniResults.find(r => r.student_id === 'std-1' && r.date === '2026-06-19');
    expect(testResult).toBeDefined();
    expect(testResult?.test_content).toBe('数学小テスト（一次方程式）');

    const hwResults = db.getHomeworkResults();
    const hwResult = hwResults.find(r => r.student_id === 'std-1' && r.date === '2026-06-19');
    expect(hwResult).toBeDefined();
    expect(hwResult?.homework_content).toBe('数学ワークP45');
    expect(hwResult?.homework_deadline).toBe('2026-06-25');

    unmountTeacher();

    // 宿題の status: 'skipped', 'incomplete', 'completed' のブランチをカバーするための宿題データを流し込む
    await db.saveHomeworkResult({
      id: 'hw-completed',
      student_id: 'std-1',
      date: '2026-06-19',
      homework_content: '提出済みの宿題',
      homework_deadline: '2026-06-27',
      status: 'completed',
      created_at: new Date().toISOString()
    });
    await db.saveHomeworkResult({
      id: 'hw-skipped',
      student_id: 'std-1',
      date: '2026-06-19',
      homework_content: 'スキップ宿題',
      homework_deadline: '2026-06-26',
      status: 'skipped',
      created_at: new Date().toISOString()
    });
    await db.saveHomeworkResult({
      id: 'hw-incomplete',
      student_id: 'std-1',
      date: '2026-06-19',
      homework_content: '未完の宿題',
      homework_deadline: '', // 期限なしのブランチもカバー
      status: 'incomplete',
      created_at: new Date().toISOString()
    });

    const testStudent: Student = {
      id: 'std-1',
      student_id: 'student101',
      name: '佐藤 拓海',
      email: 'student101@tentoru.com',
      grade: '中3',
      school_id: 'sch-1',
      status: 'normal',
      start_unit_id: null,
      created_at: ''
    };
    
    const { unmount } = render(<StudentDashboard student={testStudent} onBackToPortal={() => {}} initialDate="2026-06-19" />);

    await waitFor(() => {
      expect(screen.getByText(/本日のテスト/)).toBeInTheDocument();
    });
    expect(screen.getByText('数学小テスト（一次方程式）')).toBeInTheDocument();
    expect(screen.getByText(/今日の宿題/)).toBeInTheDocument();
    expect(screen.getByText('数学ワークP45')).toBeInTheDocument();
    expect(screen.getByText('提出期限: 2026-06-25')).toBeInTheDocument();
    expect(screen.getByText('スキップ宿題')).toBeInTheDocument();
    expect(screen.getByText('未完の宿題')).toBeInTheDocument();
    expect(screen.getByText('提出済みの宿題')).toBeInTheDocument();
    expect(screen.getByText('提出期限: 2026-06-26')).toBeInTheDocument();
    expect(screen.getByText('提出期限: 2026-06-27')).toBeInTheDocument();
    expect(screen.getAllByText('スキップ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('未完').length).toBeGreaterThan(0);
    expect(screen.getAllByText('提出済み').length).toBeGreaterThan(0);

    const scoreInput = screen.getByPlaceholderText('点数を入力');
    const saveScoreBtn = screen.getByText('結果を保存');
    fireEvent.change(scoreInput, { target: { value: '150' } });
    fireEvent.click(saveScoreBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('0〜100の点数を入力してください。');
    });

    fireEvent.change(scoreInput, { target: { value: '88' } });
    fireEvent.click(saveScoreBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('小テスト点数を送信しました！');
    });

    fireEvent.change(scoreInput, { target: { value: '' } });
    fireEvent.click(saveScoreBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('小テスト点数を送信しました！');
    });

    fireEvent.change(scoreInput, { target: { value: '88' } });
    fireEvent.click(saveScoreBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('小テスト点数を送信しました！');
    });
    expect(screen.getByText('不合格 (再挑戦) ⚠️')).toBeInTheDocument();

    fireEvent.change(scoreInput, { target: { value: '95' } });
    fireEvent.click(saveScoreBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('小テスト点数を送信しました！');
    });
    expect(screen.getByText('合格 ✨')).toBeInTheDocument();

    // 88点のアサーション期待値と整合させるため、再度88点に戻して保存する
    fireEvent.change(scoreInput, { target: { value: '88' } });
    fireEvent.click(saveScoreBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('小テスト点数を送信しました！');
    });

    const completeCustomBtn = screen.getByText('この授業を完了にする');
    fireEvent.click(completeCustomBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('授業を完了にしました！');
    });

    const updatedMiniResults = db.getMiniTestResults();
    const updatedResult = updatedMiniResults.find(r => r.student_id === 'std-1' && r.date === '2026-06-19');
    expect(updatedResult?.score).toBe(88);

    unmount();

    const { unmount: unmountTeacher2 } = render(<TeacherDashboard initialDate="2026-06-19" onBackToPortal={() => {}} />);
    const studentItem2 = screen.getByText(/佐藤 拓海/);
    fireEvent.click(studentItem2);
    
    const tabMiniTestsBtn = screen.getByText('小テスト結果');
    fireEvent.click(tabMiniTestsBtn);
    expect(screen.getByText('数学小テスト（一次方程式）')).toBeInTheDocument();

    const tabHomeworksBtn = screen.getByText('宿題提出状況');
    fireEvent.click(tabHomeworksBtn);
    expect(screen.getByText('数学ワークP45')).toBeInTheDocument();

    // 宿題提出状況の更新・保存テスト
    const hwRow = screen.getByText('数学ワークP45').closest('tr')!;
    const hwSelect = hwRow.querySelector('select')!;
    fireEvent.change(hwSelect, { target: { value: 'completed' } });
    const hwSaveBtn = hwRow.querySelector('button')!;
    fireEvent.click(hwSaveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('宿題提出状況を保存しました！');
    });

    const finalHwResults = db.getHomeworkResults();
    const finalHwResult = finalHwResults.find(r => r.student_id === 'std-1' && r.date === '2026-06-19');
    expect(finalHwResult?.status).toBe('completed');

    // 小テスト点数の更新テスト
    fireEvent.click(tabMiniTestsBtn);
    const scoreCellInput = screen.getByDisplayValue('88');
    fireEvent.change(scoreCellInput, { target: { value: '150' } });
    const teacherSaveBtn = scoreCellInput.closest('tr')!.querySelector('button')!;
    fireEvent.click(teacherSaveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('点数は0〜100の範囲で入力してください。');
    });

    fireEvent.change(scoreCellInput, { target: { value: '95' } });
    fireEvent.click(teacherSaveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('小テスト点数・合否を保存しました！');
    });

    const finalMiniResults = db.getMiniTestResults();
    const finalResult = finalMiniResults.find(r => r.student_id === 'std-1' && r.date === '2026-06-19');
    expect(finalResult?.score).toBe(95);

    // 点数95点はレベルA(合格点90)なので、テーブル内で「合格」バッジが表示されていることを確認
    const tr = scoreCellInput.closest('tr')!;
    expect(tr.innerHTML).toContain('合格');
    expect(tr.innerHTML).toContain('レベルA (90点)');

    // 左下のレベルセレクトボックスを取得し、レベルC (基礎, 合格目標70点) に変更
    const levelSelect = screen.getByLabelText('学習レベル:');
    fireEvent.change(levelSelect, { target: { value: 'C' } });
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('生徒の学習レベルを レベルC に更新しました。');
    });
    alertMock.mockClear();

    // レベル変更後、テーブル表示が「レベルC (70点)」に切り替わったことを検証
    expect(tr.innerHTML).toContain('レベルC (70点)');

    // 点数を 75 点（レベルCでは合格）に変更して保存
    fireEvent.change(scoreCellInput, { target: { value: '75' } });
    fireEvent.click(teacherSaveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('小テスト点数・合否を保存しました！');
    });
    expect(tr.innerHTML).toContain('合格');

    // 点数を 65 点（レベルCでは不合格）に変更して保存
    fireEvent.change(scoreCellInput, { target: { value: '65' } });
    fireEvent.click(teacherSaveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('小テスト点数・合否を保存しました！');
    });
    expect(tr.innerHTML).toContain('不合格');

    // 次のテストへの影響を避けるため、元の値 95 点に戻しておく
    fireEvent.change(scoreCellInput, { target: { value: '95' } });
    fireEvent.click(teacherSaveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('小テスト点数・合否を保存しました！');
    });
    alertMock.mockClear();

    // 既存のテスト/宿題の削除保存テスト（DBからの削除ブランチのカバー）
    const tabScheduleBtn = screen.getByText('学習計画・コマ割り');
    fireEvent.click(tabScheduleBtn);
    
    // 既存のテスト入力欄とその削除ボタンを取得
    const testInputs2 = screen.getAllByPlaceholderText('例: 二次方程式10問');
    const deleteTestBtn2 = testInputs2[0].closest('div')!.querySelector('button')!;
    fireEvent.click(deleteTestBtn2); // 数学小テストを削除

    // 既存の宿題入力欄とその削除ボタンを取得
    const hwContentInputs2 = screen.getAllByPlaceholderText('宿題の内容を入力（例：ワークP24-25）');
    const deleteHwBtn2 = hwContentInputs2[0].closest('div')!.querySelector('button')!;
    fireEvent.click(deleteHwBtn2); // 数学ワークP45を削除

    const saveBtn2 = screen.getByText('時間割コマ割りを保存');
    fireEvent.click(saveBtn2);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('今日の時間割コマ割りを保存しました！');
    });

    // 削除がDBに反映されたか確認
    const finalMiniResultsAfterDel = db.getMiniTestResults();
    expect(finalMiniResultsAfterDel.find(r => r.test_content === '数学小テスト（一次方程式）')).toBeUndefined();

    const finalHwResultsAfterDel = db.getHomeworkResults();
    expect(finalHwResultsAfterDel.find(r => r.homework_content === '数学ワークP45')).toBeUndefined();

    unmountTeacher2();
  });

  it('should support edge cases, unit sorting, custom task updates, and AI report manual corrections in TeacherDashboard', async () => {
    const { container, unmount } = render(<TeacherDashboard initialDate="2026-06-19" onBackToPortal={() => {}} />);
    
    // 生徒を選択する
    const studentItem = screen.getByText(/佐藤 拓海/);
    fireEvent.click(studentItem);

    // 0. 初期状態での小テスト結果が空であることの確認 (length === 0 分岐のカバー)
    const tabMiniTestsBtn = screen.getByText('小テスト結果');
    fireEvent.click(tabMiniTestsBtn);
    expect(screen.getByText('記録された小テスト結果はありません。')).toBeInTheDocument();

    const tabHomeworksBtn = screen.getByText('宿題提出状況');
    fireEvent.click(tabHomeworksBtn);
    expect(screen.getByText('記録された宿題はありません。')).toBeInTheDocument();

    // 1. カリキュラム順序変更 (moveUnit) のテスト
    // 「学校カリキュラム管理」タブを開く
    const tabCurriculum = screen.getByText('学校カリキュラム管理');
    fireEvent.click(tabCurriculum);

    // リストの移動ボタンを取得
    const upButtons = screen.getAllByTitle('上へ移動');
    const downButtons = screen.getAllByTitle('下へ移動');
    
    // ガード節の検証 (最上部を上、最下部を下)
    fireEvent.click(upButtons[0]);
    fireEvent.click(downButtons[downButtons.length - 1]);
    
    // 通常の移動 (上から2番目を上へ)
    if (upButtons.length > 1) {
      fireEvent.click(upButtons[1]);
      await waitFor(() => {
        expect(alertMock).toHaveBeenLastCalledWith('カリキュラムの順序を更新し、対象生徒の未来の学習計画を再編しました。(過去の完了ログは維持されています)');
      });
    }

    // 2. カスタムタスクの上書き更新
    // 学習計画・コマ割りタブを開く
    const tabSchedule = screen.getByText('学習計画・コマ割り');
    fireEvent.click(tabSchedule);

    // 1時間目にその他を選択し、テーマを入力して保存
    const cellNum1 = screen.getByText('1', { selector: 'span' });
    const period1Select = cellNum1.parentElement!.querySelector('select')!;
    fireEvent.change(period1Select, { target: { value: 'その他' } });
    const customThemeInput = screen.getByPlaceholderText('テーマを入力（例: 面談、宿題指導）');
    fireEvent.change(customThemeInput, { target: { value: '電流の性質' } });
    
    const saveBtn = screen.getByText('時間割コマ割りを保存');
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('今日の時間割コマ割りを保存しました！');
    });

    // 同じスロットに再度別テーマのカスタムタスクを設定して保存 (existingCustomTaskIdx >= 0 の上書き処理)
    fireEvent.change(customThemeInput, { target: { value: '光の反射' } });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('今日の時間割コマ割りを保存しました！');
    });
    
    // 反映を確認
    const miniTasks = db.getLearningTasks();
    const updatedCustom = miniTasks.find(t => t.student_id === 'std-1' && t.scheduled_date === '2026-06-19' && t.period === 1);
    expect(updatedCustom?.custom_unit_name).toBe('光の反射');

    // 3. 数学や英語でのカリキュラム単元選択 (unitId) と「またはテーマを自由に入力」の変更テスト
    // 1時間目を数学に変更
    fireEvent.change(period1Select, { target: { value: '数学' } });
    // 数学に変更するとカリキュラム単元のドロップダウンが表示される
    const parentContainer = period1Select.parentElement!;
    await waitFor(() => {
      const selects = parentContainer.querySelectorAll('select');
      expect(selects.length).toBeGreaterThanOrEqual(2);
    });
    const selects = parentContainer.querySelectorAll('select');
    const unitSelect = selects[1]; // 単元セレクト
    
    // プルダウンを変更 (単元を選択)
    fireEvent.change(unitSelect, { target: { value: 'unit-101-1' } });
    
    // 数学（一般教科）では、自由入力 input は非表示（null）になっていることを確認
    await waitFor(() => {
      const unitCustomInput = parentContainer.querySelector('input[placeholder="または新しい授業名を直接入力"]') || 
                               parentContainer.querySelector('input[placeholder="テーマを入力（例: 面談、宿題指導）"]');
      expect(unitCustomInput).toBeNull();
    });
 
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('今日の時間割コマ割りを保存しました！');
    });

    // 4. AI指導報告書の手動修正および未生成保存ガードのテスト
    const tabAIReport = screen.getByText('AI指導報告書');
    fireEvent.click(tabAIReport);
    
    // レポートテキストが空の状態で保存ボタンをクリック (ガードを通過)
    const reportSaveBtn = screen.getByText('報告書を保存 ＆ 修正履歴を学習 (パターンB)');
    fireEvent.click(reportSaveBtn);
    
    // AI報告書を生成
    const generateAIBtn = screen.getByText('今月の学習ログから報告書を自動生成 (AI分析ステップ)');
    fireEvent.click(generateAIBtn);
    
    // 生成完了を待つ (setTimeoutが1.5秒)
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('AI報告書の文章を自動生成しました！');
    }, { timeout: 3000 });

    // 生成されたテキストを変更する
    const reportTextarea = document.querySelectorAll('textarea')[0];
    const originalText = reportTextarea.value;
    fireEvent.change(reportTextarea, { target: { value: originalText + '\n追加のフィードバック' } });
    
    // 保存を実行
    fireEvent.click(reportSaveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('指導報告書を保存し、文体修正履歴を学習しました！');
    });

    // 学習履歴に保存されたか確認
    const correctionLogs = db.getTeacherCorrectionsLogs();
    expect(correctionLogs.length).toBeGreaterThan(0);
    expect(correctionLogs[0].corrected_text).toContain('追加のフィードバック');

    // 5. 小テスト結果管理での変則データのカバレッジテスト
    // 不明な生徒や、宿題なし・期限なしの小テスト結果を表示させるテスト
    await db.saveMiniTestResult({
      id: 'mini-unknown-student',
      student_id: 'non-existent-student-id',
      date: '2026-06-19',
      test_content: '変則テスト',
      score: null,
      created_at: new Date().toISOString()
    });

    await db.saveHomeworkResult({
      id: 'hw-unknown-student',
      student_id: 'non-existent-student-id',
      date: '2026-06-19',
      homework_content: '変則宿題',
      homework_deadline: null,
      status: 'incomplete',
      created_at: new Date().toISOString()
    });

    // 表示更新のため生徒を切り替えて戻す
    const studentListTabBtn = screen.getAllByText('生徒一覧')[0];
    fireEvent.click(studentListTabBtn);
    const yuiItem = screen.getByText(/鈴木 結衣/);
    fireEvent.click(yuiItem);
    
    fireEvent.click(studentListTabBtn);
    const takumiItem = screen.getByText(/佐藤 拓海/);
    fireEvent.click(takumiItem);

    // 再度小テスト結果タブを開く
    const tabMiniTestsBtn2 = screen.getByText('小テスト結果');
    fireEvent.click(tabMiniTestsBtn2);

    // 反映とフォールバックの確認
    expect(screen.getByText('不明な生徒')).toBeInTheDocument();

    // 宿題提出状況タブを開く
    const tabHwBtn = screen.getByText('宿題提出状況');
    fireEvent.click(tabHwBtn);
    expect(screen.getByText('不明な生徒')).toBeInTheDocument();

    // 6. 年間計画タブのテスト (Milestones)
    // 一旦完了タスクを削除し、かつ平日（4月2週）に日付を変更して全ブランチを通す
    await db.deleteLearningTasksByStudent('std-1');

    // 日付変更のためにまず学習計画タブに戻る
    const tabScheduleForMilestones = screen.getByText('学習計画・コマ割り');
    fireEvent.click(tabScheduleForMilestones);

    const dateInput = container.querySelector('input[type="date"]')!;
    fireEvent.change(dateInput, { target: { value: '2026-04-10' } });

    const tabMilestones = screen.getByText('年間計画（マイルストーン）');
    fireEvent.click(tabMilestones);
    await waitFor(() => {
      expect(screen.getByText(/年間基準計画（マイルストーン）/)).toBeInTheDocument();
    });

    // 進捗現在地バッジが表示されているか確認
    expect(document.body.innerHTML).toContain('📍');

    // 教科の切り替え (英語へ) を追加し、onChange ブランチをカバーする
    const selectSubjectElement = container.querySelector('select[value="数学"]') as HTMLSelectElement;
    if (selectSubjectElement) {
      fireEvent.change(selectSubjectElement, { target: { value: '英語' } });
    }

    // 元に戻す
    fireEvent.click(tabScheduleForMilestones);
    fireEvent.change(dateInput, { target: { value: '2026-06-19' } });
    await db.saveLearningTasks(db.getLearningTasks()); // シード初期タスクの復元

    unmount();
  });

  it('should support student search filters and navigation fallbacks in TeacherDashboard', async () => {
    // 準備：モックデータをクリアし、シードデータをロードして初期状態を構築
    db.clearMockData();
    db.getSchools(); // これにより sch-1 (中学校) と sch-2 (小学校) が正しくシード登録されます
    db.getCurriculumUnits();
    db.getMilestonePlans();

    // 田中太郎をシードデータの中学校(sch-1)に所属させ、シード単元(unit-101-1)をstart_unit_idに設定
    const studentA: Student = {
      id: 'std-A', student_id: 'student-A', name: '田中 太郎', email: 'a@test.com',
      grade: 'chugaku3', school_id: 'sch-1', status: 'normal', start_unit_id: 'unit-101-1', created_at: ''
    };
    // grade を中3にする (日本語表記は '中3' だが、 grade フィールドの値は '中3' でシードデータと同じにする)
    studentA.grade = '中3';

    const studentB: Student = {
      id: 'std-B', student_id: 'student-B', name: '鈴木 花子', email: 'b@test.com',
      grade: '小5', school_id: 'sch-2', status: 'warning', start_unit_id: null, created_at: ''
    };
    await db.saveStudent(studentA);
    await db.saveStudent(studentB);

    const { unmount } = render(<TeacherDashboard onBackToPortal={() => {}} />);

    // 1. 初期表示で生徒一覧が表示されることを確認
    expect(screen.getByText('田中 太郎 (中3)')).toBeInTheDocument();
    expect(screen.getByText('鈴木 花子 (小5)')).toBeInTheDocument();

    // 2. 学校名検索フィルターの適用
    const schoolSelect = screen.getByLabelText('学校名検索');
    fireEvent.change(schoolSelect, { target: { value: '天登第一中学校' } });
    expect(screen.getByText('田中 太郎 (中3)')).toBeInTheDocument();
    expect(screen.queryByText('鈴木 花子 (小5)')).not.toBeInTheDocument();

    fireEvent.change(schoolSelect, { target: { value: 'テントル小学校' } });
    expect(screen.queryByText('田中 太郎 (中3)')).not.toBeInTheDocument();
    expect(screen.getByText('鈴木 花子 (小5)')).toBeInTheDocument();

    // 元に戻す
    fireEvent.change(schoolSelect, { target: { value: '' } });
    expect(screen.getByText('田中 太郎 (中3)')).toBeInTheDocument();
    expect(screen.getByText('鈴木 花子 (小5)')).toBeInTheDocument();

    // 3. 学年フィルターの適用
    const gradeSelect = screen.getByLabelText('学年');
    fireEvent.change(gradeSelect, { target: { value: '小5' } });
    expect(screen.queryByText('田中 太郎 (中3)')).not.toBeInTheDocument();
    expect(screen.getByText('鈴木 花子 (小5)')).toBeInTheDocument();

    // 元に戻す
    fireEvent.change(gradeSelect, { target: { value: '' } });

    // 4. 名前部分一致キーワードフィルターの適用
    const nameInput = screen.getByPlaceholderText('名前を入力...');
    fireEvent.change(nameInput, { target: { value: '田中' } });
    expect(screen.getByText('田中 太郎 (中3)')).toBeInTheDocument();
    expect(screen.queryByText('鈴木 花子 (小5)')).not.toBeInTheDocument();

    // 検索窓クリア
    fireEvent.change(nameInput, { target: { value: '' } });
    expect(screen.getByText('田中 太郎 (中3)')).toBeInTheDocument();
    expect(screen.getByText('鈴木 花子 (小5)')).toBeInTheDocument();

    // 5. 生徒の選択と自動遷移
    const card = screen.getByText('田中 太郎 (中3)');
    fireEvent.click(card);
    // スケジュール画面に遷移し、田中太郎が選択されていること
    expect(screen.getByText(/田中 太郎 \(ID: student-A\)/)).toBeInTheDocument();

    // 7. 解除ボタンでの解除と生徒一覧への戻り
    const clearBtn = screen.getByText('解除');
    fireEvent.click(clearBtn);
    expect(screen.queryByText(/田中 太郎 \(ID: student-A\)/)).not.toBeInTheDocument();
    expect(screen.getByText('田中 太郎 (中3)')).toBeInTheDocument();

    // 8. 未選択時に個別メニューをクリックした場合のフォールバックUIの確認
    const scheduleMenuBtn = screen.getByRole('button', { name: '学習計画・コマ割り' });
    fireEvent.click(scheduleMenuBtn);
    // フォールバック画面が表示される
    expect(screen.getByText('生徒が選択されていません。左のメニューから「生徒一覧」を表示し、生徒を選択してください。')).toBeInTheDocument();

    // 「生徒一覧へ」ボタンクリック
    const goToListBtn = screen.getByRole('button', { name: '生徒一覧へ' });
    fireEvent.click(goToListBtn);
    expect(screen.getByText('田中 太郎 (中3)')).toBeInTheDocument();

    // 9. 中学生かつ start_unit_id ありの状態でマイルストーン計画を表示させてブランチカバー
    await db.saveLearningTasks([
      {
        id: 'task-A-completed-1',
        student_id: 'std-A',
        unit_id: 'unit-108-4',
        scheduled_date: '2026-06-20',
        period: 1,
        status: 'completed',
        video_watched: true,
        test_passed: true,
        office_note: '',
        actual_completed_date: '2026-06-20',
        created_at: new Date().toISOString()
      }
    ]);
    const cardA = screen.getByText('田中 太郎 (中3)');
    fireEvent.click(cardA);

    const milestoneMenuBtn = screen.getByRole('button', { name: '年間計画（マイルストーン）' });
    fireEvent.click(milestoneMenuBtn);
    // テーブルの中の進捗現在地が表示されるのを明示的に待ちます
    await waitFor(() => {
      expect(document.body.innerHTML).toContain('📍');
      expect(document.body.innerHTML).toContain('テーマ');
    });
    // 表示月を「すべて」に切り替えて、4月の単元「文字を使った式」が表示されるようにする
    const allMonthBtn = screen.getByRole('button', { name: 'すべて' });
    fireEvent.click(allMonthBtn);

    // 「文字を使った式」が select の value として描画されていることを確認
    const hasUnit1 = Array.from(document.querySelectorAll('select')).some(select => select.value.includes('文字を使った式'));
    expect(hasUnit1).toBe(true);

    // 対象教科を「英語」に切り替えて onChange ブランチをカバー
    const labels = Array.from(document.querySelectorAll('label'));
    const subjectLabel = labels.find(l => l.textContent?.includes('対象教科:'));
    if (subjectLabel) {
      const select = subjectLabel.nextElementSibling as HTMLSelectElement;
      if (select) {
        fireEvent.change(select, { target: { value: '英語' } });
        fireEvent.change(select, { target: { value: '数学' } });
      }
    }

    // 10. 小学生の状態でマイルストーン計画を表示させて教科の算数ブランチカバー
    const studentListTabBtn2 = screen.getAllByText('生徒一覧')[0];
    fireEvent.click(studentListTabBtn2);
    const cardB = screen.getByText('鈴木 花子 (小5)');
    fireEvent.click(cardB);

    fireEvent.click(milestoneMenuBtn);
    // 教科セレクトボックスで「算数」が表示されていることを確認
    expect(screen.getByRole('option', { name: '算数' })).toBeInTheDocument();

    unmount();
    db.clearMockData();
    db.getSchools();
    db.getStudents();
  });

  it('should support milestone customization and template CRUD lifecycle', async () => {
    db.clearMockData();
    db.getSchools();
    db.getStudents();
    db.getCurriculumUnits();
    db.getMilestonePlans();

    // 1. 新規生徒登録フォームでレベルBを指定して発行する
    const { container, unmount } = render(<TeacherDashboard onBackToPortal={() => {}} />);
    const createStudentTabBtn = screen.getAllByText('新規生徒アカウント発行')[0];
    fireEvent.click(createStudentTabBtn);

    const inputName = screen.getByPlaceholderText('例: 佐藤 拓海');
    fireEvent.change(inputName, { target: { value: 'レベルB太郎' } });

    const newStudentForm = screen.getByText('1クリックアカウント発行').closest('form')!;
    const formSelects = newStudentForm.querySelectorAll('select');
    fireEvent.change(formSelects[0], { target: { value: '中1' } });
    fireEvent.change(formSelects[1], { target: { value: 'sch-1' } });
    fireEvent.change(formSelects[2], { target: { value: 'B' } });

    const submitBtn = screen.getByText('1クリックアカウント発行');
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('生徒アカウントを発行しました'));
    });
    alertMock.mockClear();

    // 2. 年間計画画面を表示する
    const studentListTabBtn = screen.getAllByText('生徒一覧')[0];
    fireEvent.click(studentListTabBtn);

    const studentItem = screen.getByText(/レベルB太郎/);
    fireEvent.click(studentItem);

    const milestoneMenuBtn = screen.getByRole('button', { name: '年間計画（マイルストーン）' });
    fireEvent.click(milestoneMenuBtn);

    // レベルトグルでBが選択されていることを確認
    const levelBBtn = screen.getByRole('button', { name: 'レベルB (標準)' });
    expect(levelBBtn).toHaveClass(/segmentBtnActive/);

    // レベルトグルをCに切り替える
    const levelCBtn = screen.getByRole('button', { name: 'レベルC (基礎)' });
    fireEvent.click(levelCBtn);
    expect(levelCBtn).toHaveClass(/segmentBtnActive/);

    // レベルトグルをBに切り替える
    fireEvent.click(levelBBtn);
    expect(levelBBtn).toHaveClass(/segmentBtnActive/);

    // レベルトグルをAに切り替える
    const levelABtn = screen.getByRole('button', { name: 'レベルA (発展)' });
    fireEvent.click(levelABtn);
    expect(levelABtn).toHaveClass(/segmentBtnActive/);

    // 3. マイルストーン行の追加
    const addMonthSelect = container.querySelector('#add-month-select')!;
    const addWeekSelect = container.querySelector('#add-week-select')!;
    fireEvent.change(addMonthSelect, { target: { value: '10' } });
    fireEvent.change(addWeekSelect, { target: { value: '1' } });

    const addRowBtn = screen.getByText('➕ 行を追加');
    fireEvent.click(addRowBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('新しいマイルストーン行を追加しました。');
    });
    alertMock.mockClear();

    // 2行目の追加 (空文字チャプター同士の比較用)
    fireEvent.change(addMonthSelect, { target: { value: '10' } });
    fireEvent.change(addWeekSelect, { target: { value: '2' } });
    fireEvent.click(addRowBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('新しいマイルストーン行を追加しました。');
    });
    alertMock.mockClear();

    expect(screen.getAllByText('10月').length).toBeGreaterThan(0);

    // 4. マイルストーン行の上下移動
    const upButtons = screen.getAllByTitle('上へ');
    // 境界のテスト (一番上をさらに上へ移動 -> 早期リターンされるためアラートは呼ばれない)
    fireEvent.click(upButtons[0]);
    expect(alertMock).not.toHaveBeenCalled();

    // 正常移動
    fireEvent.click(upButtons[1]);

    const downButtons = screen.getAllByTitle('下へ');
    // 境界のテスト (一番下をさらに下へ移動 -> 早期リターンされるためアラートは呼ばれない)
    fireEvent.click(downButtons[downButtons.length - 1]);
    expect(alertMock).not.toHaveBeenCalled();

    // 正常移動
    fireEvent.click(downButtons[0]);

    // 5. 休校日トグル
    const holidayButtons = screen.getAllByTitle('休校日の切り替え');
    fireEvent.click(holidayButtons[0]); // トグル ON
    const holidayInputs = container.querySelectorAll('input[placeholder="休校理由を入力"]');
    if (holidayInputs.length > 0) {
      fireEvent.change(holidayInputs[0], { target: { value: 'テスト休校理由' } });
    }
    await waitFor(() => {
      expect(screen.getByText('🎉 テスト休校理由')).toBeInTheDocument();
    });

    if (holidayInputs.length > 0) {
      fireEvent.change(holidayInputs[0], { target: { value: '' } });
    }
    await waitFor(() => {
      expect(screen.getByText('🎉 休校日')).toBeInTheDocument();
    });
    fireEvent.click(holidayButtons[0]); // トグル OFF

    // 6. 章、単元名、目標テーマ、到達順序の編集
    const chapterInputs = container.querySelectorAll('input[placeholder="例: 第1章 正の数・負の数"]');
    if (chapterInputs.length > 0) {
      fireEvent.change(chapterInputs[0], { target: { value: '第1章 新たな章' } });
    }

    const unitInputs = container.querySelectorAll('input[placeholder="例: 加法と減法"]');
    if (unitInputs.length > 0) {
      fireEvent.change(unitInputs[0], { target: { value: '新しい単元名' } });
    }

    const seqInputs = container.querySelectorAll('input[title="目標到達シーケンス順序"]');
    if (seqInputs.length > 0) {
      fireEvent.change(seqInputs[0], { target: { value: '15' } });
      fireEvent.change(seqInputs[0], { target: { value: '' } });
    }

    const themeSelects = container.querySelectorAll('select');
    const themeSelect = Array.from(themeSelects).find(s => s.innerHTML.includes('テーマを選択'));
    if (themeSelect) {
      fireEvent.change(themeSelect, { target: { value: '正の数と負の数' } });
      fireEvent.change(themeSelect, { target: { value: '' } });
    }

    // 7. 章の順序一括変更
    const chapterUpBtn = screen.getAllByTitle('章を上へ移動');
    if (chapterUpBtn.length > 0) {
      // 境界のテスト (一番上をさらに上へ移動 -> 早期リターンされるためアラートは呼ばれない)
      fireEvent.click(chapterUpBtn[0]);
      expect(alertMock).not.toHaveBeenCalled();
    }

    if (chapterUpBtn.length > 1) {
      fireEvent.click(chapterUpBtn[1]);
      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('章の順序を入れ替えました。');
      });
      alertMock.mockClear();
    }

    const chapterDownBtn = screen.getAllByTitle('章を下へ移動');
    if (chapterDownBtn.length > 0) {
      // 境界のテスト (一番下をさらに下へ移動 -> 早期リターンされるためアラートは呼ばれない)
      fireEvent.click(chapterDownBtn[chapterDownBtn.length - 1]);
      expect(alertMock).not.toHaveBeenCalled();

      // 正常移動のテスト
      fireEvent.click(chapterDownBtn[0]);
      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('章の順序を入れ替えました。');
      });
      alertMock.mockClear();
    }

    // 8. テンプレート保存
    const templateInput = screen.getByPlaceholderText(/現在の計画をテンプレート名として保存/);
    
    // 空文字での保存テスト (何も起こらない/リターンされる)
    fireEvent.change(templateInput, { target: { value: '   ' } });
    const saveTemplateBtn = screen.getByText('計画テンプレートを保存');
    fireEvent.click(saveTemplateBtn);
    expect(alertMock).not.toHaveBeenCalled();

    // 正常な保存テスト
    fireEvent.change(templateInput, { target: { value: 'テスト用カスタムテンプレート' } });
    fireEvent.click(saveTemplateBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('テンプレートを保存しました。');
    });
    alertMock.mockClear();

    // 保存したテンプレートをセレクトボックスから選択する
    const templateSelect = screen.getByText('保存済みテンプレート:').nextElementSibling as HTMLSelectElement;
    const option = Array.from(templateSelect.options).find(opt => opt.text.includes('テスト用カスタムテンプレート'));
    fireEvent.change(templateSelect, { target: { value: option!.value } });

    // 9. 保存済みテンプレートの適用、名称変更、削除
    const applyBtn = screen.getByText('呼び出して適用');
    fireEvent.click(applyBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('適用しました'));
    });
    alertMock.mockClear();

    const editNameBtn = screen.getByText('名称変更');
    fireEvent.click(editNameBtn);
    const cancelEditBtn = screen.getByText('キャンセル');
    fireEvent.click(cancelEditBtn);
    // 再度名称変更を開く (再レンダリング後の最新のボタン要素を再取得)
    const editNameBtn2 = screen.getByText('名称変更');
    fireEvent.click(editNameBtn2);
    const templateNameInput = await screen.findByDisplayValue('テスト用カスタムテンプレート');

    // 空文字で更新テスト (何も起こらない/リターンされる)
    fireEvent.change(templateNameInput, { target: { value: '' } });
    const saveNameBtn = screen.getByText('保存');
    fireEvent.click(saveNameBtn);
    expect(alertMock).not.toHaveBeenCalled();

    // 正常な更新テスト
    fireEvent.change(templateNameInput, { target: { value: '編集後テンプレート' } });
    fireEvent.click(saveNameBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('テンプレート名を更新しました'));
    });
    alertMock.mockClear();

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deleteTemplateBtn = screen.getByText('削除');
    fireEvent.click(deleteTemplateBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('テンプレートを削除しました。');
    });
    alertMock.mockClear();
    confirmSpy.mockRestore();

    // 10. 行の削除
    const deleteRowButtons = screen.getAllByTitle('行削除');
    fireEvent.click(deleteRowButtons[0]);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('マイルストーン行を削除しました。');
    });
    alertMock.mockClear();

    unmount();
  });

  // 4. 生徒情報詳細 (新規メニュー生徒情報、自動進級、個性、対応履歴) の結合テスト
  it('should support student detail features including auto-grade promotion, personality tags, and interaction logging', async () => {
    // 2025年度に「小5」で登録された鈴木結衣（std-2）は、2026年度には「小6」になっているはず
    const allSt = db.getStudents();
    const yui = allSt.find(s => s.id === 'std-2')!;
    expect(yui.grade).toBe('小6'); // 自動進級の検証

    const { unmount } = render(<TeacherDashboard onBackToPortal={() => {}} />);

    // 左メニューの「生徒情報」タブをクリック
    const studentDetailTabBtn = screen.getByText('生徒情報');
    await act(async () => {
      fireEvent.click(studentDetailTabBtn);
    });

    // 生徒が選択されていない状態の文言を検証
    expect(screen.getByText(/生徒が選択されていません/)).toBeInTheDocument();

    // 生徒一覧に戻ってまず佐藤拓海を選択する（佐藤拓海は登録時level/classroom/teacher_in_chargeが設定されていないためフォールバックを評価できる）
    const studentListTabBtn = screen.getAllByText('生徒一覧')[0];
    await act(async () => {
      fireEvent.click(studentListTabBtn);
    });

    const studentItemTakumi = screen.getByText(/佐藤 拓海/);
    await act(async () => {
      fireEvent.click(studentItemTakumi);
    });

    await waitFor(() => {
      expect(screen.getByText('佐藤 拓海 (中3)', { selector: 'div' })).toBeInTheDocument();
    });

    // 「生徒情報」タブをクリック（フォールバック表示を確認）
    await act(async () => {
      fireEvent.click(studentDetailTabBtn);
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('佐藤 拓海')).toBeInTheDocument();
    });

    // 再度生徒一覧に戻って鈴木結衣を選択する
    await act(async () => {
      fireEvent.click(studentListTabBtn);
    });

    const studentItemYui = screen.getByText(/鈴木 結衣/);
    await act(async () => {
      fireEvent.click(studentItemYui);
    });

    await waitFor(() => {
      expect(screen.getByText('鈴木 結衣 (小6)', { selector: 'div' })).toBeInTheDocument();
    });

    // 再度「生徒情報」タブをクリック
    await act(async () => {
      fireEvent.click(studentDetailTabBtn);
    });

    // 鈴木結衣の詳細情報が表示されていること、および初期状態では対応履歴がないことを検証
    await waitFor(() => {
      expect(screen.getByDisplayValue('鈴木 結衣')).toBeInTheDocument();
      expect(screen.getByDisplayValue('スズキ ユイ')).toBeInTheDocument();
      expect(screen.getByText('対応履歴はまだありません。')).toBeInTheDocument();
      // テストレコードが無い時の fallback (3140, 3181 の false ブランチ) をアサート
      expect(screen.getByText('定期テスト記録がありません。')).toBeInTheDocument();
      expect(screen.getByText('模試の記録がありません。')).toBeInTheDocument();
    });

    // ここでテストレコードを登録する
    // 3209行目の failed アラートカバー用のタスク
    await db.saveLearningTasks([
      ...db.getLearningTasks(),
      {
        id: 'task-failed-std2',
        student_id: 'std-2',
        unit_id: 'unit-101-1',
        scheduled_date: '2026-06-18',
        period: 1,
        status: 'failed' as const,
        video_watched: false,
        test_passed: false,
        created_at: new Date().toISOString()
      }
    ]);

    // 3290-3291行目の各カテゴリデザイン分岐カバー用の対応履歴
    const categories = ['保護者対応', '人生相談', '学校相談', 'その他'] as const;
    for (let i = 0; i < categories.length; i++) {
      await db.saveStudentInteraction({
        id: `si-std2-extra-${i}`,
        student_id: 'std-2',
        category: categories[i],
        memo: `カテゴリ ${categories[i]} のテスト用対応ログ`,
        date: '2026-06-20',
        staff_name: '福田',
        created_at: new Date(Date.now() - (i + 1) * 60000).toISOString()
      });
    }

    await db.saveTestRecord({
      id: 'tr-std2-1',
      student_id: 'std-2',
      record_type: 'regular_test',
      subject: '算数',
      score: 80,
      rank_change: 'up',
      rate_change: 5,
      next_target_score: 90,
      created_at: '2026-06-20T10:00:00Z'
    });

    await db.saveTestRecord({
      id: 'tr-std2-2',
      student_id: 'std-2',
      record_type: 'mock_exam',
      subject: '算数',
      score: 85,
      target_school_code: 'schcode-A',
      created_at: '2026-06-21T10:00:00Z'
    });

    // target_school_code がマスタに存在しないものも追加 (3189 の fallback カバー)
    await db.saveTestRecord({
      id: 'tr-std2-3',
      student_id: 'std-2',
      record_type: 'mock_exam',
      subject: '算数',
      score: 85,
      target_school_code: 'unknown-sch',
      created_at: '2026-06-22T10:00:00Z'
    });

    // 定期テストをもう1件追加して、sort関数の比較ブランチをカバー (TeacherDashboard 3141行目)
    await db.saveTestRecord({
      id: 'tr-std2-1-older',
      student_id: 'std-2',
      record_type: 'regular_test',
      subject: '数学',
      score: 75,
      rank_change: 'keep',
      rate_change: 0,
      created_at: '2026-06-19T10:00:00Z'
    });

    // 各編集フォームのフィールドに入力するテスト (TeacherDashboard 2830-2998 の onChange カバー)
    const nameInput = screen.getByPlaceholderText('氏名（漢字）');
    fireEvent.change(nameInput, { target: { value: '鈴木 結衣子' } });

    const nameKanaInput = screen.getByPlaceholderText('氏名（フリガナ）');
    fireEvent.change(nameKanaInput, { target: { value: 'スズキ ユイコ' } });

    // 存在しない学校名
    const schoolNameInput = screen.getByPlaceholderText('学校名');
    fireEvent.change(schoolNameInput, { target: { value: '存在しない学校名' } });
    // 存在する学校名 (Matched branch in school_name onChange)
    fireEvent.change(schoolNameInput, { target: { value: '天登第一中学校' } });

    const birthdayInput = screen.getByLabelText('生年月日');
    fireEvent.change(birthdayInput, { target: { value: '2013-05-15' } });

    const teacherMasterSelect = screen.getByTestId('teacher-master-select');
    fireEvent.change(teacherMasterSelect, { target: { value: '佐藤 舞' } });
    fireEvent.click(screen.getByTestId('add-teacher-btn'));

    const clubInput = screen.getByPlaceholderText('例: サッカー部');
    fireEvent.change(clubInput, { target: { value: 'テニス部' } });

    const hobbiesInput = screen.getByPlaceholderText('例: 将棋・動画編集');
    fireEvent.change(hobbiesInput, { target: { value: '読書' } });

    const parentInput = screen.getByPlaceholderText('例: 佐藤 健二');
    fireEvent.change(parentInput, { target: { value: '鈴木 太郎' } });

    const parentKanaInput = screen.getByPlaceholderText('例: サトウ ケンジ');
    fireEvent.change(parentKanaInput, { target: { value: 'スズキ タロウ' } });

    // 志望校テスト（最大3校および追加・削除）
    const addTargetSchoolBtn = screen.getByText('＋ 志望校を追加');
    fireEvent.click(addTargetSchoolBtn);

    const targetSchoolInputs = screen.getAllByPlaceholderText('志望校名（例: 天登星雲高校）');
    fireEvent.change(targetSchoolInputs[0], { target: { value: '恵比寿第一高校' } });
    if (targetSchoolInputs[1]) {
      fireEvent.change(targetSchoolInputs[1], { target: { value: '渋谷第二高校' } });
    }

    const courseInputs = screen.getAllByPlaceholderText('学科・コース名（例: 普通科 特進コース）');
    if (courseInputs[0]) {
      fireEvent.change(courseInputs[0], { target: { value: '普通科 特進コース' } });
    }

    const phoneInput = screen.getByPlaceholderText('例: 090-7039-0656');
    fireEvent.change(phoneInput, { target: { value: '080-1234-5678' } });

    // 1. 学年の手動変更のテスト
    const gradeSelect = screen.getByLabelText('学年（登録時の学年を反映）');
    fireEvent.change(gradeSelect, { target: { value: '中1' } });
    await waitFor(() => {
      expect(gradeSelect).toHaveValue('中1');
    });
    
    // 保存ボタンをクリック
    const saveBtn = screen.getByText('変更を保存する');
    fireEvent.click(saveBtn);
    
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('生徒情報を保存しました。');
    });
    alertMock.mockClear();

    // 趣味 (hobbies) を変更する
    const hobbiesInput2 = screen.getByPlaceholderText('例: 将棋・動画編集');
    fireEvent.change(hobbiesInput2, { target: { value: 'サッカー・音楽鑑賞' } });

    // 学年はすでに '中1' で、期待される学年と同じになっているため、今度は学年変更なしでの保存 (db.ts 703 行目の false ブランチのカバー)
    const saveBtn2 = screen.getByText('変更を保存する');
    fireEvent.click(saveBtn2);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('生徒情報を保存しました。');
    });
    alertMock.mockClear();

    // ここで、先ほど登録したテストデータがロードされていることをアサートする (3140, 3181 の true ブランチ)
    await waitFor(() => {
      expect(screen.getAllByText(/定期テスト（最新）/)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/80/)[0]).toBeInTheDocument();
      expect(screen.getByText(/▲ 上昇/)).toBeInTheDocument();
      expect(screen.getAllByText(/模試実績（最新）/)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/85/)[0]).toBeInTheDocument();
      expect(screen.getByText(/unknown-sch/)).toBeInTheDocument();
    });

    // 新しく regular_test で rank_change: 'keep' の最新レコードを登録し、キープのブランチをテストする
    await db.saveTestRecord({
      id: 'tr-std2-keep',
      student_id: 'std-2',
      record_type: 'regular_test',
      subject: '国語',
      score: 78,
      rank_change: 'keep',
      rate_change: 0,
      next_target_score: 80,
      created_at: '2026-06-23T10:00:00Z' // 2026-06-20 (tr-std2-1) より新しい日付
    });

    // リロードまたは情報再描画のために他生徒を選択してから再度鈴木結衣を選択する
    await act(async () => {
      fireEvent.click(studentListTabBtn);
    });
    const studentItemTakumiForSwitch = screen.getByText(/佐藤 拓海/);
    await act(async () => {
      fireEvent.click(studentItemTakumiForSwitch);
    });
    // 佐藤拓海が選択された状態になる（サイドバーの選択中表示など）のを待つ
    await waitFor(() => {
      expect(screen.getByText('佐藤 拓海 (中3)', { selector: 'div' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(studentListTabBtn);
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/鈴木 結衣/));
    });
    // 鈴木結衣が選択された状態になるのを待つ
    await waitFor(() => {
      expect(screen.getByText('鈴木 結衣子 (中1)', { selector: 'div' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(studentDetailTabBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('キープ')).toBeInTheDocument();
    });

    // 画像ファイル添付テスト (生徒写真・保護者写真)
    const fileInputList = document.querySelectorAll('input[type="file"]');
    const dummyFile = new File(['dummy content'], 'photo.png', { type: 'image/png' });
    
    if (fileInputList[0]) {
      fireEvent.change(fileInputList[0], { target: { files: [dummyFile] } });
    }

    if (fileInputList[1]) {
      fireEvent.change(fileInputList[1], { target: { files: [dummyFile] } });
    }

    // 志望校追加 (最大3校まで)
    const addTargetBtn = screen.getByText('＋ 志望校を追加');
    fireEvent.click(addTargetBtn); // 2校目
    fireEvent.click(addTargetBtn); // 3校目

    const extraTargetSchoolInputs = screen.getAllByPlaceholderText('志望校名（例: 天登星雲高校）');
    expect(extraTargetSchoolInputs.length).toBe(3);

    // 削除ボタンテスト
    const deleteBtns = screen.getAllByTitle('この志望校を削除');
    if (deleteBtns.length > 0) {
      fireEvent.click(deleteBtns[0]);
    }

    // 2. 個性の追加・削除テスト
    // 未入力・未選択での追加テスト (guard clause)
    const addPersonalityBtn = screen.getByText('＋ 追加');
    await act(async () => {
      fireEvent.click(addPersonalityBtn);
    });

    // 用意された個性から選択して追加
    const personalitySelect = screen.getByLabelText('マスタから選ぶ');
    fireEvent.change(personalitySelect, { target: { value: '合唱実行委員長' } });
    await waitFor(() => {
      expect(personalitySelect).toHaveValue('合唱実行委員長');
    });

    await act(async () => {
      fireEvent.click(addPersonalityBtn);
    });
    await waitFor(() => {
      expect(screen.getAllByText('合唱実行委員長').length).toBeGreaterThanOrEqual(1);
    });

    // 新規に個性を入力して追加
    const personalityInput = screen.getByPlaceholderText('新しい個性を入力...');
    fireEvent.change(personalityInput, { target: { value: '負けず嫌い' } });
    await waitFor(() => {
      expect(personalityInput).toHaveValue('負けず嫌い');
    });

    await act(async () => {
      fireEvent.click(addPersonalityBtn);
    });
    await waitFor(() => {
      expect(screen.getByText('負けず嫌い', { selector: 'span' })).toBeInTheDocument();
    });

    // 重複した個性を追加しようとするとアラートが出るテスト
    fireEvent.change(personalityInput, { target: { value: '負けず嫌い' } });
    await act(async () => {
      fireEvent.click(addPersonalityBtn);
    });
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('この個性は既に登録されています。');
    });
    alertMock.mockClear();

    // 個性を削除する
    const removeBtn = screen.getAllByText('×').find(btn => btn.closest('span')?.textContent?.includes('負けず嫌い'))!;
    fireEvent.click(removeBtn);
    await waitFor(() => {
      expect(screen.queryByText('負けず嫌い', { selector: 'span' })).not.toBeInTheDocument();
    });

    // 残りの個性タグもすべて削除する (personalities=[] のカバー)
    let remainingRemoveBtns = screen.queryAllByText('×');
    while (remainingRemoveBtns.length > 0) {
      fireEvent.click(remainingRemoveBtns[0]);
      await waitFor(() => {
        remainingRemoveBtns = screen.queryAllByText('×');
      });
    }
    expect(screen.getByText('個性タグが登録されていません。')).toBeInTheDocument();

    // 3. 対応履歴の登録と表示テスト
    // メモが空の状態での登録テスト (guard clause)
    const addInteractionBtn = screen.getByText('対応内容を登録');
    await act(async () => {
      fireEvent.submit(addInteractionBtn.closest('form')!);
    });

    const categorySelect = screen.getByLabelText('種別');
    fireEvent.change(categorySelect, { target: { value: '勉強相談' } });
    await waitFor(() => {
      expect(categorySelect).toHaveValue('勉強相談');
    });

    const memoTextarea = screen.getByPlaceholderText('具体的な対応メモを入力...');
    fireEvent.change(memoTextarea, { target: { value: '期末テストに向けての学習スケジュールを話し合いました。' } });
    await waitFor(() => {
      expect(memoTextarea).toHaveValue('期末テストに向けての学習スケジュールを話し合いました。');
    });

    const dateInput = screen.getByLabelText('日付');
    fireEvent.change(dateInput, { target: { value: '2026-06-25' } }); // 日付を変更して onChange を発火させる

    await act(async () => {
      fireEvent.submit(addInteractionBtn.closest('form')!);
    });

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('対応内容を登録しました。');
    });
    alertMock.mockClear();

    // 登録された対応がタイムラインに表示されているか検証
    expect(screen.getByText('期末テストに向けての学習スケジュールを話し合いました。')).toBeInTheDocument();
    expect(screen.getByText('2026/06/25')).toBeInTheDocument();
    expect(screen.getByText('勉強相談', { selector: 'span' })).toBeInTheDocument();

    // 鈴木結衣のレベルを C に変更して保存し、StudentDashboard のレベルC目標 (70点) のブランチをテストする
    const levelSelect = screen.getByLabelText('学習レベル');
    fireEvent.change(levelSelect, { target: { value: 'C' } });

    const saveBtnLevel = screen.getByText('変更を保存する');
    fireEvent.submit(saveBtnLevel.closest('form')!);
    
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('生徒情報を保存しました。');
    });
    alertMock.mockClear();

    // --- エラー系の catch ブロックのカバーテスト (TeacherDashboard 400, 428, 462-463 カバー) ---
    // 1. 生徒情報保存エラー
    const saveStudentSpy = vi.spyOn(db, 'saveStudent').mockRejectedValueOnce(new Error('Save failed'));
    const saveBtnError = screen.getByText('変更を保存する');
    fireEvent.submit(saveBtnError.closest('form')!);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('保存中にエラーが発生しました。'));
    });
    alertMock.mockClear();
    saveStudentSpy.mockRestore();

    // 2. 個性の追加エラー
    const addOptionSpy = vi.spyOn(db, 'addPersonalityOption').mockRejectedValueOnce(new Error('Add failed'));
    const errorPersonalityInput = screen.getByPlaceholderText('新しい個性を入力...');
    fireEvent.change(errorPersonalityInput, { target: { value: 'エラー個性' } });
    const addPersonalityBtnError = screen.getByText('＋ 追加');
    await act(async () => {
      fireEvent.click(addPersonalityBtnError);
    });
    await waitFor(() => {
      expect(addOptionSpy).toHaveBeenCalled();
    });
    addOptionSpy.mockRestore();

    // 3. 対応履歴登録エラー
    const saveInterSpy = vi.spyOn(db, 'saveStudentInteraction').mockRejectedValueOnce(new Error('Save failed'));
    const errorMemoTextarea = screen.getByPlaceholderText('具体的な対応メモを入力...');
    fireEvent.change(errorMemoTextarea, { target: { value: 'エラー対応ログ' } });
    const addInteractionBtnError = screen.getByText('対応内容を登録');
    await act(async () => {
      fireEvent.submit(addInteractionBtnError.closest('form')!);
    });
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('登録中にエラーが発生しました。');
    });
    alertMock.mockClear();
    saveInterSpy.mockRestore();

    // --- 3157, 3161, 3208 行目のカバレッジ向上のためのテスト ---
    // タスク無し、定期テストの rank_change: 'down' / 'keep' および rate_change: -5 / 0 を持つ生徒の登録
    const noTaskStudent = {
      id: 'notask-std',
      student_id: 'notask101',
      name: 'タスク無し生徒',
      grade: '中1' as const,
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      level: 'A' as const,
      status: 'normal' as const,
      created_at: new Date().toISOString()
    };
    await db.saveStudent(noTaskStudent);
    
    await db.saveTestRecord({
      id: 'tr-notask-1',
      student_id: 'notask-std',
      record_type: 'regular_test',
      subject: '英語',
      score: 60,
      rank_change: 'down',
      rate_change: -5,
      created_at: '2026-06-20T10:00:00Z'
    });

    await db.saveTestRecord({
      id: 'tr-notask-2',
      student_id: 'notask-std',
      record_type: 'regular_test',
      subject: '英語',
      score: 65,
      rank_change: 'down',
      rate_change: -5,
      created_at: '2026-06-21T10:00:00Z'
    });

    // リフレッシュのために既存の生徒（鈴木結衣）の変更を保存する
    const forceSaveBtn = screen.getByText('変更を保存する');
    fireEvent.submit(forceSaveBtn.closest('form')!);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('生徒情報を保存しました。');
    });
    alertMock.mockClear();

    // 生徒一覧メニューに遷移する
    const studentListMenuBtn = screen.getByText('生徒一覧');
    fireEvent.click(studentListMenuBtn);

    // 新規生徒をクリック (レンダリング完了を待つ)
    await waitFor(() => {
      expect(screen.getByText(/タスク無し生徒/)).toBeInTheDocument();
    });
    const studentItem = screen.getByText(/タスク無し生徒/);
    fireEvent.click(studentItem);

    // 生徒情報メニューに遷移して詳細を表示する
    const studentInfoMenuBtn = screen.getByText('生徒情報');
    fireEvent.click(studentInfoMenuBtn);

    // 下降（rank_change='down'）、進捗率: 0% （タスク数0）をアサート
    await waitFor(() => {
      expect(screen.queryAllByText(/下降/).length).toBeGreaterThanOrEqual(1);
      expect(screen.queryAllByText(/進捗率/).length).toBeGreaterThanOrEqual(1);
    });
    // ----------------------------------------------------------------------------------

    unmount();

    // 鈴木結衣がレベルCになったので、本日のミニテストを登録し、StudentDashboard をレンダーして合格ラインが 70点になるブランチを通す
    await db.saveMiniTestResult({
      id: 'mini-c-1',
      student_id: 'std-2',
      date: '2026-06-19',
      test_content: 'レベルC向け計算小テスト',
      score: 75,
      created_at: new Date().toISOString()
    });

    const studentDashboardData = db.getStudents().find(s => s.id === 'std-2')!;
    expect(studentDashboardData.level).toBe('C');

    const { unmount: studentUnmount } = render(
      <StudentDashboard 
        key="student-dashboard-c"
        student={studentDashboardData} 
        onBackToPortal={() => {}} 
      />
    );

    // 合格ラインが70点目標で75点なので「合格」になっていることを検証
    await waitFor(() => {
      expect(screen.getByText(/目標:.*70.*点/)).toBeInTheDocument();
      expect(screen.getByText('合格 ✨')).toBeInTheDocument();
    });

    studentUnmount();

    // レベルB (合格目標 80点) のブランチを通すためのテスト
    const studentB = { ...studentDashboardData, level: 'B' as const };
    await db.saveStudent(studentB);

    await db.saveMiniTestResult({
      id: 'mini-b-1',
      student_id: 'std-2',
      date: '2026-06-19',
      test_content: 'レベルB向け発展小テスト',
      score: 85,
      created_at: new Date().toISOString()
    });

    const { unmount: studentUnmountB } = render(
      <StudentDashboard 
        key="student-dashboard-b"
        student={studentB} 
        onBackToPortal={() => {}} 
      />
    );

    // 合格ラインが80点目標で85点なので「合格」になっていることを検証 (StudentDashboard:303 の Level B カバー)
    await waitFor(() => {
      expect(screen.getAllByText(/目標:.*80.*点/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('合格 ✨')).toBeInTheDocument();
    });

    studentUnmountB();
  });

  it('should support drag and drop reordering, holiday name updates, and date input onChange', async () => {
    db.clearMockData();
    db.getSchools();
    db.getStudents();
    db.getCurriculumUnits();
    
    const originalPlans = db.getMilestonePlans();
    const basePlan = originalPlans[0];
    const dummyPlans = [
      {
        ...basePlan,
        id: 'mp-dummy-1',
        grade: '中3',
        subject: '数学',
        level: 'A',
        course: 'standard',
        month: 4,
        week_number: 1,
        target_theme_name: '非常に長くて25文字を超えるような特別に用意した数学のテーマ名です',
        chapter: ''
      },
      {
        ...basePlan,
        id: 'mp-dummy-2',
        grade: '中3',
        subject: '数学',
        level: 'A',
        course: 'standard',
        month: 4,
        week_number: 2,
        target_theme_name: '18文字を超える長い数学のテーマ',
        chapter: '第2章'
      },
      {
        ...basePlan,
        id: 'mp-dummy-3',
        grade: '中3',
        subject: '数学',
        level: 'A',
        course: 'standard',
        month: 4,
        week_number: 3,
        target_theme_name: '12文字を超えるテーマ',
        chapter: '第3章'
      }
    ] as any;
    await db.saveMilestonePlans([...originalPlans, ...dummyPlans]);

    const { container, unmount } = render(<TeacherDashboard onBackToPortal={() => {}} />);
    
    const studentItem = screen.getByText(/佐藤 拓海/);
    fireEvent.click(studentItem);
    const milestoneMenuBtn = screen.getByRole('button', { name: '年間計画（マイルストーン）' });
    fireEvent.click(milestoneMenuBtn);

    const allMonthBtn = screen.getByRole('button', { name: 'すべて' });
    fireEvent.click(allMonthBtn);

    // 各月の個別フィルターボタンをクリックして 2509行目の onClick ブランチをカバー
    const aprilBtn = screen.getByRole('button', { name: '4月' });
    fireEvent.click(aprilBtn);
    fireEvent.click(allMonthBtn); // 戻す

    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThanOrEqual(2);

    const dataTransfer = {
      effectAllowed: 'none',
      setData: vi.fn(),
      getData: vi.fn()
    };
    
    fireEvent.dragStart(rows[0], { dataTransfer });
    fireEvent.dragOver(rows[1]);
    fireEvent.drop(rows[1], { dataTransfer });
    fireEvent.dragEnd(rows[0]);

    fireEvent.dragStart(rows[0], { dataTransfer });
    fireEvent.drop(rows[0], { dataTransfer });
    
    fireEvent.dragStart(rows[0]);
    fireEvent.dragOver(rows[1]);
    fireEvent.drop(rows[1]);
    fireEvent.dragEnd(rows[0]);

    const studentInfoMenuBtn = screen.getByText('生徒情報');
    fireEvent.click(studentInfoMenuBtn);

    // 氏名（漢字）インプットを空にして 2977行目の editForm.name || '' ブランチをカバー
    const nameInput = container.querySelector('input[placeholder="氏名（漢字）"]')!;
    expect(nameInput).toBeInTheDocument();
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.change(nameInput, { target: { value: '佐藤 拓海' } });

    // 対応履歴の日付変更（現在の日付とは異なる日付を設定して確実に onChange を走らせる）
    const dateInput = container.querySelector('#interaction-date')!;
    expect(dateInput).toBeInTheDocument();
    fireEvent.change(dateInput, { target: { value: '2026-07-01' } });

    // スケジュールメニューに遷移
    const scheduleMenuBtn = screen.getByText('学習計画・コマ割り');
    fireEvent.click(scheduleMenuBtn);

    // 対象日付インプットの値を無効な日付および空文字列にして、339-342行目のブランチをカバーする
    const scheduleDateInput = container.querySelector('input[type="date"]')!;
    expect(scheduleDateInput).toBeInTheDocument();
    
    const originalType = scheduleDateInput.type;
    scheduleDateInput.type = 'text';
    fireEvent.change(scheduleDateInput, { target: { value: 'invalid-date' } });
    scheduleDateInput.type = originalType;

    fireEvent.change(scheduleDateInput, { target: { value: '' } });

    unmount();
  });

  // 13. 一括適用機能テスト
  it('should successfully bulk apply timetable, tests, and homework to students in the same level/school/grade', async () => {
    // 1. テストデータのシード
    await db.saveSchool({ id: 'sch-bulk-1', name: 'バルク中学A', type: 'junior_high', created_at: '' });
    await db.saveSchool({ id: 'sch-bulk-2', name: 'バルク中学B', type: 'junior_high', created_at: '' });

    const s1 = { id: 'std-bulk-1', student_id: 'std-b1', name: '生徒A', email: 'b1@t.com', grade: '中3', school_id: 'sch-bulk-1', status: 'normal', start_unit_id: null, level: 'A', period_count: 2, created_at: new Date().toISOString() };
    const s2 = { id: 'std-bulk-2', student_id: 'std-b2', name: '生徒B', email: 'b2@t.com', grade: '中3', school_id: 'sch-bulk-1', status: 'normal', start_unit_id: null, level: 'B', period_count: 2, created_at: new Date().toISOString() };
    const s3 = { id: 'std-bulk-3', student_id: 'std-b3', name: '生徒C', email: 'b3@t.com', grade: '中3', school_id: 'sch-bulk-2', status: 'normal', start_unit_id: null, level: 'A', period_count: 2, created_at: new Date().toISOString() };
    const s4 = { id: 'std-bulk-4', student_id: 'std-b4', name: '生徒D', email: 'b4@t.com', grade: '中2', school_id: 'sch-bulk-1', status: 'normal', start_unit_id: null, level: 'A', period_count: 2, created_at: new Date().toISOString() };

    await db.saveStudent(s1);
    await db.saveStudent(s2);
    await db.saveStudent(s3);
    await db.saveStudent(s4);

    // カリキュラム単元のシード
    await db.saveCurriculumUnits([
      { id: 'unit-b1-1', school_id: 'sch-bulk-1', subject: '数学', name: 'バルク単元1', sequence_order: 1, google_drive_url: '', created_at: '' },
      { id: 'unit-b2-1', school_id: 'sch-bulk-2', subject: '数学', name: 'バルク単元1', sequence_order: 1, google_drive_url: '', created_at: '' }
    ]);

    // 2. 講師ダッシュボードのレンダリング
    const { container } = render(<TeacherDashboard />);
    
    // 生徒リストから std-bulk-1 (生徒A) を選択
    await waitFor(() => {
      expect(screen.getByText('生徒A (中3)')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('生徒A (中3)'));

    // 「学習計画・コマ割り」タブに切り替え
    const tabBtn = screen.getByText('学習計画・コマ割り');
    fireEvent.click(tabBtn);

    // 日付設定 (2026-06-21)
    const dateInput = container.querySelector('input[type="date"]')!;
    fireEvent.change(dateInput, { target: { value: '2026-06-21' } });

    // コマ割り設定
    const timetableContainer = screen.getByText('コマ割り設定 (標準2コマ / 最大10コマ)').parentElement!;
    const periodSelects = timetableContainer.querySelectorAll('select');
    fireEvent.change(periodSelects[0], { target: { value: '数学' } });
    
    // 単元選択用の select は subject 選択後に表示される可能性があるので待つ
    await waitFor(() => {
      const allSelects = timetableContainer.querySelectorAll('select');
      expect(allSelects.length).toBeGreaterThanOrEqual(2);
    });
    
    // 数学の単元「バルク単元1」を選択
    const allSelects = timetableContainer.querySelectorAll('select');
    // 最初の select は period-1 の教科、2番目は単元選択
    fireEvent.change(allSelects[1], { target: { value: 'unit-b1-1' } });

    // 宿題を追加
    const addHwBtn = screen.getByText('➕ 宿題を追加');
    fireEvent.click(addHwBtn);
    const hwTextareas = screen.getAllByPlaceholderText('宿題の内容を入力（例：ワークP24-25）');
    fireEvent.change(hwTextareas[0], { target: { value: '一括宿題A' } });

    // テストを追加
    const addTestBtn = screen.getByText('➕ テストを追加');
    fireEvent.click(addTestBtn);
    const testInputs = screen.getAllByPlaceholderText('例: 二次方程式10問');
    fireEvent.change(testInputs[0], { target: { value: '一括テストA' } });

    // 適用対象ドロップダウンを取得し、'level'（同じレベル全員）に設定
    const applySelect = screen.getByTestId('apply-scope-select');
    fireEvent.change(applySelect, { target: { value: 'level' } });

    // 保存実行
    const saveBtn = screen.getByText('時間割コマ割りを保存');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('今日の時間割コマ割りを対象生徒全員に一括保存しました！');
    });

    // 各生徒に保存されたか検証
    const allTasks = db.getLearningTasks();
    const allHws = db.getHomeworkResults();
    const allTests = db.getMiniTestResults();

    // std-bulk-3 (レベルA, 別校) に適用されたか検証
    const s3Tasks = allTasks.filter(t => t.student_id === 'std-bulk-3' && t.scheduled_date === '2026-06-21');
    expect(s3Tasks.length).toBeGreaterThan(0);
    // 別学校のため、同じ単元名「バルク単元1」を持つ 'unit-b2-1' がマッピングされているはず
    expect(s3Tasks[0].unit_id).toBe('unit-b2-1');
    
    const s3Hws = allHws.filter(h => h.student_id === 'std-bulk-3' && h.date === '2026-06-21');
    expect(s3Hws.some(h => h.homework_content === '一括宿題A')).toBe(true);

    const s3Tests = allTests.filter(t => t.student_id === 'std-bulk-3' && t.date === '2026-06-21');
    expect(s3Tests.some(t => t.test_content === '一括テストA')).toBe(true);

    // std-bulk-4 (レベルA, 同校・別学年) にも適用されたか検証
    const s4Tasks = allTasks.filter(t => t.student_id === 'std-bulk-4' && t.scheduled_date === '2026-06-21');
    expect(s4Tasks.length).toBeGreaterThan(0);
    expect(s4Tasks[0].unit_id).toBe('unit-b1-1');

    // std-bulk-2 (レベルB) には適用されていないか検証
    const s2Tasks = allTasks.filter(t => t.student_id === 'std-bulk-2' && t.scheduled_date === '2026-06-21');
    expect(s2Tasks.length).toBe(0);

    // -- 599行目のカバー: スコープを 'school' (同じ学校全員) に変更して保存 --
    fireEvent.change(applySelect, { target: { value: 'school' } });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('今日の時間割コマ割りを対象生徒全員に一括保存しました！');
    });

    // -- 601行目のカバー: スコープを 'grade' (同じ学年全員) に変更して保存 --
    fireEvent.change(applySelect, { target: { value: 'grade' } });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('今日の時間割コマ割りを対象生徒全員に一括保存しました！');
    });

    // -- テスト・宿題の個別 targetScope 変更のカバー --
    const testSection = screen.getByText('本日のテスト (自由記述):').parentElement!;
    const testScopeSelect = testSection.querySelector('select')!;
    fireEvent.change(testScopeSelect, { target: { value: 'grade' } });
    
    const hwSection = screen.getByText('宿題:').parentElement!;
    const hwScopeSelect = hwSection.querySelector('select')!;
    fireEvent.change(hwScopeSelect, { target: { value: 'school' } });

    fireEvent.change(applySelect, { target: { value: 'grade' } });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('今日の時間割コマ割りを対象生徒全員に一括保存しました！');
    });

    fireEvent.change(testScopeSelect, { target: { value: 'school' } });
    fireEvent.change(hwScopeSelect, { target: { value: 'grade' } });
    fireEvent.change(applySelect, { target: { value: 'school' } });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('今日の時間割コマ割りを対象生徒全員に一括保存しました！');
    });

    // -- 682行目のカバー: カスタムテーマを上書き更新して保存 --
    // 適用対象を 'individual' に戻す
    fireEvent.change(applySelect, { target: { value: 'individual' } });
    
    // コマ1を「その他」に変更する
    fireEvent.change(allSelects[0], { target: { value: 'その他' } });
    const customThemeInput = timetableContainer.querySelector('input[placeholder="テーマを入力（例: 面談、宿題指導）"]')!;
    fireEvent.change(customThemeInput, { target: { value: '自由テーマ1' } });
    
    // 一度保存する（カスタムテーマの作成）
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('今日の時間割コマ割りを保存しました！');
    });

    // 同じカスタムテーマ枠を別の文字で上書きする（682行目の existingCustomTaskIdx >= 0 に入るはず）
    fireEvent.change(customThemeInput, { target: { value: '上書き自由テーマ' } });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('今日の時間割コマ割りを保存しました！');
    });

    // 上書きされているか検証
    const finalTasks = db.getLearningTasks();
    const s1CustomTask = finalTasks.find(t => t.student_id === 'std-bulk-1' && t.scheduled_date === '2026-06-21' && t.period === 1);
    expect(s1CustomTask?.custom_unit_name).toBe('上書き自由テーマ');
  });

  it('should cover dynamic db operations and extra branch edge cases for coverage', async () => {
    // 1. db.ts: 803, 810-816 の custom_classes CRUD カバー
    const newCC = { id: 'cc-new-unique', name: '完全新規テーマ', created_at: '' };
    await db.saveCustomClass(newCC);
    await db.saveCustomClass({ ...newCC, name: '完全新規テーマ更新' });
    await db.deleteCustomClass(newCC.id);

    // 2. 教科別スタート位置テストに必要な他の教科の単元を sch-1 用にシードする
    const extUnits: CurriculumUnit[] = [
      { id: 'unit-english-dummy', school_id: 'sch-1', subject: '英語', name: '英語単元', sequence_order: 1, created_at: '' },
      { id: 'unit-english-dummy2', school_id: 'sch-1', subject: '英語', name: '英語単元2', sequence_order: 2, created_at: '' },
      { id: 'unit-japanese-dummy', school_id: 'sch-1', subject: '国語', name: '国語単元', sequence_order: 1, created_at: '' },
      { id: 'unit-japanese-dummy2', school_id: 'sch-1', subject: '国語', name: '国語単元2', sequence_order: 2, created_at: '' },
      { id: 'unit-science-dummy', school_id: 'sch-1', subject: '理科', name: '理科単元', sequence_order: 1, created_at: '' },
      { id: 'unit-science-dummy2', school_id: 'sch-1', subject: '理科', name: '理科単元2', sequence_order: 2, created_at: '' },
      { id: 'unit-social-dummy', school_id: 'sch-1', subject: '社会', name: '社会単元', sequence_order: 1, created_at: '' },
      { id: 'unit-social-dummy2', school_id: 'sch-1', subject: '社会', name: '社会単元2', sequence_order: 2, created_at: '' }
    ];
    await db.saveCurriculumUnits(extUnits);

    const extTasks: LearningTask[] = [
      { id: 't-eng-dummy', student_id: 'std-1', unit_id: 'unit-english-dummy', scheduled_date: '2026-06-25', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
      { id: 't-sci-dummy', student_id: 'std-1', unit_id: 'unit-science-dummy', scheduled_date: '2026-06-25', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
      { id: 't-soc-dummy', student_id: 'std-1', unit_id: 'unit-social-dummy', scheduled_date: '2026-06-25', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
      { id: 't-jap-dummy', student_id: 'std-1', unit_id: 'unit-japanese-dummy', scheduled_date: '2026-06-25', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' }
    ];
    await db.saveLearningTasks(extTasks);

    const resultItem3: MiniTestResult = {
      id: 'mini-c-1',
      student_id: 'std-2',
      date: '2026-06-19',
      test_content: 'レベルC向け計算小テスト',
      score: 75,
      created_at: new Date().toISOString()
    };
    const resultItem4: MiniTestResult = {
      id: 'mini-b-1',
      student_id: 'std-2',
      date: '2026-06-19',
      test_content: 'レベルB向け発展小テスト',
      score: 85,
      created_at: new Date().toISOString()
    };
    const resultItemPercent: MiniTestResult = {
      id: 'mini-percent',
      student_id: 'std-1',
      date: '2026-06-25',
      test_content: '割合小テスト',
      score: 75,
      passing_line: '80%以上',
      created_at: new Date().toISOString()
    };
    const resultItemTen: MiniTestResult = {
      id: 'mini-ten',
      student_id: 'std-1',
      date: '2026-06-25',
      test_content: '得点小テスト',
      score: 85,
      passing_line: '90点',
      created_at: new Date().toISOString()
    };

    await db.saveMiniTestResult(resultItem3);
    await db.saveMiniTestResult(resultItem4);
    await db.saveMiniTestResult(resultItemPercent);
    await db.saveMiniTestResult(resultItemTen);

    const { container: containerOrig } = render(<TeacherDashboard onBackToPortal={() => {}} />);
    const studentItemOrig = screen.getAllByText(/佐藤 拓海/)[0];
    fireEvent.click(studentItemOrig);

    // 確実に「学習計画・コマ割り」タブを開く！
    fireEvent.click(screen.getAllByText('学習計画・コマ割り')[0]);

    // テストの追加とパラメータ変更のカバー (TeacherDashboard.tsx:2354-2364)
    const addTestBtn = screen.getByText('➕ テストを追加');
    fireEvent.click(addTestBtn);
    fireEvent.click(addTestBtn);

    await waitFor(() => {
      expect(containerOrig.querySelectorAll('input[placeholder="例: 二次方程式10問"]').length).toBeGreaterThanOrEqual(2);
    });
    const testThemeInputsOrig = containerOrig.querySelectorAll('input[placeholder="例: 二次方程式10問"]');
    if (testThemeInputsOrig.length >= 2) {
      fireEvent.change(testThemeInputsOrig[0], { target: { value: '英語自動小テスト1' } });
      fireEvent.change(testThemeInputsOrig[1], { target: { value: '英語自動小テスト2' } });
    }

    await waitFor(() => {
      expect(containerOrig.querySelectorAll('input[placeholder="例: -3点, 80%以上, 90点"]').length).toBeGreaterThanOrEqual(2);
    });
    const testLineInputs = containerOrig.querySelectorAll('input[placeholder="例: -3点, 80%以上, 90点"]');
    if (testLineInputs.length >= 2) {
      fireEvent.change(testLineInputs[0], { target: { value: '80%以上' } });
      fireEvent.change(testLineInputs[1], { target: { value: '90点' } });
    }

    // 宿題を 3 件追加する
    const addHwBtn = screen.getByText('➕ 宿題を追加');
    fireEvent.click(addHwBtn);
    fireEvent.click(addHwBtn);
    fireEvent.click(addHwBtn);

    await waitFor(() => {
      expect(containerOrig.querySelectorAll('textarea[placeholder="宿題の内容を入力（例：ワークP24-25）"]').length).toBeGreaterThanOrEqual(3);
    });
    const hwInputs = containerOrig.querySelectorAll('textarea[placeholder="宿題の内容を入力（例：ワークP24-25）"]');
    hwInputs.forEach((input, index) => {
      fireEvent.change(input, { target: { value: `宿題内容-${index}` } });
    });

    const testSection = screen.getByText('本日のテスト (自由記述):').parentElement!;
    await waitFor(() => {
      expect(testSection.querySelectorAll('select').length).toBeGreaterThanOrEqual(2);
    });
    const testSelects = Array.from(testSection.querySelectorAll('select'));
    if (testSelects.length >= 2) {
      fireEvent.change(testSelects[0], { target: { value: 'school' } });
      fireEvent.change(testSelects[1], { target: { value: 'level' } });
    }

    const hwSection = screen.getByText('宿題:').parentElement!;
    await waitFor(() => {
      expect(hwSection.querySelectorAll('select').length).toBeGreaterThanOrEqual(3);
    });
    const hwSelects = Array.from(hwSection.querySelectorAll('select'));
    if (hwSelects.length >= 3) {
      fireEvent.change(hwSelects[0], { target: { value: 'grade' } });
      fireEvent.change(hwSelects[1], { target: { value: 'school' } });
      fireEvent.change(hwSelects[2], { target: { value: 'level' } });
    }

    const saveBtn = screen.getByText('時間割コマ割りを保存');
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('今日の時間割コマ割りを保存しました！');
    });

    // 小テスト結果タブをクリックして開く！
    const reportTab = screen.getAllByText('小テスト結果')[0];
    fireEvent.click(reportTab);

    // 小テスト結果テーブルの input (点数入力欄) を取得
    await waitFor(() => {
      const table = containerOrig.querySelector('table');
      expect(table).not.toBeNull();
    });

    const scoreTable = containerOrig.querySelector('table')!;
    const scoreInputs = scoreTable.querySelectorAll('input[type="number"]');
    
    const dummyScores = ['85', '45', '95'];
    scoreInputs.forEach((input, index) => {
      if (dummyScores[index]) {
        fireEvent.change(input, { target: { value: dummyScores[index] } });
      }
    });

    // 合否セレクトを変更
    const tableRows = scoreTable.querySelectorAll('tbody tr');
    if (tableRows.length > 0) {
      const passSelect = tableRows[0].querySelector('select');
      if (passSelect) {
        fireEvent.change(passSelect, { target: { value: 'failed' } });
      }
    }

    // 3. 教科別スタート位置のセレクト変更のカバー
    const preTasks = db.getLearningTasks();
    preTasks.forEach(t => {
      if (t.student_id === 'std-1') {
        if (t.unit_id === 'unit-102-1') {
          t.status = 'unstarted';
        }
        if (t.unit_id === 'unit-102-2') {
          t.status = 'skipped';
        }
      }
    });
    await db.saveLearningTasks(preTasks);

    fireEvent.click(screen.getByText('生徒情報'));
    const infoContainer = screen.getByText('教科別学習スタート位置').closest('div')!;
    const allStartSelects = infoContainer.querySelectorAll('select');
    if (allStartSelects.length >= 5) {
      // 数学
      fireEvent.change(allStartSelects[0], { target: { value: 'unit-102-2' } });
      fireEvent.change(allStartSelects[0], { target: { value: 'unit-102-1' } });
      // 英語
      fireEvent.change(allStartSelects[1], { target: { value: 'unit-english-dummy2' } });
      // 国語
      fireEvent.change(allStartSelects[2], { target: { value: 'unit-japanese-dummy2' } });
      // 理科
      fireEvent.change(allStartSelects[3], { target: { value: 'unit-science-dummy2' } });
      // 社会
      fireEvent.change(allStartSelects[4], { target: { value: 'unit-social-dummy2' } });
    }

    const saveStudentInfoBtn = screen.getByText('変更を保存する');
    fireEvent.click(saveStudentInfoBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('生徒情報を保存しました。');
    });

    // 「学習計画・コマ割り」タブに移動
    fireEvent.click(screen.getAllByText('学習計画・コマ割り')[0]);

    // 4. gemini.ts branch coverage & TeacherDashboard API Key input coverage
    saveGeminiApiKey('');
    const resFallback = await analyzeReportCardImage('base64data', 'image/png');
    expect(resFallback.score_math).toBe(90);

    saveGeminiApiKey('dummy-api-key');
    const res = await analyzeReportCardImage('base64data', 'image/png');
    expect(res.test_name).toBe('期末テスト');
    saveGeminiApiKey('');

    // JSONパースエラーのカバー
    saveGeminiApiKey('trigger-json-error');
    try {
      await analyzeReportCardImage('base64data', 'image/png');
    } catch (e: any) {
      expect(e.message).toBe('解析結果がJSONフォーマットではありませんでした。');
    }
    saveGeminiApiKey('');

    // TeacherDashboard.tsx API Key input UI coverage
    fireEvent.click(screen.getByText('定期テスト・模試'));
    const apiKeyToggleBtn = screen.getByText('🔑 Gemini APIキー設定（成績表画像解析用）');
    fireEvent.click(apiKeyToggleBtn);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('AIzaSy...')).not.toBeNull();
    });
    const apiKeyInput = screen.getByPlaceholderText('AIzaSy...');
    fireEvent.change(apiKeyInput, { target: { value: 'test-api-key-input' } });
    
    const apiKeyContainer = apiKeyInput.parentElement!;
    const saveApiKeyBtn = apiKeyContainer.querySelector('button')!;
    alertMock.mockClear();
    fireEvent.click(saveApiKeyBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('Gemini API キーを保存しました。');
    });

    fireEvent.click(apiKeyToggleBtn);
    await waitFor(() => {
      expect(screen.getByText('消去')).not.toBeNull();
    });

    const deleteApiKeyBtn = screen.getByText('消去');
    alertMock.mockClear();
    fireEvent.click(deleteApiKeyBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('APIキーを消去しました。デモ（モック）モードに戻ります。');
    });

    fireEvent.click(apiKeyToggleBtn);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('AIzaSy...')).not.toBeNull();
    });
    const reloadedInput = screen.getByPlaceholderText('AIzaSy...');
    fireEvent.change(reloadedInput, { target: { value: 'test-api-key-input' } });
    const reloadedContainer = reloadedInput.parentElement!;
    const reloadedSaveBtn = reloadedContainer.querySelector('button')!;
    alertMock.mockClear();
    fireEvent.click(reloadedSaveBtn);
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('Gemini API キーを保存しました。');
    });

    // 1097行目のファイル処理エラーのカバー
    const reportCardInput = containerOrig.querySelector('input[type="file"]')!;
    const badFile = { name: 'bad.png', size: 1024, type: 'image/png' };
    const originalRead = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = () => { throw new Error('Mock FileReader Error'); };
    fireEvent.change(reportCardInput, { target: { files: [badFile] } });
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('ファイル処理エラー: Mock FileReader Error');
    });
    FileReader.prototype.readAsDataURL = originalRead;

    // 1069-1070行目のファイル読み込み失敗のカバー
    const nullFile = new File([''], 'empty.png', { type: 'image/png' });
    const originalRead2 = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function() {
      Object.defineProperty(this, 'result', { value: null, configurable: true });
      if (this.onload) {
        this.onload({} as any);
      }
    };
    alertMock.mockClear();
    fireEvent.change(reportCardInput, { target: { files: [nullFile] } });
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('ファイルの読み込みに失敗しました。');
    });
    FileReader.prototype.readAsDataURL = originalRead2;

    // 1068-1092行目の正常アップロード・自動解析のカバー
    const goodFile = new File(['mock-image-data'], 'report.png', { type: 'image/png' });
    fireEvent.change(reportCardInput, { target: { files: [goodFile] } });
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('成績表画像の解析が完了し、点数を自動セットしました！内容をご確認ください。');
    });

    // 1091-1092行目の解析中エラーのカバー
    saveGeminiApiKey('trigger-json-error');
    fireEvent.change(reportCardInput, { target: { files: [goodFile] } });
    await waitFor(() => {
      expect(alertMock).toHaveBeenLastCalledWith('解析中にエラーが発生しました。');
    });
    saveGeminiApiKey('');

    // 2066行目のカバー (新規学校名の onChange)
    fireEvent.click(screen.getByText('新規生徒アカウント発行'));
    const gradeSelect = screen.getByText('学年').parentElement!.querySelector('select')!;
    fireEvent.change(gradeSelect, { target: { value: 'その他' } });
    const schoolSelect = screen.getByText('所属学校').parentElement!.querySelector('select')!;
    fireEvent.change(schoolSelect, { target: { value: 'add_new' } });
    await waitFor(() => {
      expect(screen.getByPlaceholderText('例: 桜丘')).not.toBeNull();
    });
    const schoolNameInput = screen.getByPlaceholderText('例: 桜丘');
    fireEvent.change(schoolNameInput, { target: { value: '新設テスト校' } });
    fireEvent.click(screen.getByText('生徒一覧'));

    // 2271-2284todayTests >= 2 select render & onChange のカバー
    cleanup();
    const { container: container2 } = render(<TeacherDashboard onBackToPortal={() => {}} />);
    const studentItem2 = screen.getAllByText(/佐藤 拓海/)[0];
    fireEvent.click(studentItem2);

    fireEvent.click(screen.getAllByText('学習計画・コマ割り')[0]);

    const addTestBtn2 = screen.getByText('➕ テストを追加');
    fireEvent.click(addTestBtn2);
    fireEvent.click(addTestBtn2);

    await waitFor(() => {
      expect(container2.querySelectorAll('input[placeholder="例: 二次方程式10問"]').length).toBeGreaterThanOrEqual(2);
    });

    const testThemeInputs2 = container2.querySelectorAll('input[placeholder="例: 二次方程式10問"]');
    fireEvent.change(testThemeInputs2[0], { target: { value: '小テスト1' } });
    fireEvent.change(testThemeInputs2[1], { target: { value: '小テスト2' } });

    const timetableContainer2 = screen.getByText('コマ割り設定 (標準2コマ / 最大10コマ)').parentElement!;
    const periodSelect2 = timetableContainer2.querySelector('select');
    if (periodSelect2) {
      fireEvent.change(periodSelect2, { target: { value: 'テスト' } });
      await waitFor(() => {
        const selects = Array.from(timetableContainer2.querySelectorAll('select'));
        const found = selects.some(s => Array.from(s.options).some(o => o.value === '小テスト1'));
        expect(found).toBe(true);
      });
      const testSelect = Array.from(timetableContainer2.querySelectorAll('select')).find(s => 
        Array.from(s.options).some(o => o.value === '小テスト1')
      );
      if (testSelect) {
        fireEvent.change(testSelect, { target: { value: '小テスト1' } });
      }
    }

    // 2246 (自由記述テーマ of select 変更) & 2258 (直接入力 of onChange)
    const customClassItem: CustomClass = { id: 'cc-1', name: '自由授業テーマ', created_at: '' };
    await db.saveCustomClass(customClassItem);

    cleanup();
    const { container: container3 } = render(<TeacherDashboard onBackToPortal={() => {}} />);
    const studentItem3 = screen.getAllByText(/佐藤 拓海/)[0];
    fireEvent.click(studentItem3);

    fireEvent.click(screen.getAllByText('学習計画・コマ割り')[0]);

    const timetableContainer3 = screen.getByText('コマ割り設定 (標準2コマ / 最大10コマ)').parentElement!;
    const periodSelect3 = timetableContainer3.querySelector('select');
    if (periodSelect3) {
      fireEvent.change(periodSelect3, { target: { value: '自由記述' } });
      await waitFor(() => {
        const selects = Array.from(timetableContainer3.querySelectorAll('select'));
        const found = selects.some(s => Array.from(s.options).some(o => o.value === '自由授業テーマ'));
        expect(found).toBe(true);
      });
      const freeSelect = Array.from(timetableContainer3.querySelectorAll('select')).find(s => 
        Array.from(s.options).some(o => o.value === '自由授業テーマ')
      );
      if (freeSelect) {
        fireEvent.change(freeSelect, { target: { value: '自由授業テーマ' } });
      }
      await waitFor(() => {
        expect(timetableContainer3.querySelector('input[placeholder="または新しい授業名を直接入力"]')).not.toBeNull();
      });
      const directInput = timetableContainer3.querySelector('input[placeholder="または新しい授業名を直接入力"]')!;
      fireEvent.change(directInput, { target: { value: '新規授業直打ち' } });
    }

    // 5. db.ts: 796-798, 811-812 Supabase実サーバー通信パスのカバー
    const originalMockMode = db.isMockMode;
    const originalSupabase = db.supabase;
    
    const supabaseMock = {
      from: (table: string) => {
        return {
          upsert: (data: any) => {
            return {
              select: () => {
                return {
                  single: async () => {
                    return { data: { id: 'cc-new-unique', name: '完全新規テーマ' }, error: null };
                  }
                };
              }
            };
          },
          delete: () => {
            return {
              eq: async (col: string, val: any) => {
                return { error: null };
              }
            };
          }
        };
      }
    };

    (db as any).isMockMode = false;
    (db as any).supabase = supabaseMock;

    const dummyCC = { id: 'cc-new-unique', name: '完全新規テーマ', created_at: '' };
    await db.saveCustomClass(dummyCC);
    await db.deleteCustomClass(dummyCC.id);

    const supabaseMockError = {
      from: (table: string) => {
        return {
          upsert: (data: any) => {
            return {
              select: () => {
                return {
                  single: async () => {
                    return { data: null, error: new Error('Mock Supabase Save Error') };
                  }
                };
              }
            };
          },
          delete: () => {
            return {
              eq: async (col: string, val: any) => {
                return { error: new Error('Mock Supabase Delete Error') };
              }
            };
          }
        };
      }
    };

    (db as any).supabase = supabaseMockError;
    try {
      await db.saveCustomClass(dummyCC);
    } catch (e: any) {
      expect(e.message).toBe('Mock Supabase Save Error');
    }

    try {
      await db.deleteCustomClass(dummyCC.id);
    } catch (e: any) {
      expect(e.message).toBe('Mock Supabase Delete Error');
    }

    (db as any).isMockMode = originalMockMode;
    (db as any).supabase = originalSupabase;

    // 8.7 TeacherDashboard.tsx: 自由記述授業テーマの作成・削除UIテスト
    cleanup();
    const { container: containerCustom } = render(<TeacherDashboard onBackToPortal={() => {}} />);
    const studentItemCustom = screen.getAllByText(/佐藤 拓海/)[0];
    fireEvent.click(studentItemCustom);
    fireEvent.click(screen.getAllByText('学校カリキュラム管理')[0]);

    // バリデーション警告（空文字）のカバー
    alertMock.mockClear();
    const addBtn = screen.getByText('追加する');
    fireEvent.click(addBtn);
    expect(alertMock).toHaveBeenCalledWith('自由記述の授業名を入力してください。');

    // 正常追加のカバー
    const customInput = screen.getByPlaceholderText('例: 高校入試過去問演習');
    fireEvent.change(customInput, { target: { value: '新規テスト授業テーマ' } });
    fireEvent.click(addBtn);

    // 削除のカバー
    await waitFor(() => {
      expect(screen.getByText('新規テスト授業テーマ')).toBeDefined();
    });
    const deleteBtn = screen.getAllByText('削除')[0];
    fireEvent.click(deleteBtn);

    // 8.8 TeacherDashboard.tsx: カリキュラム単元の編集・削除UIテスト
    // 単元の編集を開始する
    const editUnitBtns = screen.getAllByText('編集');
    fireEvent.click(editUnitBtns[0]);

    // バリデーション警告（空文字）のカバー
    const firstUnitContainer = editUnitBtns[0].closest('div[class*="curriculumItem"]')!;
    const editInput = firstUnitContainer.querySelector('input')!;
    fireEvent.change(editInput, { target: { value: '' } });
    const saveUnitBtn = screen.getByText('保存');
    alertMock.mockClear();
    fireEvent.click(saveUnitBtn);
    expect(alertMock).toHaveBeenCalledWith('単元名を入力してください。');

    // 正常保存のカバー (act で State 更新を確実に同期)
    await act(async () => {
      fireEvent.change(firstUnitContainer.querySelector('input')!, { target: { value: '更新後の単元名' } });
    });
    await act(async () => {
      fireEvent.click(saveUnitBtn);
    });
    expect(alertMock).toHaveBeenLastCalledWith('授業（単元）を更新しました！');

    // キャンセルボタンのカバー
    fireEvent.click(editUnitBtns[0]);
    const cancelBtn = screen.getByText('キャンセル');
    fireEvent.click(cancelBtn);

    // 単元削除のカバー (confirm が false の時の早期リターンパスもカバー)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const deleteUnitBtns = screen.getAllByText('削除');
    fireEvent.click(deleteUnitBtns[0]);
    
    // confirm を true にして実際に削除を走らせる
    confirmSpy.mockReturnValue(true);
    await act(async () => {
      fireEvent.click(deleteUnitBtns[0]);
    });
    expect(alertMock).toHaveBeenLastCalledWith('授業（単元）を削除しました。');
    confirmSpy.mockRestore();

    // 9. TeacherDashboard.tsx: 2284 (直接入力テストテーマの onChange)
    cleanup();
    db.clearMockData();
    db.getSchools();
    db.getCurriculumUnits();
    db.getStudents();
    db.getLearningTasks();
    db.getSchoolCodesMaster();
    db.getExamThresholdsMaster();
    db.getPromptSettings();
    db.getAIReports();

    const { container: container4 } = render(<TeacherDashboard onBackToPortal={() => {}} />);
    const studentItem4 = screen.getAllByText(/佐藤 拓海/)[0];
    fireEvent.click(studentItem4);
    fireEvent.click(screen.getAllByText('学習計画・コマ割り')[0]);

    const timetableContainer4 = screen.getByText('コマ割り設定 (標準2コマ / 最大10コマ)').parentElement!;
    const periodSelects4 = timetableContainer4.querySelectorAll('select');
    const periodSelect4 = periodSelects4[0];
    fireEvent.change(periodSelect4, { target: { value: 'テスト' } });
    await waitFor(() => {
      const firstPeriodContainer = periodSelect4.parentElement!;
      expect(firstPeriodContainer.querySelector('input[placeholder="テストのテーマ（例: 一次方程式小テスト）"]')).not.toBeNull();
    });
    const firstPeriodContainer = periodSelect4.parentElement!;
    const testDirectInput = firstPeriodContainer.querySelector('input[placeholder="テストのテーマ（例: 一次方程式小テスト）"]')!;
    fireEvent.change(testDirectInput, { target: { value: '直接入力小テストテーマ' } });

    // 10. TeacherDashboard.tsx: 1119 (本日のテストがちょうど1件の時の自動初期選択) をカバー
    cleanup();
    db.clearMockData();
    db.getSchools();
    db.getCurriculumUnits();
    db.getStudents();
    db.getLearningTasks();
    db.getSchoolCodesMaster();
    db.getExamThresholdsMaster();
    db.getPromptSettings();
    db.getAIReports();

    // 本日の小テスト結果(MiniTestResult)を1件追加して、todayTests.length === 1 の状態を作る
    const oneTestResult: MiniTestResult = {
      id: 'mini-one-test',
      student_id: 'std-1',
      date: '2026-06-19',
      test_content: '数学小テスト（一次方程式）',
      score: 85,
      passing_line: 80,
      target_scope: 'individual',
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(oneTestResult);

    const { container: container5 } = render(<TeacherDashboard onBackToPortal={() => {}} />);
    const studentItem5 = screen.getAllByText(/佐藤 拓海/)[0];
    fireEvent.click(studentItem5);
    fireEvent.click(screen.getAllByText('学習計画・コマ割り')[0]);

    const timetableContainer5 = screen.getByText('コマ割り設定 (標準2コマ / 最大10コマ)').parentElement!;
    const periodSelect5 = timetableContainer5.querySelector('select')!;
    fireEvent.change(periodSelect5, { target: { value: 'テスト' } });

    // 11. TeacherDashboard.tsx: 新規生徒アカウント発行時の所属学校自動同期の検証
    cleanup();
    const { container: container6 } = render(<TeacherDashboard onBackToPortal={() => {}} />);
    fireEvent.click(screen.getByText('新規生徒アカウント発行'));
    
    const gradeSelect6 = screen.getByText('学年').parentElement!.querySelector('select')!;
    fireEvent.change(gradeSelect6, { target: { value: '小5' } });
    
    const studentNameInput6 = screen.getByPlaceholderText('例: 佐藤 拓海');
    fireEvent.change(studentNameInput6, { target: { value: 'MJ' } });
    const submitBtn6 = screen.getByText('1クリックアカウント発行');
    
    alertMock.mockClear();
    fireEvent.click(submitBtn6);
    await waitFor(() => {
      expect(alertMock).toHaveBeenCalled();
      expect(alertMock.mock.calls[0][0]).toContain('生徒アカウントを発行しました！');
    });

    // 12. TeacherDashboard.tsx: 小テスト・宿題管理画面の「キーワード検索（フリーワード入力）」、クリアボタン(✕)、および0件時メッセージの検証
    cleanup();
    render(<TeacherDashboard teacherType="junior_high" onBackToPortal={() => {}} />);

    // 生徒を選択する
    const studentItemTest = screen.getAllByText(/佐藤 拓海/)[0];
    fireEvent.click(studentItemTest);

    // 小テスト結果タブを開く
    fireEvent.click(screen.getByText('小テスト結果'));
    
    // キーワード検索窓の存在確認と入力テスト
    const miniSearchInput = screen.getAllByPlaceholderText('題名・生徒名・単元で検索...')[0] as HTMLInputElement;
    expect(miniSearchInput).toBeDefined();

    await act(async () => {
      fireEvent.change(miniSearchInput, { target: { value: '存在しないテストキーワード9999' } });
    });

    // 該当なしメッセージが表示されることを確認
    expect(screen.getByText('該当するテスト・宿題が見つかりませんでした。')).toBeInTheDocument();

    // クリアボタン(✕)をクリック
    const clearMiniBtn = screen.getAllByTitle('検索をクリア')[0];
    await act(async () => {
      fireEvent.click(clearMiniBtn);
    });
    expect(miniSearchInput.value).toBe('');

    // 宿題提出状況タブを開く
    fireEvent.click(screen.getByText('宿題提出状況'));

    const hwSearchInput = screen.getAllByPlaceholderText('題名・生徒名・単元で検索...')[0] as HTMLInputElement;
    expect(hwSearchInput).toBeDefined();

    await act(async () => {
      fireEvent.change(hwSearchInput, { target: { value: '存在しない宿題キーワード9999' } });
    });

    // 該当なしメッセージが表示されることを確認
    expect(screen.getByText('該当するテスト・宿題が見つかりませんでした。')).toBeInTheDocument();

    const clearHwBtn = screen.getAllByTitle('検索をクリア')[0];
    await act(async () => {
      fireEvent.click(clearHwBtn);
    });
    expect(hwSearchInput.value).toBe('');
  });

  it('should achieve full branch coverage across StudentScheduleConfigForm, TeacherDashboard filters/sorts, TestScoreRadarChart, and WeeklyScheduleViewer', async () => {
    // 1. TestScoreRadarChart coverage
    const testScoreData = [
      { subject: '数学', score: 85, fullMark: 100 },
      { subject: '英語', score: 70, fullMark: 100 },
      { subject: '理科', score: 45, fullMark: 100 },
    ];
    const { unmount: unmountRadar } = render(
      <TestScoreRadarChart data={testScoreData} title="能力分析チャート" showTable={true} dataKeyName="生徒スコア" />
    );
    expect(screen.getByText('能力分析チャート')).toBeInTheDocument();
    expect(screen.getByText('得意')).toBeInTheDocument();
    expect(screen.getByText('良好')).toBeInTheDocument();
    expect(screen.getByText('要強化')).toBeInTheDocument();
    unmountRadar();

    const { unmount: unmountRadarEmpty } = render(
      <TestScoreRadarChart data={[]} title="" showTable={false} />
    );
    expect(screen.getByText('表示できる点数データがありません')).toBeInTheDocument();
    unmountRadarEmpty();

    // 2. WeeklyScheduleViewer coverage
    const { unmount: unmountWeeklyFull } = render(
      <WeeklyScheduleViewer
        studentConfig={{
          student_id: 'std-1',
          weekly_frequency: '2回',
          weekly_duration: '120分',
          selected_days: ['tuesday', 'friday'],
          default_slots: 2,
        }}
        tasks={[
          { id: 't-1', student_id: 'std-1', unit_id: 'u-1', scheduled_date: '2026-06-16', period: 1, status: 'completed', video_watched: true, test_passed: true, created_at: '', office_note: 'コマ1ノート' }
        ]}
        currentDateStr="2026-06-15"
      />
    );
    expect(screen.getByText('週表示 (Week View)')).toBeInTheDocument();
    
    // Switch to Day view
    const dayViewBtn = screen.getByText('日表示 (Day View)');
    fireEvent.click(dayViewBtn);

    // Click non-school day tab (水曜日)
    const wedBtn = screen.getByText('水曜日');
    fireEvent.click(wedBtn);
    expect(screen.getByText('通塾日外のため「授業予定なし」')).toBeInTheDocument();

    // Click school day tab (火曜日)
    const tueBtn = screen.getByText('火曜日');
    fireEvent.click(tueBtn);
    expect(screen.getByText('コマ1ノート')).toBeInTheDocument();
    unmountWeeklyFull();

    // Empty selected_days branch
    const { unmount: unmountWeeklyEmpty } = render(
      <WeeklyScheduleViewer
        studentConfig={{
          student_id: 'std-1',
          weekly_frequency: '2回',
          weekly_duration: '120分',
          selected_days: [],
          default_slots: 2,
        }}
        tasks={[]}
        currentDateStr="2026-06-15"
      />
    );
    expect(screen.getByText('週表示 (Week View)')).toBeInTheDocument();
    unmountWeeklyEmpty();

    // Invalid selected_days branch
    const { unmount: unmountWeeklyInvalid } = render(
      <WeeklyScheduleViewer
        studentConfig={{
          student_id: 'std-1',
          weekly_frequency: '2回',
          weekly_duration: '120分',
          selected_days: ['invalid_day'],
          default_slots: 2,
        }}
        tasks={[]}
        currentDateStr="2026-06-15"
      />
    );
    expect(screen.getByText('週表示 (Week View)')).toBeInTheDocument();
    unmountWeeklyInvalid();

    // 3. StudentScheduleConfigForm coverage (all frequency & duration options)
    const { unmount: unmountConfigUnlim } = render(
      <StudentScheduleConfigForm studentId="std-1" gradeType="junior_high" />
    );
    const freqSelectEl = document.querySelector('#weekly-frequency-select') as HTMLSelectElement;
    if (freqSelectEl) {
      const freqs = ['2回', '3回', '4回', '5回', '無制限', '自由追加'];
      for (const f of freqs) {
        fireEvent.change(freqSelectEl, { target: { value: f } });
      }
      fireEvent.click(screen.getByText('月曜日'));
      fireEvent.click(screen.getByText('水曜日'));
      fireEvent.click(screen.getByText('木曜日'));
    }

    const durSelectEl = document.querySelector('#weekly-duration-select') as HTMLSelectElement;
    if (durSelectEl) {
      const durs = ['120分', '180分', '240分', '無制限', '自由追加'];
      for (const d of durs) {
        fireEvent.change(durSelectEl, { target: { value: d } });
      }
    }
    unmountConfigUnlim();

    // 3. StudentScheduleConfigForm coverage
    const onSavedMock = vi.fn();
    const { unmount: unmountConfig } = render(
      <StudentScheduleConfigForm studentId="std-1" gradeType="elementary" onSaved={onSavedMock} />
    );

    // Toggle Wednesday (3rd day when max is 2)
    const wedToggle = screen.getByText('水曜日');
    fireEvent.click(wedToggle);
    expect(screen.getByText(/週回数（2回）を超える曜日は選択できません/i)).toBeInTheDocument();

    // Click Save button
    const saveConfigBtn = screen.getByText('通塾設定を保存する');
    await act(async () => {
      fireEvent.click(saveConfigBtn);
    });
    expect(onSavedMock).toHaveBeenCalled();
    unmountConfig();

    // StudentScheduleConfigForm error toast path
    const spySaveConfig = vi.spyOn(db, 'saveStudentScheduleConfig').mockRejectedValueOnce(new Error('Save Error Test'));
    const { unmount: unmountConfigErr } = render(
      <StudentScheduleConfigForm studentId="std-1" gradeType="elementary" />
    );
    const saveConfigBtnErr = screen.getByText('通塾設定を保存する');
    await act(async () => {
      fireEvent.click(saveConfigBtnErr);
    });
    expect(screen.getByText('設定の保存に失敗しました。')).toBeInTheDocument();
    spySaveConfig.mockRestore();
    unmountConfigErr();

    // StudentScheduleConfigForm max days limit error toast path
    const { unmount: unmountConfigMaxErr } = render(
      <StudentScheduleConfigForm studentId="std-max-err-2" gradeType="junior_high" />
    );
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });

    const freqSelMaxErr = document.querySelector('#weekly-frequency-select') as HTMLSelectElement;
    if (freqSelMaxErr) {
      fireEvent.change(freqSelMaxErr, { target: { value: '3回' } });
    }

    fireEvent.click(screen.getByText('月曜日'));
    fireEvent.click(screen.getByText('水曜日'));

    if (freqSelMaxErr) {
      fireEvent.change(freqSelMaxErr, { target: { value: '2回' } });
    }

    const saveBtnMaxErr = screen.getByText('通塾設定を保存する');
    await act(async () => {
      fireEvent.click(saveBtnMaxErr);
    });
    expect(screen.getByText(/選択中の曜日は最大2つまでに制限されています。/i)).toBeInTheDocument();
    unmountConfigMaxErr();

    // 4. TeacherDashboard filters, sort options, basic info select changes, and HorizontalDatePicker navigation
    await db.saveMiniTestResult({
      id: 'mini-sort-1',
      student_id: 'std-1',
      date: '2026-06-18',
      test_content: '小テストA',
      score: 90,
      passed: true,
      created_at: '2026-06-18T10:00:00Z'
    });
    await db.saveMiniTestResult({
      id: 'mini-sort-2',
      student_id: 'std-2',
      date: '2026-06-19',
      test_content: '小テストB',
      score: null,
      passed: false,
      created_at: '2026-06-19T10:00:00Z'
    });

    await db.saveHomeworkResult({
      id: 'hw-sort-1',
      student_id: 'std-1',
      date: '2026-06-18',
      homework_content: '宿題A',
      homework_deadline: '2026-06-25',
      status: 'completed',
      created_at: '2026-06-18T10:00:00Z'
    });
    await db.saveHomeworkResult({
      id: 'hw-sort-2',
      student_id: 'std-2',
      date: '2026-06-19',
      homework_content: '宿題B',
      homework_deadline: '2026-06-26',
      status: 'incomplete',
      created_at: '2026-06-19T10:00:00Z'
    });
    await db.saveHomeworkResult({
      id: 'hw-sort-3',
      student_id: 'std-1',
      date: '2026-06-20',
      homework_content: '宿題C',
      homework_deadline: '2026-06-27',
      status: 'incomplete',
      created_at: '2026-06-20T10:00:00Z'
    });

    render(<TeacherDashboard teacherType="junior_high" onBackToPortal={vi.fn()} />);

    // Filter student by name search
    const filterNameInput = screen.queryByPlaceholderText('生徒名で検索...') as HTMLInputElement;
    if (filterNameInput) {
      await act(async () => {
        fireEvent.change(filterNameInput, { target: { value: '拓海' } });
      });
    }
    
    // Open Student List & Select 佐藤 拓海
    const studentItem = screen.getAllByText(/佐藤 拓海/i)[0];
    fireEvent.click(studentItem);

    // Click 遅れチェック ＆ 自動リスケ button
    const autoReschedBtn = screen.getByText('遅れチェック ＆ 自動リスケ');
    fireEvent.click(autoReschedBtn);

    // Open 生徒情報 tab via sidebar
    const studentInfoSidebarBtn = screen.getByText('生徒情報');
    fireEvent.click(studentInfoSidebarBtn);

    // Open 基本情報・属性設定 sub tab
    const detailTab = screen.getByText('基本情報・属性設定');
    fireEvent.click(detailTab);

    const nameInputEdit = screen.getByPlaceholderText('氏名（漢字）');
    fireEvent.change(nameInputEdit, { target: { value: '佐藤 拓海 (更新)' } });

    const nameKanaInputEdit = screen.getByPlaceholderText('氏名（フリガナ）');
    fireEvent.change(nameKanaInputEdit, { target: { value: 'サトウ タクミ' } });

    const fileInputs = document.querySelectorAll('input[type="file"]');
    if (fileInputs[0]) {
      fireEvent.change(fileInputs[0], { target: { files: [new File([''], 'avatar.png')] } });
    }

    const schoolNameInput = screen.getByPlaceholderText('学校名');
    fireEvent.change(schoolNameInput, { target: { value: '天登第一中学校' } });

    const gradeSelectEdit = document.querySelector('#student-grade') as HTMLSelectElement;
    if (gradeSelectEdit) fireEvent.change(gradeSelectEdit, { target: { value: '中3' } });

    // Change weekly frequency, weekly duration, period count selects
    const freqSelect = document.querySelector('#edit-weekly-frequency') as HTMLSelectElement;
    if (freqSelect) fireEvent.change(freqSelect, { target: { value: '3回' } });

    const durSelect = document.querySelector('#edit-weekly-duration') as HTMLSelectElement;
    if (durSelect) fireEvent.change(durSelect, { target: { value: '180分' } });

    const slotsSelect = document.querySelector('#edit-default-slots') as HTMLSelectElement;
    if (slotsSelect) fireEvent.change(slotsSelect, { target: { value: '3' } });

    const saveDetailBtn = screen.getByText('変更を保存する');
    await act(async () => {
      fireEvent.click(saveDetailBtn);
    });

    // Open 小テスト結果 tab
    const miniTestTab = screen.getAllByText('小テスト結果')[0];
    fireEvent.click(miniTestTab);

    // Test Grade Filters
    const gradeSelect = document.querySelector('#minitest-grade-filter') as HTMLSelectElement;
    if (gradeSelect) {
      const gradeOptions = ['all', '小学生', '中学生', '高校生', '小6', '中3', '高1'];
      for (const gOpt of gradeOptions) {
        await act(async () => {
          fireEvent.change(gradeSelect, { target: { value: gOpt } });
        });
      }
    }

    // Test Subject Filters
    const subjectSelect = document.querySelector('#minitest-subject-filter') as HTMLSelectElement;
    if (subjectSelect) {
      const subOptions = ['all', '数学', '英語', '理科', '社会', '国語'];
      for (const sOpt of subOptions) {
        await act(async () => {
          fireEvent.change(subjectSelect, { target: { value: sOpt } });
        });
      }
    }

    // Test Sort Orders in Mini Tests
    const sortSelect = document.querySelector('#minitest-sort-order') as HTMLSelectElement;
    if (sortSelect) {
      const sortOptions = ['date_desc', 'date_asc', 'name_asc', 'unsubmitted_first', 'passed_first'];
      for (const sortOpt of sortOptions) {
        await act(async () => {
          fireEvent.change(sortSelect, { target: { value: sortOpt } });
        });
      }
    }

    const miniSearchInput = document.querySelector('#minitest-search') as HTMLInputElement;
    if (miniSearchInput) {
      await act(async () => {
        fireEvent.change(miniSearchInput, { target: { value: '小テスト' } });
      });
    }

    // Switch to 宿題提出状況 tab and test all sort options
    fireEvent.click(screen.getByText('宿題提出状況'));
    const hwSearchInput = document.querySelector('#homework-search') as HTMLInputElement;
    if (hwSearchInput) {
      await act(async () => {
        fireEvent.change(hwSearchInput, { target: { value: '宿題' } });
      });
    }
    const hwGradeSelect = document.querySelector('#homework-grade-filter') as HTMLSelectElement || document.querySelector('select');
    if (hwGradeSelect) {
      await act(async () => {
        fireEvent.change(hwGradeSelect, { target: { value: '小学生' } });
      });
    }

    const hwSortSelect = document.querySelector('#homework-sort-order') as HTMLSelectElement;
    if (hwSortSelect) {
      const hwSortOptions = ['date_desc', 'date_asc', 'name_asc', 'unsubmitted_first', 'completed_first'];
      for (const sortOpt of hwSortOptions) {
        await act(async () => {
          fireEvent.change(hwSortSelect, { target: { value: sortOpt } });
        });
      }
    }

    // Open 学習計画・コマ割り tab and test HorizontalDatePicker prev/next buttons
    fireEvent.click(screen.getAllByText('学習計画・コマ割り')[0]);
    const prevWeekBtn = screen.getByLabelText('前週へ');
    const nextWeekBtn = screen.getByLabelText('次週へ');
    fireEvent.click(prevWeekBtn);
    fireEvent.click(nextWeekBtn);

    const dateCardBtns = document.querySelectorAll('button[type="button"]');
    if (dateCardBtns.length > 5) {
      fireEvent.click(dateCardBtns[3]);
    }

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    if (dateInput) fireEvent.change(dateInput, { target: { value: '2026-06-20' } });

    const noteInput = screen.queryByPlaceholderText(/1学期中間テスト対策特別コマ/i);
    if (noteInput) fireEvent.change(noteInput, { target: { value: 'テスト対策特別コマ' } });

    // Select 佐藤 拓海 then return to schedule tab
    const studentItemForTT = screen.getAllByText(/佐藤 拓海/i)[0];
    fireEvent.click(studentItemForTT);
    fireEvent.click(screen.getAllByText('学習計画・コマ割り')[0]);

    // Test applyScope selects and handleSaveTimetable
    const scopeSelect = screen.getByTestId('apply-scope-select') as HTMLSelectElement;
    if (scopeSelect) {
      const scopes = ['individual', 'school', 'grade', 'level'];
      for (const scopeVal of scopes) {
        await act(async () => {
          fireEvent.change(scopeSelect, { target: { value: scopeVal } });
        });
        const saveTTBtn = screen.getByText('時間割コマ割りを保存');
        await act(async () => {
          fireEvent.click(saveTTBtn);
        });
      }
    }

    // Open 新規生徒アカウント発行 tab & create student with custom school
    fireEvent.click(screen.getByText('新規生徒アカウント発行'));
    const nameInput = screen.getByPlaceholderText('例: 佐藤 拓海');
    fireEvent.change(nameInput, { target: { value: '新規テスト生徒' } });

    const schoolSelect = screen.getByDisplayValue(/天登第一中学校/i);
    fireEvent.change(schoolSelect, { target: { value: 'add_new' } });

    const customSchoolInput = screen.getByPlaceholderText('例: 桜丘');
    fireEvent.change(customSchoolInput, { target: { value: '富士見' } });

    const createForm = nameInput.closest('form');
    if (createForm) {
      await act(async () => {
        fireEvent.submit(createForm);
      });
    }

    // Open 年間計画（マイルストーン） for student
    const studentItemForMS = screen.getAllByText(/佐藤 拓海/i)[0];
    fireEvent.click(studentItemForMS);
    fireEvent.click(screen.getByText('年間計画（マイルストーン）'));

    const chUpBtns = screen.queryAllByTitle('章を上へ移動');
    if (chUpBtns.length > 0) {
      await act(async () => {
        fireEvent.click(chUpBtns[0]);
      });
    }
    const chDownBtns = screen.queryAllByTitle('章を下へ移動');
    if (chDownBtns.length > 0) {
      await act(async () => {
        fireEvent.click(chDownBtns[0]);
      });
    }

    const holidayToggleBtns = screen.queryAllByTitle('休校日の切り替え');
    if (holidayToggleBtns.length > 0) {
      await act(async () => {
        fireEvent.click(holidayToggleBtns[0]);
      });
    }
    const deleteRowBtns = screen.queryAllByTitle('行削除');
    if (deleteRowBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteRowBtns[0]);
      });
    }

    fireEvent.click(screen.getByText('学校カリキュラム管理'));
    const upBtns = screen.queryAllByTitle('上へ移動');
    if (upBtns.length > 0) fireEvent.click(upBtns[0]);
    const downBtns = screen.queryAllByTitle('下へ移動');
    if (downBtns.length > 0) fireEvent.click(downBtns[0]);

    const editUnitBtns = screen.queryAllByText('編集');
    if (editUnitBtns.length > 0) {
      fireEvent.click(editUnitBtns[0]);
      const editInput = document.querySelector('#edit-unit-name-input') as HTMLInputElement;
      if (editInput) fireEvent.change(editInput, { target: { value: '更新された単元名' } });
      const saveUnitBtns = screen.queryAllByText('保存');
      if (saveUnitBtns.length > 0) fireEvent.click(saveUnitBtns[0]);
    }

    const customClassInput = screen.getByPlaceholderText('例: 高校入試過去問演習');
    fireEvent.change(customClassInput, { target: { value: '追加マスターテーマ' } });
    fireEvent.click(screen.getByText('追加する'));

    const studentItemForTests = screen.getAllByText(/佐藤 拓海/i)[0];
    fireEvent.click(studentItemForTests);

    fireEvent.click(screen.getByText('定期テスト・模試'));
    const toggleApiKeyBtn = screen.getByText('🔑 Gemini APIキー設定（成績表画像解析用）');
    fireEvent.click(toggleApiKeyBtn);
    const keyInput = screen.getByPlaceholderText('AIzaSy...');
    fireEvent.change(keyInput, { target: { value: 'test-api-key' } });
    fireEvent.click(screen.getByText('消去'));
    fireEvent.click(toggleApiKeyBtn);
    fireEvent.click(screen.getByText('保存'));

    const regTestNameInput = screen.getByPlaceholderText('例：1学期中間テスト、前期期末テスト');
    fireEvent.change(regTestNameInput, { target: { value: '中間テスト' } });
    const saveRegTestBtn = screen.getByText('定期テスト結果を記録');
    await act(async () => {
      fireEvent.click(saveRegTestBtn);
    });

    const mockFormInputs = document.querySelectorAll('input[required]');
    if (mockFormInputs.length >= 2) {
      fireEvent.change(mockFormInputs[0], { target: { value: '全県模試' } });
      fireEvent.change(mockFormInputs[1], { target: { value: '380' } });
    }
    const mockSelectEl = document.querySelector('select[required]') as HTMLSelectElement;
    if (mockSelectEl && mockSelectEl.options.length > 1) {
      fireEvent.change(mockSelectEl, { target: { value: mockSelectEl.options[1].value } });
    }
    const saveMockBtn = screen.queryByText('模試点数を入力して合格判定算出');
    if (saveMockBtn) {
      await act(async () => {
        fireEvent.click(saveMockBtn);
      });
    }

    const studentItemForAI = screen.getAllByText(/佐藤 拓海/i)[0];
    fireEvent.click(studentItemForAI);
    fireEvent.click(screen.getByText('AI指導報告書'));
    const genReportBtn = screen.getByText('今月の学習ログから報告書を自動生成 (AI分析ステップ)');
    await act(async () => {
      fireEvent.click(genReportBtn);
    });
    const saveReportBtn = screen.getByText('報告書を保存 ＆ 修正履歴を学習 (パターンB)');
    await act(async () => {
      fireEvent.click(saveReportBtn);
    });

    // TeacherDashboard elementary & high_school modes
    const { unmount: unmountElemTD } = render(<TeacherDashboard teacherType="elementary" />);
    expect(screen.getAllByText(/司令塔ダッシュボード/i)[0]).toBeInTheDocument();
    unmountElemTD();

    const { unmount: unmountHighTD } = render(<TeacherDashboard teacherType="high_school" />);
    expect(screen.getAllByText(/司令塔ダッシュボード/i)[0]).toBeInTheDocument();
    unmountHighTD();
  });

  it('should support day-of-week selection chips, weekly frequency limit checks, and 1-week schedule matrix navigation in TeacherDashboard', async () => {
    const { container, unmount } = render(<TeacherDashboard />);
    
    // Select first student
    await waitFor(() => {
      expect(screen.getByText(/佐藤 拓海/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/佐藤 拓海/));

    // Switch to 基本情報・属性設定 (生徒情報 tab)
    fireEvent.click(screen.getByText('生徒情報'));

    // Verify day-of-week chips are rendered
    await waitFor(() => {
      expect(screen.getByText('🗓️ 通塾曜日設定')).toBeInTheDocument();
    });

    const monChip = screen.getByTestId('day-chip-monday');
    const wedChip = screen.getByTestId('day-chip-wednesday');
    const friChip = screen.getByTestId('day-chip-friday');

    // Toggle chips
    fireEvent.click(wedChip); // Add wednesday
    fireEvent.click(monChip); // Try adding when max 2 is reached (should alert limit)

    // Change weekly frequency to 3回
    const freqSelect = container.querySelector('#edit-weekly-frequency') as HTMLSelectElement;
    fireEvent.change(freqSelect, { target: { value: '3回' } });
    fireEvent.click(monChip); // Now adding monChip should succeed

    // Save basic settings
    const saveBtn = screen.getByText('変更を保存する');
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Switch to 学習計画・コマ割り (Tab 1)
    fireEvent.click(screen.getByText('学習計画・コマ割り'));

    // Verify 1-week schedule overview matrix is rendered
    await waitFor(() => {
      expect(screen.getByText('📅 選択週（1週間）の学習予定・コマ割り状況')).toBeInTheDocument();
    });

    // Switch date from 1-week matrix
    const selectButtons = screen.getAllByText('選択');
    if (selectButtons.length > 0) {
      fireEvent.click(selectButtons[0]);
    }

    unmount();
  });

  it('should support dynamic multi-teacher tag assignment, removal, master sync, and master deletion', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    const { container, unmount } = render(<TeacherDashboard />);

    // Select student
    await waitFor(() => {
      expect(screen.getByText(/佐藤 拓海/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/佐藤 拓海/));

    // Switch to 生徒情報 -> 基本情報・属性設定
    fireEvent.click(screen.getByText('生徒情報'));

    // Check teacher tags area is rendered
    await waitFor(() => {
      expect(screen.getByText('👨‍🏫 担当講師（複数設定可能）')).toBeInTheDocument();
    });

    const teacherContainer = screen.getByTestId('assigned-teachers-container');
    expect(teacherContainer).toBeInTheDocument();

    // Initial teacher badge: 福田 尚弘
    expect(screen.getByTestId('teacher-tag-福田 尚弘')).toBeInTheDocument();

    // 1. Add teacher from master select: 佐藤 舞
    const teacherSelect = screen.getByTestId('teacher-master-select');
    fireEvent.change(teacherSelect, { target: { value: '佐藤 舞' } });

    const addTeacherBtn = screen.getByTestId('add-teacher-btn');
    await act(async () => {
      fireEvent.click(addTeacherBtn);
    });

    // Both badges present
    expect(screen.getByTestId('teacher-tag-福田 尚弘')).toBeInTheDocument();
    expect(screen.getByTestId('teacher-tag-佐藤 舞')).toBeInTheDocument();

    // 2. Add custom teacher: 鈴木 健太 (should auto-sync to teacher master)
    const teacherInput = screen.getByTestId('teacher-custom-input');
    fireEvent.change(teacherInput, { target: { value: '鈴木 健太' } });
    await act(async () => {
      fireEvent.click(addTeacherBtn);
    });

    expect(screen.getByTestId('teacher-tag-鈴木 健太')).toBeInTheDocument();
    // Check teacher master options in db
    expect(db.getTeacherOptions()).toContain('鈴木 健太');

    // 3. Try duplicate
    fireEvent.change(teacherSelect, { target: { value: '佐藤 舞' } });
    await act(async () => {
      fireEvent.click(addTeacherBtn);
    });
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('既に担当に追加されています'));

    // 4. Remove teacher from student: 福田 尚弘
    const removeBtn = screen.getByTestId('remove-teacher-福田 尚弘');
    fireEvent.click(removeBtn);

    expect(screen.queryByTestId('teacher-tag-福田 尚弘')).not.toBeInTheDocument();
    expect(screen.getByTestId('teacher-tag-佐藤 舞')).toBeInTheDocument();
    expect(screen.getByTestId('teacher-tag-鈴木 健太')).toBeInTheDocument();

    // 5. Delete a teacher from Teacher Master (e.g. 渡辺 葵)
    fireEvent.change(teacherSelect, { target: { value: '渡辺 葵' } });
    const deleteMasterBtn = screen.getByTestId('delete-teacher-master-btn');
    await act(async () => {
      fireEvent.click(deleteMasterBtn);
    });
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('渡辺 葵'));
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('削除しました'));
    expect(db.getTeacherOptions()).not.toContain('渡辺 葵');

    // 6. Save student changes
    const saveBtn = screen.getByText('変更を保存する');
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(alertSpy).toHaveBeenCalledWith('生徒情報を保存しました。');

    // Verify in db
    const updatedStudent = db.getStudents().find(s => s.id === 'std-1');
    expect(updatedStudent?.assigned_teachers).toEqual(['佐藤 舞', '鈴木 健太']);
    expect(updatedStudent?.teacher_in_charge).toBe('佐藤 舞');

    alertSpy.mockRestore();
    confirmSpy.mockRestore();
    unmount();
  });

  it('should dynamically update dashboard header title and filter student list based on portal grade category and school name search', async () => {
    // 1. Elementary mode
    const { unmount: unmountElem } = render(<TeacherDashboard teacherType="elementary" onBackToPortal={() => {}} />);
    expect(screen.getByText('【小学生】テントル 司令塔ダッシュボード (講師用)')).toBeInTheDocument();
    expect(screen.getByTestId('filter-school-name')).toBeInTheDocument();
    expect(screen.getByTestId('filter-grade')).toBeInTheDocument();
    expect(screen.getByTestId('filter-name')).toBeInTheDocument();
    expect(screen.queryByText('区分トグル')).not.toBeInTheDocument();
    unmountElem();

    // 2. High School mode
    const { unmount: unmountHigh } = render(<TeacherDashboard teacherType="high_school" onBackToPortal={() => {}} />);
    expect(screen.getByText('【高校生】テントル 司令塔ダッシュボード (講師用)')).toBeInTheDocument();
    unmountHigh();

    // 3. Junior High mode & school search
    const { unmount: unmountJhs } = render(<TeacherDashboard teacherType="junior_high" onBackToPortal={() => {}} />);
    expect(screen.getByText('【中学生】テントル 司令塔ダッシュボード (講師用)')).toBeInTheDocument();

    const schoolSelect = screen.getByTestId('filter-school-name');
    fireEvent.change(schoolSelect, { target: { value: '天登第一中学校' } });
    expect(screen.getByText(/佐藤 拓海/)).toBeInTheDocument();

    fireEvent.change(schoolSelect, { target: { value: 'テントル小学校' } });
    expect(screen.queryByText(/佐藤 拓海/)).not.toBeInTheDocument();

    unmountJhs();
  });

  it('should support dynamic selected subjects configuration, grade category linking, chip toggling, and persistence', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    // 1. Render TeacherDashboard and select student
    const { unmount } = render(<TeacherDashboard onBackToPortal={() => {}} />);
    const studentCard = screen.getByText(/佐藤 拓海/);
    fireEvent.click(studentCard);

    // Go to student detail tab
    const detailTabBtn = screen.getByRole('button', { name: /生徒情報/ });
    fireEvent.click(detailTabBtn);

    // 2. Check 選択教科 UI exists and chips are present
    expect(screen.getByText('📚 選択教科')).toBeInTheDocument();
    expect(screen.getByTestId('subject-chip-数学')).toBeInTheDocument();
    expect(screen.getByTestId('subject-chip-英語')).toBeInTheDocument();
    expect(screen.getByTestId('subject-chip-理科')).toBeInTheDocument();
    expect(screen.getByTestId('subject-chip-社会')).toBeInTheDocument();
    expect(screen.getByTestId('subject-chip-国語')).toBeInTheDocument();

    // 3. Toggle off 理科
    const rikaChip = screen.getByTestId('subject-chip-理科');
    fireEvent.click(rikaChip);

    // Toggle on and off
    fireEvent.click(screen.getByTestId('subject-chip-社会'));
    fireEvent.click(screen.getByTestId('subject-chip-国語'));
    fireEvent.click(screen.getByTestId('subject-chip-英語'));

    // Attempt to deselect the last remaining subject (数学)
    fireEvent.click(screen.getByTestId('subject-chip-数学'));
    expect(alertSpy).toHaveBeenCalledWith('少なくとも1つの教科を選択してください。');

    // Toggle 英語 back on
    fireEvent.click(screen.getByTestId('subject-chip-英語'));

    // Save student details
    const saveBtn = screen.getByRole('button', { name: '変更を保存する' });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Verify in db
    const updatedStudent = db.getStudents().find(s => s.id === 'std-1');
    expect(updatedStudent?.selected_subjects).toEqual(['数学', '英語']);

    // Check timetable subject options prioritizing selected subjects
    const scheduleTabBtn = screen.getByRole('button', { name: /学習計画・コマ割り/ });
    fireEvent.click(scheduleTabBtn);
    expect(screen.getAllByText(/数学 ⭐ \(選択教科\)/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/英語 ⭐ \(選択教科\)/).length).toBeGreaterThanOrEqual(1);

    unmount();

    // 4. Test Elementary student (Suzuki Yui) in elementary mode
    const { unmount: unmountElem } = render(<TeacherDashboard teacherType="elementary" onBackToPortal={() => {}} />);
    const elemStudentCard = screen.getByText(/鈴木 結衣/);
    fireEvent.click(elemStudentCard);

    const elemDetailTabBtn = screen.getByRole('button', { name: /生徒情報/ });
    fireEvent.click(elemDetailTabBtn);

    expect(screen.getByText('📚 選択教科')).toBeInTheDocument();
    expect(screen.getByTestId('subject-chip-算数')).toBeInTheDocument();
    expect(screen.queryByTestId('subject-chip-数学')).not.toBeInTheDocument();

    unmountElem();
    alertSpy.mockRestore();
  });

  it('should support CurriculumCsvImport parsing, preview, auto sort_order assignment, bulk import, search, and delete operations', async () => {
    // Setup mocks
    const originalClipboard = navigator.clipboard;
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
    const originalReadAsText = FileReader.prototype.readAsText;
    FileReader.prototype.readAsText = function(blob: any) {
      const text = blob._text || (blob && typeof blob.toString === 'function' ? blob.toString() : '');
      if (this.onload) {
        this.onload({ target: { result: text } } as any);
      }
    };

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const mockBack = vi.fn();
    const mockCompleted = vi.fn();

    const { unmount } = render(<CurriculumCsvImport onBack={mockBack} onImportCompleted={mockCompleted} />);

    // Check title and UI elements
    expect(screen.getByText('カリキュラムデータ CSV一括インポート')).toBeInTheDocument();
    expect(screen.getByText(/サンプルCSVダウンロード/)).toBeInTheDocument();
    expect(screen.getByText(/形式をコピー/)).toBeInTheDocument();

    // Test format copy
    fireEvent.click(screen.getByText(/形式をコピー/));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();

    // Test template download
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('mock-blob-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    fireEvent.click(screen.getByText(/サンプルCSVダウンロード/));
    expect(createObjectUrlSpy).toHaveBeenCalled();
    createObjectUrlSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();

    // Test back button
    const backBtn = screen.getByText('戻る');
    fireEvent.click(backBtn);
    expect(mockBack).toHaveBeenCalled();

    // Test drag over / drag leave
    const dropZone = screen.getByTestId('csv-dropzone');
    fireEvent.dragOver(dropZone);
    fireEvent.dragLeave(dropZone);

    // Test invalid drop (non-csv file)
    const badFile = new File(['hello'], 'test.txt', { type: 'text/plain' });
    await act(async () => {
      fireEvent.drop(dropZone, { dataTransfer: { files: [badFile] } });
    });
    expect(screen.getByText(/CSVファイル \(\.csv\) を選択してください/)).toBeInTheDocument();

    // Test CSV with missing header
    const invalidCsv = `名前,年齢,所属
山田,15,中3`;
    const invalidFile = new File([invalidCsv], 'invalid.csv', { type: 'text/csv' });
    (invalidFile as any)._text = invalidCsv;
    const fileInput = screen.getByTestId('csv-file-input');
    
    // Simulate file upload with invalid CSV
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });
    });

    // Test valid CSV upload
    const validCsv = `学年,教科,単元名,授業名
小5,算数,1章 整数と小数,小数と10倍・100倍・1/10
小5,算数,1章 整数と小数,小数の位取りと数の構成
小5,算数,2章 小数の乗除,小数×整数の計算
中1,数学,1章 正の数・負の数,正の数・負の数の意味`;
    const validFile = new File([validCsv], 'curriculum.csv', { type: 'text/csv' });
    (validFile as any)._text = validCsv;

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [validFile] } });
    });

    // Verify preview is displayed
    expect(screen.getByText(/インポートデータ プレビュー/)).toBeInTheDocument();
    expect(screen.getAllByText(/4件/).length).toBeGreaterThanOrEqual(1);

    // Check preview items and automatic sort order
    expect(screen.getByText('小数と10倍・100倍・1/10')).toBeInTheDocument();
    expect(screen.getByText('正の数・負の数の意味')).toBeInTheDocument();

    // Test cancel/clear preview
    const cancelPreviewBtn = screen.getByText('キャンセル');
    fireEvent.click(cancelPreviewBtn);
    expect(screen.queryByText(/インポートデータ プレビュー/)).not.toBeInTheDocument();

    // Re-upload
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [validFile] } });
    });

    const importBtn = screen.getByTestId('execute-import-btn');
    expect(importBtn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(importBtn);
    });

    expect(mockCompleted).toHaveBeenCalled();

    // Switch to "登録済みマスター一覧" tab
    const listTabBtn = screen.getByText(/登録済みマスター一覧/);
    await act(async () => {
      fireEvent.click(listTabBtn);
    });

    // Search and filter
    const searchInput = screen.getByPlaceholderText(/単元・授業名で検索/);
    fireEvent.change(searchInput, { target: { value: '正の数' } });
    expect(screen.getByText('正の数・負の数の意味')).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '' } });

    // Test delete single item
    const deleteBtns = screen.getAllByTitle('削除');
    if (deleteBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteBtns[0]);
      });
      expect(confirmSpy).toHaveBeenCalled();
    }

    // Test delete legacy masters (小1~小6, 中3)
    const deleteLegacyBtn = screen.queryByTestId('delete-legacy-masters-btn');
    if (deleteLegacyBtn) {
      await act(async () => {
        fireEvent.click(deleteLegacyBtn);
      });
      expect(confirmSpy).toHaveBeenCalled();
    }

    // Test clear all masters
    const clearAllBtn = screen.queryByText('全件クリア');
    if (clearAllBtn) {
      await act(async () => {
        fireEvent.click(clearAllBtn);
      });
      expect(confirmSpy).toHaveBeenCalled();
    }

    unmount();
    confirmSpy.mockRestore();
    FileReader.prototype.readAsText = originalReadAsText;
    if (originalClipboard) {
      Object.assign(navigator, { clipboard: originalClipboard });
    }
  });

  it('should support elementary timeline UI with progress bar and completion date estimation without monthly/weekly headers, and switch to grid for junior high', async () => {
    // Ensure test elementary curriculum masters exist in database
    await db.saveCurriculumMasters([
      { id: 'cm-p1-m1', grade: '小1', subject: '算数', unit_name: '1章 かずとすうじ', lesson_name: '1から5までのかず', sort_order: 1 },
      { id: 'cm-p5-m1', grade: '小5', subject: '算数', unit_name: '1章 整数と小数', lesson_name: '小数と10倍', sort_order: 2 },
      { id: 'cm-p6-m1', grade: '小6', subject: '算数', unit_name: '1章 分数の乗除', lesson_name: '分数×分数', sort_order: 3 },
      { id: 'cm-p-jp1', grade: '小5', subject: '国語', unit_name: '1章 言語事項', lesson_name: '同音異義語・同訓異字の使い分け', sort_order: 1 },
      { id: 'cm-p-sc1', grade: '小5', subject: '理科', unit_name: '1章 植物の発芽と成長', lesson_name: '発芽に必要な条件（水・空気・温度）', sort_order: 1 },
      { id: 'cm-p-en1', grade: '小5', subject: '英語', unit_name: '1章 自己紹介と日常会話', lesson_name: 'What do you like? / I like ...', sort_order: 1 }
    ]);

    // 1. Elementary student test
    const { unmount } = render(<TeacherDashboard teacherType="elementary" onBackToPortal={() => {}} />);

    // Select elementary student (Suzuki Yui - 小5)
    const elemStudentCard = screen.getByText(/鈴木 結衣/);
    await act(async () => {
      fireEvent.click(elemStudentCard);
    });

    // Navigate to Milestones tab
    const milestoneTabBtn = screen.getByText('年間計画（マイルストーン）');
    await act(async () => {
      fireEvent.click(milestoneTabBtn);
    });

    // Verify elementary-specific headers and elements
    expect(screen.getByText(/小学生カリキュラムは固定の月・週区切りにとらわれず/)).toBeInTheDocument();
    expect(screen.getByText(/進行状況（進度バー）/)).toBeInTheDocument();
    expect(screen.getByText(/全単元完了の推定予定日/)).toBeInTheDocument();
    expect(screen.getByText(/消化ペース/)).toBeInTheDocument();

    // Verify monthly and weekly table headers are NOT present for elementary
    expect(screen.queryByRole('columnheader', { name: '月' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '週' })).not.toBeInTheDocument();

    // Verify milestone step cards are rendered with grade indicators across all elementary grades
    expect(screen.getByText('STEP 1')).toBeInTheDocument();
    expect(screen.getByText(/1から5までのかず/)).toBeInTheDocument();
    expect(screen.getAllByText('小1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('小5').length).toBeGreaterThan(0);
    expect(screen.getAllByText('小6').length).toBeGreaterThan(0);

    // Test switching subject in elementary view (国語, 理科, 社会, 英語)
    const subjectSelect = screen.getByDisplayValue('算数');
    await act(async () => {
      fireEvent.change(subjectSelect, { target: { value: '国語' } });
    });
    expect(subjectSelect).toHaveValue('国語');
    expect(screen.getByText(/同音異義語・同訓異字の使い分け/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(subjectSelect, { target: { value: '理科' } });
    });
    expect(subjectSelect).toHaveValue('理科');
    expect(screen.getByText(/発芽に必要な条件/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(subjectSelect, { target: { value: '英語' } });
    });
    expect(subjectSelect).toHaveValue('英語');
    expect(screen.getByText(/自己紹介と日常会話/)).toBeInTheDocument();

    // Test CSV import button in sidebar
    const csvImportMenuBtn = screen.getByText('カリキュラムCSVインポート');
    await act(async () => {
      fireEvent.click(csvImportMenuBtn);
    });
    expect(screen.getByText('カリキュラムデータ CSV一括インポート')).toBeInTheDocument();

    unmount();

    // 2. Junior High student test
    const { unmount: unmountJh } = render(<TeacherDashboard teacherType="junior_high" onBackToPortal={() => {}} />);

    // Select junior high student (Sato Takumi - 中1)
    const jhStudentCard = screen.getByText(/佐藤 拓海/);
    await act(async () => {
      fireEvent.click(jhStudentCard);
    });

    // Navigate to Milestones tab
    const jhMilestoneTabBtn = screen.getByText('年間計画（マイルストーン）');
    await act(async () => {
      fireEvent.click(jhMilestoneTabBtn);
    });

    // Verify spreadsheet grid headers for junior high (月, 週, 章, 単元名)
    expect(screen.getByRole('columnheader', { name: '月' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '週' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '章' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '単元名' })).toBeInTheDocument();

    // Verify elementary description is NOT present
    expect(screen.queryByText(/小学生カリキュラムは固定の月・週区切りにとらわれず/)).not.toBeInTheDocument();

    unmountJh();
  });

  // Test: 教科別学習スタート位置と学習計画のスタートライン自動連動テスト
  it('should auto-link subject start positions with schedule planning, show visual badges, and reorganize future tasks on save', async () => {
    // 1. Setup mock student with subject-specific start positions
    const studentWithStarts: Student = {
      id: 'std-start-test',
      student_id: 'start101',
      name: 'スタート連携 生徒',
      email: 'start@tentoru.com',
      grade: '中1',
      school_id: 'sch-1',
      status: 'normal',
      start_unit_id: null,
      start_unit_math: 'u-m2', // 数学: 文字と式からスタート
      start_unit_english: 'u-e2', // 英語: 一般動詞からスタート
      selected_days: ['monday', 'thursday'],
      selected_subjects: ['数学', '英語'],
      default_slots: 2,
      period_count: 2,
      created_at: ''
    };

    const mathUnits: CurriculumUnit[] = [
      { id: 'u-m1', school_id: 'sch-1', subject: '数学', name: '正負の数', sequence_order: 1, created_at: '' },
      { id: 'u-m2', school_id: 'sch-1', subject: '数学', name: '文字と式', sequence_order: 2, created_at: '' },
      { id: 'u-m3', school_id: 'sch-1', subject: '数学', name: '一次方程式', sequence_order: 3, created_at: '' }
    ];

    const engUnits: CurriculumUnit[] = [
      { id: 'u-e1', school_id: 'sch-1', subject: '英語', name: 'be動詞', sequence_order: 1, created_at: '' },
      { id: 'u-e2', school_id: 'sch-1', subject: '英語', name: '一般動詞', sequence_order: 2, created_at: '' }
    ];

    // Seed into mock db
    await db.saveStudent(studentWithStarts);
    await db.saveCurriculumUnits([...mathUnits, ...engUnits]);

    const { unmount } = render(<TeacherDashboard teacherType="junior_high" onBackToPortal={() => {}} />);

    // 2. Wait for student list to load and select the student
    await waitFor(() => {
      expect(screen.getByText(/スタート連携 生徒/)).toBeInTheDocument();
    });

    const studentCard = screen.getByText(/スタート連携 生徒/);
    await act(async () => {
      fireEvent.click(studentCard);
    });

    // 3. Switch to schedule tab
    const scheduleMenuBtn = screen.getByText('学習計画・コマ割り');
    await act(async () => {
      fireEvent.click(scheduleMenuBtn);
    });

    // 4. Verify that Tab 1 (学習計画・コマ割り) shows the start position summary box
    await waitFor(() => {
      expect(screen.getByTestId('start-line-summary-bar')).toBeInTheDocument();
    });
    expect(screen.getByText(/教科別スタートライン/)).toBeInTheDocument();
    expect(screen.getByText(/数学:/)).toBeInTheDocument();
    expect(screen.getAllByText(/文字と式/).length).toBeGreaterThan(0);
    expect(screen.getByText(/英語:/)).toBeInTheDocument();
    expect(screen.getAllByText(/一般動詞/).length).toBeGreaterThan(0);

    // 5. Verify dropdown options have the start line marker
    const period1SubjectSelect = screen.getByTestId('period-subject-select-1');
    await act(async () => {
      fireEvent.change(period1SubjectSelect, { target: { value: '数学' } });
    });

    // Unit select should now include '★ [スタートライン] 文字と式'
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /★ \[スタートライン\] 文字と式/ })).toBeInTheDocument();
    });

    // 6. Test Milestone / Timeline tab for visual start line badge
    const milestoneTabBtn = screen.getByText('年間計画（マイルストーン）');
    await act(async () => {
      fireEvent.click(milestoneTabBtn);
    });

    // Switch subject to 数学
    await waitFor(() => {
      expect(screen.getByDisplayValue('数学')).toBeInTheDocument();
    });

    // 7. Test updating student detail start positions with 2-step grade filtering and saving
    const studentDetailMenuBtn = screen.getByText('生徒情報');
    await act(async () => {
      fireEvent.click(studentDetailMenuBtn);
    });

    // Verify Basic info card is visible
    expect(screen.getByText('基本情報・属性設定')).toBeInTheDocument();
    expect(screen.getByText('教科別学習スタート位置')).toBeInTheDocument();

    // Verify 2-step UI dropdowns exist
    const mathGradeSelect = screen.getByTestId('start-grade-select-start_unit_math');
    const mathUnitSelect = screen.getByTestId('start-unit-select-start_unit_math');
    expect(mathGradeSelect).toBeInTheDocument();
    expect(mathUnitSelect).toBeInTheDocument();

    // Change grade to 4年生 and verify filtered options appear
    await act(async () => {
      fireEvent.change(mathGradeSelect, { target: { value: '4年生' } });
    });

    // Check that grade 4 unique units are available (distinct unit_name, not duplicated per lesson)
    expect(screen.getByRole('option', { name: '1章 わり算の筆算' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '2章 面積と角度' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /2桁・3桁÷1桁の筆算/ })).not.toBeInTheDocument();

    // Select unit '1章 わり算の筆算' which automatically maps to earliest lesson ID 'cm-p4-m1'
    await act(async () => {
      fireEvent.change(mathUnitSelect, { target: { value: 'cm-p4-m1' } });
    });

    // Verify Save button exists and click it
    const saveBtn = screen.getByRole('button', { name: '変更を保存する' });
    expect(saveBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // Verify student's start_unit_math is saved with earliest lesson ID
    const updatedStudents = db.getStudents();
    const targetStudent = updatedStudents.find(s => s.id === studentWithStarts.id);
    expect(targetStudent?.start_unit_math).toBe('cm-p4-m1');

    unmount();
  });

  it('should display direct school_name on student card, and support edit and delete actions', async () => {
    db.clearMockData();
    localStorage.setItem('tentoru_learning_tasks', JSON.stringify([]));
    localStorage.setItem('tentoru_curriculum_units', JSON.stringify([]));
    localStorage.setItem('tentoru_students', JSON.stringify([]));
    localStorage.setItem('tentoru_schools', JSON.stringify([]));

    const testStudent: Student = {
      id: 'std-custom-school-1',
      student_id: 'student999',
      name: '木村 咲良',
      email: 'kimura@tentoru-student.com',
      grade: '中2',
      school_id: 'sch-unregistered',
      school_name: '自由が丘学園中学校',
      status: 'normal',
      start_unit_id: null,
      created_at: new Date().toISOString()
    };
    await db.saveStudent(testStudent);

    // Also add a task for this student to verify deletion cascading
    const testTask: LearningTask = {
      id: 'task-kimura-1',
      student_id: 'std-custom-school-1',
      unit_id: 'u-1',
      scheduled_date: '2026-08-16',
      period: 1,
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([testTask]);

    const { unmount } = render(<TeacherDashboard onBackToPortal={() => {}} />);

    // 1. Verify student card shows direct school_name
    expect(screen.getByText('木村 咲良 (中2)')).toBeInTheDocument();
    expect(screen.getAllByText('自由が丘学園中学校').length).toBeGreaterThanOrEqual(1);

    // 2. Verify edit button navigates to student-detail tab
    const editBtn = screen.getByTestId('edit-student-btn-std-custom-school-1');
    expect(editBtn).toBeInTheDocument();
    
    await act(async () => {
      fireEvent.click(editBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('基本情報・属性設定')).toBeInTheDocument();
    });
    // Check form fields populated
    const nameInput = screen.getByDisplayValue('木村 咲良');
    expect(nameInput).toBeInTheDocument();

    // 3. Return to student-list tab
    const studentListTabBtn = screen.getByText('生徒一覧');
    await act(async () => {
      fireEvent.click(studentListTabBtn);
    });

    // 4. Test delete action with confirm cancellation
    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockReturnValueOnce(false); // cancel deletion

    const deleteBtn = screen.getByTestId('delete-student-btn-std-custom-school-1');
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(confirmSpy).toHaveBeenCalled();
    // Student should still exist
    expect(db.getStudents().some(s => s.id === 'std-custom-school-1')).toBe(true);

    // 5. Test delete action with confirm OK
    confirmSpy.mockReturnValueOnce(true); // confirm deletion

    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(confirmSpy).toHaveBeenCalledTimes(2);
    // Student should be deleted from db
    expect(db.getStudents().some(s => s.id === 'std-custom-school-1')).toBe(false);
    // Tasks for student should also be deleted
    expect(db.getLearningTasks().some(t => t.student_id === 'std-custom-school-1')).toBe(false);

    confirmSpy.mockRestore();
    unmount();
  });

  it('should dynamically display schools in create student tab, support delete school with confirm, and auto-save new school', async () => {
    db.clearMockData();
    localStorage.setItem('tentoru_learning_tasks', JSON.stringify([]));
    localStorage.setItem('tentoru_curriculum_units', JSON.stringify([]));
    localStorage.setItem('tentoru_students', JSON.stringify([]));
    localStorage.setItem('tentoru_schools', JSON.stringify([]));

    // Seed test schools
    await db.saveSchool({ id: 'sch-alpha', name: '青葉中学校', type: 'junior_high', created_at: '' });
    await db.saveSchool({ id: 'sch-beta', name: '緑が丘中学校', type: 'junior_high', created_at: '' });

    const { unmount } = render(<TeacherDashboard onBackToPortal={() => {}} />);

    // 1. Navigate to '新規生徒アカウント発行' tab
    const createStudentTabBtn = screen.getByText('新規生徒アカウント発行');
    await act(async () => {
      fireEvent.click(createStudentTabBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('new-student-school-select')).toBeInTheDocument();
    });

    const schoolSelect = screen.getByTestId('new-student-school-select') as HTMLSelectElement;
    const deleteSchoolBtn = screen.getByTestId('delete-school-btn') as HTMLButtonElement;

    // Both seeded schools should appear in options
    expect(screen.getByRole('option', { name: /青葉中学校/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /緑が丘中学校/ })).toBeInTheDocument();

    // 2. Select 'add_new' and verify delete button is disabled
    await act(async () => {
      fireEvent.change(schoolSelect, { target: { value: 'add_new' } });
    });
    expect(deleteSchoolBtn).toBeDisabled();

    // 3. Select 'sch-beta' (緑が丘中学校) and test cancellation
    await act(async () => {
      fireEvent.change(schoolSelect, { target: { value: 'sch-beta' } });
    });
    expect(deleteSchoolBtn).not.toBeDisabled();

    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockReturnValueOnce(false); // cancel

    await act(async () => {
      fireEvent.click(deleteSchoolBtn);
    });

    expect(confirmSpy).toHaveBeenCalled();
    // School should still exist
    expect(db.getSchools().some(s => s.id === 'sch-beta')).toBe(true);

    // 4. Test deletion with confirm OK
    confirmSpy.mockReturnValueOnce(true); // confirm delete

    await act(async () => {
      fireEvent.click(deleteSchoolBtn);
    });

    expect(confirmSpy).toHaveBeenCalledTimes(2);
    // School should be deleted from db
    expect(db.getSchools().some(s => s.id === 'sch-beta')).toBe(false);

    // 5. Test creating a student with a brand new custom school
    await act(async () => {
      fireEvent.change(schoolSelect, { target: { value: 'add_new' } });
    });

    const studentNameInput = screen.getByPlaceholderText('例: 佐藤 拓海');
    const customSchoolInput = screen.getByTestId('new-custom-school-name-input');

    await act(async () => {
      fireEvent.change(studentNameInput, { target: { value: '新規 太郎' } });
      fireEvent.change(customSchoolInput, { target: { value: 'ひまわり' } });
    });

    const createSubmitBtn = screen.getByRole('button', { name: '1クリックアカウント発行' });
    await act(async () => {
      fireEvent.click(createSubmitBtn);
    });

    // Check that new school (ひまわり中学校) was added to schools in db
    const schoolsAfterCreate = db.getSchools();
    expect(schoolsAfterCreate.some(s => s.name.includes('ひまわり'))).toBe(true);

    confirmSpy.mockRestore();
    unmount();
  });

  it('should display unique unit_name dropdown in student detail, automatically map to first lesson ID, and reflect as current position (📍 現在地) in elementary milestone timeline', async () => {
    db.clearMockData();
    localStorage.setItem('tentoru_learning_tasks', JSON.stringify([]));
    localStorage.setItem('tentoru_curriculum_units', JSON.stringify([]));
    localStorage.setItem('tentoru_students', JSON.stringify([]));

    const elemStudent: Student = {
      id: 'std-elem-unique-unit',
      student_id: 'student_elem_u',
      name: '鈴木 花子',
      email: 'hanako@tentoru-student.com',
      grade: '小4',
      school_id: 'sch-1',
      status: 'normal',
      start_unit_id: null,
      start_unit_math: null,
      selected_subjects: ['算数', '国語', '英語'],
      selected_days: ['mon', 'thu'],
      default_slots: 2,
      period_count: 2,
      created_at: ''
    };

    await db.saveStudent(elemStudent);

    const { unmount } = render(<TeacherDashboard teacherType="elementary" onBackToPortal={() => {}} />);

    // 1. Select student
    await waitFor(() => {
      expect(screen.getByText(/鈴木 花子/)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/鈴木 花子/));
    });

    // 2. Open 生徒情報
    const studentDetailMenuBtn = screen.getByText('生徒情報');
    await act(async () => {
      fireEvent.click(studentDetailMenuBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('教科別学習スタート位置')).toBeInTheDocument();
    });

    const mathGradeSelect = screen.getByTestId('start-grade-select-start_unit_math');
    const mathUnitSelect = screen.getByTestId('start-unit-select-start_unit_math');

    // 3. Select 4年生
    await act(async () => {
      fireEvent.change(mathGradeSelect, { target: { value: '4年生' } });
    });

    // Verify unique unit_names are listed without lesson duplication
    expect(screen.getByRole('option', { name: '1章 わり算の筆算' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '2章 面積と角度' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /2桁・3桁÷1桁の筆算/ })).not.toBeInTheDocument();

    // 4. Select unit '1章 わり算の筆算' (value: 'cm-p4-m1') and save
    await act(async () => {
      fireEvent.change(mathUnitSelect, { target: { value: 'cm-p4-m1' } });
    });

    const saveBtn = screen.getByRole('button', { name: '変更を保存する' });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    const targetStudent = db.getStudents().find(s => s.id === elemStudent.id);
    expect(targetStudent?.start_unit_math).toBe('cm-p4-m1');

    // 5. Navigate to 年間計画（マイルストーン）timeline tab
    const milestoneTabBtn = screen.getByText('年間計画（マイルストーン）');
    await act(async () => {
      fireEvent.click(milestoneTabBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('⭐ スタートライン')).toBeInTheDocument();
    });

    // Verify that the start unit step is displayed as 📍 現在地（取り組み中）
    expect(screen.getByText('📍 現在地（取り組み中）')).toBeInTheDocument();
    // Verify earlier steps show ✓ 完了
    expect(screen.getAllByText('✓ 完了').length).toBeGreaterThan(0);

    unmount();
  });

  it('should support enrollment and withdrawal dates, calculate duration badge, allow adding/removing personality tags and deleting master personality', async () => {
    // 1. Setup student
    const testStudent: Student = {
      id: 'std-enrollment-test',
      student_id: 'S99001',
      name: '期間管理 太郎',
      name_kana: 'キカンカンリ タロウ',
      grade: '中2',
      school_id: 'sch-1',
      status: 'normal',
      enrollment_date: '2025-04-01',
      withdrawal_date: '2026-07-01',
      personalities: ['負けず嫌い'],
      personality_tags: ['負けず嫌い'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(testStudent);
    await db.addPersonalityOption('負けず嫌い');
    await db.addPersonalityOption('集中力がある');

    const { unmount } = render(
      <TeacherDashboard onBackToPortal={vi.fn()} onLogout={vi.fn()} />
    );

    // 2. Select student via edit button
    await waitFor(() => {
      expect(screen.getByTestId('edit-student-btn-std-enrollment-test')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-student-btn-std-enrollment-test'));
    });

    // 3. Verify enrollment duration badge
    await waitFor(() => {
      expect(screen.getByText(/在籍期間: 1年3ヶ月/)).toBeInTheDocument();
    });

    // 4. Change withdrawal date to empty -> shows active duration badge
    const withdrawalInput = screen.getByTestId('student-withdrawal-date-input');
    await act(async () => {
      fireEvent.change(withdrawalInput, { target: { value: '' } });
    });

    await waitFor(() => {
      expect(screen.getByText(/在籍中:/)).toBeInTheDocument();
    });

    // 5. Check personality tags
    expect(screen.getAllByText('負けず嫌い').length).toBeGreaterThanOrEqual(1);

    // 6. Add new personality via "新しく書いて追加"
    const newPersonalityInput = screen.getByTestId('new-personality-input');
    const addPersonalityBtn = screen.getByTestId('add-personality-btn');

    await act(async () => {
      fireEvent.change(newPersonalityInput, { target: { value: 'しっかりもの' } });
    });
    await act(async () => {
      fireEvent.click(addPersonalityBtn);
    });

    // Verified: tag added immediately, master options updated, input cleared
    expect(screen.getAllByText('しっかりもの').length).toBeGreaterThanOrEqual(1);
    expect((newPersonalityInput as HTMLInputElement).value).toBe('');
    expect(db.getPersonalityOptions()).toContain('しっかりもの');

    // 7. Remove tag from student via "×" button
    const removeTagBtn = screen.getByRole('button', { name: '個性を解除: 負けず嫌い' });
    await act(async () => {
      fireEvent.click(removeTagBtn);
    });
    expect(screen.queryByRole('button', { name: '個性を解除: 負けず嫌い' })).not.toBeInTheDocument();

    // 8. Delete option from master list via delete button
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const masterSelect = screen.getByTestId('personality-master-select');
    await act(async () => {
      fireEvent.change(masterSelect, { target: { value: '集中力がある' } });
    });

    const deleteMasterBtn = screen.getByTestId('delete-personality-master-btn');
    await act(async () => {
      fireEvent.click(deleteMasterBtn);
    });
    expect(db.getPersonalityOptions()).not.toContain('集中力がある');
    expect(screen.queryByRole('option', { name: '集中力がある' })).not.toBeInTheDocument();

    // 9. Save changes
    const saveBtn = screen.getByRole('button', { name: '変更を保存する' });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // 10. Check saved state in DB
    const savedStudent = db.getStudents().find(s => s.id === 'std-enrollment-test');
    expect(savedStudent?.enrollment_date).toBe('2025-04-01');
    expect(savedStudent?.withdrawal_date).toBeNull();
    expect(savedStudent?.personalities).toEqual(['しっかりもの']);

    unmount();
  });
});





