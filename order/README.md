# Azure Document Intelligence 最小検証ランナー

注文書PDFを Azure Document Intelligence（以下 DI）へ送信し、返却 JSON を保存・要約表示するコンソール用の最小ツールです。SDK は不要で、Node.js 18 の標準 `fetch` による REST コールのみで動作します。ネットワークや認証がない環境でも挙動確認できるモックモードを同梱しています。

## できること
- `./input` の `*.pdf` を走査して DI を実行
  - `prebuilt-document`（キー値・フィールド）
  - `prebuilt-layout`（テーブル）
- 返却 JSON を `./data/out` に保存（ファイル名＋モデル種別）
- 主要ヘッダー項目とテーブルの先頭数行をコンソール出力
- オフライン用モックモード（サンプル JSON を使用）

## 必要環境
- Node.js 18+
- DI 資格情報（実機実行時のみ）
  - `AZURE_DI_ENDPOINT` 例: `https://<resource>.cognitiveservices.azure.com`
  - `AZURE_DI_KEY`

## 使い方（実機）
1. 検証したい PDF を `./input` に配置
2. 環境変数を設定
   - macOS/Linux:
     - `export AZURE_DI_ENDPOINT="https://<resource>.cognitiveservices.azure.com"`
     - `export AZURE_DI_KEY="<your-key>"`
   - Windows PowerShell:
     - `$env:AZURE_DI_ENDPOINT = "https://<resource>.cognitiveservices.azure.com"`
     - `$env:AZURE_DI_KEY = "<your-key>"`
3. 実行
   - `node scripts/run-di.mjs`

## 使い方（モック／オフライン）
- 実行: `node scripts/run-di.mjs --mock`
- 使用するサンプル: `./samples/mock-document.json`, `./samples/mock-layout.json`
- 出力: `./data/out/MOCK.prebuilt-document.json`, `./data/out/MOCK.prebuilt-layout.json`

## 出力物
- JSON: `./data/out/<pdf名>.prebuilt-document.json`, `./data/out/<pdf名>.prebuilt-layout.json`
- コンソール要約: ヘッダー項目（例: `order_no`, `customer_name`, `ship_to` など）とテーブルの先頭数行

## 補足
- 既定 API バージョンは `2023-07-31`。変更は `scripts/run-di.mjs` の `API_VERSION` を編集してください。
- 本ツールは `agent.md` の要件に合わせた最小構成です。画面はありません（コンソール出力のみ）。
