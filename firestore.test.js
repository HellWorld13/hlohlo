const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const ALICE_UID = "alice_uid_123";
const BOB_UID = "bob_uid_456";

const [emulatorHost, emulatorPortStr] = (
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085"
).split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

function buildValidClipPayload(uid, ts) {
  return {
    userId: uid,
    mediaId: "media_1",
    sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    youtubeVideoId: "dQw4w9WgXcQ",
    thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    title: "3-Second Hook Formula",
    hook: "Most creators lose 70% of viewers right here.",
    viralScore: 94,
    startSec: 12,
    endSec: 58,
    subtitlesEnabled: true,
    subtitleStyle: "HORMOZI_POP",
    captions: [{ startSec: 12, endSec: 16, text: "Most creators lose 70% here." }],
    aspectRatio: "9:16",
    filterPreset: "CYBER_CYAN",
    playbackSpeed: 1.15,
    zoomScale: 1.1,
    brightness: 0.05,
    contrast: 1.15,
    saturation: 1.1,
    voiceVolume: 1.0,
    musicTrack: "HYPER_BEAT",
    musicVolume: 0.25,
    noiseReduction: true,
    overlayText: "WATCH TIL END",
    thumbnailTemplate: "NEON_HOOK",
    exportResolution: "1080p",
    exportFps: 60,
    exportBitrate: "HIGH",
    exportFormat: "MP4_H264",
    optimizedPlatform: "TIKTOK",
    seoTitle: "Why 70% of Viewers Scroll Past Your Hook",
    seoDescription: "Learn the 3-second retention hook framework for short-form video.",
    seoTags: ["#videomarketing", "#tiktoktips", "#viralshorts"],
    exportedPath: "",
    createdEpochMs: Date.now() - 5000,
    superAiGenerated: true,
    createdAt: ts,
    updatedAt: ts,
  };
}

test("Unauthenticated user: cannot read or write any user collection", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  const ts = new Date(Date.now() - 1000);
  await assertFails(unauthDb.collection("users").doc(ALICE_UID).get());
  await assertFails(unauthDb.collection("users").doc(ALICE_UID).collection("clips").get());
  await assertFails(
    unauthDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("clips")
      .doc("clip_1")
      .set(buildValidClipPayload(ALICE_UID, ts))
  );
});

test("User profile & Super AI config: create, partial update, and cross-user isolation", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  const ts = new Date(Date.now() - 5000);

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).set({
      userId: ALICE_UID,
      displayName: "Alice Studio",
      defaultPlatform: "TIKTOK",
      autoSubtitlesEnabled: true,
      superAiActive: false,
      superAiNiche: "Tech & AI",
      superAiChannel: "@MKBHD",
      superAiAutoPostNow: false,
      superAiPostingTimes: ["09:00 AM", "06:30 PM"],
      autoDelete24hEnabled: false,
      createdAt: ts,
      updatedAt: ts,
    })
  );

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).update({
      defaultPlatform: "YOUTUBE_SHORTS",
      autoSubtitlesEnabled: false,
      superAiActive: true,
      superAiPostingTimes: ["09:00 AM", "01:00 PM", "09:00 PM"],
      autoDelete24hEnabled: true,
      updatedAt: new Date(Date.now() - 1000),
    })
  );

  await assertFails(bobDb.collection("users").doc(ALICE_UID).get());
  await assertFails(
    bobDb.collection("users").doc(ALICE_UID).update({
      displayName: "Hacked",
      updatedAt: new Date(Date.now() - 1000),
    })
  );
});

test("Media library: create, list, update, delete & reject ghost fields", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const ts = new Date(Date.now() - 5000);

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("media").doc("media_1").set({
      userId: ALICE_UID,
      title: "Creator Podcast Ep 12",
      sourceType: "YOUTUBE",
      sourceUrl: "https://www.youtube.com/watch?v=abc123xyz00",
      youtubeVideoId: "abc123xyz00",
      thumbnailUrl: "https://img.youtube.com/vi/abc123xyz00/hqdefault.jpg",
      durationSeconds: 1840,
      aspectRatio: "16:9",
      status: "READY",
      createdEpochMs: Date.now() - 5000,
      superAiGenerated: false,
      createdAt: ts,
      updatedAt: ts,
    })
  );

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("media").get()
  );

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("media").doc("media_1").update({
      status: "EXPORTED",
      updatedAt: new Date(Date.now() - 1000),
    })
  );

  // Reject ghost field (@DocumentId `id` leaked into payload)
  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).collection("media").doc("media_2").set({
      id: "media_2",
      userId: ALICE_UID,
      title: "Invalid",
      sourceType: "UPLOADED",
      sourceUrl: "content://media/1",
      youtubeVideoId: "",
      thumbnailUrl: "",
      durationSeconds: 30,
      aspectRatio: "9:16",
      status: "READY",
      createdEpochMs: Date.now() - 5000,
      superAiGenerated: false,
      createdAt: ts,
      updatedAt: ts,
    })
  );

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("media").doc("media_1").delete()
  );
});

