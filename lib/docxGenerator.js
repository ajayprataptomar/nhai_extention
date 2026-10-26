/**
 * NHAI Compliance Letter - Native DOCX Generator
 * Produces authentic Microsoft Word (.docx) files matching Draft letter (1).docx
 * Features:
 *  - 4.5 inch top margin for official pre-printed letterhead paper
 *  - Embedded high-res QR code PNG pointing to cloud spreadsheet
 *  - Native Trebuchet MS 10pt styling & borderless circular PIU table
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.generateComplianceLetterDocx = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const BASE_DOCX_BASE64 = "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";

  function xmlEscape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function getQrCodePngBase64(text) {
    if (typeof qrcode === 'undefined') {
      return null;
    }
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const scale = 5;
    const margin = 20;
    const canvas = document.createElement('canvas');
    canvas.width = count * scale + margin * 2;
    canvas.height = count * scale + margin * 2;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(c * scale + margin, r * scale + margin, scale, scale);
        }
      }
    }
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1];
  }

  function buildDocumentXml(data) {
    const {
      letterRef = 'NHAI/RO-KOL/001/2026/3(A)-Dashcam/',
      letterMonth = 'Sept 2026',
      dispatchMode = 'single',
      piu = 'Kolkata',
      projectName = 'Kolaghat Haldia Project',
      stretchDetails = '4L Kolaghat-Haldia from km. 0.00 to km. 53.72 including ROB cum Flyover from km. 52.08 to km. 53.472 (New_NH-116)',
      surveyDate = '31 Aug 2026',
      excelSheetUrl = 'https://docs.google.com/spreadsheets/d/12vaeZwtpi5psV5ajoIzVECPYvBkKbwye/edit'
    } = data;

    const fontDef = '<w:rPr><w:rFonts w:ascii="Trebuchet MS" w:hAnsi="Trebuchet MS"/><w:sz w:val="20"/></w:rPr>';
    const fontDefBold = '<w:rPr><w:rFonts w:ascii="Trebuchet MS" w:hAnsi="Trebuchet MS"/><w:b/><w:sz w:val="20"/></w:rPr>';

    let recipientXml = '';
    const normPiu = String(piu || '').toUpperCase();

    if (dispatchMode === 'all') {
      recipientXml = `
        <w:p><w:pPr><w:spacing w:before="60" w:after="40"/></w:pPr><w:r>${fontDef}<w:t>To</w:t></w:r></w:p>
        <w:tbl>
          <w:tblPr>
            <w:tblW w:w="9072" w:type="dxa"/>
            <w:tblInd w:w="675" w:type="dxa"/>
            <w:tblBorders>
              <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/><w:insideH w:val="none"/><w:insideV w:val="none"/>
            </w:tblBorders>
          </w:tblPr>
          <w:tblGrid>
            <w:gridCol w:w="3119"/><w:gridCol w:w="2835"/><w:gridCol w:w="3118"/>
          </w:tblGrid>
          <w:tr>
            <w:tc><w:tcPr><w:tcW w:w="3119" w:type="dxa"/></w:tcPr>
              <w:p><w:r>${fontDefBold}<w:t>Project Director</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>PIU-Kolkata, NHAI</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>Synthesis Business Park</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>8th Floor, Block-C</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>New Town, Kolkata – 700 156</w:t></w:r></w:p>
            </w:tc>
            <w:tc><w:tcPr><w:tcW w:w="2835" w:type="dxa"/></w:tcPr>
              <w:p><w:r>${fontDefBold}<w:t>Project Director</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>PIU- Malda, NHAI</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>1st Floor, New Setumore, Sahapur</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>P.O. Nageswarpur, Malda,Pin-732142</w:t></w:r></w:p>
            </w:tc>
            <w:tc><w:tcPr><w:tcW w:w="3118" w:type="dxa"/></w:tcPr>
              <w:p><w:r>${fontDefBold}<w:t>Project Director</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>PIU – Krishnagar, NHAI</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>P.O. &amp; Vill.:- Bhatjangla,</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>Dist - Nadia, Pin- 741102, West Bengal</w:t></w:r></w:p>
            </w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:tcPr><w:tcW w:w="3119" w:type="dxa"/></w:tcPr>
              <w:p><w:r>${fontDefBold}<w:t>Project Director</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>PIU – Jalpaiguri, NHAI, 2 ½ Mile,</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>Sevoke Road, Jyotinagar,</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>Near Don Bosco School,</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>Siliguri – 734 001</w:t></w:r></w:p>
            </w:tc>
            <w:tc><w:tcPr><w:tcW w:w="2835" w:type="dxa"/></w:tcPr>
              <w:p><w:r>${fontDefBold}<w:t>Project Director</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>PIU-Kharagpur, NHAI,</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>NHAI Complex near Chaurangi,</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>P.O. Inda, Kharagpur – 721305</w:t></w:r></w:p>
            </w:tc>
            <w:tc><w:tcPr><w:tcW w:w="3118" w:type="dxa"/></w:tcPr>
              <w:p><w:r>${fontDefBold}<w:t>Project Director</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>NHAI, PIU-Bardhaman,</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>P.O. – Palla Road, P.S. Memari,</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>Dist.- Purba Bardhaman-713151</w:t></w:r></w:p>
            </w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:tcPr><w:tcW w:w="3119" w:type="dxa"/></w:tcPr>
              <w:p><w:r>${fontDefBold}<w:t>Project Director</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>NHAI, PIU-Purulia</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>Module-31, 3rd Floor, Webel IT Park,</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>North Lake Road, Saheb Bandh,</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>Purulia – 723 101</w:t></w:r></w:p>
            </w:tc>
            <w:tc><w:tcPr><w:tcW w:w="2835" w:type="dxa"/></w:tcPr>
              <w:p><w:r>${fontDefBold}<w:t>Project Director</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>NHAI, PIU – Durgapur</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>NHAI Complex, Sector –2(A), Bidhannagar,</w:t></w:r></w:p>
              <w:p><w:r>${fontDef}<w:t>Durgapur – 713 212</w:t></w:r></w:p>
            </w:tc>
            <w:tc><w:tcPr><w:tcW w:w="3118" w:type="dxa"/></w:tcPr><w:p/></w:tc>
          </w:tr>
        </w:tbl>
      `;
    } else {
      let piuDetails = '';
      if (normPiu.includes('MALDA')) {
        piuDetails = '<w:p><w:r>' + fontDef + '<w:t>PIU – Malda</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>National Highways Authority of India</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>1st Floor, New Setumore, Sahapur</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>P.O. Nageswarpur, Malda, Pin-732142</w:t></w:r></w:p>';
      } else if (normPiu.includes('KRISHNAGAR')) {
        piuDetails = '<w:p><w:r>' + fontDef + '<w:t>PIU – Krishnagar</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>National Highways Authority of India</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>P.O. &amp; Vill.:- Bhatjangla, Dist - Nadia, Pin- 741102, West Bengal</w:t></w:r></w:p>';
      } else if (normPiu.includes('JALPAIGURI')) {
        piuDetails = '<w:p><w:r>' + fontDef + '<w:t>PIU – Jalpaiguri</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>National Highways Authority of India</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>2 ½ Mile, Sevoke Road, Jyotinagar, Near Don Bosco School, Siliguri – 734 001</w:t></w:r></w:p>';
      } else if (normPiu.includes('KHARAGPUR')) {
        piuDetails = '<w:p><w:r>' + fontDef + '<w:t>PIU – Kharagpur</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>National Highways Authority of India</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>NHAI Complex near Chaurangi, P.O. Inda, Kharagpur – 721305</w:t></w:r></w:p>';
      } else if (normPiu.includes('BARDHAMAN') || normPiu.includes('BURDWAN')) {
        piuDetails = '<w:p><w:r>' + fontDef + '<w:t>PIU – Bardhaman</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>National Highways Authority of India</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>P.O. – Palla Road, P.S. Memari, Dist.- Purba Bardhaman-713151</w:t></w:r></w:p>';
      } else if (normPiu.includes('PURULIA')) {
        piuDetails = '<w:p><w:r>' + fontDef + '<w:t>PIU – Purulia</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>National Highways Authority of India</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>Module-31, 3rd Floor, Webel IT Park, North Lake Road, Saheb Bandh, Purulia – 723 101</w:t></w:r></w:p>';
      } else if (normPiu.includes('DURGAPUR')) {
        piuDetails = '<w:p><w:r>' + fontDef + '<w:t>PIU – Durgapur</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>National Highways Authority of India</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>NHAI Complex, Sector –2(A), Bidhannagar, Durgapur – 713 212</w:t></w:r></w:p>';
      } else {
        piuDetails = '<w:p><w:r>' + fontDef + '<w:t>PIU – Kolkata</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>National Highways Authority of India</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>Synthesis Business Park, 8th Floor, Block-C</w:t></w:r></w:p><w:p><w:r>' + fontDef + '<w:t>New Town, Kolkata – 700 156</w:t></w:r></w:p>';
      }

      recipientXml = `
        <w:p><w:pPr><w:spacing w:before="60" w:after="20"/></w:pPr><w:r>${fontDef}<w:t>To</w:t></w:r></w:p>
        <w:p><w:pPr><w:spacing w:before="0" w:after="20"/></w:pPr><w:r>${fontDefBold}<w:t>Project Director</w:t></w:r></w:p>
        ${piuDetails}
      `;
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    <!-- Reference Number and Date Row (4.5 inch top margin leaves blank space for pre-printed letterhead) -->
    <w:p>
      <w:pPr>
        <w:spacing w:before="0" w:after="80"/>
        <w:tabs>
          <w:tab w:val="right" w:pos="10000"/>
        </w:tabs>
      </w:pPr>
      <w:r>${fontDef}<w:t xml:space="preserve">     ${xmlEscape(letterRef)}</w:t></w:r>
      <w:r><w:tab/><w:rPr><w:rFonts w:ascii="Trebuchet MS" w:hAnsi="Trebuchet MS"/><w:sz w:val="20"/></w:rPr><w:t>${xmlEscape(letterMonth)}</w:t></w:r>
    </w:p>

    <!-- MOST URGENT FLAG -->
    <w:p>
      <w:pPr>
        <w:spacing w:before="60" w:after="80"/>
        <w:ind w:left="4000"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Trebuchet MS" w:hAnsi="Trebuchet MS"/>
          <w:b/>
          <w:u w:val="single"/>
          <w:sz w:val="20"/>
        </w:rPr>
        <w:t>MOST URGENT</w:t>
      </w:r>
    </w:p>

    <!-- Recipient Block -->
    ${recipientXml}

    <!-- Subject Block -->
    <w:p>
      <w:pPr>
        <w:spacing w:before="120" w:after="80"/>
        <w:jc w:val="both"/>
      </w:pPr>
      <w:r>${fontDefBold}<w:t xml:space="preserve">Sub:    </w:t></w:r>
      <w:r>${fontDefBold}<w:t>Dashcam Analytics Services for the systematic weekly data collection through surveys and condition assessment of National Highway assets: Submission of Compliance Report against Dashcam Survey of ${xmlEscape(projectName)} – reg.</w:t></w:r>
    </w:p>

    <!-- Ref Block -->
    <w:p>
      <w:pPr>
        <w:spacing w:before="60" w:after="80"/>
      </w:pPr>
      <w:r>${fontDefBold}<w:t xml:space="preserve">Ref:    </w:t></w:r>
      <w:r>${fontDef}<w:t>Dash Cam Survey Report dated ${xmlEscape(surveyDate)}.</w:t></w:r>
    </w:p>

    <!-- Salutation -->
    <w:p>
      <w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>
      <w:r>${fontDef}<w:t>Sir,</w:t></w:r>
    </w:p>

    <!-- Paragraph 1 -->
    <w:p>
      <w:pPr>
        <w:spacing w:before="60" w:after="80" w:line="260" w:lineRule="auto"/>
        <w:jc w:val="both"/>
      </w:pPr>
      <w:r>${fontDef}<w:t>Please find enclosed herewith Dashcam Survey weekly Report dated ${xmlEscape(surveyDate)} against ${xmlEscape(stretchDetails)}. During Dashcam Survey numerous defects have been identified which needs immediate rectification. Dashcam Survey report dated ${xmlEscape(surveyDate)} is enclosed herewith.</w:t></w:r>
    </w:p>

    <!-- Paragraph 2 -->
    <w:p>
      <w:pPr>
        <w:spacing w:before="60" w:after="80" w:line="260" w:lineRule="auto"/>
        <w:jc w:val="both"/>
      </w:pPr>
      <w:r>${fontDef}<w:t>In this regard, it is requested to submit compliance Report against defects identified during weekly survey to this office at the earliest.</w:t></w:r>
    </w:p>

    <!-- Paragraph 3 -->
    <w:p>
      <w:pPr>
        <w:spacing w:before="60" w:after="100" w:line="260" w:lineRule="auto"/>
        <w:jc w:val="both"/>
      </w:pPr>
      <w:r>${fontDef}<w:t>This issues with the approval of CGM (T)/RO-Kolkata.</w:t></w:r>
    </w:p>

    <!-- Enclosure and Signature Row -->
    <w:p>
      <w:pPr>
        <w:spacing w:before="240" w:after="0"/>
        <w:tabs>
          <w:tab w:val="right" w:pos="10000"/>
        </w:tabs>
      </w:pPr>
      <w:r>${fontDefBold}<w:t xml:space="preserve">Encl:    </w:t></w:r>
      <w:r>${fontDef}<w:t>As stated above.</w:t></w:r>
      <w:r><w:tab/>${fontDef}<w:t>Yours faithfully,</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:before="0" w:after="0"/>
        <w:ind w:left="7200"/>
      </w:pPr>
      <w:r>${fontDefBold}<w:t>(Debasish Das)</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:before="0" w:after="0"/>
        <w:ind w:left="7200"/>
      </w:pPr>
      <w:r>${fontDef}<w:t>Dy. General Manager (Tech)</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:before="0" w:after="0"/>
        <w:ind w:left="7200"/>
      </w:pPr>
      <w:r>${fontDef}<w:t>Regional Office, Kolkata</w:t></w:r>
    </w:p>

    <!-- Page Setup: 4.0 inch (5760 dxa) top margin for pre-printed letterhead -->
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838" w:code="9"/>
      <w:pgMar w:top="5760" w:right="703" w:bottom="540" w:left="810" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  }

  async function generateComplianceLetterDocx(data) {
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip library is not loaded.');
    }

    const zip = await JSZip.loadAsync(BASE_DOCX_BASE64, { base64: true });

    // Ensure [Content_Types].xml supports PNG
    let ct = await zip.file('[Content_Types].xml').async('text');
    if (!ct.includes('Extension="png"')) {
      ct = ct.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
      zip.file('[Content_Types].xml', ct);
    }

    // Ensure document.xml.rels links rIdQrCode to media/qrcode.png
    let rels = await zip.file('word/_rels/document.xml.rels').async('text');
    if (!rels.includes('Id="rIdQrCode"')) {
      rels = rels.replace('</Relationships>', '<Relationship Id="rIdQrCode" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/qrcode.png"/></Relationships>');
      zip.file('word/_rels/document.xml.rels', rels);
    }

    // Generate high-resolution QR code PNG binary
    const qrPngBase64 = getQrCodePngBase64(data.excelSheetUrl || 'https://docs.google.com/spreadsheets/d/12vaeZwtpi5psV5ajoIzVECPYvBkKbwye/edit');
    if (qrPngBase64) {
      zip.file('word/media/qrcode.png', qrPngBase64, { base64: true });
    }

    // Inject dynamic document.xml
    const docXml = buildDocumentXml(data);
    zip.file('word/document.xml', docXml);

    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  }

  return generateComplianceLetterDocx;
});
