import request from "supertest";
import express, { type Express } from "express";
import { OBSService } from "../src/services/obs.service";
import { updateUrl } from "../src/utils/url.utils";

// OBSServiceのモック
jest.mock("../src/services/obs.service");
jest.mock("../src/utils/url.utils");

describe("API Endpoints", () => {
  let app: Express;
  let mockOBSService: jest.Mocked<OBSService>;
  const BASE_URL = "https://studio.alive-project.com/item?slot=alive-studio-ctrl&";
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // OBSServiceのモック
    mockOBSService = {
      connect: jest.fn(),
      getCurrentSceneName: jest.fn(),
      getSceneItemList: jest.fn(),
      findAliveSource: jest.fn(),
      getInputSettings: jest.fn(),
      setInputSettings: jest.fn(),
      updateOBSSource: jest.fn(),
      getConnectionStatus: jest.fn()
    } as unknown as jest.Mocked<OBSService>;
    
    // モックコンストラクタを作成
    (OBSService as jest.Mock).mockImplementation(() => mockOBSService);
    
    // テスト用Expressアプリの作成
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // ルート
    app.get("/", (_req, res) => {
      res.status(200).json({ message: "Hello from Alive Studio!" });
    });
    
    // pingエンドポイント
    app.get("/ping", (_req, res) => {
      res.status(200).json({ message: "pong" });
    });
    
    // obsエンドポイント
    app.post("/obs", async (req, res) => {
      if (!req.body.params) {
        return res.status(400).json({ error: "params is required" });
      }
      
      try {
        // OBSServiceの実装では2つの引数が必要なため、テスト用にダミーのソース名を使用
        const sourceName = "Alive Studio";
        await mockOBSService.updateOBSSource(sourceName, req.body.params);
        return res.status(200).json({ success: true });
      } catch (error) {
        return res.status(500).json({ error: (error as Error).message });
      }
    });
    
    // /sendエンドポイント
    app.post("/send", async (req, res) => {
      // リクエストパラメータの処理
      let urlParam: string;

      if (req.body.url) {
        urlParam = req.body.url;
      } else if (req.body.key && req.body.value) {
        urlParam = `${req.body.key}=${req.body.value}`;
      } else {
        return res
          .status(400)
          .send("Missing parameters. Expected either 'url' or both 'key' and 'value'.");
      }

      try {
        // OBS接続状態確認
        if (!mockOBSService.getConnectionStatus()) {
          await mockOBSService.connect();
          if (!mockOBSService.getConnectionStatus()) {
            return res
              .status(503)
              .send("OBS is not connected. Reconnection attempts are in progress.");
          }
        }

        // Alive Studioソースを検索
        const sourceName = await mockOBSService.findAliveSource();
        if (!sourceName) {
          return res.status(404).send("No Alive Studio source found in current scene");
        }

        // 現在の設定を取得
        const { inputSettings } = await mockOBSService.getInputSettings(sourceName);

        // URLを更新
        const newUrl = (updateUrl as jest.Mock)(urlParam, inputSettings.url, BASE_URL);

        // OBSソースを更新
        const success = await mockOBSService.updateOBSSource(sourceName, newUrl);

        if (success) {
          return res.status(200).send("OK");
        }
        return res.status(500).send("Failed to update OBS source");
      } catch (error) {
        return res.status(500).send(`Server error: ${(error as Error).message}`);
      }
    });
    
    // ヘルスチェックエンドポイント
    app.get("/health", (_req, res) => {
      const status = {
        status: "ok",
        obsConnected: mockOBSService.getConnectionStatus(),
        timestamp: new Date().toISOString(),
      };
      res.status(200).json(status);
    });
  });

  describe("GET /", () => {
    it("should respond with a message", async () => {
      const response = await request(app).get("/");
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Hello from Alive Studio!" });
    });
  });

  describe("GET /ping", () => {
    it("should respond with pong", async () => {
      const response = await request(app).get("/ping");
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "pong" });
    });
  });

  describe("POST /obs", () => {
    it("should update OBS source and return success", async () => {
      const mockParams = "background=red&width=1920&height=1080";
      mockOBSService.updateOBSSource.mockResolvedValue(true);

      const response = await request(app)
        .post("/obs")
        .send({ params: mockParams });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(mockOBSService.updateOBSSource).toHaveBeenCalledWith(
        "Alive Studio",
        expect.stringContaining("background=red")
      );
    });

    it("should return 400 when params are missing", async () => {
      const response = await request(app).post("/obs").send({});
      
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "params is required" });
      expect(mockOBSService.updateOBSSource).not.toHaveBeenCalled();
    });

    it("should return 500 when OBS update fails", async () => {
      mockOBSService.updateOBSSource.mockRejectedValue(
        new Error("Failed to update OBS")
      );

      const response = await request(app)
        .post("/obs")
        .send({ params: "background=red" });
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: "Failed to update OBS" });
    });
  });

  describe("POST /send", () => {
    it("should return 400 for invalid request format", async () => {
      const response = await request(app).post("/send").send({});

      expect(response.status).toBe(400);
      expect(response.text).toContain("Missing parameters");
    });

    it("should return 503 when OBS is not connected", async () => {
      mockOBSService.getConnectionStatus.mockReturnValue(false);
      mockOBSService.connect.mockResolvedValue(false);

      const response = await request(app).post("/send").send({ key: "background", value: "blue" });

      expect(response.status).toBe(503);
      expect(response.text).toContain("OBS is not connected");
    });

    it("should return 404 when Alive source not found", async () => {
      mockOBSService.getConnectionStatus.mockReturnValue(true);
      mockOBSService.findAliveSource.mockResolvedValue(null);

      const response = await request(app).post("/send").send({ key: "background", value: "blue" });

      expect(response.status).toBe(404);
      expect(response.text).toContain("No Alive Studio source found");
    });

    it("should return 200 when update is successful", async () => {
      const sourceName = "Alive Studio";
      const currentUrl = `${BASE_URL}background=red`;
      const newUrl = `${BASE_URL}background=blue`;

      mockOBSService.getConnectionStatus.mockReturnValue(true);
      mockOBSService.findAliveSource.mockResolvedValue(sourceName);
      mockOBSService.getInputSettings.mockResolvedValue({
        inputSettings: { url: currentUrl },
      });
      (updateUrl as jest.Mock).mockReturnValue(newUrl);
      mockOBSService.updateOBSSource.mockResolvedValue(true);

      const response = await request(app).post("/send").send({ key: "background", value: "blue" });

      expect(response.status).toBe(200);
      expect(response.text).toBe("OK");
      expect(updateUrl).toHaveBeenCalledWith("background=blue", currentUrl, BASE_URL);
      expect(mockOBSService.updateOBSSource).toHaveBeenCalledWith(sourceName, newUrl);
    });

    it("should handle URL format in request", async () => {
      const sourceName = "Alive Studio";
      const currentUrl = `${BASE_URL}background=red`;
      const newUrl = `${BASE_URL}background=blue&sound=on`;

      mockOBSService.getConnectionStatus.mockReturnValue(true);
      mockOBSService.findAliveSource.mockResolvedValue(sourceName);
      mockOBSService.getInputSettings.mockResolvedValue({
        inputSettings: { url: currentUrl },
      });
      (updateUrl as jest.Mock).mockReturnValue(newUrl);
      mockOBSService.updateOBSSource.mockResolvedValue(true);

      const response = await request(app).post("/send").send({ url: "background=blue&sound=on" });

      expect(response.status).toBe(200);
      expect(updateUrl).toHaveBeenCalledWith("background=blue&sound=on", currentUrl, BASE_URL);
    });
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      mockOBSService.getConnectionStatus.mockReturnValue(true);

      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({
          status: "ok",
          obsConnected: true,
          timestamp: expect.any(String),
        }),
      );
    });
  });
});
