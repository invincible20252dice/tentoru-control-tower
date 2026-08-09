'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import BranchManagement from '../../../components/BranchManagement';

export default function AdminBranchesPage() {
  const router = useRouter();

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
