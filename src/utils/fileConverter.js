import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const execPromise = promisify(exec);

export const convertDocxToPdf = async (buffer, originalname) => {
  try {
    console.log('[Converter] 🔄 Converting DOCX to PDF...');
    
    // Create temp directory
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });

    // Create temp files
    const inputExt = path.extname(originalname);
    const baseName = `${uuidv4()}`;
    const inputPath = path.join(tempDir, `${baseName}${inputExt}`);
    const outputPath = path.join(tempDir, `${baseName}.pdf`);

    // Write input file
    await fs.writeFile(inputPath, buffer);

    // Try to convert using LibreOffice
    try {
      const command = `libreoffice --headless --convert-to pdf --outdir ${tempDir} ${inputPath}`;
      await execPromise(command);
      console.log('[Converter] ✅ Conversion successful');
    } catch (convertError) {
      console.warn('[Converter] ⚠️ LibreOffice not available, using fallback');
      // If LibreOffice fails, return original file
      return {
        buffer,
        filename: originalname,
        mimetype: originalname.endsWith('.docx') 
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
          : 'application/octet-stream'
      };
    }

    // Read output file
    const pdfBuffer = await fs.readFile(outputPath);

    // Clean up
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});

    console.log('[Converter] ✅ DOCX converted to PDF successfully');
    
    return {
      buffer: pdfBuffer,
      filename: originalname.replace(/\.[^.]+$/, '.pdf'),
      mimetype: 'application/pdf'
    };
  } catch (error) {
    console.error('[Converter] ❌ Error:', error);
    // If conversion fails, return original file
    return {
      buffer,
      filename: originalname,
      mimetype: originalname.endsWith('.docx') 
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        : 'application/octet-stream'
    };
  }
};
