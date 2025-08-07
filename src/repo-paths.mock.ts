import {join, resolve} from 'node:path';

export const repoDirPath = resolve(import.meta.dirname, '..');
export const notCommittedDirPath = join(repoDirPath, '.not-committed');
export const userDataDirPath = join(notCommittedDirPath, 'user-dir');
export const testSnapshotDirPath = join(notCommittedDirPath, 'snapshots');
