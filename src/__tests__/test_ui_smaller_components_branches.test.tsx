import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Page from '../app/page';
import BranchManagement from '../components/BranchManagement';
import {
  generateInterview2CoachingAdvice,
  generateInterview3CoachingAdvice,
  generateInterviewSummary,
  parseInterviewTranscriptToFields
} from '../lib/gemini';
import { db, type Student } from '../lib/db';

describe('UI Smaller Components and Gemini Branch Perfection Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    db.clearMockData();
    vi.restoreAllMocks();
  });

  const getDynamicDate = (offsetDays: number = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  it('covers app/page.tsx student grade category filter and session role fallback branches', async () => {
    // Student with empty grade or special grade category
    const st1: Student = {
      id: 'st-grade-fallback-1',
      name: '学年未設定生徒',
      grade: '',
      grade_category: '小学生',
      school_name: '第一小学校'
    };
    const st2: Student = {
      id: 'st-grade-fallback-2',
      name: '既卒生',
      grade: '既卒',
      grade_category: '高校生',
      school_name: '第一高校'
    };
    await db.saveStudent(st1);
    await db.saveStudent(st2);

    // Render Page
    render(<Page />);

    // Wait for splash / initialization to finish
    await waitFor(() => {
      expect(screen.queryByText('TENTORU を起動中...')).toBeNull();
    });
  });

  it('covers BranchManagement direct db fallback when API returns error', async () => {
    // Mock global fetch to return 500 error
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'カスタムAPIエラー' })
    });

    render(<BranchManagement onBack={() => {}} />);

    // Open create branch modal
    const openBtn = screen.getByRole('button', { name: /新規校舎アカウント発行/i });
    fireEvent.click(openBtn);

    // Fill form
    const nameInputs = screen.getAllByPlaceholderText(/例: 横浜教室/i);
    fireEvent.change(nameInputs[0], { target: { value: 'APIフォールバック校' } });

    const codeInputs = screen.getAllByPlaceholderText(/例: YOKOHAMA/i);
    fireEvent.change(codeInputs[0], { target: { value: 'api-fallback' } });

    const emailInputs = screen.getAllByPlaceholderText(/例: yokohama@tentoru\.jp/i);
    fireEvent.change(emailInputs[0], { target: { value: 'fallback@example.com' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /アカウントを発行する/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // In mock environment, it falls back to db.createBranchAccount and shows toast
      expect(screen.getByText(/校舎アカウント「APIフォールバック校」を発行しました。/i)).toBeDefined();
    });
  });

  it('covers gemini.ts prompt generation fallback branches (custom fields empty, dream_goal, two-way transcript)', async () => {
    const dynamicDate = getDynamicDate(0);

    // 1. generateInterview2CoachingAdvice with custom fields missing value, and dream_goal provided
    const advice2 = await generateInterview2CoachingAdvice(
      {
        interview_date: dynamicDate,
        interviewer: '山田 講師',
        dream_goal: '宇宙飛行士',
        target_school: '東京大学',
        study_anxiety: '数学のベクトル',
        required_actions: '毎朝10分の計算',
        target_score: '90',
        custom_fields: [
          { label: '特記事項', value: '' } // triggers f.value || '未記入'
        ]
      },
      { name: '田中 太郎', grade: '高1' }
    );
    expect(advice2).toContain('宇宙飛行士');
    expect(advice2).toContain('数学のベクトル');

    // 2. generateInterview3CoachingAdvice with custom parent_type
    const advice3 = await generateInterview3CoachingAdvice(
      {
        interview_date: dynamicDate,
        interviewer: '佐藤 講師',
        parent_type: '祖母様' as any,
        future_direction_agreed: 'yes',
        custom_fields: [{ label: '家庭での様子', value: '' }]
      },
      { name: '佐藤 花子', grade: '中2' }
    );
    expect(advice3).toContain('三者面談'); // advice markdown contains fallback structure

    // 3. parseInterviewTranscriptToFields with interviewType = 'two-way' and rule-based fallback
    const parsedTwoWay = await parseInterviewTranscriptToFields('志望校は東京大学です。将来の夢は医師です。', 'two-way');
    expect(parsedTwoWay.target_school).toBe('東京大学');
    expect(parsedTwoWay.dream_goal).toBe('医師');

    // 4. generateInterviewSummary with empty interviewer / interview_date
    const summaryMarkdown = await generateInterviewSummary({
      interviewType: 'three-way',
      interview: {
        interview_date: '',
        interviewer: '',
        parent_type: '祖母様' as any
      },
      student: { name: '未設定生徒', grade: '' }
    });
    expect(summaryMarkdown).toContain('本日（担当: 講師）');
  });
});
