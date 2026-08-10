export type Role = 'user' | 'admin';

export type RoomType = '1on1' | 'group';

export type RoomStatus = 'waiting' | 'active' | 'ended';

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
  role: Role;
  interestVec?: number[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface InterestCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

export interface UserInterest {
  id: string;
  userId: string;
  categoryId: string;
  weight: number;
  category?: InterestCategory;
}

export interface SystemTopic {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  category?: InterestCategory;
  createdAt: string;
}

export interface WatchedTopic {
  id: string;
  userId: string;
  topicId: string;
  topic?: SystemTopic;
  createdAt: string;
}

export interface Room {
  id: string;
  type: RoomType;
  systemTopicId?: string | null;
  customTopic?: string | null;
  customDescription?: string | null;
  categoryId?: string | null;
  createdBy?: string | null;
  cap?: number | null;
  status: RoomStatus;
  hasAi: boolean;
  isPublic: boolean;
  createdAt: string;
  endedAt?: string | null;
  systemTopic?: SystemTopic | null;
  category?: InterestCategory | null;
  creator?: User | null;
  participants?: Participant[];
  messages?: Message[];
}

export interface Participant {
  id: string;
  roomId: string;
  userId?: string | null;
  isAi: boolean;
  joinedAt: string;
  leftAt?: string | null;
  user?: User | null;
}

export interface Message {
  id: string;
  roomId: string;
  senderId?: string | null;
  isAi: boolean;
  content: string;
  createdAt: string;
  sender?: User | null;
}

export interface JoinRequest {
  id: string;
  roomId: string;
  userId: string;
  status: JoinRequestStatus;
  createdAt: string;
  user?: User;
  room?: Room;
}

export interface ConversationDigest {
  id: string;
  roomId: string;
  summary: string;
  user1Position: string;
  user2Position: string;
  unresolvedQuestion: string;
  createdAt: string;
}

export interface PostChatDigest {
  id: string;
  roomId: string;
  summaryStanceUser1: string;
  summaryStanceUser2: string;
  openQuestions: string;
  createdAt: string;
}

export interface ArgumentMapNode {
  id: string;
  type: 'claim' | 'evidence' | 'rebuttal' | 'concession' | 'agreement';
  participant: string;
  content: string;
  parent?: string;
  relation?: 'supports' | 'challenges' | 'partially_agrees' | 'acknowledges';
}

export interface ArgumentMapEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ArgumentMapData {
  centralQuestion: string;
  participants: Array<{ id: string; username: string; color: string }>;
  nodes: ArgumentMapNode[];
  edges: ArgumentMapEdge[];
}

export interface ArgumentMap {
  id: string;
  roomId: string;
  data: ArgumentMapData;
  createdAt: string;
}

export interface ConversationStarter {
  id: string;
  roomId: string;
  questions: string[];
  createdAt: string;
}

// WebSocket Event Payloads
export interface ClientToServerEvents {
  join_room: (data: { roomId: string }) => void;
  leave_room: (data: { roomId: string }) => void;
  send_message: (data: { roomId: string; content: string }) => void;
  typing_start: (data: { roomId: string }) => void;
  typing_stop: (data: { roomId: string }) => void;
  queue_enter: (data: { topicId: string }) => void;
  queue_leave: (data: { topicId: string }) => void;
}

export interface ServerToClientEvents {
  room_joined: (data: { room: Room; participants: Participant[]; messages: Message[]; starters?: string[] }) => void;
  user_joined: (data: { user: User }) => void;
  user_left: (data: { userId: string }) => void;
  new_message: (data: { message: Message }) => void;
  ai_chunk: (data: { messageId: string; chunk: string }) => void;
  ai_done: (data: { messageId: string }) => void;
  typing: (data: { userId: string }) => void;
  stopped_typing: (data: { userId: string }) => void;
  match_found: (data: { roomId: string; topicTitle: string }) => void;
  ai_joining: (data: { roomId: string }) => void;
  room_ended: (data: { roomId: string }) => void;
  new_join_request: (data: { request: JoinRequest }) => void;
  join_request_update: (data: { status: JoinRequestStatus; roomId: string }) => void;
  watched_topic_active: (data: { topicId: string; topicTitle: string }) => void;
}
