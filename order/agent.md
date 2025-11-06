# Azure Document Intelligence 最小検証（目的と必要項目だけ）

## 1. 目的
- **Azure Document Intelligence（DI）にPDFを投げて返却値を確認すること。**
- 返ってきた JSON から、以下「DI抽出可能項目一覧」に該当する値が取得できているかを確認する。
- 画面やアプリケーションは不要。コンソール等で確認できれば良い。

---

## 2. やりたいこと
1. PDFファイルを ディレクトリ内に排配置する  
2. PDFファイルを使ってDI の **prebuilt-document**（キー値）と **prebuilt-layout**（テーブル）の2種類を実行  
3. 返却された JSON を 出力して確認できるようにする**  
4. 返却結果から、DI抽出可能項目（注文番号・顧客名・納入先・明細など）が取得できているか目視で確認  

---

## 3. 検証対象（DI抽出可能項目想定）
※ すべてのPDFでこのスキーマを軸に目視チェックすればよい

### ■ ヘッダー項目
- **order_no**（注文書番号 / Order No / PO No）
- **customer_order_no**（顧客注文番号）
- **order_date**（注文日 / Order Date）
- **shipment_date**（納期 / Delivery Date / 出荷日）
- **customer_name**（顧客名 / Customer）
- **ship_to**（納入先 / 納品先 / Deliver To）
- **bill_to**（請求先 / Billing）
- **contact_person**（担当者 / Attn）
- **phone**（電話番号）
- **supplier_name**（発注先 / Supplier）
- **supplier_address**
- **currency**（JPY / USD など）
- **purchase_order_type**（取引区分 / 発注区分）

### ■ 明細項目（テーブル）
- **product_code**
- **product_name**
- **qty**
- **unit**
- **unit_price**
- **amount**
- **line_delivery**
