import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Home from '../app/page';
import LoginForm from '../components/LoginForm';
import { db } from '../lib/db';

describe('Clean Login Screen & Direct Dashboard Navigation Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should display pure LoginForm by default on root page with no demo presets or student entry link', async () => {
    render(<Home />);

    // Check pure login form branding and fields
    expect(screen.getByText('TENTORU')).toBeInTheDocument();
    expect(screen.getByText('校舎・管理者 ログイン')).toBeInTheDocument();
    expect(screen.getByTestId('login-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit-btn')).toBeInTheDocument();

    // Verify demo quick logins and student entry links are completely removed
    expect(screen.queryByTestId('quick-login-admin')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-login-ebisu')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-login-shibuya')).not.toBeInTheDocument();
    expect(screen.queryByTestId('student-entry-btn')).not.toBeInTheDocument();
  });

  it('should authenticate with headquarters admin credentials and route directly to management dashboard', async () => {
    render(<Home />);

    const emailInput = screen.getByTestId('login-email-input');
    const passInput = screen.getByTestId('login-password-input');
    const submitBtn = screen.getByTestId('login-submit-btn');
    const form = submitBtn.closest('form')!;

    // Input admin credentials
    fireEvent.change(emailInput, { target: { value: 'admin@tentoru.jp' } });
    fireEvent.change(passInput, { target: { value: 'Tentoru2026!' } });

    await act(async () => {
      fireEvent.submit(form);
    });

    // Should now be on management dashboard directly with header logout button and branch switcher
    await waitFor(() => {
      expect(screen.getByText('テントル 司令塔ダッシュボード (講師用)')).toBeInTheDocument();
      expect(screen.getByTestId('header-logout-btn')).toBeInTheDocument();
      expect(screen.getByTestId('admin-branch-switcher')).toBeInTheDocument();
    });

    // Click logout
    const logoutBtn = screen.getByTestId('header-logout-btn');
    await act(async () => {
      fireEvent.click(logoutBtn);
    });

    // Should return to login screen
    await waitFor(() => {
      expect(screen.getByText('校舎・管理者 ログイン')).toBeInTheDocument();
    });
  });

  it('should authenticate with branch credentials and directly route to TeacherDashboard', async () => {
    render(<Home />);

    const emailInput = screen.getByTestId('login-email-input');
    const passInput = screen.getByTestId('login-password-input');
    const submitBtn = screen.getByTestId('login-submit-btn');
    const form = submitBtn.closest('form')!;

    // Input branch credentials
    fireEvent.change(emailInput, { target: { value: 'ebisu@tentoru.jp' } });
    fireEvent.change(passInput, { target: { value: 'Tentoru2026!' } });

    await act(async () => {
      fireEvent.submit(form);
    });

    // Should route directly to TeacherDashboard
    await waitFor(() => {
      expect(screen.getByText('テントル 司令塔ダッシュボード (講師用)')).toBeInTheDocument();
      expect(screen.getByTestId('header-logout-btn')).toBeInTheDocument();
    });

    // Click header logout
    const headerLogout = screen.getByTestId('header-logout-btn');
    await act(async () => {
      fireEvent.click(headerLogout);
    });

    // Should return to login screen
    await waitFor(() => {
      expect(screen.getByText('校舎・管理者 ログイン')).toBeInTheDocument();
    });
  });

  it('should support viewing student screen from TeacherDashboard student banner', async () => {
    // Start with admin session
    db.saveSession({
      user: {
        id: 'admin-1',
        email: 'admin@tentoru.jp',
        role: 'admin',
        name: '本部統括管理者'
      },
      logged_in_at: new Date().toISOString()
    });

    render(<Home />);

    // Starts on TeacherDashboard
    await waitFor(() => {
      expect(screen.getByText('テントル 司令塔ダッシュボード (講師用)')).toBeInTheDocument();
    });

    // Select a student from list
    const studentCard = screen.getByText(/佐藤 拓海/);
    fireEvent.click(studentCard);

    // Open student screen from banner
    await waitFor(() => {
      expect(screen.getByTestId('banner-view-student-screen-btn')).toBeInTheDocument();
    });

    const openStudentBtn = screen.getByTestId('banner-view-student-screen-btn');
    fireEvent.click(openStudentBtn);

    // Student dashboard shown
    await waitFor(() => {
      expect(screen.getByText(/佐藤 拓海 さんの学習画面/)).toBeInTheDocument();
    });

    // Return back to portal
    const backBtn = screen.getByText('ログアウト（ポータルへ）');
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(screen.getByText('TENTORU')).toBeInTheDocument();
    });
  });

  it('should display error message on invalid login credentials', async () => {
    render(<LoginForm onLoginSuccess={vi.fn()} />);

    const emailInput = screen.getByTestId('login-email-input');
    const passInput = screen.getByTestId('login-password-input');
    const submitBtn = screen.getByTestId('login-submit-btn');
    const form = submitBtn.closest('form')!;

    // Invalid credentials input
    fireEvent.change(emailInput, { target: { value: 'unknown@example.com' } });
    fireEvent.change(passInput, { target: { value: 'wrongpass' } });

    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(screen.getByTestId('login-error-alert')).toBeInTheDocument();
    });
  });
});
