# Alive Studio HTTP to WebSocket Bridge

HTTPリクエストをWebSocketメッセージに変換するブリッジアプリケーションです。Alive Studioの環境でHTTPとWebSocketの間の通信を可能にします。

## 機能

- HTTPリクエストの受信とWebSocketへの転送
- WebSocketへの自動接続と再接続処理
- パラメータを受け取るRESTful API
- システムの健全性をモニタリングするヘルスチェックエンドポイント

## 技術スタック

- TypeScript：型安全なコード開発
- Express：APIサーバーフレームワーク
- WebSocket：リアルタイム通信
- Jest：ユニットテスト
- Biome：コード品質管理

## 前提条件

- Node.js 16.x以上
- WebSocketサーバーへのアクセス権限
- OBS Studio（WebSocketプラグイン有効）
- Alive Studioブラウザソースを含むOBSシーン

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/kentaro/alive-studio-http2ws.git
cd alive-studio-http2ws

# 依存関係をインストール
npm install

# TypeScriptをコンパイル
npm run build
```

## 環境設定

`.env`ファイルを作成し、以下の変数を設定します：

```
WEBSOCKET_URL=ws://localhost:8080  # WebSocketサーバーのURL
SERVER_PORT=5001                   # このアプリケーションのポート番号
```

## 使用方法

### サーバーの起動

```bash
# 開発モード（自動再起動あり）
npm run dev

# 本番モード
npm start
```

### APIエンドポイント

#### パラメータ送信

```
POST /send
```

リクエスト形式:

```json
{
  "key": "background",
  "value": "blue"
}
```

または

```json
{
  "url": "background=blue&sound=on"
}
```

#### ヘルスチェック

```
GET /health
```

レスポンス例:

```json
{
  "status": "ok",
  "obsConnected": true,
  "timestamp": "2023-04-06T12:34:56.789Z"
}
```

## 開発

### コードスタイルとリンティング

```bash
# コードのフォーマット
npm run format

# リンティング
npm run lint

# リンティング（自動修正あり）
npm run lint:fix
```

### テスト

```bash
# すべてのテストを実行
npm test

# テストカバレッジを確認
npm run test:coverage

# 監視モードでテストを実行
npm run test:watch
```

## 貢献

1. Forkする
2. 機能ブランチを作成する（`git checkout -b feature/amazing-feature`）
3. 変更をコミットする（`git commit -m 'Add some amazing feature'`）
4. ブランチをPushする（`git push origin feature/amazing-feature`）
5. Pull Requestを作成する

## ライセンス

ISC

## 謝辞

- OBS Project - Open Broadcaster Software
- OBS WebSocket - OBSのリモートコントロール機能を提供
- Alive Project - Alive Studioの開発 