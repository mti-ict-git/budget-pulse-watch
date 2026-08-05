import fs from 'fs';
import path from 'path';

const DEFAULT_DOCKER_ROOT = '/app/shared-documents';
const COMPANY_FOLDER = 'PT Merdeka Tsingshan Indonesia';

const unique = (values: Array<string | null | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map((value) => path.normalize(value)))];

const isContainerPath = (value: string): boolean => value.startsWith('/app/') || value.startsWith('/mnt/');

function relativeSharedPath(value: string): string | null {
  const normalized = value.trim().replace(/\\/g, '/');
  const dockerMarker = '/app/shared-documents/';
  const dockerIndex = normalized.toLowerCase().indexOf(dockerMarker);
  if (dockerIndex >= 0) return normalized.slice(dockerIndex + dockerMarker.length).replace(/^\/+/, '');

  const documentMarker = '/pr_document/';
  const documentIndex = normalized.toLowerCase().indexOf(documentMarker);
  if (documentIndex >= 0) return normalized.slice(documentIndex + documentMarker.length).replace(/^\/+/, '');

  if (/^\/\/[^/]+\/[^/]+\/?/i.test(normalized)) {
    return normalized.replace(/^\/\/[^/]+\/[^/]+\/?/i, '').replace(/^\/+/, '');
  }
  return null;
}

export function sharedStorageRoots(configuredPath = process.env.SHARED_FOLDER_PATH || ''): string[] {
  const configured = configuredPath.trim();
  const roots: string[] = [];
  if (configured && isContainerPath(configured)) roots.push(configured);
  if (process.platform !== 'win32') roots.push(DEFAULT_DOCKER_ROOT);

  const normalized = configured.replace(/\\/g, '/');
  const uncMatch = normalized.match(/^\/\/([^/]+)\/([^/]+)/);
  if (uncMatch && process.platform !== 'win32') {
    // Compatibility with files accidentally written below the mount root while
    // SHARED_FOLDER_PATH contained a forward-slash UNC value.
    roots.push(path.join(DEFAULT_DOCKER_ROOT, uncMatch[1], uncMatch[2]));
  }
  if (configured && (process.platform === 'win32' || !configured.startsWith('//'))) roots.push(configured);
  return unique(roots);
}

export function storedFileCandidates(
  storedPaths: Array<string | null | undefined>,
  options: { prfNo?: string; fileName?: string; configuredPath?: string } = {}
): string[] {
  const roots = sharedStorageRoots(options.configuredPath);
  const candidates: string[] = [];
  for (const storedPath of storedPaths) {
    if (!storedPath?.trim()) continue;
    candidates.push(storedPath);
    const relative = relativeSharedPath(storedPath);
    if (!relative) continue;
    for (const root of roots) {
      candidates.push(path.join(root, relative));
      if (relative.startsWith(`${COMPANY_FOLDER}/`)) {
        candidates.push(path.join(root, relative.slice(COMPANY_FOLDER.length + 1)));
      } else {
        candidates.push(path.join(root, COMPANY_FOLDER, relative));
      }
    }
  }
  if (options.prfNo && options.fileName) {
    for (const root of roots) {
      candidates.push(path.join(root, options.prfNo, options.fileName));
      candidates.push(path.join(root, COMPANY_FOLDER, options.prfNo, options.fileName));
    }
  }
  return unique(candidates);
}

export function resolveStoredFile(
  storedPaths: Array<string | null | undefined>,
  options: { prfNo?: string; fileName?: string; configuredPath?: string } = {}
): string | null {
  return storedFileCandidates(storedPaths, options).find((candidate) => {
    try { return fs.statSync(candidate).isFile(); } catch { return false; }
  }) || null;
}

export function prfFolderCandidates(prfNo: string, configuredPath = process.env.SHARED_FOLDER_PATH || ''): string[] {
  return unique(sharedStorageRoots(configuredPath).flatMap((root) => [
    path.join(root, prfNo),
    path.join(root, COMPANY_FOLDER, prfNo)
  ]));
}

export function resolvePRFFolder(prfNo: string, configuredPath = process.env.SHARED_FOLDER_PATH || ''): string | null {
  return prfFolderCandidates(prfNo, configuredPath).find((candidate) => {
    try { return fs.statSync(candidate).isDirectory(); } catch { return false; }
  }) || null;
}

