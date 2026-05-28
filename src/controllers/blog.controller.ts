import { Request, Response } from "express";
import admin from "@/config/firebase";
import { asyncHandler } from "@/utils/async-handler.util";
import { ApiError } from "@/utils/api-error.util";
import { ApiResponse } from "@/utils/api-response.util";

// ─── GET ALL BLOGS (paginated) ────────────────────────────────────────────────
// GET /api/v1/blogs?page=1&limit=10&category=Tech+Stack
export const getBlogs = asyncHandler(async (req: Request, res: Response) => {
  const db = admin.firestore();

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(
    50,
    Math.max(1, parseInt(req.query.limit as string) || 10),
  );
  const category = req.query.category as string | undefined;

  try {
    let query: admin.firestore.Query = db
      .collection("blogs")
      .orderBy("publishedAt", "desc");

    if (category) {
      query = query.where("category", "==", category);
    }

    // Get total count for pagination meta (separate lightweight query)
    const countSnap = await query.count().get();
    const total = countSnap.data().count;
    const totalPages = Math.ceil(total / limit);

    // Cursor-based pagination using offset (simple approach for small datasets)
    // For large datasets, pass lastDocId as query param instead
    const offset = (page - 1) * limit;
    const snapshot = await query.limit(limit).offset(offset).get();

    const blogs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json(
      new ApiResponse(
        200,
        {
          blogs,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        },
        "Blogs fetched successfully",
      ),
    );
  } catch (err) {
    console.error("Error fetching blogs:", err);
    throw new ApiError(500, "Failed to fetch blogs");
  }
});

// ─── GET SINGLE BLOG BY SLUG ─────────────────────────────────────────────────
// GET /api/v1/blogs/:slug
export const getBlogBySlug = asyncHandler(
  async (req: Request, res: Response) => {
    const { slug } = req.params;
    const db = admin.firestore();

    try {
      const snapshot = await db
        .collection("blogs")
        .where("slug", "==", slug)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new ApiError(404, "Blog not found");
      }

      const doc = snapshot.docs[0];
      const blog = { id: doc.id, ...doc.data() };

      res
        .status(200)
        .json(new ApiResponse(200, blog, "Blog fetched successfully"));
    } catch (err) {
      console.error("Error fetching blog by slug:", err);
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, "Failed to fetch blog");
    }
  },
);
