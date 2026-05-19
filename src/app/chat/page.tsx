import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ChatShell } from './chat-shell';

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, public_key')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  return (
    <ChatShell
      currentUserId={user.id}
      currentUsername={profile.username as string}
      currentDisplayName={(profile.display_name ?? profile.username) as string}
    />
  );
}
