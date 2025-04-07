import request from "supertest";
import { app, obsService } from "../src/index";

// obsServiceのメソッドをモック化
jest.mock("../src/services/obs.service");

describe("Express App", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /", () => {
    it("should return welcome message", async () => {
      const response = await request(app).get("/");
      expect(response.status).toBe(200);
      expect(response.text).toBe("Max for Live to Alive Studio Bridge");
    });
  });

  describe("GET /ping", () => {
    it("should return pong", async () => {
      const response = await request(app).get("/ping");
      expect(response.status).toBe(200);
      expect(response.text).toBe("pong");
    });
  });

  describe("POST /obs", () => {
    it("should update OBS source successfully", async () => {
      // obsService.updateOBSSourceメソッドをモック化
      (obsService.updateOBSSource as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post("/obs")
        .send({
          sourceName: "TestSource",
          url: "https://example.com"
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe("OK");
      expect(obsService.updateOBSSource).toHaveBeenCalledWith(
        "TestSource",
        "https://example.com"
      );
    });

    it("should return 400 for missing parameters", async () => {
      const response = await request(app)
        .post("/obs")
        .send({
          // sourceName missing
          url: "https://example.com"
        });

      expect(response.status).toBe(400);
      expect(obsService.updateOBSSource).not.toHaveBeenCalled();
    });

    it("should return 500 when update fails", async () => {
      // updateOBSSourceがfalseを返すケース
      (obsService.updateOBSSource as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .post("/obs")
        .send({
          sourceName: "TestSource",
          url: "https://example.com"
        });

      expect(response.status).toBe(500);
      expect(response.text).toBe("Failed to update OBS source");
    });

    it("should handle errors", async () => {
      (obsService.updateOBSSource as jest.Mock).mockRejectedValue(
        new Error("Test error")
      );

      const response = await request(app)
        .post("/obs")
        .send({
          sourceName: "TestSource",
          url: "https://example.com"
        });

      expect(response.status).toBe(500);
      expect(response.text).toBe("Server error: Test error");
    });
  });

  describe("POST /send", () => {
    beforeEach(() => {
      // getConnectionStatusのモック
      (obsService.getConnectionStatus as jest.Mock).mockReturnValue(true);
      // findAliveSourceのモック
      (obsService.findAliveSource as jest.Mock).mockResolvedValue("AliveSource");
      // getInputSettingsのモック
      (obsService.getInputSettings as jest.Mock).mockResolvedValue({
        inputSettings: {
          url: "https://studio.alive-project.com/item?slot=alive-studio-ctrl&background=red"
        }
      });
      // updateOBSSourceのモック
      (obsService.updateOBSSource as jest.Mock).mockResolvedValue(true);
    });

    it("should process url parameter format", async () => {
      const response = await request(app)
        .post("/send")
        .send({
          url: "background=blue"
        });

      expect(response.status).toBe(200);
      expect(obsService.updateOBSSource).toHaveBeenCalled();
    });

    it("should process key-value format", async () => {
      const response = await request(app)
        .post("/send")
        .send({
          key: "background",
          value: "green"
        });

      expect(response.status).toBe(200);
      expect(obsService.updateOBSSource).toHaveBeenCalled();
    });

    it("should return 400 for invalid request format", async () => {
      const response = await request(app)
        .post("/send")
        .send({
          // 必要なパラメータがない
          invalid: "parameter"
        });

      expect(response.status).toBe(400);
      expect(obsService.updateOBSSource).not.toHaveBeenCalled();
    });

    it("should return 503 when OBS is not connected", async () => {
      // OBS接続状態をfalseに変更
      (obsService.getConnectionStatus as jest.Mock).mockReturnValue(false);
      // 再接続失敗のモック
      (obsService.connect as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .post("/send")
        .send({
          url: "background=blue"
        });

      expect(response.status).toBe(503);
      expect(obsService.connect).toHaveBeenCalled();
    });

    it("should return 404 when Alive source not found", async () => {
      // findAliveSourceがnullを返すよう変更
      (obsService.findAliveSource as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post("/send")
        .send({
          url: "background=blue"
        });

      expect(response.status).toBe(404);
      expect(obsService.findAliveSource).toHaveBeenCalled();
    });

    it("should handle errors during processing", async () => {
      // findAliveSourceでエラーを発生させる
      (obsService.findAliveSource as jest.Mock).mockRejectedValue(
        new Error("Test error")
      );

      const response = await request(app)
        .post("/send")
        .send({
          url: "background=blue"
        });

      expect(response.status).toBe(500);
      expect(response.text).toContain("Server error: Test error");
    });
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      // getConnectionStatusのモック
      (obsService.getConnectionStatus as jest.Mock).mockReturnValue(true);

      const response = await request(app).get("/health");
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        status: "ok",
        obsConnected: true,
        timestamp: expect.any(String)
      }));
    });
  });
}); 