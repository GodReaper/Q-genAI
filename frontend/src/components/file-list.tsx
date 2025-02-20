// components/file-list.tsx
import React from 'react';
import { FileText, X } from 'lucide-react';
import { Button } from './ui/button';

interface FileWithPreview extends File {
  preview?: string;
  asset_id?: string;
  questions?: string[];
}

interface FileListProps {
  files: FileWithPreview[];
  onRemove: (file: FileWithPreview) => void;
}

const FileList: React.FC<FileListProps> = ({ files, onRemove }) => {
  if (files.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-medium">Uploaded Files</h3>
      <div className="space-y-2">
        {files.map((file, index) => (
          <div key={index} className="flex items-center justify-between p-2 border rounded-lg">
            <div className="flex items-center space-x-2">
              {file.preview ? (
                <img
                  src={file.preview}
                  alt={`Preview of ${file.name}`}
                  className="h-10 w-10 object-cover rounded"
                />
              ) : (
                <FileText className="h-10 w-10 text-muted-foreground" />
              )}
              <div>
                <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                {file.asset_id && (
                  <p className="text-xs text-gray-500">Asset ID: {file.asset_id}</p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(file)}
              aria-label={`Remove ${file.name}`}
              disabled={file.asset_id !== undefined} // Prevent removal after upload
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileList;
