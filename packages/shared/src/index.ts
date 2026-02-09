import type { OAuthProvider as OAuthProviderType } from "./provider-adapter";

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

export interface SourcePlaylist {
  id: string;
  name: string;
  trackCount: number;
}

export interface SourceTrack {
  id: string;
  title: string;
  artist: string;
  isrc?: string;
  durationMs?: number;
  playlistId?: string;
}

export interface TransferPreviewRequest {
  sourceProvider: OAuthProviderType;
  destinationProvider: OAuthProviderType;
  playlistIds?: string[];
  includeLiked?: boolean;
}

export interface TransferPreviewUnmatchedTrack {
  trackId: string;
  title: string;
  artist: string;
  reason: "no_destination_match" | "destination_lookup_failed";
}

export interface TransferPreviewResult {
  matched: number;
  unmatched: number;
  totalSourceTracks: number;
  unmatchedTracks: TransferPreviewUnmatchedTrack[];
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
