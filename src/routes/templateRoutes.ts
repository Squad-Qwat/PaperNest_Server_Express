import { Router } from "express";
import templateController from "../controllers/templateController";
import { authenticate } from "../middlewares/auth";

const router: Router = Router();

// All template routes require authentication
router.use(authenticate);

router.get("/", templateController.getTemplates);
router.get("/:templateId", templateController.getTemplateById);

export default router;
