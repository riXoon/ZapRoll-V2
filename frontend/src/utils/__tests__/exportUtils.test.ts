import { exportToPDF, exportToExcel, exportRegistryToPDF, exportRegistryToExcel, exportPosterClearanceToPDF, exportPosterClearanceToExcel } from '../exportUtils';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// Mock Expo Modules
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn().mockResolvedValue({ uri: 'file://mock/document.pdf' }),
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file://mock/document/',
  cacheDirectory: 'file://mock/cache/',
  moveAsync: jest.fn().mockResolvedValue(true),
  writeAsStringAsync: jest.fn().mockResolvedValue(true),
  readAsStringAsync: jest.fn().mockResolvedValue('base64string'),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
    createFileAsync: jest.fn().mockResolvedValue('file://mock/saf/document.pdf'),
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Alert: { alert: jest.fn() },
}));

describe('exportUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exportToPDF', () => {
    it('should export valid data to PDF successfully (Happy Path)', async () => {
      const mockData = [
        {
          full_name: 'John Doe',
          email: 'john@example.com',
          external_id: '12345',
          metadata: { year: '4', section: 'A' },
          am_eval_submitted_at: '2026-05-17T10:00:00Z',
          pm_eval_submitted_at: '2026-05-17T15:00:00Z',
        },
      ];

      const result = await exportToPDF(mockData, 'Test Event');

      expect(Print.printToFileAsync).toHaveBeenCalled();
      expect(FileSystem.moveAsync).toHaveBeenCalled();
      expect(Sharing.shareAsync).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle anonymous users and missing metadata gracefully', async () => {
      const mockData = [
        {
          // Missing full_name, email, external_id, metadata
        },
      ];

      const result = await exportToPDF(mockData, 'Test Event');

      // It shouldn't crash
      expect(Print.printToFileAsync).toHaveBeenCalled();
      
      // Look into the HTML passed to printToFileAsync to ensure fallbacks were used
      const printArgs = (Print.printToFileAsync as jest.Mock).mock.calls[0][0];
      expect(printArgs.html).toContain('Anonymous');
      expect(printArgs.html).toContain('N/A');
      
      expect(result).toBe(true);
    });

    it('should sanitize file names with special characters', async () => {
      const mockData = [{ full_name: 'Test' }];
      await exportToPDF(mockData, 'My Event! / @#$');

      const moveArgs = (FileSystem.moveAsync as jest.Mock).mock.calls[0][0];
      // File name should have special characters replaced with underscores, and multiple underscores collapsed
      expect(moveArgs.to).toMatch(/My_Event__Whitelist_.*\.pdf/);
    });

    it('should sort the export data alphabetically by Section (primary) and Name (secondary) automatically', async () => {
      const mockData = [
        {
          full_name: 'Charlie Brown',
          email: 'charlie@example.com',
          external_id: '33333',
          metadata: { year: '4', section: 'B' },
        },
        {
          full_name: 'Alice Green',
          email: 'alice@example.com',
          external_id: '11111',
          metadata: { year: '4', section: 'A' },
        },
        {
          full_name: 'Bob Blue',
          email: 'bob@example.com',
          external_id: '22222',
          metadata: { year: '4', section: 'B' },
        },
        {
          full_name: 'Zoe Yellow',
          email: 'zoe@example.com',
          external_id: '44444',
          metadata: { year: '4', section: 'A' },
        },
      ];

      const result = await exportToPDF(mockData, 'Sorting Event');
      expect(result).toBe(true);

      const printArgs = (Print.printToFileAsync as jest.Mock).mock.calls[0][0];
      const htmlContent = printArgs.html;

      const nameIndices = [
        htmlContent.indexOf('Alice Green'),
        htmlContent.indexOf('Zoe Yellow'),
        htmlContent.indexOf('Bob Blue'),
        htmlContent.indexOf('Charlie Brown')
      ];

      expect(nameIndices[0]).toBeLessThan(nameIndices[1]);
      expect(nameIndices[1]).toBeLessThan(nameIndices[2]);
      expect(nameIndices[2]).toBeLessThan(nameIndices[3]);
    });
  });

  describe('exportPosterClearanceToPDF', () => {
    it('should correctly format poster clearance PDF with specific columns', async () => {
      const mockData = [
        {
          full_name: 'Jane Smith',
          external_id: '67890',
          metadata: { section: 'B', groupNumber: '5', capstoneTitle: 'AI System' },
          poster_scanned_at: '2026-05-17T09:00:00Z',
          poster_out_at: '2026-05-17T12:00:00Z',
        },
      ];

      const result = await exportPosterClearanceToPDF(mockData, 'Tech Fair');

      expect(result).toBe(true);
      const printArgs = (Print.printToFileAsync as jest.Mock).mock.calls[0][0];
      
      // Verify specific columns are rendered
      expect(printArgs.html).toContain('Jane Smith');
      expect(printArgs.html).toContain('67890');
      expect(printArgs.html).toContain('AI System');
      expect(printArgs.html).toContain('Group');
    });
  });

  describe('exportToExcel', () => {
    it('should correctly build an Excel HTML document and share it', async () => {
      const mockData = [
        {
          full_name: 'Excel User',
          email: 'excel@example.com',
          external_id: '11111',
          metadata: { yearLevel: '3', yearSection: 'C' },
          am_eval_submitted_at: '2026-05-17T08:00:00Z',
        },
      ];

      const result = await exportToExcel(mockData, 'Data Export Event');

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
      expect(FileSystem.moveAsync).toHaveBeenCalled();
      expect(Sharing.shareAsync).toHaveBeenCalled();
      expect(result).toBe(true);

      const writeArgs = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0][1];
      expect(writeArgs).toContain('Excel User');
      expect(writeArgs).toContain('excel@example.com');
      // Validate that legacy metadata keys correctly resolve
      expect(writeArgs).toContain('3');
      expect(writeArgs).toContain('C');
    });

    it('should sort the export data alphabetically by Section (primary) and Name (secondary) automatically', async () => {
      const mockData = [
        {
          full_name: 'Charlie Brown',
          email: 'charlie@example.com',
          external_id: '33333',
          metadata: { year: '4', section: 'B' },
        },
        {
          full_name: 'Alice Green',
          email: 'alice@example.com',
          external_id: '11111',
          metadata: { year: '4', section: 'A' },
        },
        {
          full_name: 'Bob Blue',
          email: 'bob@example.com',
          external_id: '22222',
          metadata: { year: '4', section: 'B' },
        },
        {
          full_name: 'Zoe Yellow',
          email: 'zoe@example.com',
          external_id: '44444',
          metadata: { year: '4', section: 'A' },
        },
      ];

      const result = await exportToExcel(mockData, 'Sorting Event');
      expect(result).toBe(true);

      const writeArgs = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls[0][1];

      const nameIndices = [
        writeArgs.indexOf('Alice Green'),
        writeArgs.indexOf('Zoe Yellow'),
        writeArgs.indexOf('Bob Blue'),
        writeArgs.indexOf('Charlie Brown')
      ];

      expect(nameIndices[0]).toBeLessThan(nameIndices[1]);
      expect(nameIndices[1]).toBeLessThan(nameIndices[2]);
      expect(nameIndices[2]).toBeLessThan(nameIndices[3]);
    });
  });

  describe('Android StorageAccessFramework behavior', () => {
    beforeAll(() => {
      Platform.OS = 'android';
    });

    afterAll(() => {
      Platform.OS = 'ios'; // Reset for other tests
    });

    it('should use SAF if permissions are granted', async () => {
      // Mock SAF granting permission
      (FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        granted: true,
        directoryUri: 'content://mock.tree/',
      });

      const mockData = [{ full_name: 'Android User' }];
      const result = await exportToPDF(mockData, 'Android Event');

      expect(FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync).toHaveBeenCalled();
      expect(FileSystem.StorageAccessFramework.createFileAsync).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('Performance and Large Datasets', () => {
    it('should handle exporting 5000 records to PDF without crashing', async () => {
      // Generate 5000 mock records
      const largeDataset = Array.from({ length: 5000 }, (_, i) => ({
        full_name: `User ${i}`,
        email: `user${i}@example.com`,
        external_id: `ID-${10000 + i}`,
        metadata: { year: '3', section: 'B' },
        am_eval_submitted_at: '2026-05-17T10:00:00Z',
        pm_eval_submitted_at: '2026-05-17T15:00:00Z',
      }));

      const startTime = performance.now();
      const result = await exportToPDF(largeDataset, 'Large Event PDF');
      const endTime = performance.now();

      expect(result).toBe(true);
      expect(Print.printToFileAsync).toHaveBeenCalled();
      
      const executionTimeMs = endTime - startTime;
      console.log(`Exported 5000 records to PDF in ${executionTimeMs.toFixed(2)}ms`);
      
      // Ensure it completes within a reasonable threshold (e.g., 5 seconds in Node env)
      expect(executionTimeMs).toBeLessThan(5000);
    });

    it('should handle exporting 5000 records to Excel without crashing', async () => {
      // Generate 5000 mock records
      const largeDataset = Array.from({ length: 5000 }, (_, i) => ({
        full_name: `User ${i}`,
        email: `user${i}@example.com`,
        external_id: `ID-${10000 + i}`,
        metadata: { year: '3', section: 'B' },
      }));

      const startTime = performance.now();
      const result = await exportToExcel(largeDataset, 'Large Event Excel');
      const endTime = performance.now();

      expect(result).toBe(true);
      expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();

      const executionTimeMs = endTime - startTime;
      console.log(`Exported 5000 records to Excel in ${executionTimeMs.toFixed(2)}ms`);
      
      // Excel string concatenation should be very fast
      expect(executionTimeMs).toBeLessThan(2000);
    });
  });
});
