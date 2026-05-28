import { Router } from "express";
import billingController from "../controllers/billingController";
import { authenticate } from "../middlewares/auth";

const router = Router();

// Apply auth middleware to all billing endpoints
router.use(authenticate);

router.post("/checkout", billingController.createCheckout);
router.get("/portal", billingController.getCustomerPortal);

export default router;
