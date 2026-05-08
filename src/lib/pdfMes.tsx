import { createRoot } from 'react-dom/client';
import type { Bloco, BlocoPlantao, Hospital } from '@/types';
import { MontarPdfPage } from '@/views/MontarPdfPage';

export interface PdfMesOpts {
  hospital: Hospital;
  plantoes: BlocoPlantao[];
  bloqueios: Bloco[];
  mesISO: string;
  nomeMedico: string;
  nomeChefe?: string;
}

/**
 * Renderiza o componente MontarPdfPage off-screen, captura como imagem
 * via html2canvas e empacota num PDF A4 portrait via jspdf. Resultado
 * fiel à identidade visual do site (logo, cores, fontes).
 *
 * Roda apenas no browser. Libs (html2canvas, jspdf) são lazy-loaded.
 */
export async function gerarPdfMes(opts: PdfMesOpts): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('gerarPdfMes só roda no browser');
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-9999px';
  container.style.width = '794px';
  container.style.zIndex = '-1';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(<MontarPdfPage {...opts} />);

  // Aguarda fontes e o React commit.
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
  await new Promise((r) => setTimeout(r, 250));

  const target = container.firstElementChild as HTMLElement | null;
  if (!target) {
    root.unmount();
    container.remove();
    throw new Error('falha ao renderizar página do PDF');
  }

  const canvas = await html2canvas(target, {
    scale: 2,
    backgroundColor: '#FFFAF3',
    useCORS: true,
    logging: false,
  });

  root.unmount();
  container.remove();

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const ratio = canvas.width / canvas.height;
  // Cobre a página A4. Se a imagem for mais alta que 1 página, divide.
  const imgW = pdfW;
  const imgH = imgW / ratio;
  const imgData = canvas.toDataURL('image/png');

  if (imgH <= pdfH) {
    pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
  } else {
    // Multi-página · adiciona em pedaços de pdfH
    let remaining = imgH;
    let yOffset = 0;
    while (remaining > 0) {
      pdf.addImage(imgData, 'PNG', 0, -yOffset, imgW, imgH);
      remaining -= pdfH;
      yOffset += pdfH;
      if (remaining > 0) pdf.addPage();
    }
  }

  return pdf.output('blob');
}
