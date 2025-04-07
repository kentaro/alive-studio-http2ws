import dotenv from "dotenv";
import type { AppConfig } from "./types";

// 環境変数の読み込み
dotenv.config();

/**
 * アプリケーション設定
 */
export const config: AppConfig = {
  obsPort: process.env.OBS_PORT || "4455",
  obsPassword: process.env.OBS_PASSWORD || undefined,
  baseUrl: "https://studio.alive-project.com/item?slot=alive-studio-ctrl&",
  serverPort: Number.parseInt(process.env.SERVER_PORT || "5001", 10),
  retryInterval: 5000, // 再接続間隔（ミリ秒）
};

export default config;
