import dotenv from "dotenv";

// dotenvをモック
jest.mock("dotenv", () => ({
  config: jest.fn()
}));

// 環境変数をモックするため
const originalEnv = process.env;

describe("Config", () => {
  beforeEach(() => {
    // テスト前に環境変数をリセット
    jest.resetModules();
    process.env = { ...originalEnv };
    // OBS_PASSWORDを削除
    delete process.env.OBS_PASSWORD;
  });

  afterAll(() => {
    // テスト終了後に環境変数を元に戻す
    process.env = originalEnv;
  });

  it("should use default values when environment variables are not set", () => {
    // 環境変数を一時的にクリア
    delete process.env.OBS_PORT;
    delete process.env.OBS_PASSWORD;
    delete process.env.SERVER_PORT;

    // configをリロード
    jest.resetModules();
    const { config } = require("../src/config");

    // デフォルト値をチェック
    expect(config.obsPort).toBe("4455");
    expect(config.obsPassword).toBeUndefined();
    expect(config.serverPort).toBe(5001);
    expect(config.retryInterval).toBe(5000);
    expect(config.baseUrl).toBe("https://studio.alive-project.com/item?slot=alive-studio-ctrl&");
  });

  it("should use environment variables when set", () => {
    // テスト用の環境変数を設定
    process.env.OBS_PORT = "8080";
    process.env.OBS_PASSWORD = "testpassword";
    process.env.SERVER_PORT = "3000";

    // configをリロード
    jest.resetModules();
    const { config } = require("../src/config");

    // 環境変数からの値をチェック
    expect(config.obsPort).toBe("8080");
    expect(config.obsPassword).toBe("testpassword");
    expect(config.serverPort).toBe(3000);
  });
}); 