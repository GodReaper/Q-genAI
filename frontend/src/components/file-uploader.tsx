// components/file-uploader.tsx
import React, { ChangeEvent } from 'react';
import { Upload } from 'lucide-react';

interface FileUploaderProps {
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, disabled = false }) => {
  return (
    <label
      htmlFor="file-upload"
      className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-secondary ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      <div className="flex flex-col items-center justify-center pt-5 pb-6">
        <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
        <p className="mb-2 text-sm text-muted-foreground">
          <span className="font-semibold">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-muted-foreground">Any file type accepted</p>
      </div>
      <input
        id="file-upload"
        type="file"
        className="hidden"
        multiple
        onChange={onFileSelect}
        aria-label="File upload"
        disabled={disabled}
      />
    </label>
  );
};

export default FileUploader;
