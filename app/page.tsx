'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ExtractedItem, ImportResponse, InvoiceData } from './types';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <label style={{ width: 260 }}>{label}</label>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h3 style={{ margin: '8px 0' }}>{title}</h3>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
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
    <main style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ margin: '8px 0 16px' }}>海外送金モック（Spec v0.2）</h1>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        style={{
          border: '2px dashed #999',
          padding: 24,
          textAlign: 'center',
          borderRadius: 8,
          background: '#fafafa',
          cursor: 'pointer',
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => e.target.files && onFiles(e.target.files)}
        />
        {dropText}
      </div>

      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <div style={{ minWidth: 240 }}>
            <h3 style={{ margin: '8px 0' }}>ファイル一覧（OCR結果画像の表示検証予定）</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {items.map((it, i) => (
                <li key={it.id}>
                  <button
                    onClick={() => setSelected(i)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      marginBottom: 8,
                      borderRadius: 6,
                      border: '1px solid #ddd',
                      background: i === selected ? '#e6f0ff' : 'white',
                    }}
                  >
                    {it.filename}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {selectedItem && (
            <div style={{ flex: 1 }}>
              <Section title="抽出結果（編集可能）">
                <Field label="報告者氏名">
                  <input
                    value={selectedItem.data.reporterName}
                    onChange={(e) => update({ reporterName: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </Field>
                <Field label="支払金額通貨">
                  <input
                    value={selectedItem.data.currency}
                    onChange={(e) => update({ currency: e.target.value.toUpperCase() })}
                    style={{ width: 120 }}
                  />
                </Field>
                <Field label="金額">
                  <input
                    value={selectedItem.data.amount}
                    onChange={(e) => update({ amount: e.target.value })}
                    style={{ width: 200 }}
                  />
                </Field>
                <Field label="支払先国">
                  <input
                    value={selectedItem.data.payeeCountry}
                    onChange={(e) => update({ payeeCountry: e.target.value })}
                    style={{ width: 200 }}
                  />
                </Field>
                <Field label="支払先（会社名等）">
                  <input
                    value={selectedItem.data.payeeName}
                    onChange={(e) => update({ payeeName: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </Field>
                <Field label="①商品代（a.直貿／b.間貿）">
                  <select
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
                    value={selectedItem.data.productAmount}
                    onChange={(e) => update({ productAmount: e.target.value })}
                    style={{ width: 200 }}
                  />
                </Field>
                <Field label="人事グループへの確認（源泉所得税）">
                  <input
                    type="checkbox"
                    checked={selectedItem.data.withholdingTaxConfirmed}
                    onChange={(e) => update({ withholdingTaxConfirmed: e.target.checked })}
                  />
                </Field>
                <Field label="輸入貨物名称">
                  <textarea
                    value={selectedItem.data.goodsDescription}
                    onChange={(e) => update({ goodsDescription: e.target.value })}
                    rows={3}
                    style={{ width: '100%' }}
                  />
                </Field>
                <Field label="原産地">
                  <input
                    value={selectedItem.data.originCountry}
                    onChange={(e) => update({ originCountry: e.target.value })}
                    style={{ width: 200 }}
                  />
                </Field>
                <Field label="船積地（カンマ区切り）">
                  <textarea
                    value={selectedItem.data.shippingPorts}
                    onChange={(e) => update({ shippingPorts: e.target.value })}
                    rows={2}
                    style={{ width: '100%' }}
                  />
                </Field>
                <Field label="国名">
                  <input
                    value={selectedItem.data.countryName}
                    onChange={(e) => update({ countryName: e.target.value })}
                    style={{ width: 200 }}
                  />
                </Field>
                <Field label="北朝鮮およびイランに関連する取引ではないことを確認">
                  <input
                    type="checkbox"
                    checked={selectedItem.data.notNKIran}
                    onChange={(e) => update({ notNKIran: e.target.checked })}
                  />
                </Field>
                <Field label="その他外為法の規制対象に該当しないことを確認">
                  <input
                    type="checkbox"
                    checked={selectedItem.data.notSanctioned}
                    onChange={(e) => update({ notSanctioned: e.target.checked })}
                  />
                </Field>
              </Section>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button onClick={exportExcel} disabled={busy}>
                  Excel出力
                </button>
              </div>

              <Section title="エラーパネル（簡易）">
                {selectedItem.errors.length === 0 ? (
                  <div style={{ color: 'green' }}>エラーはありません</div>
                ) : (
                  <ul style={{ margin: 0 }}>
                    {selectedItem.errors.map((e, i) => (
                      <li key={i} style={{ color: 'crimson' }}>
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

      <footer style={{ marginTop: 24, color: '#666', fontSize: 12 }}>
        Azure Document Intelligenceとは疎通しない（擬似抽出）／出力は固定テンプレのExcel（簡易）
      </footer>
    </main>
  );
}