test("Viral clips: create, toggle subtitles, studio edit, and reject invalid bounds", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  const ts = new Date(Date.now() - 5000);

  await assertSucceeds(
    aliceDb
      .collection("users")
      .doc(ALICE_UID)
      .collection("clips")
      .doc("clip_1")
      .set(buildValidClipPayload(ALICE_UID, ts))
  );

  // Toggle subtitles off & update studio filters + export settings
  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("clips").doc("clip_1").update({
      subtitlesEnabled: false,
      filterPreset: "OBSIDIAN",
      exportResolution: "4K",
      optimizedPlatform: "YOUTUBE_SHORTS",
      updatedAt: new Date(Date.now() - 1000),
    })
  );

  // Reject future timestamp & out-of-range viralScore
  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).collection("clips").doc("clip_2").set({
      ...buildValidClipPayload(ALICE_UID, new Date(Date.now() + 60000)),
    })
  );
  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).collection("clips").doc("clip_1").update({
      viralScore: 150,
      updatedAt: new Date(Date.now() - 1000),
    })
  );
  await assertFails(
    bobDb.collection("users").doc(ALICE_UID).collection("clips").get()
  );
});

test("Social accounts & Scheduled posts: create, reschedule, terminal lock on PUBLISHED", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const ts = new Date(Date.now() - 5000);

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("socialAccounts").doc("acc_tiktok").set({
      userId: ALICE_UID,
      platform: "TIKTOK",
      handle: "@clipforge.creator",
      connected: true,
      autoOptimize: true,
      followersCount: 48200,
      peakTimeWindow: "6:30 PM - 9:00 PM",
      createdAt: ts,
      updatedAt: ts,
    })
  );

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("scheduledPosts").doc("post_1").set({
      userId: ALICE_UID,
      clipId: "clip_1",
      clipTitle: "3-Second Hook Formula",
      thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      platforms: ["TIKTOK", "YOUTUBE_SHORTS"],
      seoTitle: "Why 70% of Viewers Scroll Past Your Hook",
      seoDescription: "Retention hook breakdown.",
      seoTags: ["#shorts", "#tiktok"],
      scheduledAtEpochMs: Date.now() + 3600000,
      scheduledLabel: "Today 6:30 PM (Peak 94%)",
      peakScore: 94,
      status: "SCHEDULED",
      optimizationSummary: "Auto-framed 9:16, -14 LUFS audio, 60fps MP4",
      createdAt: ts,
      updatedAt: ts,
    })
  );

  // Transition to PUBLISHED
  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("scheduledPosts").doc("post_1").update({
      status: "PUBLISHED",
      updatedAt: new Date(Date.now() - 1000),
    })
  );

  // Terminal state lock: PUBLISHED post cannot be edited
  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).collection("scheduledPosts").doc("post_1").update({
      status: "SCHEDULED",
      updatedAt: new Date(Date.now() - 500),
    })
  );
});

test("Analytics records: create, query list, and update metrics", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const ts = new Date(Date.now() - 5000);

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("analytics").doc("m_1").set({
      userId: ALICE_UID,
      clipId: "clip_1",
      clipTitle: "3-Second Hook Formula",
      platform: "TIKTOK",
      dayLabel: "Mon",
      views: 18420,
      likes: 2340,
      comments: 194,
      shares: 412,
      avgWatchSeconds: 38,
      retentionPercent: 78,
      createdAt: ts,
      updatedAt: ts,
    })
  );

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("analytics").get()
  );

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("analytics").doc("m_1").update({
      views: 21500,
      likes: 2710,
      updatedAt: new Date(Date.now() - 1000),
    })
  );
});
