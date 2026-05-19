// DriveBC — bundled CSV from data.gov.bc.ca "DriveBC HighwayCams" dataset.
// CSV file:    lib/sources/data/drivebc-cameras.csv
// CSV source:  https://catalogue.data.gov.bc.ca/dataset/bc-highwaycams
// License:     Open Government License - British Columbia
//
// Note on snapshot URLs: the CSV's `links_imageDisplay` column points to
// images.drivebc.ca/bchighwaycam/pub/cameras/{id}.jpg, which today serves
// a fixed 420x315 PNG placeholder for *every* id (verified May 2026 by
// fetching ~5 ids and confirming identical 40 571-byte bodies). The live
// image URL the modern DriveBC site uses is
// https://www.drivebc.ca/images/{id}.jpg — verified to return distinct
// JPEGs sized ~30–100 KB. We use the live URL pattern here, keyed by the
// CSV's `id`, so pins still load real frames.
import { promises as fs } from 'fs';
import path from 'path';
import type { Camera } from '../types';

const CSV_PATH = path.join(process.cwd(), 'lib/sources/data/drivebc-cameras.csv');

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      }
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) obj[header[i]] = (r[i] ?? '').trim();
    return obj;
  });
}

export async function fetchDriveBcCameras(): Promise<Camera[]> {
  let text: string;
  try {
    text = await fs.readFile(CSV_PATH, 'utf8');
  } catch (err) {
    console.error('DriveBC CSV missing at', CSV_PATH, err);
    return [];
  }
  const records = parseCsv(text);
  const out: Camera[] = [];
  for (const r of records) {
    const id = r.id;
    const lat = parseFloat(r.latitude);
    const lon = parseFloat(r.longitude);
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const name = r.camName || r.highway_locationDescription || `DriveBC #${id}`;
    const highway = r.highway_number ? `Hwy ${r.highway_number}` : undefined;
    out.push({
      id: `drivebc:${id}`,
      source: 'drivebc',
      title: highway ? `${name} (${highway})` : name,
      lat,
      lon,
      snapshotUrl: `https://www.drivebc.ca/images/${id}.jpg`,
      externalUrl: `https://www.drivebc.ca/cameras/${id}`,
      refreshSeconds: 300,
      country: 'Canada',
    });
  }
  return out;
}
