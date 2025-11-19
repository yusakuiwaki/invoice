# Overseas Remittance Mock (Spec v0.2)

最小モックとして、海外送金業務の「アップロード → 擬似抽出 → 確認・修正 → Excel出力」までを Next.js + TypeScript で実装しています。OCR/外部API連携は行わず、擬似抽出(JSON)で処理します。

## 概要
- 単一ページのUIで PDF のドラッグ&ドロップ、抽出結果の編集、簡易エラー表示、Excel 出力を提供
- バックエンド API は最小構成（`/api/import` と `/api/export`）
- ストレージはローカル `./data` のみ（開発用途）。ログはコンソールのみ
- Excel 生成は `exceljs` を使用。固定テンプレート相当の簡易表を生成

## 仕様（要約）
- フロント
  - PDF(単票/複数)のドラッグ&ドロップ or ファイル選択
  - 抽出結果フォーム（支払金額/通貨/支払先/品目…）と簡易エラー表示
  - 「Excel出力」ボタンでダウンロード
- バック
  - `POST /api/import` : PDF受取→`./data/uploads`に保存→擬似抽出の JSON を返却
  - `POST /api/export` : JSON を受取→Excelを生成→添付レスポンス
- 非対象（Non-Goals）
  - 認証/権限、閉域、本番インフラ設計
  - 楽々DP API 連携
  - 本番OCR連携（Azure DI / GCP / AWS 等）

## 必要ソフト/環境
- Node.js 18+（推奨）
- npm 9+（または互換のパッケージマネージャ）

## セットアップ
```bash
npm install
```

## 起動
- 開発サーバ
```bash
npm run dev
# http://localhost:3000 を開く
```
- プロダクションビルド（任意）
```bash
npm run build
npm start
```

## 使い方
1. 画面上部のドロップエリアに PDF をドラッグ&ドロップ（複数可）
2. 右側のフォームで値を確認・修正（エラーパネルに簡易エラーが表示）
3. 「Excel出力」をクリックすると Excel ファイルがダウンロードされます

## ディレクトリ構成（抜粋）
```
app/
  api/
    export/route.ts    # JSON → Excel 生成（exceljs）
    import/route.ts    # PDF 受取 → 擬似抽出JSON返却（./data/uploads に保存）
  page.tsx             # 単一ページUI（D&D, フォーム, エラーパネル, Excel出力）
  layout.tsx           # ページレイアウト
  types.ts             # 型定義（InvoiceData など）

data/
  .gitkeep             # ローカル保存ディレクトリ（開発用）

next.config.js         # Next.js 設定
package.json           # スクリプト・依存関係
tsconfig.json          # TypeScript 設定
```

## フロント（UI）のポイント
- PDF プレビューは任意のため未実装（フォーム＋エラーパネルは実装）
- クライアント側にも簡易バリデーションあり（サーバと同等ルール）
- 擬似抽出の初期値は `AGENTS.md` の回答例を反映

## API 仕様
### POST `/api/import`
- 概要: PDF を受け取り、`./data/uploads` に保存。擬似抽出の JSON を返却
- リクエスト: `multipart/form-data`（フィールド名は `files`、複数可）
- レスポンス例:
```json
{
  "items": [
    {
      "id": "a1b2c3d4",
      "filename": "sample.pdf",
      "data": {
        "reporterName": "畠中 良太",
        "currency": "USD",
        "amount": "797,488.67",
        "payeeCountry": "USA",
        "payeeName": "RAYONIER",
        "productType": "直貿",
        "productAmount": "797,488.67",
        "withholdingTaxConfirmed": true,
        "goodsDescription": "PULP ...",
        "originCountry": "USA",
        "shippingPorts": "SAVANNAH, ...",
        "countryName": "USA",
        "notNKIran": true,
        "notSanctioned": true
      },
      "errors": []
    }
  ]
}
```
- cURL 例:
```bash
curl -X POST http://localhost:3000/api/import \
  -F "files=@./path/to/invoice1.pdf" \
  -F "files=@./path/to/invoice2.pdf"
```

### POST `/api/export`
- 概要: JSON で受け取ったデータを固定表の Excel に埋め込み、添付レスポンスで返却
- リクエスト: `application/json`（`{ data: InvoiceData }`）
- レスポンス: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`（添付）
- cURL 例:
```bash
curl -X POST http://localhost:3000/api/export \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "reporterName": "畠中 良太",
      "currency": "USD",
      "amount": "797,488.67",
      "payeeCountry": "USA",
      "payeeName": "RAYONIER",
      "productType": "直貿",
      "productAmount": "797,488.67",
      "withholdingTaxConfirmed": true,
      "goodsDescription": "PULP Acetanier F LV, ...",
      "originCountry": "USA",
      "shippingPorts": "SAVANNAH, SAVANNAH, ...",
      "countryName": "USA",
      "notNKIran": true,
      "notSanctioned": true
    }
  }' \
  -o report.xlsx
