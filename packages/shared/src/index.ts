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
  filterPlaylistId?: string;
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

export interface TransferMatchedTrack {
  sourceTrackId: string;
  destinationTrackId: string;
  title: string;
  artist: string;
}

export interface TransferPreviewPlaylistBreakdown {
  playlistId: string;
  playlistName: string;
  totalTracks: number;
  matchedCount: number;
  unmatchedCount: number;
  matchedTracks: TransferMatchedTrack[];
}

export interface TransferPreviewResultV2 extends TransferPreviewResult {
  playlists: TransferPreviewPlaylistBreakdown[];
  duplicatesRemoved: number;
  unavailableTracks: number;
}

export interface TidalExistingPlaylist {
  tidalPlaylistId: string;
  tidalPlaylistName: string;
  sourcePlaylistId: string;
  sourcePlaylistName: string;
}

export interface TransferChunkRequest {
  destinationProvider: "tidal";
  playlistId: string;
  playlistName: string;
  destinationPlaylistId?: string;
  trackIds: string[];
}

export interface TransferChunkResult {
  added: number;
  skipped: number;
  failed: number;
  failedTracks: Array<{ trackId: string; reason: string }>;
  destinationPlaylistId: string;
}

export type {
  OAuthProvider,
  OAuthAuthorizationRequest,
  OAuthTokenExchangeRequest,
  OAuthTokenSet,
  OAuthProviderAdapter
} from "./provider-adapter";
