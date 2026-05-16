import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(__dir, '.env') });
dotenv.config({ path: resolve(__dir, '../../.env') });