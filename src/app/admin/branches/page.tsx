'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BranchManagement from '../../../components/BranchManagement';
import { db, UserSession } from '../../../lib/db';

export default function AdminBranchesPage() {
  const router = useRouter();
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const curSession = db.getSession();
    if (!curSession || curSession.user.role !== 'admin') {
      // Auth Guard: Redirect unauthenticated or non-admin users to root login
      router.push('/');
    } else {
      setSession(curSession);
    }
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
        <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>認証確認中...</span>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '24px 32px' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <BranchManagement
          onBack={() => router.push('/')}
        />
      </div>
    </div>
  );
}
