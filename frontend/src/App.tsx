// App.tsx
import FileList from './components/file-list';
import FileUploader from './components/file-uploader';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Spinner } from './components/ui/spinner';

interface FileWithPreview extends File {
  preview?: string;
  asset_id?: string;
  questions?: string[];
}

const App: React.FC = () => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Handle file selection and upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).map((file) => {
        if (file.type.startsWith('image/')) {
          return Object.assign(file, {
            preview: URL.createObjectURL(file),
          });
        }
        return file;
      });

      // Upload each file and store asset_id
      setLoading(true);
      setError(null);
      try {
        const uploadedFiles = await Promise.all(
          selectedFiles.map(async (file) => {
            const formData = new FormData();
            formData.append('file', file);

            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/documents/process`, formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            });

            return {
              ...file,
              asset_id: response.data.asset_id,
            };
          })
        );

        setFiles((prev) => [...prev, ...uploadedFiles]);
      } catch (err: any) {
        console.error('Error uploading files:', err);
        setError('Failed to upload files. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle file removal
  const removeFile = (fileToRemove: FileWithPreview) => {
    setFiles((files) => files.filter((file) => file !== fileToRemove));
    if ('preview' in fileToRemove && fileToRemove.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
  };

  useEffect(() => {
    // Clean up preview URLs when component unmounts
    return () => {
      files.forEach((file) => {
        if ('preview' in file && file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  // Handle Generate Questions
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      // Assuming you want to generate questions for all uploaded files
      const generatePromises = files.map(async (file) => {
        if (!file.asset_id) {
          throw new Error(`Missing asset_id for file: ${file.name}`);
        }

        const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/documents/generate_questions`, {
          asset_id: file.asset_id,
        });
        let questions = response.data.questions.slice(1, -1);

      // Process the questions to separate headers from regular questions
        questions = questions.map((question: string) => {
        // If the question contains '**', treat it as a section header
        if (question.includes('**')) {
          return { type: 'header', text: question.replace('**', '').trim() };
        } else {
          return { type: 'question', text: question.trim() };
        }
      });


        return {
          ...file,
          questions,
        };
      });

      const updatedFiles = await Promise.all(generatePromises);
      setFiles(updatedFiles);
    } catch (err: any) {
      console.error('Error generating questions:', err);
      setError('Failed to generate questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card className="p-6">
        <div className="space-y-6">
          <div className="space-y-4">
            <FileUploader onFileSelect={handleFileChange} disabled={loading} />
            <FileList files={files} onRemove={removeFile} />
          </div>
          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={files.length === 0 || loading}
          >
            {loading ? <Spinner /> : 'Generate'}
          </Button>
          {error && <p className="text-red-500">{error}</p>}
        </div>
      </Card>

      {/* Display Generated Questions */}
      {files.some((file) => file.questions && file.questions.length > 0) && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Generated Questions</h2>
          {files.map((file, index) =>
            file.questions && file.questions.length > 0 ? (
              <Card key={index} className="p-4 mb-4">
                <h3 className="text-lg font-semibold mb-2">{file.name}</h3>
                <ol className="list-disc list-inside space-y-1">
                  {file.questions.map((question, qIndex) => (
                    question.type === 'header' ? (
                      <li key={qIndex} className="text-lg font-bold mb-2">{question.text}</li>
                    ): (
                      <li key={qIndex}>{question.text}</li>
                    )
                  ))}
                </ol>
              </Card>
            ) : null
          )}
        </div>
      )}
    </div>
  );
};

export default App;