```

## Excel 出力のカスタマイズ
- 実装箇所: `app/api/export/route.ts`
  - `rows` 配列で「項目名 → 値」の行を定義
  - 列幅、ボーダー、ヘッダ太字などの装飾を最低限設定済み
- 既存の会社指定テンプレートがある場合の方向性（任意）
  - `exceljs` でテンプレブックを読み込み、そのシート上のセル番地に値を転記する方式へ変更可能
  - 例: 事前に `template.xlsx` を `./data` に配置 → 読み込んで所定セルへ `ws.getCell('B5').value = data.reporterName` のように転記

## バリデーション（簡易）
- クライアント/サーバ双方で同等の簡易ルールを適用
  - `reporterName`/`payeeCountry`/`payeeName`/`goodsDescription`/`originCountry`/`countryName`: 必須
  - `currency`: 英大文字3文字（例: `USD`）
  - `amount`/`productAmount`: 数値文字（`-`/`,`/`.`/数字）

## 注意事項 / 制限
- OCR/AI 解析は行いません（擬似抽出のみ）
- 認証・権限や本番環境想定のセキュリティ要件は未実装
- ローカル `./data` 保存は開発用途です。機微情報を配置しないでください
- PDF プレビュー/ハイライトは任意機能のため未実装

## トラブルシュート
- `npm run build` が環境によって失敗する場合
  - まずは `npm run dev` での確認を推奨
  - Node のバージョンを 18 以上にし、依存を再インストール
  - 権限周りで止まる環境では、ローカル端末での実行を推奨

---
本モックは動作イメージの共有が目的です。要件確定後に実テンプレや運用フローへ合わせて精緻化してください。

## 判断リストによる自動補完（品目名 → 関連項目）
輸入貨物名称に判断リストの「品目名」が含まれていた場合、以下の項目を自動補完します。

- 対象項目: 支払先国、支払先（会社名等）、原産地、船積地（都市名→カンマ区切り）、船積地（国名）
- 発火タイミング:
  - `/api/import` の返却を画面に表示する直後（Azure Document Intelligence の返却表示相当）
  - 画面で「輸入貨物名称」をユーザーが編集したとき
- 実装箇所:
  - 判断リストとロジック: `app/lib/judgment.ts`
  - 画面適用（import 直後/入力時）: `app/page.tsx`（`getAutofillForGoodsDescription` を使用）

### 判断リスト（品目名 → 補完値）
| 品目名          | 支払先国 | 支払先（会社名等）       | 原産地   | 船積地（都市名） | 船積地（国名） |
|-----------------|----------|--------------------------|----------|------------------|----------------|
| AMELIANIER-F    | USA      | RAYONIER                 | USA      | JACKSONVILLE     | USA            |
| PLACETATE-F     | USA      | RAYONIER                 | USA      | JACKSONVILLE     | USA            |
| ACETANIER-F-LV  | USA      | RAYONIER                 | USA      | SAVANNAH         | USA            |
| CELLUNIER-F     | USA      | RAYONIER                 | USA      | SAVANNAH         | USA            |
| ETHENIER-F      | USA      | RAYONIER                 | USA      | SAVANNAH         | USA            |
| RAYACETA-HJ     | USA      | RAYONIER                 | USA      | SAVANNAH         | USA            |
| RAYACETA-HJ 11S | USA      | RAYONIER                 | USA      | SAVANNAH         | USA            |
| SULFATATE-HJ    | USA      | RAYONIER                 | USA      | SAVANNAH         | USA            |
| SUPER ACETA     | ノルウェー | BORREGAARD              | NORWAY   | ROTTERDAM        | NETHERLANDS    |
| Blue Bear MV    | ノルウェー | BORREGAARD              | NORWAY   | ROTTERDAM        | NETHERLANDS    |
| LV-U            | ノルウェー | BORREGAARD              | NORWAY   | ROTTERDAM        | NETHERLANDS    |
| Ultra Aceta     | ノルウェー | BORREGAARD              | NORWAY   | OSLO             | NORWAY         |
| IARY            | 日本     | 三井物産パッケージング    | USA      | LOS ANGELES      | USA            |
| 225HL-M         | 日本     | 三井物産パッケージング    | USA      | LOS ANGELES      | USA            |
| HVE             | 日本     | 三井物産パッケージング    | USA      | LOS ANGELES      | USA            |
| AC1600          | 日本     | 東工ユーセン              | CHINA    | QINGDAO          | CHINA          |
| CP9125          | 日本     | 東工ユーセン              | CHINA    | QINGDAO          | CHINA          |
| PCS2400         | 日本     | 東工ユーセン              | CHINA    | QINGDAO          | CHINA          |
| DIAMOND         | 日本     | 丸紅                      | THAILAND | BANGKOK          | THAILAND       |
| BAHIA ACE       | 日本     | 丸紅                      | BRAZIL   | SALVADOR         | BRAZIL         |

### 実装ロジック（簡易）
- `goodsDescription`（輸入貨物名称）に対し、品目名を大小無視の部分一致で走査。
- 一致が1件以上ある場合:
  - 最初に一致した品目の「支払先国」「支払先（会社名等）」「原産地」「船積地（国名）」で補完。
  - 「船積地（都市名）」は一致した全品目の都市名をユニーク化し、カンマ区切りで結合して補完。
- 入力時の注意:
  - 上記の補完は「輸入貨物名称」を変更したタイミングでのみ実行し、他フィールドの手入力は上書きしません。
  - 複数品目が同時に含まれるケースの厳密な整合は本モックの範囲外（代表一致を採用）。
