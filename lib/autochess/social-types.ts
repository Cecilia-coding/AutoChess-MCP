export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type SocialInvite = {
  id: string; roomId: string; fromId: string; fromName: string; fromKind: 'human' | 'machine';
  toId: string; toName: string; toKind: 'human' | 'machine'; packName: string;
  createdAt: number; expiresAt: number; seenAt?: number; status: InvitationStatus;
};
export type SocialPeer = {
  id: string; username: string; frame?: string; kind: 'human' | 'machine';
  presence: 'online' | 'recent' | 'offline'; inGame: boolean;
};
export type SocialSnapshot = {
  humans: SocialPeer[]; machines: SocialPeer[]; inbox: SocialInvite[]; sent: SocialInvite[];
  currentRoom?: { roomId: string; token: string; phase?: 'waiting' | 'prepare' | 'finished'; cancelAction?: { tool: 'act'; args: { kind: 'cancel_room'; round: number; revision: number }; fill: string[]; reason: string } };
};
