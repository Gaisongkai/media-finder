import { Router, type IRouter } from "express";
import healthRouter from "./health";
import searchRouter from "./search";
import imageProxyRouter from "./imageProxy";

const router: IRouter = Router();

router.use(healthRouter);
router.use(searchRouter);
router.use(imageProxyRouter);

export default router;
