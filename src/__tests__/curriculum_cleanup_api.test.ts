import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, DELETE } from '../app/api/admin/curriculum-masters/cleanup/route';
import { NextRequest } from 'next/server';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      delete: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }))
}));

describe('Curriculum Masters Cleanup API Route Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('should handle POST request with default grades when body is empty', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/curriculum-masters/cleanup', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.target_grades).toEqual(['小1', '小2', '小3', '小4', '小5', '小6', '中3']);
  });

  it('should handle DELETE request with custom grades', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/curriculum-masters/cleanup', {
      method: 'DELETE',
      body: JSON.stringify({ grades: ['小1', '小2'] })
    });

    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.target_grades).toEqual(['小1', '小2']);
  });

  it('should handle Supabase deletion flow when credentials are present', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://dummy.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'dummy-service-key';

    const req = new NextRequest('http://localhost:3000/api/admin/curriculum-masters/cleanup', {
      method: 'POST',
      body: JSON.stringify({ grades: ['中3'] })
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.supabase_connected).toBe(true);
  });
});
