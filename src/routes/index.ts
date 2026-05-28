import { getBlogBySlug, getBlogs } from "@/controllers/blog.controller";
import { calculate } from "@/controllers/calculator.controller";
import { contactForm } from "@/controllers/mail.controller";
import express from "express";

const router = express.Router();

router.post("/api/v1/mail/contact",contactForm);
router.post("/api/v1/calculate", calculate);

// ─── Blogs ────────────────────────────────────────────────────────────────────
// GET /api/v1/blogs?page=1&limit=10&category=Tech+Stack
router.get("/api/v1/blogs", getBlogs);
// GET /api/v1/blogs/:slug
router.get("/api/v1/blogs/:slug", getBlogBySlug);

export default router;