import { executeQuery, executeStoredProcedure } from '../config/database';
import sql from 'mssql';

// Interface for file statistics results
interface FileStatsResult {
  totalFiles: number;
  totalSize: number;
}

export interface PRFFile {
  FileID: number;
  PRFID: number;
  OriginalFileName: string;
  FilePath: string;
  SharedPath?: string;
  FileSize: number;
  FileType: string;
  MimeType: string;
  UploadDate: Date;
  UploadedBy: number;
  IsOriginalDocument: boolean;
  Description?: string;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface CreatePRFFileRequest {
  PRFID: number;
  OriginalFileName: string;
  FilePath: string;
  SharedPath?: string;
  FileSize: number;
  FileType: string;
  MimeType: string;
  UploadedBy: number;
  IsOriginalDocument?: boolean;
  Description?: string;
}

export class PRFFilesModel {
  /**
   * Create a new PRF file record
   */
  static async create(fileData: CreatePRFFileRequest): Promise<PRFFile> {
    const result = await executeQuery<PRFFile>(`
      INSERT INTO PRFFiles (
        PRFID, OriginalFileName, FilePath, SharedPath, FileSize, 
        FileType, MimeType, UploadedBy, IsOriginalDocument, Description
      )
      OUTPUT INSERTED.*
      VALUES (
        @PRFID, @OriginalFileName, @FilePath, @SharedPath, @FileSize,
        @FileType, @MimeType, @UploadedBy, @IsOriginalDocument, @Description
      )
    `, {
      PRFID: fileData.PRFID,
      OriginalFileName: fileData.OriginalFileName,
      FilePath: fileData.FilePath,
      SharedPath: fileData.SharedPath || null,
      FileSize: fileData.FileSize,
      FileType: fileData.FileType,
      MimeType: fileData.MimeType,
      UploadedBy: fileData.UploadedBy,
      IsOriginalDocument: fileData.IsOriginalDocument || false,
      Description: fileData.Description || null
    });
    
    return result.recordset[0] as PRFFile;
  }

  /**
   * Get all files for a specific PRF
   */
  static async getByPRFID(prfId: number): Promise<PRFFile[]> {
    const result = await executeQuery<PRFFile>(`
      SELECT * FROM PRFFiles 
      WHERE PRFID = @PRFID 
      ORDER BY UploadDate DESC
    `, {
      PRFID: prfId
    });
    
    return result.recordset as PRFFile[];
  }

  /**
   * Get a specific file by ID
   */
  static async getById(fileId: number): Promise<PRFFile | null> {
    const result = await executeQuery<PRFFile>(`
      SELECT * FROM PRFFiles 
      WHERE FileID = @FileID
    `, {
      FileID: fileId
    });
    
    return result.recordset[0] as PRFFile || null;
  }

  /**
   * Update shared path for a file
   */
  static async updateSharedPath(fileId: number, sharedPath: string): Promise<boolean> {
    const result = await executeQuery(`
      UPDATE PRFFiles 
      SET SharedPath = @SharedPath, UpdatedAt = GETDATE()
      WHERE FileID = @FileID
    `, {
      FileID: fileId,
      SharedPath: sharedPath
    });
    
    return result.rowsAffected[0] > 0;
  }

  /**
   * Delete a file record
   */
  static async delete(fileId: number): Promise<boolean> {
    const result = await executeQuery(`
      DELETE FROM PRFFiles 
      WHERE FileID = @FileID
    `, {
      FileID: fileId
    });
    
    return result.rowsAffected[0] > 0;
  }

  /**
   * Get files by type
   */
  static async getByFileType(fileType: string): Promise<PRFFile[]> {
    const result = await executeQuery<PRFFile>(`
      SELECT * FROM PRFFiles 
      WHERE FileType = @FileType 
      ORDER BY UploadDate DESC
    `, {
      FileType: fileType
    });
    
    return result.recordset as PRFFile[];
  }

  /**
   * Get original documents (OCR source files)
   */
  static async getOriginalDocuments(prfId?: number): Promise<PRFFile[]> {
    let query = `
      SELECT * FROM PRFFiles 
      WHERE IsOriginalDocument = 1
    `;
    
    const params: { [key: string]: unknown } = {};
    
    if (prfId) {
      params.PRFID = prfId;
      query += ` AND PRFID = @PRFID`;
    }
    
    query += ` ORDER BY UploadDate DESC`;
    
    const result = await executeQuery<PRFFile>(query, params);
    return result.recordset as PRFFile[];
  }

  /**
   * Get file statistics
   */
  static async getFileStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByType: { fileType: string; count: number; totalSize: number }[];
  }> {
    const totalResult = await executeQuery(`
      SELECT 
        COUNT(*) as totalFiles,
        SUM(FileSize) as totalSize
      FROM PRFFiles
    `);
    
    const typeResult = await executeQuery(`
      SELECT 
        FileType,
        COUNT(*) as count,
        SUM(FileSize) as totalSize
      FROM PRFFiles
      GROUP BY FileType
      ORDER BY count DESC
    `);
    
    return {
      totalFiles: (totalResult.recordset[0] as FileStatsResult).totalFiles,
      totalSize: (totalResult.recordset[0] as FileStatsResult).totalSize || 0,
      filesByType: typeResult.recordset as { fileType: string; count: number; totalSize: number }[]
    };
  }
}