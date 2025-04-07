import { OBSService } from "../src/services/obs.service";
import OBSWebSocket from "obs-websocket-js";

// OBS WebSocketのモック化
jest.mock("obs-websocket-js", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      call: jest.fn(),
      on: jest.fn()
    }))
  };
});

describe("OBSService", () => {
  let obsService: OBSService;
  let mockObs: any;
  const BASE_URL = "https://studio.alive-project.com/item?slot=alive-studio-ctrl&";
  
  // OBSServiceOptionsインターフェースに合わせたオプション
  const options = {
    port: "4444",
    password: "password",
    retryInterval: 100
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // OBSWebSocketのモック
    mockObs = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      call: jest.fn(),
      on: jest.fn()
    };
    
    // OBSWebSocketコンストラクタのモック
    (OBSWebSocket as unknown as jest.Mock).mockImplementation(() => mockObs);

    // OBSServiceのインスタンス作成
    obsService = new OBSService(options, BASE_URL);
  });

  describe("connect", () => {
    it("should connect to OBS successfully", async () => {
      mockObs.connect.mockResolvedValue(undefined);

      const result = await obsService.connect();

      expect(result).toBe(true);
      expect(mockObs.connect).toHaveBeenCalledWith(
        `ws://localhost:${options.port}`,
        options.password
      );
      expect(obsService.getConnectionStatus()).toBe(true);
    });

    it("should handle connection errors", async () => {
      mockObs.connect.mockRejectedValue(new Error("Connection failed"));

      const result = await obsService.connect();

      expect(result).toBe(false);
      expect(obsService.getConnectionStatus()).toBe(false);
    });
  });

  describe("getCurrentSceneName", () => {
    it("should return current scene name", async () => {
      mockObs.call.mockResolvedValue({
        currentProgramSceneName: "Scene 1"
      });

      const sceneName = await obsService.getCurrentSceneName();

      expect(sceneName).toBe("Scene 1");
      expect(mockObs.call).toHaveBeenCalledWith("GetCurrentProgramScene");
    });

    it("should throw error when call fails", async () => {
      mockObs.call.mockRejectedValue(new Error("Failed to get scene"));

      await expect(obsService.getCurrentSceneName()).rejects.toThrow(
        "Failed to get scene"
      );
    });
  });

  describe("findAliveSource", () => {
    it("should find Alive Studio source", async () => {
      // getCurrentSceneNameの戻り値をモック
      mockObs.call.mockImplementationOnce(() => {
        return Promise.resolve({ currentProgramSceneName: "Scene 1" });
      });
      
      // getSceneItemListの戻り値をモック
      mockObs.call.mockImplementationOnce(() => {
        return Promise.resolve({
          sceneItems: [
            { sourceName: "Other Source", sceneItemId: 1 },
            { sourceName: "Browser", sceneItemId: 2 },
            { sourceName: "Alive Studio", sceneItemId: 3 },
          ]
        });
      });
      
      // getInputSettingsの戻り値をモック
      mockObs.call.mockImplementation((api: string, params: { inputName: string }) => {
        if (api === "GetInputSettings") {
          if (params.inputName === "Other Source") {
            return Promise.resolve({
              inputSettings: { url: "https://example.com" }
            });
          }
          if (params.inputName === "Browser") {
            return Promise.resolve({
              inputSettings: { url: "https://google.com" }
            });
          }
          if (params.inputName === "Alive Studio") {
            return Promise.resolve({
              inputSettings: { url: `${BASE_URL}background=blue` }
            });
          }
        }
        return Promise.reject(new Error("Unknown API call"));
      });

      const result = await obsService.findAliveSource();

      expect(result).toBe("Alive Studio");
    });

    it("should return null when no Alive Studio source is found", async () => {
      // getCurrentSceneNameの戻り値をモック
      mockObs.call.mockImplementationOnce(() => {
        return Promise.resolve({ currentProgramSceneName: "Scene 1" });
      });
      
      // getSceneItemListの戻り値をモック
      mockObs.call.mockImplementationOnce(() => {
        return Promise.resolve({
          sceneItems: [
            { sourceName: "Other Source", sceneItemId: 1 },
            { sourceName: "Browser", sceneItemId: 2 },
          ]
        });
      });
      
      // getInputSettingsの戻り値をモック
      mockObs.call.mockImplementation((api: string, params: { inputName: string }) => {
        if (api === "GetInputSettings") {
          return Promise.resolve({
            inputSettings: { url: "https://example.com" }
          });
        }
        return Promise.reject(new Error("Unknown API call"));
      });

      const result = await obsService.findAliveSource();

      expect(result).toBeNull();
    });
  });

  describe("updateOBSSource", () => {
    const sourceName = "Alive Studio";
    const newUrl = "https://studio.alive-project.com/item?slot=alive-studio-ctrl&background=blue";

    it("should update source URL successfully", async () => {
      // getInputSettingsの戻り値をモック（初回）
      mockObs.call.mockImplementationOnce(() => {
        return Promise.resolve({
          inputSettings: {
            url: "https://example.com",
            width: 1920,
            height: 1080
          }
        });
      });
      
      // setInputSettingsの戻り値をモック
      mockObs.call.mockImplementationOnce(() => {
        return Promise.resolve({});
      });

      // getInputSettingsの戻り値をモック（2回目 - 確認用）
      mockObs.call.mockImplementationOnce(() => {
        return Promise.resolve({
          inputSettings: {
            url: newUrl,
            width: 1920,
            height: 1080
          }
        });
      });

      const result = await obsService.updateOBSSource(sourceName, newUrl);

      expect(result).toBe(true);
      expect(mockObs.call).toHaveBeenCalledWith("SetInputSettings", {
        inputName: sourceName,
        inputSettings: expect.objectContaining({
          url: newUrl
        })
      });
    });

    it("should return false when update fails", async () => {
      // getInputSettingsの戻り値をモック
      mockObs.call.mockImplementationOnce(() => {
        return Promise.resolve({
          inputSettings: { url: "https://example.com" }
        });
      });
      
      // setInputSettingsでエラーを発生させる
      mockObs.call.mockImplementationOnce(() => {
        return Promise.reject(new Error("Failed to update settings"));
      });

      const result = await obsService.updateOBSSource(sourceName, newUrl);

      expect(result).toBe(false);
    });
  });

  describe("ConnectionClosed event", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.clearAllTimers();
    });

    it("should attempt to reconnect when connection is closed", async () => {
      // まずconnectメソッドのモックを設定
      mockObs.connect.mockResolvedValue(undefined);
      
      // 接続する
      await obsService.connect();
      expect(obsService.getConnectionStatus()).toBe(true);
      
      // ConnectionClosedイベントのコールバックを実行するためにモックされたonメソッドのコールバックを取得して実行
      const connectionClosedCallback = mockObs.on.mock.calls.find(
        (call: [string, () => void]) => call[0] === "ConnectionClosed"
      )[1];
      
      // ConnectionClosedイベントを発生させる
      connectionClosedCallback();
      
      // isConnectedがfalseに設定されたことを確認
      expect(obsService.getConnectionStatus()).toBe(false);
      
      // モックをクリアして、再接続の回数を正確に追跡できるようにする
      mockObs.connect.mockClear();
      
      // スケジューリングされた再接続を実行するためにタイマーを進める
      jest.runOnlyPendingTimers();
      
      // 非同期処理を待つ
      await Promise.resolve();
      
      // 再接続が試みられたことを確認
      expect(mockObs.connect).toHaveBeenCalledTimes(1);
    });

    it("should continue retrying if reconnection fails", async () => {
      // setTimeoutのカウンタをリセット
      const spy = jest.spyOn(global, 'setTimeout');
      spy.mockClear();
      
      // connectメソッドのモックを設定（最初は成功、次は失敗）
      mockObs.connect
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Connection failed"));
      
      // 接続する
      await obsService.connect();
      expect(obsService.getConnectionStatus()).toBe(true);
      
      // ConnectionClosedイベントのコールバックを実行
      const connectionClosedCallback = mockObs.on.mock.calls.find(
        (call: [string, () => void]) => call[0] === "ConnectionClosed"
      )[1];
      
      // ConnectionClosedイベント発生前のsetTimeoutカウントをリセット
      spy.mockClear();
      
      connectionClosedCallback();
      expect(obsService.getConnectionStatus()).toBe(false);
      
      // モックをクリアして、再接続の回数を正確に追跡できるようにする
      mockObs.connect.mockClear();
      
      // スケジューリングされた最初の再接続（失敗する）を実行
      jest.runOnlyPendingTimers();
      await Promise.resolve();
      
      // 最初の再接続が失敗した後、2回目の再接続がスケジュールされたことを確認
      expect(mockObs.connect).toHaveBeenCalledTimes(1);
      
      // 再接続が一度実行され、その後の再試行が一度スケジュールされたことを確認
      // （初回の接続失敗後のスケジュール）
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("getSceneItemList", () => {
    it("should return scene items", async () => {
      const sceneName = "Scene 1";
      const mockItems = {
        sceneItems: [
          { sourceName: "Source 1", sceneItemId: 1 },
          { sourceName: "Source 2", sceneItemId: 2 }
        ]
      };
      
      mockObs.call.mockResolvedValue(mockItems);
      
      const result = await obsService.getSceneItemList(sceneName);
      
      expect(result).toEqual(mockItems);
      expect(mockObs.call).toHaveBeenCalledWith("GetSceneItemList", { sceneName });
    });
    
    it("should throw error when call fails", async () => {
      mockObs.call.mockRejectedValue(new Error("Failed to get scene items"));
      
      await expect(obsService.getSceneItemList("Scene 1")).rejects.toThrow(
        "Failed to get scene items"
      );
    });
  });

  describe("findAliveSource error handling", () => {
    it("should handle error during search and return null", async () => {
      // getCurrentSceneNameでエラーを発生させる
      mockObs.call.mockRejectedValue(new Error("Scene retrieval failed"));
      
      const result = await obsService.findAliveSource();
      
      expect(result).toBeNull();
    });
  });
});

