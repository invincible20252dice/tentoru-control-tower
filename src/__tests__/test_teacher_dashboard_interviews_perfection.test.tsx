import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import * as geminiModule from '../lib/gemini';
import html2canvas from 'html2canvas';

vi.mock('html2canvas', () => {
  return {
    default: vi.fn().mockResolvedValue({
      toDataURL: vi.fn().mockReturnValue('data:image/png;base64,fakeImageData')
    })
  };
});

const getDynamicDateStr = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

describe('TeacherDashboard Two-Way and Three-Way Interview Perfection Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);
  });

  it('covers two-way interview full lifecycle: creation, fields, custom fields, voice recording, transcript parsing, AI summary, image download, and deletion', async () => {
    const todayStr = getDynamicDateStr(0);
    const mockStudent = {
      id: 'st-dyn-interview-1',
      student_id: 'std_test_01',
      name: '二者面談テスト生徒',
      grade: '中2',
      school_id: 'sch-1',
      school_name: '第一中学',
      teacher_in_charge: '山田講師',
      status: 'normal' as const
    };

    const initialInterviews2 = [
      {
        id: 'int2-existing-1',
        student_id: mockStudent.id,
        interviewer: '山田講師',
        interview_date: getDynamicDateStr(-10),
        target_school: 'トップ県立高校',
        dream_goal: '宇宙飛行士',
        club_activity: 'バスケットボール部',
        club_members_count: '25名',
        close_friends: '田中くん',
        target_rank: '学年15位以内',
        target_score: '450点',
        study_anxiety: '英語の長文読解',
        self_evaluation: '7点/10点',
        student_challenges: '毎日の英単語練習',
        required_actions: '毎朝15分の単語学習',
        expectations: '自主的な質問',
        notes: '面談メモ既存',
        custom_fields: [{ id: 'cf-old-1', label: '睡眠時間', value: '7時間' }],
        ai_coaching_advice: '既存AI要約です',
        audio_transcript: '既存文字起こし'
      }
    ];

    vi.spyOn(db, 'getStudents').mockReturnValue([mockStudent as any]);
    vi.spyOn(db, 'fetchStudents').mockResolvedValue([mockStudent as any]);
    vi.spyOn(db, 'getStudentInterviews2').mockReturnValue(initialInterviews2 as any);
    const saveInterview2Spy = vi.spyOn(db, 'saveStudentInterview2').mockResolvedValue(true as any);
    const deleteInterview2Spy = vi.spyOn(db, 'deleteStudentInterview2').mockResolvedValue(true as any);

    // Mock gemini functions
    vi.spyOn(geminiModule, 'parseInterviewTranscriptToFields').mockResolvedValue({
      interviewer: '鈴木講師',
      target_school: '希望高校A',
      dream_goal: '医師',
      club_activity: 'テニス部',
      club_members_count: '12名',
      close_friends: '佐藤くん',
      study_anxiety: '数学の関数',
      self_evaluation: '5点',
      student_challenges: 'ケアレスミス',
      required_actions: '見直し5分',
      expectations: '提出期限厳守',
      target_rank: '10位',
      target_score: '460点',
      notes: '追加メモ'
    });
    vi.spyOn(geminiModule, 'generateInterviewSummary').mockResolvedValue('生成されたAI二者面談要約シート');

    // Setup mock SpeechRecognition
    let mockRecInstance: any = null;
    class MockSpeechRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: any = null;
      onerror: any = null;
      onend: any = null;
      start = vi.fn(() => {
        mockRecInstance = this;
      });
      stop = vi.fn();
    }
    (window as any).SpeechRecognition = MockSpeechRecognition;

    const { rerender } = render(
      <TeacherDashboard
        students={[mockStudent as any]}
        initialStudentId={mockStudent.id}
        initialTab="two-way-interview"
      />
    );

    // Verify interview view is rendered
    expect(screen.getByTestId('two-way-interview-view')).toBeInTheDocument();

    // 1. Select existing interview from list
    const itemBtn = screen.getByTestId(`interview2-item-${initialInterviews2[0].id}`);
    await act(async () => {
      fireEvent.click(itemBtn);
    });

    // Check fields loaded
    const targetSchoolInput = screen.getByTestId('interview2-target-school') as HTMLInputElement;
    expect(targetSchoolInput.value).toBe('トップ県立高校');

    // 2. Click "新規作成" button to reset form
    const newBtn = screen.getByTestId('interview2-new-btn');
    await act(async () => {
      fireEvent.click(newBtn);
    });
    expect((screen.getByTestId('interview2-target-school') as HTMLInputElement).value).toBe('');

    // 3. Fill in all form fields
    const interviewerInput = screen.getByTestId('interview2-interviewer');
    const dateInput = screen.getByTestId('interview2-date');
    const dreamGoalInput = screen.getByTestId('interview2-dream-goal');
    const clubActivityInput = screen.getByTestId('interview2-club-activity');
    const clubMembersInput = screen.getByTestId('interview2-club-members-count');
    const closeFriendsInput = screen.getByTestId('interview2-close-friends');
    const targetRankInput = screen.getByTestId('interview2-target-rank');
    const targetScoreInput = screen.getByTestId('interview2-target-score');
    const studyAnxietyInput = screen.getByTestId('interview2-study-anxiety');
    const selfEvalInput = screen.getByTestId('interview2-self-evaluation');
    const challengesInput = screen.getByTestId('interview2-student-challenges');
    const reqActionsInput = screen.getByTestId('interview2-required-actions');
    const expectationsInput = screen.getByTestId('interview2-expectations');
    const notesInput = screen.getByTestId('interview2-notes');

    await act(async () => {
      fireEvent.change(interviewerInput, { target: { value: '新規担当講師' } });
      fireEvent.change(dateInput, { target: { value: todayStr } });
      fireEvent.change(targetSchoolInput, { target: { value: '新規志望校B' } });
      fireEvent.change(dreamGoalInput, { target: { value: 'プログラマー' } });
      fireEvent.change(clubActivityInput, { target: { value: '科学部' } });
      fireEvent.change(clubMembersInput, { target: { value: '10人' } });
      fireEvent.change(closeFriendsInput, { target: { value: '高橋くん' } });
      fireEvent.change(targetRankInput, { target: { value: 'トップ5' } });
      fireEvent.change(targetScoreInput, { target: { value: '480点' } });
      fireEvent.change(studyAnxietyInput, { target: { value: '理科の実験記述' } });
      fireEvent.change(selfEvalInput, { target: { value: '8点' } });
      fireEvent.change(challengesInput, { target: { value: '計算スピード' } });
      fireEvent.change(reqActionsInput, { target: { value: '毎日計算ドリル3ページ' } });
      fireEvent.change(expectationsInput, { target: { value: '自己主導学習' } });
      fireEvent.change(notesInput, { target: { value: '初動メモ' } });
    });

    // 4. Test Custom Fields (Add, Edit label/value, Remove)
    const addCustomBtn = screen.getByTestId('interview2-add-custom-field-btn');
    await act(async () => {
      fireEvent.click(addCustomBtn);
    });
    const customLabel0 = screen.getByTestId('interview2-custom-label-0');
    const customValue0 = screen.getByTestId('interview2-custom-value-0');
    await act(async () => {
      fireEvent.change(customLabel0, { target: { value: '通学時間' } });
      fireEvent.change(customValue0, { target: { value: '徒歩15分' } });
    });

    // Add a second custom field and remove it
    await act(async () => {
      fireEvent.click(addCustomBtn);
    });
    const removeCustom1 = screen.getByTestId('interview2-remove-custom-field-1');
    await act(async () => {
      fireEvent.click(removeCustom1);
    });

    // 5. Test Voice Recording Toggle & callbacks
    const recordBtn = screen.getByTestId('interview2-record-btn');
    await act(async () => {
      fireEvent.click(recordBtn); // Start recording
    });
    expect(mockRecInstance).not.toBeNull();
    // Simulate onresult
    await act(async () => {
      mockRecInstance.onresult({
        results: [[{ transcript: '二者面談の録音文字起こしテキスト' }]]
      });
    });
    const transcriptTextarea = screen.getByTestId('interview2-transcript') as HTMLTextAreaElement;
    expect(transcriptTextarea.value).toContain('二者面談の録音文字起こしテキスト');

    // Simulate onerror and onend
    await act(async () => {
      mockRecInstance.onerror({ error: 'network' });
      mockRecInstance.onend();
    });

    // Stop recording manually
    await act(async () => {
      fireEvent.click(recordBtn); // Stop
    });

    // 6. Test Parse Transcript to Fields
    const parseBtn = screen.getByTestId('interview2-parse-transcript-btn');
    await act(async () => {
      fireEvent.click(parseBtn);
    });
    expect(geminiModule.parseInterviewTranscriptToFields).toHaveBeenCalled();
    expect((interviewerInput as HTMLInputElement).value).toBe('鈴木講師');

    // Parse transcript with empty transcript alert (using whitespace to enable button but trigger trim empty check)
    await act(async () => {
      fireEvent.change(transcriptTextarea, { target: { value: '   ' } });
      fireEvent.click(parseBtn);
    });
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('音声文字起こしテキストがありません'));

    // Parse transcript failure handling
    vi.spyOn(geminiModule, 'parseInterviewTranscriptToFields').mockRejectedValueOnce(new Error('Parse API Error'));
    await act(async () => {
      fireEvent.change(transcriptTextarea, { target: { value: 'エラー誘発用テキスト' } });
      fireEvent.click(parseBtn);
    });
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('自動入力でエラーが発生しました'));

    // 7. Test AI Coaching Advice Generation
    const generateAiBtn = screen.getByTestId('interview2-generate-ai-btn');
    await act(async () => {
      fireEvent.click(generateAiBtn);
    });
    expect(geminiModule.generateInterviewSummary).toHaveBeenCalled();
    const adviceTextarea = screen.getByTestId('interview2-ai-advice') as HTMLTextAreaElement;
    expect(adviceTextarea.value).toBe('生成されたAI二者面談要約シート');

    // AI Coaching advice failure
    vi.spyOn(geminiModule, 'generateInterviewSummary').mockRejectedValueOnce(new Error('Summary Gen Error'));
    await act(async () => {
      fireEvent.click(generateAiBtn);
    });
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('面談の要約生成でエラーが発生しました'));

    // 8. Test Download Image
    const downloadImgBtn = screen.getByTestId('interview2-download-image-btn');
    await act(async () => {
      fireEvent.click(downloadImgBtn);
    });
    expect(html2canvas).toHaveBeenCalled();

    // Download image failure
    vi.mocked(html2canvas).mockRejectedValueOnce(new Error('Canvas Error'));
    await act(async () => {
      fireEvent.click(downloadImgBtn);
    });
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('画像書き出しでエラーが発生しました'));

    // 9. Test Save Interview (validation and success)
    const saveBtn = screen.getByTestId('interview2-save-btn');

    // Validation: missing date
    await act(async () => {
      fireEvent.change(dateInput, { target: { value: '' } });
      fireEvent.click(saveBtn);
    });
    expect(window.alert).toHaveBeenCalledWith('実施日を入力してください。');

    // Normal Save
    await act(async () => {
      fireEvent.change(dateInput, { target: { value: todayStr } });
      fireEvent.click(saveBtn);
    });
    expect(saveInterview2Spy).toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith('二者面談の記録を保存しました。');

    // 10. Test Delete Interview
    // Select existing one first
    await act(async () => {
      fireEvent.click(itemBtn);
    });
    const deleteBtn = screen.getByTestId('interview2-delete-btn');

    // Cancel confirm
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await act(async () => {
      fireEvent.click(deleteBtn);
    });
    expect(deleteInterview2Spy).not.toHaveBeenCalled();

    // Confirm OK: when updated has items
    vi.mocked(window.confirm).mockReturnValueOnce(true);
    vi.spyOn(db, 'getStudentInterviews2').mockReturnValueOnce([]);
    await act(async () => {
      fireEvent.click(deleteBtn);
    });
    expect(deleteInterview2Spy).toHaveBeenCalledWith(initialInterviews2[0].id);
    expect(window.alert).toHaveBeenCalledWith('面談記録を削除しました。');

  });

  it('handles unsupported SpeechRecognition in two-way interview', async () => {
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;

    const mockStudent = {
      id: 'st-dyn-interview-unsupp',
      student_id: 'std_test_unsupp',
      name: '非サポート生徒',
      grade: '中2',
      school_id: 'sch-1',
      school_name: '第一中学',
      teacher_in_charge: '山田講師',
      status: 'normal' as const
    };

    render(
      <TeacherDashboard
        students={[mockStudent as any]}
        initialStudentId={mockStudent.id}
        initialTab="two-way-interview"
      />
    );

    const recordBtn = screen.getByTestId('interview2-record-btn');
    await act(async () => {
      fireEvent.click(recordBtn);
    });
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Web Speech APIによる音声認識がサポートされていません'));
  });

  it('covers three-way interview full lifecycle: creation, fields, custom fields, voice recording, transcript parsing, AI summary, image download, and deletion', async () => {
    const todayStr = getDynamicDateStr(0);
    const mockStudent = {
      id: 'st-dyn-interview-3',
      student_id: 'std_test_03',
      name: '三者面談テスト生徒',
      grade: '高1',
      school_id: 'sch-1',
      school_name: '第一高校',
      teacher_in_charge: '高橋講師',
      status: 'normal' as const
    };

    const initialInterviews3 = [
      {
        id: 'int3-existing-1',
        student_id: mockStudent.id,
        interviewer: '高橋講師',
        interview_date: getDynamicDateStr(-14),
        parent_type: 'both',
        future_direction_agreed: 'yes',
        parent_anxieties: '大学受験に向けた学習リズム',
        discussed_content: '文理選択と国公立志望について協議',
        notes: '秋に再面談予定',
        custom_fields: [{ id: 'cf3-1', label: '季節講習', value: '夏期20コマ' }],
        ai_coaching_advice: '三者面談要約既存',
        audio_transcript: '三者面談文字起こし'
      }
    ];

    vi.spyOn(db, 'getStudents').mockReturnValue([mockStudent as any]);
    vi.spyOn(db, 'fetchStudents').mockResolvedValue([mockStudent as any]);
    vi.spyOn(db, 'getStudentInterviews3').mockReturnValue(initialInterviews3 as any);
    const saveInterview3Spy = vi.spyOn(db, 'saveStudentInterview3').mockResolvedValue(true as any);
    const deleteInterview3Spy = vi.spyOn(db, 'deleteStudentInterview3').mockResolvedValue(true as any);

    // Mock gemini
    vi.spyOn(geminiModule, 'parseInterviewTranscriptToFields').mockResolvedValue({
      interviewer: '松本講師',
      parent_type: 'father',
      parent_anxieties: '苦手科目の克服',
      discussed_content: '週3日の自習室活用方針',
      notes: '電話報告予定'
    });
    vi.spyOn(geminiModule, 'generateInterviewSummary').mockResolvedValue('生成された三者面談要約シート');

    // SpeechRecognition mock
    let mockRec3: any = null;
    class MockSpeechRecognition3 {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: any = null;
      onerror: any = null;
      onend: any = null;
      start = vi.fn(() => {
        mockRec3 = this;
      });
      stop = vi.fn();
    }
    (window as any).SpeechRecognition = MockSpeechRecognition3;

    render(
      <TeacherDashboard
        students={[mockStudent as any]}
        initialStudentId={mockStudent.id}
        initialTab="three-way-interview"
      />
    );

    expect(screen.getByTestId('three-way-interview-view')).toBeInTheDocument();

    // 1. Select existing interview
    const itemBtn3 = screen.getByTestId(`interview3-item-${initialInterviews3[0].id}`);
    await act(async () => {
      fireEvent.click(itemBtn3);
    });

    // Check parent_type
    const parentTypeSelect = screen.getByTestId('interview3-parent-type') as HTMLSelectElement;
    expect(parentTypeSelect.value).toBe('both');

    // 2. Click "新規作成"
    const newBtn3 = screen.getByTestId('interview3-new-btn');
    await act(async () => {
      fireEvent.click(newBtn3);
    });
    expect(parentTypeSelect.value).toBe('mother');

    // 3. Fill in all fields
    const interviewerInput3 = screen.getByTestId('interview3-interviewer');
    const dateInput3 = screen.getByTestId('interview3-date');
    const directionNoRadio = screen.getByTestId('interview3-direction-no');
    const directionYesRadio = screen.getByTestId('interview3-direction-yes');
    const parentAnxietiesTextarea = screen.getByTestId('interview3-parent-anxieties');
    const discussedContentTextarea = screen.getByTestId('interview3-discussed-content');
    const notes3Textarea = screen.getByTestId('interview3-notes');

    await act(async () => {
      fireEvent.change(interviewerInput3, { target: { value: '新規三者講師' } });
      fireEvent.change(dateInput3, { target: { value: todayStr } });
      fireEvent.change(parentTypeSelect, { target: { value: 'father' } });
      fireEvent.click(directionNoRadio);
      fireEvent.click(directionYesRadio);
      fireEvent.change(parentAnxietiesTextarea, { target: { value: '通塾頻度と費用' } });
      fireEvent.change(discussedContentTextarea, { target: { value: '推薦入試の要件確認' } });
      fireEvent.change(notes3Textarea, { target: { value: '合意事項確認' } });
    });

    // 4. Custom fields
    const addCustomBtn3 = screen.getByTestId('interview3-add-custom-field-btn');
    await act(async () => {
      fireEvent.click(addCustomBtn3);
    });
    const label0 = screen.getByTestId('interview3-custom-label-0');
    const val0 = screen.getByTestId('interview3-custom-value-0');
    await act(async () => {
      fireEvent.change(label0, { target: { value: '家庭学習時間' } });
      fireEvent.change(val0, { target: { value: '平日2時間' } });
    });

    await act(async () => {
      fireEvent.click(addCustomBtn3);
    });
    const removeBtn3 = screen.getByTestId('interview3-remove-custom-field-1');
    await act(async () => {
      fireEvent.click(removeBtn3);
    });

    // 5. Voice Recording
    const recordBtn3 = screen.getByTestId('interview3-record-btn');
    await act(async () => {
      fireEvent.click(recordBtn3);
    });
    expect(mockRec3).not.toBeNull();
    await act(async () => {
      mockRec3.onresult({
        results: [[{ transcript: '三者面談の録音文字起こしテキスト' }]]
      });
      mockRec3.onerror({ error: 'audio-capture' });
      mockRec3.onend();
    });
    const transcript3Area = screen.getByTestId('interview3-transcript') as HTMLTextAreaElement;
    expect(transcript3Area.value).toContain('三者面談の録音文字起こしテキスト');

    // 6. Parse Transcript
    const parseBtn3 = screen.getByTestId('interview3-parse-transcript-btn');
    await act(async () => {
      fireEvent.click(parseBtn3);
    });
    expect(geminiModule.parseInterviewTranscriptToFields).toHaveBeenCalled();
    expect((interviewerInput3 as HTMLInputElement).value).toBe('松本講師');

    // Empty transcript alert (using whitespace so button is enabled)
    await act(async () => {
      fireEvent.change(transcript3Area, { target: { value: '   ' } });
      fireEvent.click(parseBtn3);
    });
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('音声文字起こしテキストがありません'));

    // Parse transcript failure
    vi.spyOn(geminiModule, 'parseInterviewTranscriptToFields').mockRejectedValueOnce(new Error('API fail'));
    await act(async () => {
      fireEvent.change(transcript3Area, { target: { value: 'テキストあり' } });
      fireEvent.click(parseBtn3);
    });
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('自動入力でエラーが発生しました'));

    // 7. AI Summary Generation
    const generateAiBtn3 = screen.getByTestId('interview3-generate-ai-btn');
    await act(async () => {
      fireEvent.click(generateAiBtn3);
    });
    expect(geminiModule.generateInterviewSummary).toHaveBeenCalled();
    const advice3Area = screen.getByTestId('interview3-ai-advice') as HTMLTextAreaElement;
    expect(advice3Area.value).toBe('生成された三者面談要約シート');

    // AI Summary failure
    vi.spyOn(geminiModule, 'generateInterviewSummary').mockRejectedValueOnce(new Error('AI error'));
    await act(async () => {
      fireEvent.click(generateAiBtn3);
    });
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('面談の要約生成でエラーが発生しました'));

    // 8. Download Image
    const downloadImgBtn3 = screen.getByTestId('interview3-download-image-btn');
    await act(async () => {
      fireEvent.click(downloadImgBtn3);
    });
    expect(html2canvas).toHaveBeenCalled();

    // Download failure
    vi.mocked(html2canvas).mockRejectedValueOnce(new Error('Canvas error'));
    await act(async () => {
      fireEvent.click(downloadImgBtn3);
    });
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('画像書き出しでエラーが発生しました'));

    // 9. Save Interview
    const saveBtn3 = screen.getByTestId('interview3-save-btn');

    // Missing date
    await act(async () => {
      fireEvent.change(dateInput3, { target: { value: '' } });
      fireEvent.click(saveBtn3);
    });
    expect(window.alert).toHaveBeenCalledWith('実施日を入力してください。');

    // Normal save
    await act(async () => {
      fireEvent.change(dateInput3, { target: { value: todayStr } });
      fireEvent.click(saveBtn3);
    });
    expect(saveInterview3Spy).toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith('三者面談の記録を保存しました。');

    // 10. Delete Interview
    await act(async () => {
      fireEvent.click(itemBtn3);
    });
    const deleteBtn3 = screen.getByTestId('interview3-delete-btn');

    // Cancel
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    await act(async () => {
      fireEvent.click(deleteBtn3);
    });
    expect(deleteInterview3Spy).not.toHaveBeenCalled();

    // Confirm OK with remaining items
    vi.mocked(window.confirm).mockReturnValueOnce(true);
    vi.spyOn(db, 'getStudentInterviews3').mockReturnValueOnce(initialInterviews3 as any);
    await act(async () => {
      fireEvent.click(deleteBtn3);
    });
    expect(deleteInterview3Spy).toHaveBeenCalledWith(initialInterviews3[0].id);
    expect(window.alert).toHaveBeenCalledWith('面談記録を削除しました。');

    // Unsupported speech recognition
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;
    await act(async () => {
      fireEvent.click(recordBtn3);
    });
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Web Speech APIによる音声認識がサポートされていません'));
  });
});
