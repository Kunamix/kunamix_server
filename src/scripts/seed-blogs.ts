/**
 * Blog Seed Script
 * ─────────────────────────────────────────────────────────────
 * Usage: ts-node src/scripts/seed-blogs.ts
 *
 * What it does:
 *  1. Reads the blog data array from src/data/blogs.data.ts
 *  2. For each blog, finds the matching image in /public/images/blog/
 *     (only one image per blog, named by coverImage field)
 *  3. Uploads that image to Cloudinary
 *  4. Replaces coverImage with the Cloudinary URL
 *  5. Saves the full blog document to Firestore "blogs" collection
 *
 * One blog is processed at a time — if it fails, it stops and logs the error.
 */

import admin from "@/config/firebase";
import { v2 as cloudinary } from "cloudinary";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { blogs } from "../data/blogs.data"; // Your blog data array

dotenv.config();

// ─── Init Firebase ────────────────────────────────────────────────────────────
// const serviceAccount = require("../../service-account.json"); // Your Firebase service account

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!.trim());
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// ─── Init Cloudinary ──────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Uploads a local image file to Cloudinary.
 * Returns the secure URL of the uploaded image.
 */
const uploadImageToCloudinary = async (
  localImagePath: string,
  blogSlug: string,
): Promise<string> => {
  const result = await cloudinary.uploader.upload(localImagePath, {
    folder: "kunamix/blogs",
    public_id: blogSlug,
    overwrite: true,
    resource_type: "image",
  });
  return result.secure_url;
};

/**
 * Checks if a blog with the given slug already exists in Firestore.
 * Returns the document ID if found, null otherwise.
 */
const findExistingBlog = async (
  db: admin.firestore.Firestore,
  slug: string,
): Promise<string | null> => {
  const snap = await db
    .collection("blogs")
    .where("slug", "==", slug)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
};

// ─── Seed Function ────────────────────────────────────────────────────────────

const seedBlogs = async () => {
  const db = admin.firestore();
  const publicDir = path.resolve(__dirname, "../../public");

  console.log(`\n🌱 Starting blog seed — ${blogs.length} blog(s) to process\n`);

  for (const blog of blogs) {
    console.log(`→ Processing: "${blog.title}" (${blog.slug})`);

    try {
      // 1. Resolve the local image path from coverImage field
      //    e.g. coverImage: "/images/blog/image10.webp" → public/images/blog/image10.webp
      const relativeImagePath = blog.coverImage.startsWith("/")
        ? blog.coverImage.slice(1)
        : blog.coverImage;
      const localImagePath = path.join(publicDir, relativeImagePath);

      if (!fs.existsSync(localImagePath)) {
        console.error(`  ✗ Image not found at: ${localImagePath}`);
        console.error(`    Skipping this blog. Add the image and re-run.`);
        continue;
      }

      // 2. Upload image to Cloudinary
      console.log(`  ↑ Uploading image: ${relativeImagePath}`);
      const cloudinaryUrl = await uploadImageToCloudinary(
        localImagePath,
        blog.slug,
      );
      console.log(`  ✓ Cloudinary URL: ${cloudinaryUrl}`);

      // 3. Build Firestore document — replace coverImage with Cloudinary URL
      const blogDoc = {
        ...blog,
        coverImage: cloudinaryUrl,
        seededAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // 4. Check if blog already exists (upsert by slug)
      const existingId = await findExistingBlog(db, blog.slug);

      if (existingId) {
        await db
          .collection("blogs")
          .doc(existingId)
          .set(blogDoc, { merge: true });
        console.log(`  ↺ Updated existing blog (id: ${existingId})`);
      } else {
        const ref = await db.collection("blogs").add(blogDoc);
        console.log(`  ✓ Created new blog (id: ${ref.id})`);
      }

      console.log(`  ✅ Done: "${blog.title}"\n`);
    } catch (err) {
      console.error(`  ✗ Failed to seed blog "${blog.slug}":`, err);
      process.exit(1); // Stop on first failure so you can fix and retry
    }
  }

  console.log("🎉 Seed complete!\n");
  process.exit(0);
};

seedBlogs();
