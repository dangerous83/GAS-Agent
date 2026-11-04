/* GAS Agent — turns Markdown into real downloadable files.
   Word (.docx) is built here (Office Open XML in a small zip writer).
   PDF uses jsPDF, loaded from assets/vendor only when first needed. */
(() => {
  'use strict';

  /* ---------- Markdown → blocks ---------- */
  function blocks(md) {
    const L = String(md || '').replace(/\r/g, '').split('\n'); const out = []; let i = 0;
    const isTableSep = (s) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(s);
    const cells = (s) => s.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    while (i < L.length) {
      const line = L[i];
      if (/^```/.test(line)) { const buf = []; i++; while (i < L.length && !/^```\s*$/.test(L[i])) buf.push(L[i++]); i++; out.push({ t: 'code', text: buf.join('\n') }); continue; }
      if (!line.trim()) { i++; continue; }
      const h = /^(#{1,6})\s+(.*)$/.exec(line); if (h) { out.push({ t: 'h', level: Math.min(3, h[1].length), text: h[2].replace(/\s+#+\s*$/, '') }); i++; continue; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push({ t: 'hr' }); i++; continue; }
      if (/^\s*>/.test(line)) { const q = []; while (i < L.length && /^\s*>/.test(L[i])) q.push(L[i++].replace(/^\s*>\s?/, '')); out.push({ t: 'quote', text: q.join(' ') }); continue; }
      if (line.includes('|') && i + 1 < L.length && isTableSep(L[i + 1])) {
        const head = cells(line); i += 2; const rows = [];
        while (i < L.length && L[i].includes('|') && L[i].trim()) rows.push(cells(L[i++]));
        out.push({ t: 'table', head, rows }); continue;
      }
      const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
      if (li) { out.push({ t: 'li', ordered: /\d/.test(li[2]), n: parseInt(li[2], 10) || 0, depth: Math.min(2, Math.floor(li[1].length / 2)), text: li[3].replace(/^\[( |x)\]\s*/i, (m, x) => (x.trim() ? '☑ ' : '☐ ')) }); i++; continue; }
      const para = [line.trim()]; i++;
      while (i < L.length && L[i].trim() && !/^(```|#{1,6}\s|\s*>|\s*([-*+]|\d+[.)])\s)/.test(L[i]) && !(L[i].includes('|') && i + 1 < L.length && isTableSep(L[i + 1]))) para.push(L[i++].trim());
      out.push({ t: 'p', text: para.join(' ') });
    }
    return out;
  }
  // Inline Markdown → runs [{ text, b, i, code }]
  function runs(s) {
    const out = []; const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*?)\*|`([^`]+)`|\[([^\]]+)\]\((https?:[^)\s]+)\))/g; let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push({ text: s.slice(last, m.index) });
      if (m[2] || m[3]) out.push({ text: m[2] || m[3], b: true });
      else if (m[4]) out.push({ text: m[4], i: true });
      else if (m[5]) out.push({ text: m[5], code: true });
      else if (m[6]) out.push({ text: `${m[6]} (${m[7]})` });
      last = re.lastIndex;
    }
    if (last < s.length) out.push({ text: s.slice(last) });
    return out.filter((r) => r.text);
  }
  const plain = (s) => runs(s).map((r) => r.text).join('');

  function titleOf(md, fallback) {
    const h = /^#{1,2}\s+(.+)$/m.exec(md || ''); const t = (h ? h[1] : fallback || 'Document').replace(/[*_`#]/g, '').trim();
    return t.slice(0, 90) || 'Document';
  }
  const fileBase = (t) => (t || 'Document').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60).replace(/[.\s]+$/, '') || 'Document';
  const brand = () => (window.GASBrand && window.GASBrand()) || 'GAS Agent';

  /* ---------- Zip (store, no compression) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u) => { let c = 0xffffffff; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(); const parts = []; const central = []; let offset = 0;
    const d = new Date(); const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1); const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const name = enc.encode(f.name); const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data; const crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint16(10, time, true); h.setUint16(12, date, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, time, true); c.setUint16(14, date, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  /* ---------- Word (.docx) ---------- */
  const x = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function wRuns(text, base = {}) {
    return runs(text).map((r) => {
      const pr = [r.code ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>' : '', r.b || base.b ? '<w:b/>' : '', r.i || base.i ? '<w:i/>' : '', base.color ? `<w:color w:val="${base.color}"/>` : '', base.sz ? `<w:sz w:val="${base.sz}"/>` : ''].join('');
      return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${x(r.text)}</w:t></w:r>`;
    }).join('');
  }
  function docx(md, title) {
    const T = title || titleOf(md); const B = blocks(md); const body = [];
    const startsWithTitle = B[0] && B[0].t === 'h' && B[0].level === 1;
    if (!startsWithTitle) body.push(`<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr>${wRuns(T)}</w:p>`);
    B.forEach((b, idx) => {
      if (b.t === 'h') body.push(`<w:p><w:pPr><w:pStyle w:val="${idx === 0 && b.level === 1 ? 'Title' : 'Heading' + b.level}"/></w:pPr>${wRuns(b.text)}</w:p>`);
      else if (b.t === 'p') body.push(`<w:p>${wRuns(b.text)}</w:p>`);
      else if (b.t === 'li') body.push(`<w:p><w:pPr><w:spacing w:after="60"/><w:ind w:left="${360 + b.depth * 360}" w:hanging="300"/></w:pPr><w:r><w:t xml:space="preserve">${b.ordered ? b.n + '.' : '•'} </w:t></w:r><w:r><w:tab/></w:r>${wRuns(b.text)}</w:p>`);
      else if (b.t === 'quote') body.push(`<w:p><w:pPr><w:ind w:left="480"/><w:pBdr><w:left w:val="single" w:sz="18" w:space="12" w:color="3B82F6"/></w:pBdr></w:pPr>${wRuns(b.text, { i: true, color: '4B5563' })}</w:p>`);
      else if (b.t === 'hr') body.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="C7D2E3"/></w:pBdr></w:pPr></w:p>');
      else if (b.t === 'code') b.text.split('\n').forEach((ln) => body.push(`<w:p><w:pPr><w:spacing w:after="0"/><w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="19"/></w:rPr><w:t xml:space="preserve">${x(ln)}</w:t></w:r></w:p>`));
      else if (b.t === 'table') {
        const n = Math.max(b.head.length, ...b.rows.map((r) => r.length)); const w = Math.floor(9026 / n);
        const cell = (t, head) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="E8EEF9"/>' : ''}</w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${wRuns(t || '', head ? { b: true } : {})}</w:p></w:tc>`;
        const row = (r, head) => `<w:tr>${Array.from({ length: n }, (_, k) => cell(r[k], head)).join('')}</w:tr>`;
        const bd = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="C7D2E3"/>`).join('');
        body.push(`<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${bd}</w:tblBorders><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${'<w:gridCol w:w="' + w + '"/>'.repeat(n)}</w:tblGrid>${row(b.head, true)}${b.rows.map((r) => row(r)).join('')}</w:tbl><w:p/>`);
      }
    });
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1300" w:right="1440" w:bottom="1300" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const hs = (id, name, sz, color, before, outline) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${before}" w:after="120"/>${outline != null ? `<w:outlineLvl w:val="${outline}"/>` : ''}</w:pPr><w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="${sz}"/></w:rPr></w:style>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${hs('Title', 'Title', 44, '0F2A5C', 0, null)}${hs('Heading1', 'heading 1', 32, '1E3A8A', 320, 0)}${hs('Heading2', 'heading 2', 27, '1E40AF', 260, 1)}${hs('Heading3', 'heading 3', 24, '1D4ED8', 200, 2)}</w:styles>`;
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${x(T)}</dc:title><dc:creator>${x(brand())}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
    return zip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
      { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'word/document.xml', data: document },
      { name: 'word/styles.xml', data: styles },
      { name: 'docProps/core.xml', data: core },
    ]);
  }

  /* ---------- PDF ---------- */
  let jsPDFLoad = null;
  function loadPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (!jsPDFLoad) jsPDFLoad = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'assets/vendor/jspdf.umd.min.js'; s.async = true;
      s.onload = () => (window.jspdf && window.jspdf.jsPDF ? res(window.jspdf.jsPDF) : rej(new Error('PDF library did not load.')));
      s.onerror = () => { jsPDFLoad = null; rej(new Error('Could not load the PDF library.')); };
      document.head.append(s);
    });
    return jsPDFLoad;
  }
  // The built-in PDF fonts cover Latin-1, so map common symbols and drop the rest.
  const MAP = { '₱': 'PHP ', '€': 'EUR ', '−': '-', '–': '-', '—': ' - ', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '×': 'x', '≥': '>=', '≤': '<=', '→': '->', '←': '<-', '•': '-', '☐': '[ ]', '☑': '[x]', '✓': 'v', '✔': 'v', '₂': '2', '₅': '5', ' ': ' ' };
  const clean = (s) => String(s).replace(/[₱€−–—‘’“”…×≥≤→←•☐☑✓✔₂₅ ]/g, (c) => MAP[c]).replace(/[^\u0009\u000a -~¡-ÿ]/g, '');

  async function pdf(md, title) {
    const JsPDF = await loadPDF();
    const T = title || titleOf(md); const B = blocks(md);
    const doc = new JsPDF({ unit: 'pt', format: 'a4', compress: true });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 56, CW = W - M * 2;
    let y = M;
    const ensure = (h) => { if (y + h > H - M) { doc.addPage(); y = M; } };
    const write = (text, { size = 11, style = 'normal', color = [31, 41, 55], indent = 0, lh = 1.45, font = 'helvetica' } = {}) => {
      doc.setFont(font, style); doc.setFontSize(size); doc.setTextColor(...color);
      const lines = doc.splitTextToSize(clean(text), CW - indent);
      lines.forEach((ln) => { ensure(size * lh); doc.text(ln, M + indent, y + size); y += size * lh; });
    };
    // Header band
    doc.setFillColor(15, 42, 92); doc.rect(0, 0, W, 6, 'F');
    const startsWithTitle = B[0] && B[0].t === 'h' && B[0].level === 1;
    write(startsWithTitle ? plain(B[0].text) : T, { size: 22, style: 'bold', color: [15, 42, 92], lh: 1.25 });
    write(`${brand()} · ${new Date().toLocaleDateString('en-PH', { day: 'numeric', month: 'long', year: 'numeric' })}`, { size: 9.5, color: [100, 116, 139] });
    y += 6; doc.setDrawColor(199, 210, 227); doc.setLineWidth(.8); doc.line(M, y, W - M, y); y += 14;
    (startsWithTitle ? B.slice(1) : B).forEach((b) => {
      if (b.t === 'h') { y += b.level === 1 ? 10 : 6; ensure(40); write(plain(b.text), { size: [0, 16, 13.5, 12][b.level], style: 'bold', color: [30, 58, 138], lh: 1.3 }); y += 2; }
      else if (b.t === 'p') { write(plain(b.text)); y += 6; }
      else if (b.t === 'li') {
        const ind = 14 + b.depth * 14; doc.setFont('helvetica', 'normal'); doc.setFontSize(11); ensure(16);
        doc.setTextColor(59, 130, 246);
        if (b.ordered) doc.text(`${b.n}.`, M + ind - 14, y + 11); else { doc.setFillColor(59, 130, 246); doc.circle(M + ind - 9, y + 7, 1.8, 'F'); }
        write(plain(b.text), { indent: ind }); y += 2;
      } else if (b.t === 'quote') {
        const y0 = y; write(plain(b.text), { style: 'italic', color: [75, 85, 99], indent: 14 }); doc.setDrawColor(59, 130, 246); doc.setLineWidth(2.5); doc.line(M + 3, y0 + 2, M + 3, y - 2); y += 6;
      } else if (b.t === 'hr') { ensure(14); y += 6; doc.setDrawColor(199, 210, 227); doc.setLineWidth(.6); doc.line(M, y, W - M, y); y += 10; }
      else if (b.t === 'code') {
        doc.setFont('courier', 'normal'); doc.setFontSize(9.5);
        const lines = b.text.split('\n').flatMap((l) => doc.splitTextToSize(clean(l) || ' ', CW - 16));
        lines.forEach((ln, k) => { ensure(13); doc.setFillColor(241, 245, 249); doc.rect(M, y - (k === 0 ? 4 : 0), CW, 13 + (k === 0 ? 4 : 0) + (k === lines.length - 1 ? 4 : 0), 'F'); doc.setTextColor(30, 41, 59); doc.text(ln, M + 8, y + 9.5); y += 13; });
        y += 12;
      } else if (b.t === 'table') {
        const n = Math.max(b.head.length, ...b.rows.map((r) => r.length)); const cw = CW / n; const fs = n > 5 ? 8.5 : 9.5; const lh = fs * 1.35;
        const drawRow = (r, head) => {
          doc.setFont('helvetica', head ? 'bold' : 'normal'); doc.setFontSize(fs);
          const cellLines = Array.from({ length: n }, (_, k) => doc.splitTextToSize(clean(plain(r[k] || '')), cw - 10));
          const h = Math.max(...cellLines.map((c) => c.length)) * lh + 10;
          if (y + h > H - M) { doc.addPage(); y = M; if (!head) drawRow(b.head, true); }
          if (head) { doc.setFillColor(232, 238, 249); doc.rect(M, y, CW, h, 'F'); }
          doc.setDrawColor(199, 210, 227); doc.setLineWidth(.6);
          cellLines.forEach((c, k) => { doc.rect(M + k * cw, y, cw, h); doc.setTextColor(head ? 15 : 31, head ? 42 : 41, head ? 92 : 55); c.forEach((ln, j) => doc.text(ln, M + k * cw + 5, y + 5 + fs + j * lh)); });
          y += h;
        };
        ensure(40); drawRow(b.head, true); b.rows.forEach((r) => drawRow(r)); y += 14;
      }
    });
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(148, 163, 184);
      doc.text(clean(T).slice(0, 70), M, H - 28); doc.text(`Page ${p} of ${pages}`, W - M, H - 28, { align: 'right' });
    }
    doc.setProperties({ title: clean(T), creator: brand() });
    return doc.output('blob');
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // kind: 'pdf' | 'docx'. Returns the file name.
  async function save(kind, md, title) {
    const T = title || titleOf(md); const name = `${fileBase(T)}.${kind}`;
    const blob = kind === 'pdf' ? await pdf(md, T) : docx(md, T);
    download(blob, name); return name;
  }

  window.GASDocs = { blocks, titleOf, docx, pdf, save, download };
})();
