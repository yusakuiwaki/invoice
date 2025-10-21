'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ExtractedItem, ImportResponse, InvoiceData } from './types';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <label className="label w-60">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card mb-4">
      <div className="card-section">
        <h3 className="section-title">{title}</h3>
        <div className="grid gap-3">{children}</div>
      </div>
    </section>
  );
}

export default function Page() {
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedItem = items[selected];

  const onFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    const form = new FormData();
    arr.forEach((f) => form.append('files', f));
    setBusy(true);
    try {
      const res = await fetch('/api/import', { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ImportResponse;
      setItems(data.items);
      setSelected(0);
    } catch (e) {
      alert('インポートに失敗しました');
      console.error(e);
    } finally {
      setBusy(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onFiles(e.dataTransfer.files);
    },
    [onFiles]
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const update = useCallback(
    (patch: Partial<InvoiceData>) => {
      setItems((prev) => {
        const next = [...prev];
        const item = { ...next[selected] };
        item.data = { ...item.data, ...patch };
        // Simple client-side validation mirroring server
        const errors: string[] = [];
        if (!item.data.reporterName.trim()) errors.push('報告者氏名は必須です');
        if (!/^[A-Z]{3}$/.test(item.data.currency.trim())) errors.push('通貨は3文字の通貨コード');
        if (!/^[-0-9.,]+$/.test(item.data.amount.trim())) errors.push('金額は数値形式で入力');
        if (!item.data.payeeCountry.trim()) errors.push('支払先国は必須です');
        if (!item.data.payeeName.trim()) errors.push('支払先(会社名)は必須です');
        if (!/^[-0-9.,]+$/.test(item.data.productAmount.trim())) errors.push('金額(①商品代)は数値形式で入力');
        if (!item.data.goodsDescription.trim()) errors.push('輸入貨物名称は必須です');
        if (!item.data.originCountry.trim()) errors.push('原産地は必須です');
        if (!item.data.countryName.trim()) errors.push('国名は必須です');
        item.errors = errors;
        next[selected] = item;
        return next;
      });
    },
    [selected]
  );

  const exportExcel = useCallback(async () => {
    if (!selectedItem) return;
    setBusy(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: selectedItem.data }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${selectedItem.filename.replace(/\.pdf$/i, '')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Excel出力に失敗しました');
      console.error(e);
    } finally {
      setBusy(false);
    }
  }, [selectedItem]);

  const dropText = useMemo(() => {
    if (busy) return '処理中...';
    if (!items.length) return 'PDFをドラッグ＆ドロップ、またはクリックして選択';
    return '別のPDFをドロップして再解析';
  }, [busy, items.length]);

  return (
    <main className="container-page">
      <header className="mb-4">
        <h1 className="text-xl font-bold">海外送金モック（Spec v0.2）</h1>
      </header>

      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        className="dropzone"
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && onFiles(e.target.files)}
        />
        <span className="text-slate-600">{dropText}</span>
      </div>

      {items.length > 0 && (
        <div className="flex gap-4 mt-4">
          <div className="w-64">
            <h3 className="section-title">ファイル一覧（OCR結果画像の表示検証予定）</h3>
            <ul className="space-y-2">
              {items.map((it, i) => (
                <li key={it.id}>
                  <button
                    onClick={() => setSelected(i)}
                    className={`file-item ${i === selected ? 'file-item-active' : ''}`}
                  >
                    {it.filename}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {selectedItem && (
            <div className="flex-1">
              <Section title="抽出結果（編集可能）">
                <Field label="報告者氏名">
                  <input
                    className="input"
                    value={selectedItem.data.reporterName}
                    onChange={(e) => update({ reporterName: e.target.value })}
                  />
                </Field>
                <Field label="支払金額通貨">
                  <input
                    className="input w-32"
                    value={selectedItem.data.currency}
                    onChange={(e) => update({ currency: e.target.value.toUpperCase() })}
                  />
                </Field>
                <Field label="金額">
                  <input
                    className="input w-52"
                    value={selectedItem.data.amount}
                    onChange={(e) => update({ amount: e.target.value })}
                  />
                </Field>
                <Field label="支払先国">
                  <input
                    className="input w-52"
                    value={selectedItem.data.payeeCountry}
                    onChange={(e) => update({ payeeCountry: e.target.value })}
                  />
                </Field>
                <Field label="支払先（会社名等）">
                  <input
                    className="input"
                    value={selectedItem.data.payeeName}
                    onChange={(e) => update({ payeeName: e.target.value })}
                  />
                </Field>
                <Field label="①商品代（a.直貿／b.間貿）">
                  <select
                    className="select w-40"
                    value={selectedItem.data.productType}
                    onChange={(e) =>
                      update({ productType: e.target.value as InvoiceData['productType'] })
                    }
                  >
                    <option value="直貿">直貿</option>
                    <option value="間貿">間貿</option>
                  </select>
                </Field>
                <Field label="金額（①商品代）">
                  <input
                    className="input w-52"
                    value={selectedItem.data.productAmount}
                    onChange={(e) => update({ productAmount: e.target.value })}
                  />
                </Field>
                <Field label="人事グループへの確認（源泉所得税）">
                  <input
                    className="h-4 w-4"
                    type="checkbox"
                    checked={selectedItem.data.withholdingTaxConfirmed}
                    onChange={(e) => update({ withholdingTaxConfirmed: e.target.checked })}
                  />
                </Field>
                <Field label="輸入貨物名称">
                  <textarea
                    className="textarea"
                    value={selectedItem.data.goodsDescription}
                    onChange={(e) => update({ goodsDescription: e.target.value })}
                    rows={3}
                  />
                </Field>
                <Field label="原産地">
                  <input
                    className="input w-52"
                    value={selectedItem.data.originCountry}
                    onChange={(e) => update({ originCountry: e.target.value })}
                  />
                </Field>
                <Field label="船積地（カンマ区切り）">
                  <textarea
                    className="textarea"
                    value={selectedItem.data.shippingPorts}
                    onChange={(e) => update({ shippingPorts: e.target.value })}
                    rows={2}
                  />
                </Field>
                <Field label="国名">
                  <input
                    className="input w-52"
                    value={selectedItem.data.countryName}
                    onChange={(e) => update({ countryName: e.target.value })}
                  />
                </Field>
                <Field label="北朝鮮およびイランに関連する取引ではないことを確認">
                  <input
                    className="h-4 w-4"
                    type="checkbox"
                    checked={selectedItem.data.notNKIran}
                    onChange={(e) => update({ notNKIran: e.target.checked })}
                  />
                </Field>
                <Field label="その他外為法の規制対象に該当しないことを確認">
                  <input
                    className="h-4 w-4"
                    type="checkbox"
                    checked={selectedItem.data.notSanctioned}
                    onChange={(e) => update({ notSanctioned: e.target.checked })}
                  />
                </Field>
              </Section>

              <div className="flex gap-2 mb-3">
                <button className="btn btn-primary" onClick={exportExcel} disabled={busy}>
                  Excel出力
                </button>
              </div>

              <Section title="エラーパネル（簡易）">
                {selectedItem.errors.length === 0 ? (
                  <div className="ok-text">エラーはありません</div>
                ) : (
                  <ul className="list-disc pl-5">
                    {selectedItem.errors.map((e, i) => (
                      <li key={i} className="error-text">
                        {e}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          )}
        </div>
      )}

      <footer className="mt-6 text-slate-500 text-xs">
        Azure Document Intelligenceとは疎通しない（擬似抽出）／出力は固定テンプレのExcel（簡易）
      </footer>
    </main>
  );
}
