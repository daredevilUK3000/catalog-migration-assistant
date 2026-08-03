import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { Album, CatalogIssue, Track } from "@/types/catalog";
import {
  BAND_LABEL,
  SCORE_FRAMING_NOTE,
  computeAlbumScore,
  computeCatalogScore,
} from "@/lib/migrationScore";

// The artist's permanent, tool-independent record of their catalog — every
// album, track, ISRC, UPC, credit, and the validation state at the moment of
// generation. Deliberately does not dump full lyrics text (the spec asks for
// "every writer/credit", not a lyrics archive) and prints "Not on file" for
// copyright holder, since Album/Track have no such column today — stating
// that plainly beats fabricating a value that was never actually captured.

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#171717" },
  coverTitle: { fontSize: 20, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  coverSubtitle: { fontSize: 11, color: "#525252", marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  row: { flexDirection: "row", marginBottom: 10 },
  artwork: { width: 90, height: 90, marginRight: 12, objectFit: "cover" },
  fieldLabel: { fontSize: 8, color: "#737373", textTransform: "uppercase" },
  fieldValue: { fontSize: 10, marginBottom: 6 },
  fieldsGrid: { flexDirection: "row", flexWrap: "wrap" },
  fieldBox: { width: "33%", marginBottom: 6 },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1pt solid #d4d4d4",
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5pt solid #e5e5e5",
    paddingVertical: 4,
  },
  colPos: { width: "6%" },
  colTitle: { width: "26%" },
  colIsrc: { width: "20%" },
  colLyrics: { width: "12%" },
  colCredits: { width: "36%" },
  issueRow: { flexDirection: "row", marginBottom: 3 },
  badge: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    fontSize: 8,
    color: "#a3a3a3",
    borderTop: "0.5pt solid #e5e5e5",
    paddingTop: 6,
  },
  disclaimer: {
    fontSize: 8,
    color: "#737373",
    marginTop: 10,
    marginBottom: 10,
  },
});

function formatDate(d: string | null): string {
  if (!d) return "Not set";
  return d;
}

function formatCredits(credits: Track["credits"]): string {
  if (!credits || credits.length === 0) return "None on file";
  return credits
    .map((c) => `${c.role}: ${c.name}${c.split_percent != null ? ` (${c.split_percent}%)` : ""}`)
    .join("; ");
}

function Footer({ generatedAt }: { generatedAt: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        Generated {generatedAt} — Catalog Migration Assistant. This is your own permanent record,
        independent of any distributor.
      </Text>
    </View>
  );
}

function AlbumPage({
  album,
  tracks,
  issues,
  generatedAt,
}: {
  album: Album;
  tracks: Track[];
  issues: CatalogIssue[];
  generatedAt: string;
}) {
  const sortedTracks = [...tracks].sort((a, b) => a.position - b.position);
  const score = computeAlbumScore(album.id, issues);
  const unresolvedIssues = issues.filter((i) => !i.resolved);

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.row}>
        {album.artwork_url && <Image style={styles.artwork} src={album.artwork_url} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.coverTitle}>{album.title}</Text>
          <Text style={styles.coverSubtitle}>{album.artist}</Text>
          <Text style={styles.badge}>
            Data readiness: {score.score}% — {BAND_LABEL[score.band]}
          </Text>
        </View>
      </View>

      <View style={styles.fieldsGrid}>
        <View style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>Release date</Text>
          <Text style={styles.fieldValue}>{formatDate(album.release_date)}</Text>
        </View>
        <View style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>UPC</Text>
          <Text style={styles.fieldValue}>{album.upc ?? "Not set"}</Text>
        </View>
        <View style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>Genre</Text>
          <Text style={styles.fieldValue}>{album.genre ?? "Not set"}</Text>
        </View>
        <View style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>Source distributor</Text>
          <Text style={styles.fieldValue}>{album.source_distributor ?? "Not set"}</Text>
        </View>
        <View style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>Copyright holder</Text>
          <Text style={styles.fieldValue}>Not on file (not tracked by this app)</Text>
        </View>
        <View style={styles.fieldBox}>
          <Text style={styles.fieldLabel}>Track count</Text>
          <Text style={styles.fieldValue}>{tracks.length}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Tracks</Text>
      <View style={styles.tableHeader}>
        <Text style={styles.colPos}>#</Text>
        <Text style={styles.colTitle}>Title</Text>
        <Text style={styles.colIsrc}>ISRC</Text>
        <Text style={styles.colLyrics}>Lyrics</Text>
        <Text style={styles.colCredits}>Credits</Text>
      </View>
      {sortedTracks.map((track) => (
        <View style={styles.tableRow} key={track.id} wrap={false}>
          <Text style={styles.colPos}>{track.position}</Text>
          <Text style={styles.colTitle}>{track.title}</Text>
          <Text style={styles.colIsrc}>{track.isrc ?? "Not set"}</Text>
          <Text style={styles.colLyrics}>
            {track.lyrics_plain || track.lyrics_synced ? "On file" : "None"}
          </Text>
          <Text style={styles.colCredits}>{formatCredits(track.credits)}</Text>
        </View>
      ))}

      <Text style={{ ...styles.sectionTitle, marginTop: 16 }}>Validation results at generation time</Text>
      {unresolvedIssues.length === 0 ? (
        <Text style={styles.fieldValue}>No open issues.</Text>
      ) : (
        unresolvedIssues.map((issue) => (
          <View style={styles.issueRow} key={issue.id}>
            <Text>{issue.severity === "error" ? "[!] " : "[warn] "}</Text>
            <Text>{issue.message}</Text>
          </View>
        ))
      )}

      <Text style={styles.disclaimer}>{SCORE_FRAMING_NOTE}</Text>

      <Footer generatedAt={generatedAt} />
    </Page>
  );
}

