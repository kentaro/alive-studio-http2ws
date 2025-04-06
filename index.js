require("dotenv").config();
const express = require("express");
const OBSWebSocket = require("obs-websocket-js").default;

// 定数定義
const OBS_PORT = process.env.OBS_PORT || "4455";
const OBS_PASSWORD = process.env.OBS_PASSWORD || undefined;
const BASE_URL = "https://studio.alive-project.com/item?slot=alive-studio-ctrl&";
const SERVER_PORT = process.env.SERVER_PORT || 5001;

// Express設定
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// OBS WebSocket接続
const obs = new OBSWebSocket();
let isConnected = false;
const RETRY_INTERVAL = 5000; // 再接続間隔（ミリ秒）

/**
 * OBSに接続する
 * @returns {Promise<boolean>} 接続成功したかどうか
 */
async function connectToOBS() {
    if (isConnected) return true;

    try {
        const url = `ws://localhost:${OBS_PORT}`;
        await obs.connect(url, OBS_PASSWORD);
        console.log("✅ Connected to OBS WebSocket");
        isConnected = true;
        return true;
    } catch (error) {
        console.error("❌ Failed to connect to OBS:", error.message);
        isConnected = false;
        return false;
    }
}

/**
 * OBSへの接続をリトライする
 */
function scheduleReconnect() {
    setTimeout(async () => {
        console.log("🔄 Attempting to reconnect to OBS...");
        const success = await connectToOBS();
        if (!success) {
            scheduleReconnect();
        }
    }, RETRY_INTERVAL);
}

// 接続が切れた時の処理
obs.on("ConnectionClosed", () => {
    console.log("⚠️ OBS connection closed");
    isConnected = false;
    scheduleReconnect();
});

// 初回接続
(async () => {
    console.log("🔌 Connecting to OBS on startup...");
    const success = await connectToOBS();
    if (!success) {
        scheduleReconnect();
    }
})();

/**
 * Alive Studioのブラウザソースを検索する
 * @returns {Promise<string|null>} 見つかったソースの名前、または見つからなかった場合はnull
 */
async function findAliveSource() {
    try {
        const { currentProgramSceneName } = await obs.call("GetCurrentProgramScene");
        console.log(`🔍 Searching for Alive Studio source in scene: ${currentProgramSceneName}`);

        const { sceneItems } = await obs.call("GetSceneItemList", {
            sceneName: currentProgramSceneName,
        });

        for (const item of sceneItems) {
            const sourceName = String(item.sourceName);

            try {
                const { inputSettings } = await obs.call("GetInputSettings", {
                    inputName: sourceName,
                });

                const sourceUrl = inputSettings.url;

                if (typeof sourceUrl === "string" && sourceUrl.includes(BASE_URL)) {
                    console.log(`✅ Found Alive Studio source: ${sourceName}`);
                    return sourceName;
                }
            } catch (err) {
                // ブラウザソース以外はスキップ（エラーログ不要）
                continue;
            }
        }

        console.log("❌ No Alive Studio source found in current scene");
        return null;
    } catch (error) {
        console.error("❌ Error finding Alive source:", error.message);
        return null;
    }
}

/**
 * URLからパラメータ部分を抽出する
 * @param {string} url 現在のURL
 * @returns {string} 抽出されたパラメータ文字列
 */
function extractUrlParams(url) {
    const match = url.match(/\?slot=alive-studio-ctrl&(.+)$/);
    return match ? match[1] : "";
}

/**
 * URLを更新する
 * @param {string} inputParam 追加するパラメータ文字列
 * @param {string} currentUrl 現在のURL
 * @returns {string} 更新されたURL
 */
