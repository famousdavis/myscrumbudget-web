// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import html2canvas from 'html2canvas';

/**
 * Resolves any computed style value containing modern CSS color functions
 * (oklch, oklab, lab, lch, color-mix) into rgb()/rgba() inside the CLONED
 * DOM that html2canvas builds. Tailwind v4 uses these everywhere;
 * html2canvas@1.4.1 cannot parse them and would otherwise throw.
 *
 * Operates on the clone only — never the live DOM. Mutations are discarded
 * with the clone after rasterization, so no teardown is needed.
 */
const MODERN_COLOR_RE = /\boklch\(|\boklab\(|\blab\(|\blch\(|\bcolor-mix\(|\bcolor\(/;

function neutralizeOklch(doc: Document, clonedEl: HTMLElement): void {
  const cvs = document.createElement('canvas');
  cvs.width = 1;
  cvs.height = 1;
  const ctx = cvs.getContext('2d');
  if (!ctx) return;

  const resolve = (color: string): string => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    try {
      ctx.fillStyle = color;
    } catch {
      return 'rgb(0,0,0)';
    }
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const r = d[0], g = d[1], b = d[2], a = d[3];
    return a < 255
      ? `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`
      : `rgb(${r},${g},${b})`;
  };

  // Pass 1: rewrite modern color funcs inside :root custom properties on the cloned doc
  const root = doc.documentElement;
  const rootStyles = getComputedStyle(root);
  for (let i = 0; i < rootStyles.length; i++) {
    const prop = rootStyles[i];
    if (!prop || !prop.startsWith('--')) continue;
    const val = rootStyles.getPropertyValue(prop);
    if (MODERN_COLOR_RE.test(val)) {
      root.style.setProperty(prop, resolve(val.trim()));
    }
  }

  // Pass 2: rewrite modern color funcs in standard properties on every cloned element
  const fix = (el: HTMLElement | SVGElement) => {
    const s = getComputedStyle(el);
    for (let i = 0; i < s.length; i++) {
      const prop = s[i];
      if (!prop || prop.startsWith('--')) continue;
      const val = s.getPropertyValue(prop);
      if (MODERN_COLOR_RE.test(val)) {
        el.style.setProperty(prop, resolve(val));
      }
    }
  };
  fix(clonedEl);
  clonedEl.querySelectorAll('*').forEach((node) => {
    if (node instanceof HTMLElement || node instanceof SVGElement) fix(node);
  });
}

/**
 * Rasterize an element to PNG and write it to the system clipboard.
 * Caller must ensure the runtime supports navigator.clipboard.write +
 * ClipboardItem (CopyImageButton handles the capability check).
 *
 * Uses the lazy Promise<Blob> ClipboardItem form so the browser keeps
 * the original user-gesture context alive across the html2canvas
 * rasterization step (which can take hundreds of ms). Without this, the
 * clipboard.write() can be rejected as "not in a user gesture" on Chrome.
 */
export async function copyChartAsPng(target: HTMLElement): Promise<void> {
  const blobPromise = (async () => {
    const canvas = await html2canvas(target, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
      ignoreElements: (el) => el.classList.contains('copy-image-button'),
      onclone: neutralizeOklch,
    });
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
        'image/png',
      );
    });
  })();

  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blobPromise }),
  ]);
}
