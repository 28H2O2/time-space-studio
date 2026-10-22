export type ArtworkCategory = "time-space" | "graphic" | "art";

// Historical Gemini records stay byte-for-byte intact; new dot writing must
// not imply that a particular underlying model was disclosed or invoked.
export type WritingProvenance = {
  model: "gemini-4-argon" | "factory/gemini-4-argon";
  generatedAt: string;
  inputHash: string;
  author?: never;
  referenceSources?: never;
} | {
  author: "dot" | "codex";
  // New dot records omit model; retain only the already-published marker.
  model?: "unknown";
  generatedAt: string;
  inputHash: string;
  referenceSources: string[];
};

export interface Artwork {
  id: string;
  title: string;
  titleOriginal: string;
  creator: string;
  year: string;
  category: ArtworkCategory;
  methods: string[];
  topics: string[];
  sourceUrl: string;
  imageKey: string;
  width: number;
  height: number;
  rights: { label: string; url: string; credit: string; usage: string };
  observation: string;
  evidence: string;
  analysis: { structure: string; borrow: string; application: string };
  writing: WritingProvenance;
  addedAt: string;
}

export interface Note {
  artworkId: string;
  favorite: boolean;
  preference: "like" | "dislike" | "neutral";
  note: string;
  tags: string[];
  updatedAt: string;
}

export interface StyleRule {
  id: string;
  text: string;
  exampleIds: string[];
  createdAt: string;
}

export interface Batch {
  id: string;
  date: string;
  featuredIds: string[];
  status: "published";
  count: number;
  createdAt: string;
}

export interface LibraryResponse {
  artworks: Artwork[];
  batches: Batch[];
  latestSuccess: string | null;
}
