import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { initTradableCoins, initP2P, initNotifications, initAdminUsers, initKyc, initCustomAssets, initLiquidityWallets, initMMBot, initDepositScanLog, initReferral } from "./lib/db";

initTradableCoins().catch((e) => logger.error(e, "initTradableCoins failed"));
initP2P().catch((e) => logger.error(e, "initP2P failed"));
initNotifications().catch((e) => logger.error(e, "initNotifications failed"));
initAdminUsers().catch((e) => logger.error(e, "initAdminUsers failed"));
initKyc().catch((e) => logger.error(e, "initKyc failed"));
initCustomAssets().catch((e) => logger.error(e, "initCustomAssets failed"));
initLiquidityWallets().catch((e) => logger.error(e, "initLiquidityWallets failed"));
initMMBot().catch((e) => logger.error(e, "initMMBot failed"));
initDepositScanLog().catch((e) => logger.error(e, "initDepositScanLog failed"));
initReferral().catch((e) => logger.error(e, "initReferral failed"));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.use("/api", router);

export default app;
