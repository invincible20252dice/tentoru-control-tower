import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createBranchPost } from '../app/api/admin/branches/create/route';
import { POST as resetPasswordPost } from '../app/api/admin/branches/reset-password/route';
import { POST as statusPost } from '../app/api/admin/branches/status/route';
import { POST as cleanupPost } from '../app/api/admin/curriculum-masters/cleanup/route';
import { db } from '../lib/db';

describe('Admin API Routes Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    localStorage.clear();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('API: /api/admin/branches/create', () => {
    it('should return 400 if name or email is missing', async () => {
      const req = new NextRequest('http://localhost/api/admin/branches/create', {
        method: 'POST',
        body: JSON.stringify({ name: '' })
      });
      const res = await createBranchPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('校舎名とメールアドレスは必須です');
    });

    it('should create branch in mock database when Supabase is not configured', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const req = new NextRequest('http://localhost/api/admin/branches/create', {
        method: 'POST',
        body: JSON.stringify({
          name: '吉祥寺教室',
          email: 'kichijoji@tentoru.jp',
          password: 'PassWord123!',
          code: 'KICHIJOJI',
          phone: '0422-00-1122',
          address: '東京都武蔵野市吉祥寺...'
        })
      });

      const res = await createBranchPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.branch.name).toBe('吉祥寺教室');
      expect(json.branch.code).toBe('KICHIJOJI');
      expect(json.message).toContain('吉祥寺教室');
    });

    it('should handle errors gracefully during branch creation', async () => {
      vi.spyOn(db, 'createBranchAccount').mockRejectedValueOnce(new Error('DB Connection Failed'));

      const req = new NextRequest('http://localhost/api/admin/branches/create', {
        method: 'POST',
        body: JSON.stringify({
          name: '吉祥寺教室',
          email: 'kichijoji@tentoru.jp'
        })
      });

      const res = await createBranchPost(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('DB Connection Failed');
    });
  });

  describe('API: /api/admin/branches/reset-password', () => {
    it('should return 400 if email is missing', async () => {
      const req = new NextRequest('http://localhost/api/admin/branches/reset-password', {
        method: 'POST',
        body: JSON.stringify({})
      });
      const res = await resetPasswordPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('emailは必須です');
    });

    it('should send password reset successfully', async () => {
      const req = new NextRequest('http://localhost/api/admin/branches/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'ebisu@tentoru.jp' })
      });
      const res = await resetPasswordPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBeDefined();
    });

    it('should handle exceptions during password reset', async () => {
      vi.spyOn(db, 'sendBranchPasswordReset').mockRejectedValueOnce(new Error('SMTP Error'));
      const req = new NextRequest('http://localhost/api/admin/branches/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@tentoru.jp' })
      });
      const res = await resetPasswordPost(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('SMTP Error');
    });
  });

  describe('API: /api/admin/branches/status', () => {
    it('should return 400 if branchId is missing', async () => {
      const req = new NextRequest('http://localhost/api/admin/branches/status', {
        method: 'POST',
        body: JSON.stringify({})
      });
      const res = await statusPost(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('branchIdは必須です');
    });

    it('should toggle branch status successfully', async () => {
      const req = new NextRequest('http://localhost/api/admin/branches/status', {
        method: 'POST',
        body: JSON.stringify({ branchId: 'branch-1' })
      });
      const res = await statusPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.branch.status).toBeDefined();
    });

    it('should handle exceptions during status toggle', async () => {
      vi.spyOn(db, 'toggleBranchStatus').mockRejectedValueOnce(new Error('Status update failed'));
      const req = new NextRequest('http://localhost/api/admin/branches/status', {
        method: 'POST',
        body: JSON.stringify({ branchId: 'branch-999' })
      });
      const res = await statusPost(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Status update failed');
    });
  });

  describe('API: /api/admin/curriculum-masters/cleanup', () => {
    it('should delete specified grades or all legacy data in mock mode', async () => {
      const req = new NextRequest('http://localhost/api/admin/curriculum-masters/cleanup', {
        method: 'POST',
        body: JSON.stringify({ target_grades: ['小1', '小2'] })
      });
      const res = await cleanupPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.deleted_grades).toEqual(['小1', '小2']);
    });

    it('should handle all grades cleanup when target_grades is empty', async () => {
      const req = new NextRequest('http://localhost/api/admin/curriculum-masters/cleanup', {
        method: 'POST',
        body: JSON.stringify({})
      });
      const res = await cleanupPost(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain('全学年');
    });

    it('should handle DB exceptions during cleanup', async () => {
      vi.spyOn(db, 'deleteCurriculumMastersByGrades').mockRejectedValueOnce(new Error('Cleanup DB Error'));
      const req = new NextRequest('http://localhost/api/admin/curriculum-masters/cleanup', {
        method: 'POST',
        body: JSON.stringify({ target_grades: ['小1'] })
      });
      const res = await cleanupPost(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe('Cleanup DB Error');
    });
  });
});
