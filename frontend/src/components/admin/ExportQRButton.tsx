'use client';

import { useState } from 'react';
import { QrCode, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType, PageBreak } from 'docx';
import { saveAs } from 'file-saver';

interface SelectedOrder {
  id: string;
  orderCode: string;
}

export default function ExportQRButton({ selectedOrders }: { selectedOrders: SelectedOrder[] }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (selectedOrders.length === 0) return;
    setExporting(true);

    try {
      const baseUrl = window.location.origin;
      const sections = [];

      for (let i = 0; i < selectedOrders.length; i++) {
        const order = selectedOrders[i];
        const url = `${baseUrl}/portal?campaign=qr_claim&orderCode=${order.orderCode}`;

        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 400,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        });

        // Convert data URL to buffer
        const base64Data = qrDataUrl.split(',')[1];
        const qrBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        const paragraphs: Paragraph[] = [
          // Spacer
          new Paragraph({ spacing: { before: 600 }, children: [] }),

          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: 'QUÉT MÃ QR ĐỂ NHẬN VOUCHER',
                bold: true,
                size: 36,
                font: 'Arial',
              }),
            ],
          }),

          // Subtitle
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: 'Quét mã bên dưới bằng ứng dụng camera hoặc Zalo',
                size: 22,
                font: 'Arial',
                color: '666666',
              }),
            ],
          }),

          // QR Code Image
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new ImageRun({
                data: qrBuffer,
                transformation: { width: 300, height: 300 },
                type: 'png',
              }),
            ],
          }),

          // Order Code
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `Mã đơn: #${order.orderCode}`,
                bold: true,
                size: 28,
                font: 'Arial',
              }),
            ],
          }),

          // URL fallback
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: 'Nếu không quét được QR, truy cập:',
                size: 18,
                font: 'Arial',
                color: '999999',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: url,
                size: 16,
                font: 'Consolas',
                color: '4A90D9',
              }),
            ],
          }),
        ];

        // Add page break if not the last page
        if (i < selectedOrders.length - 1) {
          paragraphs.push(
            new Paragraph({
              children: [new PageBreak()],
            }),
          );
        }

        sections.push(...paragraphs);
      }

      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 720,    // 0.5 inch
                  bottom: 720,
                  left: 720,
                  right: 720,
                },
              },
            },
            children: sections,
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const today = new Date().toISOString().slice(0, 10);
      saveAs(blob, `QR_DonHang_${today}.docx`);
    } catch (error) {
      console.error('Export QR error:', error);
      alert('Lỗi khi xuất file QR. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={selectedOrders.length === 0 || exporting}
      className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors shadow-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {exporting ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <QrCode className="w-5 h-5" />
      )}
      {exporting
        ? 'Đang xuất...'
        : selectedOrders.length > 0
          ? `Xuất QR (${selectedOrders.length})`
          : 'Xuất QR'}
    </button>
  );
}