function updateUrl(inputParam, currentUrl) {
    // 入力パラメータをオブジェクトに変換
    const inputParamsObj = {};
    inputParam.split("&").forEach(param => {
        const [key, value] = param.split("=");
        if (key && value) {
            inputParamsObj[key] = value;
        }
    });

    // 基本パラメータを保持（もしあれば）
    const baseParamsObj = {};
    if (currentUrl) {
        const paramsStr = extractUrlParams(currentUrl);
        paramsStr.split("&").forEach(param => {
            const [key, value] = param.split("=");
            // 基本パラメータのみ保持（width, height, version など）
            if (key && value && (key === "width" || key === "height" || key === "version")) {
                baseParamsObj[key] = value;
            }
        });
    }

    // 基本パラメータと新しいパラメータを組み合わせる（音や背景などのパラメータはリクエストのもので上書き）
    const combinedParamsObj = {
        ...baseParamsObj,
        ...inputParamsObj,
        // タイムスタンプは常に最新
        timestamp: new Date().toISOString()
    };

    // オブジェクトをURLパラメータ文字列に戻す
    const combinedParamsStr = Object.entries(combinedParamsObj)
        .map(([key, value]) => `${key}=${value}`)
        .join("&");

    return `${BASE_URL}${combinedParamsStr}`;
}

/**
 * OBSのブラウザソース設定を更新する
 * @param {string} sourceName ソース名
 * @param {string} newUrl 新しいURL
 * @returns {Promise<boolean>} 更新に成功したかどうか
 */
async function updateOBSSource(sourceName, newUrl) {
    try {
        // 現在の設定を取得
        const { inputSettings } = await obs.call("GetInputSettings", {
            inputName: sourceName,
        });

        // URLだけを更新
        await obs.call("SetInputSettings", {
            inputName: sourceName,
            inputSettings: {
                ...inputSettings,
                url: newUrl,
            },
        });

        // 更新を確認
        const { inputSettings: newSettings } = await obs.call("GetInputSettings", {
            inputName: sourceName,
        });

        const updated = newSettings.url === newUrl;
        console.log(`${updated ? '✅' : '❌'} Source URL ${updated ? 'updated' : 'update failed'}`);

        return updated;
    } catch (error) {
        console.error("❌ Failed to update OBS source:", error.message);
        return false;
    }
}

// API エンドポイント
app.post("/send", async (req, res) => {
    // リクエストパラメータの処理
    let urlParam;

    if (req.body.url) {
        // StreamDeck形式: { url: "param=value" }
        urlParam = req.body.url;
    } else if (req.body.key && req.body.value) {
        // 元の形式: { key: "keyname", value: "value" }
        urlParam = `${req.body.key}=${req.body.value}`;
    } else {
        console.error("❌ Invalid request format:", req.body);
        return res.status(400).send("Missing parameters. Expected either 'url' or both 'key' and 'value'.");
    }

    console.log(`📩 Received request with parameters: ${urlParam}`);

    try {
        // OBS接続状態確認（起動時に接続済みのはず）
        if (!isConnected) {
            console.log("⚠️ OBS not connected, attempting to connect...");
            await connectToOBS();
            if (!isConnected) {
                return res.status(503).send("OBS is not connected. Reconnection attempts are in progress.");
            }
        }

        // Alive Studioソースを検索
        const sourceName = await findAliveSource();
        if (!sourceName) {
            return res.status(404).send("No Alive Studio source found in current scene");
        }

        // 現在の設定を取得
        const { inputSettings } = await obs.call("GetInputSettings", {
            inputName: sourceName,
        });

        // URLを更新
        const newUrl = updateUrl(urlParam, inputSettings.url);
        console.log(`🔄 Updating URL: ${newUrl}`);

        // OBSソースを更新
        const success = await updateOBSSource(sourceName, newUrl);

        if (success) {
            return res.status(200).send("OK");
        } else {
            return res.status(500).send("Failed to update OBS source");
        }
    } catch (error) {
        console.error("❌ Error processing request:", error.message);
        isConnected = false;
        scheduleReconnect();
        return res.status(500).send(`Error: ${error.message}`);
    }
});

// サーバー起動
app.listen(SERVER_PORT, () => {
    console.log(`🚀 Bridge server listening on http://localhost:${SERVER_PORT}`);
});