export interface User {
  id: string;
  display_name: string;
  email: string;
  role: 'admin' | 'staff' | 'agent';
  status: 'active' | 'pending';
  created_at?: any;
}

export interface Channel {
  id: string;
  name: string;
  type: 'public' | 'private';
  description?: string;
  members: string[]; // array of user IDs
  created_by: string;
  created_at: any;
}

export interface Message {
  id: string;
  text: string;
  sender_id: string;
  created_at: any;
  target_type: 'dm' | 'channel';
  target_id: string; // userId if DM, channelId if channel
  post_type: 'standard' | 'announcement';
  thread_id?: string; // If it's a reply in a thread
  mentions?: string[]; // array of user IDs
  is_boosted?: boolean;
}

export interface UserMetadata {
  id: string; // matches user.id
  drafts?: Record<string, string>; // { targetId: "draft text" }
  custom_folders?: { id: string; name: string; items: string[] }[]; // items are mixed channel/user IDs
  muted_targets?: string[]; // Array of IDs (channels or users)
  last_read?: Record<string, any>; // { targetId: timestamp }
}

export type ChatTarget = (User & { isChannel: false }) | (Channel & { isChannel: true });
