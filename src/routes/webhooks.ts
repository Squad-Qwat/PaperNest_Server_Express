import { Router } from "express";
import * as webhookController from "../controllers/webhookController";

const router: Router = Router();

router.post("/liveblocks/userleft", webhookController.handleLiveblocksWebhook);

router.get("/liveblocks/userleft", webhookController.webhookHealthCheck);

export default router;
