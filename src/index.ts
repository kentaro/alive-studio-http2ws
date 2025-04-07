import express, { type Request, type Response } from "express";
import config from "./config";
import { OBSService } from "./services/obs.service";
import type { RequestBody } from "./types";
import { updateUrl } from "./utils/url.utils";

// OBSサービスの初期化
export const obsService = new OBSService(
  {
    port: config.obsPort,
    password: config.obsPassword,
    retryInterval: config.retryInterval,
  },
  config.baseUrl,
);

// Express設定
export const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 初回接続（テスト時は実行しない）
if (process.env.NODE_ENV !== "test") {
  (async () => {
    console.log("🔌 Connecting to OBS on startup...");
    const success = await obsService.connect();
    if (!success) {
      console.log("⚠️ Initial connection failed, scheduling reconnect...");
    }
  })();
}

// APIエンドポイント
app.post("/send", async (req: Request<unknown, unknown, RequestBody>, res: Response) => {
  // リクエストパラメータの処理
  let urlParam: string;

  if (req.body.url) {
    // StreamDeck形式: { url: "param=value" }
    urlParam = req.body.url;
  } else if (req.body.key && req.body.value) {
    // 元の形式: { key: "keyname", value: "value" }
    urlParam = `${req.body.key}=${req.body.value}`;
  } else {
    console.error("❌ Invalid request format:", req.body);
    return res
      .status(400)
      .send("Missing parameters. Expected either 'url' or both 'key' and 'value'.");
  }

  console.log(`📩 Received request with parameters: ${urlParam}`);

  try {
    // OBS接続状態確認
    if (!obsService.getConnectionStatus()) {
      console.log("⚠️ OBS not connected, attempting to connect...");
      await obsService.connect();
      if (!obsService.getConnectionStatus()) {
        return res.status(503).send("OBS is not connected. Reconnection attempts are in progress.");
      }
    }

    // Alive Studioソースを検索
    const sourceName = await obsService.findAliveSource();
    if (!sourceName) {
      return res.status(404).send("No Alive Studio source found in current scene");
    }

    // 現在の設定を取得
    const { inputSettings } = await obsService.getInputSettings(sourceName);

    // URLを更新
    const newUrl = updateUrl(urlParam, inputSettings.url, config.baseUrl);
    console.log(`🔄 Updating URL: ${newUrl}`);

    // OBSソースを更新
    const success = await obsService.updateOBSSource(sourceName, newUrl);

    if (success) {
      return res.status(200).send("OK");
    }
    return res.status(500).send("Failed to update OBS source");
  } catch (error) {
    console.error("❌ Error processing request:", (error as Error).message);
    return res.status(500).send(`Server error: ${(error as Error).message}`);
  }
});

// 基本ルート
app.get("/", (_req: Request, res: Response) => {
  res.status(200).send("Max for Live to Alive Studio Bridge");
});

// pingエンドポイント
app.get("/ping", (_req: Request, res: Response) => {
  res.status(200).send("pong");
});

// OBS設定直接更新用エンドポイント
app.post("/obs", async (req: Request, res: Response) => {
  const { sourceName, url } = req.body;

  if (!sourceName || !url) {
    return res.status(400).send("Missing parameters: sourceName and url are required");
  }

  try {
    const success = await obsService.updateOBSSource(sourceName, url);
    if (success) {
      return res.status(200).send("OK");
    }
    return res.status(500).send("Failed to update OBS source");
  } catch (error) {
    return res.status(500).send(`Server error: ${(error as Error).message}`);
  }
});

// ヘルスチェックエンドポイント
app.get("/health", (_req: Request, res: Response) => {
  const status = {
    status: "ok",
    obsConnected: obsService.getConnectionStatus(),
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(status);
});

// サーバー起動（テスト時は実行しない）
if (process.env.NODE_ENV !== "test") {
  app.listen(config.serverPort, () => {
    console.log(`🚀 Server running on port ${config.serverPort}`);
  });
}
