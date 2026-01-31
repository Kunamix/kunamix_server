import express from "express";
import { contactForm, referForm } from "../controllers/mail.controller";

const router = express.Router();

router.post("/contact-form", contactForm);
router.post("/refer-form", referForm);

export default router;
