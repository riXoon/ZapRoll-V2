import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Alert, Platform } from 'react-native';
import { LOGO_BASE64 } from './logoBase64';

const sanitizeFileName = (name: string) => {
  return name.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
};

const escapeHtml = (unsafe: any) => {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const formatShortDate = (isoString: any) => {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return String(isoString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const getTimestamp = () => {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
};

export const exportToPDF = async (data: any[], eventName: string) => {
  try {
    // Sort dataset alphabetically by Section (primary) and Name (secondary)
    const sortedData = [...data].sort((a, b) => {
      const metadataA = a.metadata || a.registrations?.metadata || {};
      const metadataB = b.metadata || b.registrations?.metadata || {};
      
      const secA = (metadataA.section || metadataA.yearSection || 'N/A').trim();
      const secB = (metadataB.section || metadataB.yearSection || 'N/A').trim();
      
      const isNaA = secA.toLowerCase() === 'n/a' || secA === '';
      const isNaB = secB.toLowerCase() === 'n/a' || secB === '';
      
      if (isNaA && !isNaB) return 1;
      if (!isNaA && isNaB) return -1;
      
      const compSec = secA.localeCompare(secB, undefined, { sensitivity: 'base', numeric: true });
      if (compSec !== 0) return compSec;
      
      const nameA = (a.full_name || a.registrations?.full_name || 'Anonymous').trim();
      const nameB = (b.full_name || b.registrations?.full_name || 'Anonymous').trim();
      
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });

    // Chunk dataset to prevent WebView layout memory exhaustion on Android
    const CHUNK_SIZE = 18;
    const chunks: any[][] = [];
    for (let i = 0; i < sortedData.length; i += CHUNK_SIZE) {
      chunks.push(sortedData.slice(i, i + CHUNK_SIZE));
    }

    const html = `
      <html>
        <head>
          <style>
            @page { size: 8.5in 13in landscape; margin: 10mm; }
            body { 
              font-family: 'Helvetica', sans-serif; 
              padding: 0; 
              color: #1e293b; 
              margin: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page-container { page-break-after: always; box-sizing: border-box; }
            .page-container:last-child { page-break-after: avoid; }
            .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px; }
            .logo-section { display: flex; align-items: center; }
            .logo { 
              width: 50px; 
              height: 50px; 
              margin-right: 12px;
              background-image: url('${LOGO_BASE64}');
              background-size: contain;
              background-repeat: no-repeat;
              background-position: center;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header-text { text-align: left; }
            h1 { color: #0f172a; margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px; }
            h2 { color: #64748b; margin: 4px 0 0 0; font-size: 12px; font-weight: normal; }
            .page-number { font-size: 10px; color: #94a3b8; font-weight: 500; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
            th { background-color: #f8fafc; color: #475569; padding: 8px 10px; text-align: left; border-bottom: 2px solid #e2e8f0; font-size: 11px; text-transform: uppercase; word-break: break-all; }
            td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; word-break: break-all; }
            .footer { margin-top: 25px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          ${chunks.map((chunk, chunkIndex) => {
            const isLast = chunkIndex === chunks.length - 1;
            return `
              <div class="page-container">
                <div class="header-container">
                  <div class="logo-section">
                    <div class="logo"></div>
                    <div class="header-text">
                      <h1>Certificate Whitelist</h1>
                      <h2>Event: ${escapeHtml(eventName)}</h2>
                    </div>
                  </div>
                  <div class="page-number">
                    Page ${chunkIndex + 1} of ${chunks.length}
                  </div>
                </div>
                <table>
                  <colgroup>
                    <col style="width: 22%">
                    <col style="width: 25%">
                    <col style="width: 13%">
                    <col style="width: 8%">
                    <col style="width: 8%">
                    <col style="width: 12%">
                    <col style="width: 12%">
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Student ID</th>
                      <th>Year</th>
                      <th>Section</th>
                      <th>AM Submitted</th>
                      <th>PM Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${chunk.map(item => {
                      const fullName = item.full_name || item.registrations?.full_name || 'Anonymous';
                      const email = item.email || item.registrations?.email || '-';
                      const studentId = item.external_id || item.registrations?.external_id || '-';
                      const metadata = item.metadata || item.registrations?.metadata || {};
                      const year = metadata.year || metadata.yearLevel || 'N/A';
                      const section = metadata.section || metadata.yearSection || 'N/A';
                      const amTime = item.am_eval_submitted_at ? formatShortDate(item.am_eval_submitted_at) : '-';
                      const pmTime = item.pm_eval_submitted_at ? formatShortDate(item.pm_eval_submitted_at) : '-';
                      
                      return `
                        <tr>
                          <td>${escapeHtml(fullName)}</td>
                          <td>${escapeHtml(email)}</td>
                          <td>${escapeHtml(studentId)}</td>
                          <td>${escapeHtml(year)}</td>
                          <td>${escapeHtml(section)}</td>
                          <td>${escapeHtml(amTime)}</td>
                          <td>${escapeHtml(pmTime)}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
                ${isLast ? `
                  <div class="footer">
                    Generated by ZapRoll, Developed by Adrian Frivaldo & Erickson Guhilde on ${new Date().toLocaleString()}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    const fileName = `${sanitizeFileName(eventName)}_Whitelist_${getTimestamp()}.pdf`;

    if (Platform.OS === 'android') {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          'application/pdf'
        );
        await FileSystem.writeAsStringAsync(createdFileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        return true;
      }
    }

    // Fallback/iOS
    const newUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.moveAsync({ from: uri, to: newUri });
    await Sharing.shareAsync(newUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Download Whitelist PDF',
      UTI: 'com.adobe.pdf'
    });
    return true;
  } catch (error) {
    console.error('PDF Export Error:', error);
    throw error;
  }
};

export const exportToExcel = async (data: any[], eventName: string) => {
  try {
    // Sort dataset alphabetically by Section (primary) and Name (secondary)
    const sortedData = [...data].sort((a, b) => {
      const metadataA = a.metadata || a.registrations?.metadata || {};
      const metadataB = b.metadata || b.registrations?.metadata || {};
      
      const secA = (metadataA.section || metadataA.yearSection || 'N/A').trim();
      const secB = (metadataB.section || metadataB.yearSection || 'N/A').trim();
      
      const isNaA = secA.toLowerCase() === 'n/a' || secA === '';
      const isNaB = secB.toLowerCase() === 'n/a' || secB === '';
      
      if (isNaA && !isNaB) return 1;
      if (!isNaA && isNaB) return -1;
      
      const compSec = secA.localeCompare(secB, undefined, { sensitivity: 'base', numeric: true });
      if (compSec !== 0) return compSec;
      
      const nameA = (a.full_name || a.registrations?.full_name || 'Anonymous').trim();
      const nameB = (b.full_name || b.registrations?.full_name || 'Anonymous').trim();
      
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });

    const headers = ['Full Name', 'Email', 'Student ID', 'Year', 'Section', 'AM Submitted At', 'PM Submitted At'];
    const rows = sortedData.map(item => {
      const metadata = item.metadata || item.registrations?.metadata || {};
      return [
        item.full_name || item.registrations?.full_name || 'Anonymous',
        item.email || item.registrations?.email || '-',
        item.external_id || item.registrations?.external_id || '-',
        metadata.year || metadata.yearLevel || 'N/A',
        metadata.section || metadata.yearSection || 'N/A',
        item.am_eval_submitted_at || '-',
        item.pm_eval_submitted_at || '-'
      ];
    });

    const excelContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Whitelist</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
      <body>
        <table border="1">
          <thead>
            <tr style="background-color: #f1f5f9;">
              ${headers.map(h => `<th style="font-weight: bold; padding: 5px;">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map(cell => `<td style="padding: 5px;">${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const fileName = `${sanitizeFileName(eventName)}_Whitelist_${getTimestamp()}.xls`;
    const tempUri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(tempUri, excelContent, { encoding: FileSystem.EncodingType.UTF8 });

    if (Platform.OS === 'android') {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          'application/vnd.ms-excel'
        );
        await FileSystem.writeAsStringAsync(createdFileUri, excelContent, { encoding: FileSystem.EncodingType.UTF8 });
        return true;
      }
    }

    // Fallback/iOS
    const newUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.moveAsync({ from: tempUri, to: newUri });
    await Sharing.shareAsync(newUri, {
      mimeType: 'application/vnd.ms-excel',
      dialogTitle: 'Download Whitelist Excel'
    });
    return true;
  } catch (error) {
    console.error('Excel Export Error:', error);
    throw error;
  }
};

export const exportRegistryToPDF = async (data: any[], eventName: string, activeTab: string) => {
  try {
    // Chunk dataset to prevent WebView layout memory exhaustion on Android
    const CHUNK_SIZE = 28;
    const chunks: any[][] = [];
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      chunks.push(data.slice(i, i + CHUNK_SIZE));
    }

    const html = `
      <html>
        <head>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            body { 
              font-family: 'Helvetica', sans-serif; 
              padding: 0; 
              color: #1e293b; 
              margin: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page-container { page-break-after: always; box-sizing: border-box; }
            .page-container:last-child { page-break-after: avoid; }
            .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px; }
            .logo-section { display: flex; align-items: center; }
            .logo { 
              width: 50px; 
              height: 50px; 
              margin-right: 12px;
              background-image: url('${LOGO_BASE64}');
              background-size: contain;
              background-repeat: no-repeat;
              background-position: center;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header-text { text-align: left; }
            h1 { color: #0f172a; margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px; }
            h2 { color: #64748b; margin: 4px 0 0 0; font-size: 12px; font-weight: normal; }
            .page-number { font-size: 10px; color: #94a3b8; font-weight: 500; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
            th { background-color: #f8fafc; color: #475569; padding: 6px 8px; text-align: left; border-bottom: 2px solid #e2e8f0; font-size: 10px; text-transform: uppercase; word-break: break-all; }
            td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; word-break: break-all; }
            .footer { margin-top: 25px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            .status { font-weight: bold; }
            .status-in { color: #10b981; }
            .status-pending { color: #f59e0b; }
          </style>
        </head>
        <body>
          ${chunks.map((chunk, chunkIndex) => {
            const isLast = chunkIndex === chunks.length - 1;
            return `
              <div class="page-container">
                <div class="header-container">
                  <div class="logo-section">
                    <div class="logo"></div>
                    <div class="header-text">
                      <h1>Participant Registry</h1>
                      <h2>Event: ${escapeHtml(eventName)} | Category: ${escapeHtml(activeTab)}</h2>
                    </div>
                  </div>
                  <div class="page-number">
                    Page ${chunkIndex + 1} of ${chunks.length}
                  </div>
                </div>
                <table>
                  <colgroup>
                    <col style="width: 25%">
                    <col style="width: 15%">
                    <col style="width: 12%">
                    <col style="width: 12%">
                    <col style="width: 20%">
                    <col style="width: 16%">
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Role</th>
                      <th>Year</th>
                      <th>Section</th>
                      <th>ID / Dept</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${chunk.map(item => `
                      <tr>
                        <td>${escapeHtml(item.full_name)}</td>
                        <td>${escapeHtml(item.role)}</td>
                        <td>${escapeHtml(item.year)}</td>
                        <td>${escapeHtml(item.section)}</td>
                        <td>${escapeHtml(item.extraInfo)}</td>
                        <td class="status status-${item.status?.toLowerCase() || 'pending'}">${escapeHtml(item.status || 'Pending')}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                ${isLast ? `
                  <div class="footer">
                    Generated by ZapRoll, Developed by Adrian Frivaldo & Erickson Guhilde on ${new Date().toLocaleString()}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    const fileName = `${sanitizeFileName(eventName)}_${activeTab}_Registry_${getTimestamp()}.pdf`;

    if (Platform.OS === 'android') {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          'application/pdf'
        );
        await FileSystem.writeAsStringAsync(createdFileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        return true; // Indicate direct download success
      }
    }

    // Fallback/iOS
    const newUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.moveAsync({ from: uri, to: newUri });
    await Sharing.shareAsync(newUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Download Registry PDF',
      UTI: 'com.adobe.pdf'
    });
    return true;
  } catch (error) {
    console.error('PDF Export Error:', error);
    throw error;
  }
};

export const exportRegistryToExcel = async (data: any[], eventName: string, activeTab: string) => {
  try {
    const headers = ['Full Name', 'Email', 'Role', 'Year', 'Section', 'ID / Dept', 'Status'];
    const rows = data.map(item => [
      item.full_name,
      item.email || '-',
      item.role,
      item.year,
      item.section,
      item.extraInfo,
      item.status
    ]);

    // Generate HTML-based Excel content for perfect cell alignment
    const excelContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Registry</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
      <body>
        <table border="1">
          <thead>
            <tr style="background-color: #f1f5f9;">
              ${headers.map(h => `<th style="font-weight: bold; padding: 5px;">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map(cell => `<td style="padding: 5px;">${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const fileName = `${sanitizeFileName(eventName)}_${activeTab}_Registry_${getTimestamp()}.xls`;
    const tempUri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(tempUri, excelContent, { encoding: FileSystem.EncodingType.UTF8 });

    if (Platform.OS === 'android') {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          'application/vnd.ms-excel'
        );
        await FileSystem.writeAsStringAsync(createdFileUri, excelContent, { encoding: FileSystem.EncodingType.UTF8 });
        return true;
      }
    }

    // Fallback/iOS
    const newUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.moveAsync({ from: tempUri, to: newUri });
    await Sharing.shareAsync(newUri, {
      mimeType: 'application/vnd.ms-excel',
      dialogTitle: 'Download Registry Excel'
    });
    return true;
  } catch (error) {
    console.error('Excel Export Error:', error);
    throw error;
  }
};
export const exportPosterClearanceToPDF = async (data: any[], eventName: string) => {
  try {
    // Chunk dataset to prevent WebView layout memory exhaustion on Android
    const CHUNK_SIZE = 16;
    const chunks: any[][] = [];
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      chunks.push(data.slice(i, i + CHUNK_SIZE));
    }

    const html = `
      <html>
        <head>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { 
              font-family: 'Helvetica', sans-serif; 
              padding: 0; 
              color: #1e293b; 
              margin: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .page-container { page-break-after: always; box-sizing: border-box; }
            .page-container:last-child { page-break-after: avoid; }
            .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px; }
            .logo-section { display: flex; align-items: center; }
            .logo { 
              width: 50px; 
              height: 50px; 
              margin-right: 12px;
              background-image: url('${LOGO_BASE64}');
              background-size: contain;
              background-repeat: no-repeat;
              background-position: center;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header-text { text-align: left; }
            h1 { color: #0f172a; margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 0.5px; }
            h2 { color: #64748b; margin: 4px 0 0 0; font-size: 12px; font-weight: normal; }
            .page-number { font-size: 10px; color: #94a3b8; font-weight: 500; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
            th { background-color: #f8fafc; color: #475569; padding: 6px 8px; text-align: left; border-bottom: 2px solid #e2e8f0; font-size: 10px; text-transform: uppercase; word-break: break-all; }
            td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; word-break: break-all; }
            .footer { margin-top: 25px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          ${chunks.map((chunk, chunkIndex) => {
            const isLast = chunkIndex === chunks.length - 1;
            return `
              <div class="page-container">
                <div class="header-container">
                  <div class="logo-section">
                    <div class="logo"></div>
                    <div class="header-text">
                      <h1>Poster Clearance Whitelist</h1>
                      <h2>Event: ${escapeHtml(eventName)}</h2>
                    </div>
                  </div>
                  <div class="page-number">
                    Page ${chunkIndex + 1} of ${chunks.length}
                  </div>
                </div>
                <table>
                  <colgroup>
                    <col style="width: 18%">
                    <col style="width: 12%">
                    <col style="width: 10%">
                    <col style="width: 8%">
                    <col style="width: 32%">
                    <col style="width: 10%">
                    <col style="width: 10%">
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Student ID</th>
                      <th>Section</th>
                      <th>Group</th>
                      <th>Capstone Title</th>
                      <th>Time In</th>
                      <th>Time Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${chunk.map(item => {
                      const fullName = item.full_name || 'Anonymous';
                      const studentId = item.external_id || '-';
                      const metadata = item.metadata || {};
                      const section = metadata.section || metadata.yearSection || 'N/A';
                      const group = metadata.groupNumber || 'N/A';
                      const capstone = metadata.capstoneTitle || 'N/A';
                      
                      return `
                        <tr>
                          <td>${escapeHtml(fullName)}</td>
                          <td>${escapeHtml(studentId)}</td>
                          <td>${escapeHtml(section)}</td>
                          <td>${escapeHtml(group)}</td>
                          <td>${escapeHtml(capstone)}</td>
                          <td>${escapeHtml(formatShortDate(item.poster_scanned_at))}</td>
                          <td>${escapeHtml(formatShortDate(item.poster_out_at))}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
                ${isLast ? `
                  <div class="footer">
                    Generated by ZapRoll, Developed by Adrian Frivaldo & Erickson Guhilde on ${new Date().toLocaleString()}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </tbody>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });
    const fileName = `${sanitizeFileName(eventName)}_Poster_Clearance_${getTimestamp()}.pdf`;

    if (Platform.OS === 'android') {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          'application/pdf'
        );
        await FileSystem.writeAsStringAsync(createdFileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        return true;
      }
    }

    const newUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.moveAsync({ from: uri, to: newUri });
    await Sharing.shareAsync(newUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Download Poster Clearance PDF',
      UTI: 'com.adobe.pdf'
    });
    return true;
  } catch (error) {
    console.error('Poster PDF Export Error:', error);
    throw error;
  }
};

export const exportPosterClearanceToExcel = async (data: any[], eventName: string) => {
  try {
    const headers = ['Full Name', 'Student ID', 'Section', 'Group Number', 'Capstone Title', 'Time In', 'Time Out'];
    const rows = data.map(item => {
      const metadata = item.metadata || {};
      return [
        item.full_name || 'Anonymous',
        item.external_id || '-',
        metadata.section || metadata.yearSection || 'N/A',
        metadata.groupNumber || 'N/A',
        metadata.capstoneTitle || 'N/A',
        item.poster_scanned_at || '-',
        item.poster_out_at || '-'
      ];
    });

    const excelContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>PosterClearance</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
      <body>
        <table border="1">
          <thead>
            <tr style="background-color: #f1f5f9;">
              ${headers.map(h => `<th style="font-weight: bold; padding: 5px;">${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${row.map(cell => `<td style="padding: 5px;">${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const fileName = `${sanitizeFileName(eventName)}_Poster_Clearance_${getTimestamp()}.xls`;
    const tempUri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(tempUri, excelContent, { encoding: FileSystem.EncodingType.UTF8 });

    if (Platform.OS === 'android') {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        const createdFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          'application/vnd.ms-excel'
        );
        await FileSystem.writeAsStringAsync(createdFileUri, excelContent, { encoding: FileSystem.EncodingType.UTF8 });
        return true;
      }
    }

    const newUri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.moveAsync({ from: tempUri, to: newUri });
    await Sharing.shareAsync(newUri, {
      mimeType: 'application/vnd.ms-excel',
      dialogTitle: 'Download Poster Clearance Excel'
    });
    return true;
  } catch (error) {
    console.error('Poster Excel Export Error:', error);
    throw error;
  }
};
