import { executeQuery } from '../config/database';

export type ApiKeyRole = 'admin' | 'doccon' | 'user';

export interface ApiKey {
  ApiKeyID: number;
  Name: string;
  KeyHash: string;
  Role: ApiKeyRole;
  IsActive: boolean;
  CreatedAt: Date;
  ExpiresAt: Date | null;
  CreatedBy: number | null;
  LastUsedAt: Date | null;
  AllowedIPs: string | null;
}

export class ApiKeyModel {
  static async findActiveByHash(hash: string): Promise<ApiKey | null> {
    const res = await executeQuery<ApiKey>(
      `SELECT TOP 1 ApiKeyID, Name, KeyHash, Role, IsActive, CreatedAt, ExpiresAt, CreatedBy, LastUsedAt, AllowedIPs
       FROM ApiKeys
       WHERE KeyHash = @KeyHash AND IsActive = 1 AND (ExpiresAt IS NULL OR ExpiresAt > GETDATE())`,
      { KeyHash: hash }
    );
    const row = res.recordset[0];
    return row || null;
  }

  static async insertKey(
    name: string,
    keyHash: string,
    role: ApiKeyRole,
    createdBy: number | null,
    expiresAt?: Date | null,
    allowedIPs?: string | null
  ): Promise<number> {
    const res = await executeQuery<{ ApiKeyID: number }>(
      `INSERT INTO ApiKeys (Name, KeyHash, Role, IsActive, CreatedBy, ExpiresAt, AllowedIPs)
       OUTPUT INSERTED.ApiKeyID
       VALUES (@Name, @KeyHash, @Role, 1, @CreatedBy, @ExpiresAt, @AllowedIPs)`,
      {
        Name: name,
        KeyHash: keyHash,
        Role: role,
        CreatedBy: createdBy,
        ExpiresAt: expiresAt ?? null,
        AllowedIPs: allowedIPs ?? null
      }
    );
    return res.recordset[0].ApiKeyID;
  }

  static async deactivate(id: number): Promise<void> {
    await executeQuery(
      `UPDATE ApiKeys SET IsActive = 0 WHERE ApiKeyID = @ApiKeyID`,
      { ApiKeyID: id }
    );
  }

  static async list(): Promise<Pick<ApiKey, 'ApiKeyID' | 'Name' | 'Role' | 'IsActive' | 'CreatedAt' | 'ExpiresAt'>[]> {
    const res = await executeQuery<Pick<ApiKey, 'ApiKeyID' | 'Name' | 'Role' | 'IsActive' | 'CreatedAt' | 'ExpiresAt'>>(
      `SELECT ApiKeyID, Name, Role, IsActive, CreatedAt, ExpiresAt FROM ApiKeys ORDER BY CreatedAt DESC`
    );
    return res.recordset;
  }
}

