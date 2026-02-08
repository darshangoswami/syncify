export interface InviteRequestPayload {
  email: string;
  honeypot?: string;
}

export interface InviteRequestResult {
  requestId: string;
  status: "received";
}

export interface InviteApprovalStatus {
  approved: boolean;
  normalizedEmail: string;
}

export interface TransferTrack {
  id: string;
  title: string;
  artist: string;
  isrc?: string;
  durationMs?: number;
}

export interface TransferChunkRequest {
  sourceProvider: string;
  destinationProvider: string;
  playlistId: string;
  tracks: TransferTrack[];
}

export interface TransferChunkResult {
  added: number;
  skipped: number;
  unmatched: Array<{ trackId: string; reason: string }>;
}

export type {
  OAuthProvider,
  OAuthAuthorizationRequest,
  OAuthTokenExchangeRequest,
  OAuthTokenSet,
  OAuthProviderAdapter
} from "./provider-adapter";