function SummaryPage({
  albums,
  issues,
  generatedAt,
}: {
  albums: Album[];
  issues: CatalogIssue[];
  generatedAt: string;
}) {
  const catalogScore = computeCatalogScore(albums, issues);
  const weakestAlbum = catalogScore.weakest
    ? albums.find((a) => a.id === catalogScore.weakest!.album_id)
    : null;

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.coverTitle}>Migration Report</Text>
      <Text style={styles.coverSubtitle}>{albums.length} album(s) — your permanent catalog record</Text>

      <Text style={styles.badge}>
        Catalog data readiness: {catalogScore.average}% — {BAND_LABEL[catalogScore.band]}
      </Text>
      {weakestAlbum && catalogScore.weakest && (
        <Text style={styles.fieldValue}>
          Weakest album: {weakestAlbum.title} — {catalogScore.weakest.score}% (
          {BAND_LABEL[catalogScore.weakest.band]})
        </Text>
      )}

      <Text style={{ ...styles.sectionTitle, marginTop: 16 }}>Albums in this report</Text>
      {catalogScore.albums.map((s) => {
        const album = albums.find((a) => a.id === s.album_id);
        return (
          <View style={styles.tableRow} key={s.album_id} wrap={false}>
            <Text style={{ width: "60%" }}>
              {album?.title} — {album?.artist}
            </Text>
            <Text style={{ width: "20%" }}>{s.score}%</Text>
            <Text style={{ width: "20%" }}>{BAND_LABEL[s.band]}</Text>
          </View>
        );
      })}

      <Text style={styles.disclaimer}>{SCORE_FRAMING_NOTE}</Text>
      <Footer generatedAt={generatedAt} />
    </Page>
  );
}

export function MigrationReportDocument({
  albums,
  tracksByAlbumId,
  issuesByAlbum,
  generatedAt,
}: {
  albums: Album[];
  tracksByAlbumId: Map<string, Track[]>;
  issuesByAlbum: Map<string, CatalogIssue[]>;
  generatedAt: string;
}) {
  const allIssues = albums.flatMap((a) => issuesByAlbum.get(a.id) ?? []);
  return (
    <Document>
      {albums.length > 1 && (
        <SummaryPage albums={albums} issues={allIssues} generatedAt={generatedAt} />
      )}
      {albums.map((album) => (
        <AlbumPage
          key={album.id}
          album={album}
          tracks={tracksByAlbumId.get(album.id) ?? []}
          issues={issuesByAlbum.get(album.id) ?? []}
          generatedAt={generatedAt}
        />
      ))}
    </Document>
  );
}
