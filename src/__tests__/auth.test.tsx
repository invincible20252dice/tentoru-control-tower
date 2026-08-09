import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Home from '../app/page';
import LoginForm from '../components/LoginForm';
import { db } from '../lib/db';

describe('Auth Guard & Login Screen Initial View Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should display LoginForm by default on root page when unauthenticated', async () => {
    render(<Home />);

    // Check login form branding and fields
    expect(screen.getByText('TENTORU')).toBeInTheDocument();
    expect(screen.getByText('校舎・管理者 ログイン')).toBeInTheDocument();
    expect(screen.getByTestId('login-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit-btn')).toBeInTheDocument();

    // Check Quick demo login buttons
    expect(screen.getByTestId('quick-login-admin')).toBeInTheDocument();
    expect(screen.getByTestId('quick-login-ebisu')).toBeInTheDocument();
    expect(screen.getByTestId('quick-login-shibuya')).toBeInTheDocument();

    // Check student entry button
    expect(screen.getByTestId('student-entry-btn')).toBeInTheDocument();
  });

  it('should authenticate successfully with headquarters admin and route to portal', async () => {
    render(<Home />);

    // Click quick login for admin
    const adminBtn = screen.getByTestId('quick-login-admin');
    await act(async () => {
      fireEvent.click(adminBtn);
    });

    // Should now be on portal / admin screen with logout button
    await waitFor(() => {
      expect(screen.getByTestId('portal-logout-btn')).toBeInTheDocument();
      expect(screen.getByText('講師・管理者')).toBeInTheDocument();
    });

    // Click logout
    const logoutBtn = screen.getByTestId('portal-logout-btn');
    await act(async () => {
      fireEvent.click(logoutBtn);
    });

    // Should return to login screen
    await waitFor(() => {
      expect(screen.getByText('校舎・管理者 ログイン')).toBeInTheDocument();
    });
  });

  it('should authenticate with branch account and directly route to TeacherDashboard', async () => {
    render(<Home />);

    // Click quick login for Ebisu branch
    const ebisuBtn = screen.getByTestId('quick-login-ebisu');
    await act(async () => {
      fireEvent.click(ebisuBtn);
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

  it('should allow student entry flow and return back to login screen', async () => {
    render(<Home />);

    // Click student entry
    const studentBtn = screen.getByTestId('student-entry-btn');
    fireEvent.click(studentBtn);

    // Should see student selection screen
    expect(screen.getByText('生徒用学習画面（すごろくマップ・Todo）')).toBeInTheDocument();
    expect(screen.getByTestId('student-select-dropdown')).toBeInTheDocument();

    // Select student
    const dropdown = screen.getByTestId('student-select-dropdown');
    fireEvent.change(dropdown, { target: { value: 'std-1' } });

    // Click enter student screen
    const enterBtn = screen.getByTestId('enter-student-btn');
    fireEvent.click(enterBtn);

    // Student dashboard shown
    await waitFor(() => {
      expect(screen.getByText(/佐藤 拓海 さんの学習画面/)).toBeInTheDocument();
    });
  });

  it('should display error message on invalid login credentials', async () => {
    render(<LoginForm onLoginSuccess={vi.fn()} onStudentEntry={vi.fn()} />);

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
