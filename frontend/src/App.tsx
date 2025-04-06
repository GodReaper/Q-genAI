// App.tsx
import FileList from './components/file-list';
import FileUploader from './components/file-uploader';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { useEffect, useState } from 'react';
import axios, { AxiosError } from 'axios';
import { Spinner } from './components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';
import { cn } from './lib/utils';

interface Question {
  type: string;
  text: string;
}

interface FileWithPreview extends File {
  preview?: string;
  asset_id?: string;
  questions?: Question[];
}

type QuestionType = 'general' | 'mcq' | 'fitb';

interface FITBQuestion {
  sentence: string;
  answer: string;
}

const App: React.FC = () => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<QuestionType>('general');

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
      } catch (err) {
        console.error('Error uploading files:', err);
        setError(err instanceof AxiosError ? err.message : 'Failed to upload files. Please try again.');
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

  // Get the API endpoint based on selected agent
  const getApiEndpoint = (agent: QuestionType) => {
    switch (agent) {
      case 'mcq':
        return 'generate_mcq';
      case 'fitb':
        return 'generate_fitb';
      default:
        return 'generate_questions';
    }
  };

  // Handle Generate Questions
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = getApiEndpoint(selectedAgent);
      const generatePromises = files.map(async (file) => {
        if (!file.asset_id) {
          throw new Error(`Missing asset_id for file: ${file.name}`);
        }

        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/documents/${endpoint}`,
          {
            asset_id: file.asset_id,
          }
        );

        let questions = response.data.questions;

        // Process the questions based on the agent type
        if (selectedAgent === 'general') {
          // Handle general questions
          if (typeof questions === 'string') {
            questions = questions.split('\n').filter(q => q.trim()).map(question => ({
              type: 'question',
              text: question.trim()
            }));
          } else if (Array.isArray(questions)) {
            questions = questions.map(question => {
              if (typeof question !== 'string') {
                return { type: 'question', text: String(question) };
              }
              if (question.includes('**')) {
                return { type: 'header', text: question.replace(/\*\*/g, '').trim() };
              }
              return { type: 'question', text: question.trim() };
            });
          } else {
            throw new Error('Invalid question format received');
          }
        } else if (selectedAgent === 'mcq') {
          // Handle MCQ format
          if (typeof questions === 'string') {
            // Remove the header text and split by Question header
            const cleanText = questions.replace(/Here are the multiple-choice questions based on the provided text:\n\n/, '');
            // Split by Question markers and keep the first question if it exists
            const questionBlocks = cleanText.split(/\*\*Question \d+\*\*/).filter(block => block.trim());
            const firstQuestion = questionBlocks[0].startsWith('\n') ? questionBlocks[0].substring(1) : questionBlocks[0];
            questionBlocks[0] = firstQuestion;

            questions = questionBlocks.map(block => {
              const lines = block.split('\n').filter(line => line.trim());
              
              // Find the question text (first line until options start)
              const questionEndIndex = lines.findIndex(line => /^[A-D]\)/.test(line.trim()));
              const questionText = lines.slice(0, questionEndIndex).join('\n').trim();
              
              // Get options (lines starting with A), B), C), D))
              const options = lines.filter(line => /^[A-D]\)/.test(line.trim()));
              
              // Get answer (line starting with "Answer:")
              const answerLine = lines.find(line => line.toLowerCase().includes('answer:'));
              const answer = answerLine 
                ? answerLine.replace(/^Answer:\s*/i, '').trim()
                : '';
              
              return {
                type: 'mcq',
                text: `${questionText}\n\n${options.join('\n')}\n\nCorrect Answer: ${answer}`
              };
            });
          } else if (!Array.isArray(questions)) {
            throw new Error('Invalid MCQ format received');
          }
        } else {
          // Handle FITB questions
          if (typeof questions === 'string') {
            // Remove the header text and split into question blocks
            const cleanText = questions.replace(/Here are the fill-in-the-blank questions based on the text:\n\n/, '');
            const questionBlocks = cleanText.split(/\d+\.\s/).filter(block => block.trim());
            
            questions = questionBlocks.map(block => {
              // Split into lines and remove empty ones
              const lines = block.split('\n').filter(line => line.trim());
              
              // Get the sentence with blank (first non-empty line)
              const sentence = lines.find(line => line.includes('_'))?.trim() || '';
              
              // Get the answer (line with "(Answer:" and ")")
              const answerLine = lines.find(line => line.includes('(Answer:'));
              const answer = answerLine
                ? answerLine.replace(/^\(Answer:\s*|\)$/g, '').trim()
                : '';
              
              if (!sentence || !answer) return null;
              
              return {
                type: 'fitb',
                text: `${sentence}\n\nAnswer: ${answer}`
              };
            }).filter(Boolean) as Question[]; // Remove any null entries
          } else if (!Array.isArray(questions)) {
            throw new Error('Invalid FITB format received');
          } else {
            questions = questions.map((q: FITBQuestion) => ({
              type: 'fitb',
              text: `${q.sentence}\nAnswer: ${q.answer}`,
            }));
          }
        }

        return {
          ...file,
          questions: questions.filter((q: Question) => q && q.text), // Filter out any invalid questions
        };
      });

      const updatedFiles = await Promise.all(generatePromises);
      setFiles(updatedFiles);
    } catch (err) {
      console.error('Error generating questions:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate questions. Please try again.';
      setError(errorMessage);
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
            <Select value={selectedAgent} onValueChange={(value: QuestionType) => setSelectedAgent(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select question type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Questions</SelectItem>
                <SelectItem value="mcq">Multiple Choice Questions</SelectItem>
                <SelectItem value="fitb">Fill in the Blank</SelectItem>
              </SelectContent>
            </Select>
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
                <ol className="list-disc list-inside space-y-2">
                  {file.questions.map((question, qIndex) => (
                    <li
                      key={qIndex}
                      className={cn(
                        "whitespace-pre-line",
                        question.type === 'header' && "text-lg font-bold mb-2",
                        (question.type === 'mcq' || question.type === 'fitb') && "font-mono text-sm"
                      )}
                    >
                      {question.text}
                    </li>
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
