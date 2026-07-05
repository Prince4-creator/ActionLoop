import { Suspense } from 'react';
import AdminLoginClient from './login-client';

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminLoginClient />
    </Suspense>
  );
}
