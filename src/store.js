// -----------------------------------------------------------------------------
// Small persistence under /data (the only writable path of the container):
// - watch.json: the networks and stations the user added. Losing it is mostly
//   harmless: the stations already created in Gladys, and their networks, are
//   rebuilt from their devices (src/service.js);
// - one cache file per network (its station list, read once a day) and one
//   for the catalog of networks: a restart does not download them again.
// -----------------------------------------------------------------------------

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'gbfs-store' });

/** /data in the container; GBFS_DATA_DIR for a run outside Docker. */
export const dataDirectory = () => process.env.GBFS_DATA_DIR || '/data';

export class JsonFile {
  constructor(directory, name) {
    this.directory = directory;
    this.path = join(directory, name);
    this.pending = null;
    this.writing = null;
    // A failing disk would fail every save: logged once, then at debug.
    this.writeFailed = false;
  }

  /** The content of the file, or null when it is missing or unreadable. */
  async load() {
    try {
      const data = JSON.parse(await readFile(this.path, 'utf8'));
      return data && typeof data === 'object' ? data : null;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn(`Cannot read ${this.path}: ${err.message}`);
      }
      return null;
    }
  }

  // Writes are coalesced and atomic (temporary file + rename): a crash never
  // leaves half a JSON file behind.
  save(data) {
    this.latest = data;
    if (!this.pending) {
      // Chained after the write in progress, if any: one writer at a time.
      this.pending = (this.writing ?? Promise.resolve()).then(async () => {
        const snapshot = this.latest;
        this.pending = null;
        try {
          await mkdir(this.directory, { recursive: true });
          const temporary = `${this.path}.tmp`;
          await writeFile(temporary, JSON.stringify(snapshot));
          await rename(temporary, this.path);
          if (this.writeFailed) {
            this.writeFailed = false;
            logger.info(`${this.path} written again`);
          }
        } catch (err) {
          if (this.writeFailed) {
            logger.debug(`Cannot write ${this.path}: ${err.message}`);
          } else {
            this.writeFailed = true;
            logger.warn(`Cannot write ${this.path}: ${err.message}`);
          }
        }
      });
      this.writing = this.pending;
    }
    return this.pending;
  }

  async remove() {
    await this.flush();
    await rm(this.path, { force: true }).catch(() => {});
  }

  /** Resolves once every write requested so far is on disk. */
  flush() {
    return this.writing ?? Promise.resolve();
  }
}

/** watch.json: the networks and stations added. */
export class Store extends JsonFile {
  constructor(directory = dataDirectory()) {
    super(directory, 'watch.json');
  }

  async load() {
    return (await super.load()) ?? {};
  }
}
