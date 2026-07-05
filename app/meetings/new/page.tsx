import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import NewMeetingClient from './new-meeting-client';
import { isAdminUser } from '@/lib/auth';

export default async function NewMeetingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <NewMeetingClient isAdmin={isAdminUser(user)} />;
}