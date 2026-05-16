import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

export const __dirname = dirname(fileURLToPath(import.meta.url));

// Root .env is 2 levels up from servers/server2-registration/
dotenv.config({ path: resolve(__dirname, '../../.env') });