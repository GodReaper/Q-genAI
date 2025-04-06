// components/file-list.tsx
import React from 'react';
import { Card } from './ui/card';
import { FileText } from 'lucide-react';

interface Question {
  type: string;
  text: string;
}

interface FileWithPreview extends File {
  preview?: string;
  asset_id?: string;
  questions?: Question[];
}

interface FileListProps {
  files: FileWithPreview[];
  onRemove: (file: FileWithPreview) => void;
}

const FileList: React.FC<FileListProps> = ({ files, onRemove }) => {
  if (files.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-medium mb-2">Uploaded Files</h3>
      {files.map((file, index) => (
        <Card key={index} className="p-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <FileText className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm font-medium">{file.name}</p>
              {file.asset_id && (
                <p className="text-xs text-gray-500">Asset ID: {file.asset_id}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => onRemove(file)}
            className="text-red-500 hover:text-red-700 text-sm font-medium"
          >
            Remove
          </button>
        </Card>
      ))}
    </div>
  );
};

export default FileList;
