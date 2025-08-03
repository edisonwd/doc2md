import React, { useState, useRef, useEffect } from 'react';
import { parseFileWithSSE, ParseResult, ParseProgress } from '../utils/api';

interface FileUploadProps {
  onContentChange: (images: { image: string; content: string }[]) => void;
  onFileUpload: (file: File) => void;
  onStreamingStart: () => void;
  onStreamingProgress: (progress: ParseProgress) => void;
  onStreamingComplete: (result: ParseResult) => void;
  onStreamingError: (error: Error) => void;
  onClearContent: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onContentChange, 
  onFileUpload,
  onStreamingStart,
  onStreamingProgress,
  onStreamingComplete,
  onStreamingError,
  onClearContent
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'processing' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parseDuration, setParseDuration] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [selectedModel, setSelectedModel] = useState<string>('docling'); // 默认模型
  const [isModelSelectOpen, setIsModelSelectOpen] = useState(false); // 控制下拉框显示
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const modelSelectRef = useRef<HTMLDivElement>(null); // 用于点击外部关闭下拉框

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const uploadFile = async (file: File) => {
    try {
      setProgress(0);
      setUploadStatus('uploading');
      
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 50));
        setProgress(i);
      }
      
      setUploadedFile(file);
      setUploadStatus('uploaded');
      onFileUpload(file);
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '上传失败');
      console.error('File upload error:', error);
    }
  };

  const handleStartParsing = async () => {
    if (!uploadedFile) return;
    
    try {
      setUploadStatus('processing');
      setProgress(0);
      setParseDuration(0);
      setTotalPages(0);
      setCurrentPage(0);
      
      startTimeRef.current = Date.now();
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setParseDuration(Date.now() - startTimeRef.current);
        }
      }, 100);
      
      if (cancelRef.current) {
        cancelRef.current();
      }
      
      onStreamingStart();
      
      cancelRef.current = parseFileWithSSE(
        uploadedFile,
        selectedModel, // 传递选择的模型
        (progress: ParseProgress) => {
          setTotalPages(progress.totalPages);
          setCurrentPage(progress.currentPage);
          setProgress(Math.round((progress.currentPage / progress.totalPages) * 100));
          onStreamingProgress(progress);
        },
        (result: ParseResult) => {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          
          if (startTimeRef.current) {
            setParseDuration(Date.now() - startTimeRef.current);
          }
          
          onContentChange(result.images);
          setUploadStatus('success');
          onStreamingComplete(result);
        },
        (error: Error) => {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          
          setUploadStatus('error');
          setErrorMessage(error.message || '解析失败');
          console.error('File parsing error:', error);
          onStreamingError(error);
        }
      );
    } catch (error) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '解析失败');
      console.error('File parsing error:', error);
    }
  };

  const handleReparse = async () => {
    if (!uploadedFile) return;
    
    try {
      onClearContent();
      
      setUploadStatus('processing');
      setProgress(0);
      setParseDuration(0);
      setTotalPages(0);
      setCurrentPage(0);
      
      startTimeRef.current = Date.now();
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setParseDuration(Date.now() - startTimeRef.current);
        }
      }, 100);
      
      if (cancelRef.current) {
        cancelRef.current();
      }
      
      onStreamingStart();
      
      cancelRef.current = parseFileWithSSE(
        uploadedFile,
        selectedModel, // 传递选择的模型
        (progress: ParseProgress) => {
          setTotalPages(progress.totalPages);
          setCurrentPage(progress.currentPage);
          setProgress(Math.round((progress.currentPage / progress.totalPages) * 100));
          onStreamingProgress(progress);
        },
        (result: ParseResult) => {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          
          if (startTimeRef.current) {
            setParseDuration(Date.now() - startTimeRef.current);
          }
          
          onContentChange(result.images);
          setUploadStatus('success');
          onStreamingComplete(result);
        },
        (error: Error) => {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          
          setUploadStatus('error');
          setErrorMessage(error.message || '重新解析失败');
          console.error('File re-parsing error:', error);
          onStreamingError(error);
        }
      );
    } catch (error) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '重新解析失败');
      console.error('File re-parsing error:', error);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getStatusText = () => {
    switch (uploadStatus) {
      case 'uploading': return '正在上传...';
      case 'uploaded': return '上传成功';
      case 'processing': return totalPages > 0 ? `正在解析... (${currentPage}/${totalPages})` : '正在解析...';
      case 'success': return '解析成功';
      case 'error': return '操作失败';
      default: return '拖拽文件到此处或点击上传';
    }
  };

  const getStatusColor = () => {
    switch (uploadStatus) {
      case 'uploading': 
      case 'processing': 
        return 'text-blue-400';
      case 'uploaded': 
      case 'success': 
        return 'text-green-400';
      case 'error': 
        return 'text-red-400';
      default: 
        return 'text-gray-400';
    }
  };

  // 处理点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelSelectRef.current && !modelSelectRef.current.contains(event.target as Node)) {
        setIsModelSelectOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 清理计时器和SSE连接
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (cancelRef.current) {
        cancelRef.current();
      }
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div 
        className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 transition-all duration-300
          ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600'}
          ${uploadStatus === 'uploading' || uploadStatus === 'processing' ? 'opacity-75' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileInput}
          accept=".pdf,.jpg,.jpeg,.png"
        />
        
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            {uploadStatus === 'uploading' || uploadStatus === 'processing' ? (
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span className="iconify ph--upload-simple-bold text-4xl text-gray-400" />
            )}
          </div>
          
          <p className={`text-lg font-medium mb-2 ${getStatusColor()}`}>
            {getStatusText()}
          </p>
          
          <p className="text-gray-500 text-sm mb-4">
            支持 PDF, JPG, PNG, JPEG 格式
          </p>
          
          {uploadStatus === 'uploaded' ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {/* 模型选择下拉框 */}
              <div className="relative" ref={modelSelectRef}>
                <button
                  type="button"
                  className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all duration-300"
                  onClick={() => setIsModelSelectOpen(!isModelSelectOpen)}
                >
                  <span className="mr-2">模型: {selectedModel}</span>
                  <span className={`iconify ph--caret-down-bold transition-transform ${isModelSelectOpen ? 'rotate-180' : ''}`}></span>
                </button>
                
                {isModelSelectOpen && (
                  <div className="absolute z-10 mt-2 w-full bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                    <button
                      className={`block w-full text-left px-4 py-2 hover:bg-gray-700 transition ${
                        selectedModel === 'docling' ? 'bg-gray-700' : ''
                      }`}
                      onClick={() => {
                        setSelectedModel('docling');
                        setIsModelSelectOpen(false);
                      }}
                    >
                      docling
                    </button>
                    <button
                      className={`block w-full text-left px-4 py-2 hover:bg-gray-700 transition ${
                        selectedModel === 'Nanonets-OCR-s' ? 'bg-gray-700' : ''
                      }`}
                      onClick={() => {
                        setSelectedModel('Nanonets-OCR-s');
                        setIsModelSelectOpen(false);
                      }}
                    >
                      Nanonets-OCR-s
                    </button>
                  </div>
                )}
              </div>
              
              <button
                type="button"
                onClick={handleStartParsing}
                className="px-6 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg hover:from-green-700 hover:to-teal-700 transition-all duration-300 shadow-lg"
              >
                解析文档
              </button>
            </div>
          ) : uploadStatus === 'success' || uploadStatus === 'error' ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={handleReparse}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg"
              >
                重新解析
              </button>
              <button
                type="button"
                onClick={triggerFileInput}
                className="px-6 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-300 shadow-lg"
              >
                重新上传
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={triggerFileInput}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg"
              disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
            >
              选择文件
            </button>
          )}
        </div>
      </div>
      
      {(uploadStatus === 'uploading' || uploadStatus === 'processing' || uploadStatus === 'success') && (
        <div className="mt-4">
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-gray-400 mt-1">
            <div>{progress}% {totalPages > 0 && `(${currentPage}/${totalPages})`}</div>
            <div>
              {(uploadStatus === 'processing' || uploadStatus === 'success') && (
                <span>耗时: {(parseDuration / 1000).toFixed(1)}秒</span>
              )}
            </div>
          </div>
        </div>
      )}
      
      {uploadStatus === 'error' && (
        <div className="mt-4 p-3 bg-red-900/50 text-red-300 rounded-lg border border-red-700">
          {errorMessage}
        </div>
      )}
      
      <div className="mt-6 text-sm text-gray-400">
        <h3 className="font-medium mb-2">使用说明:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>拖拽文件到上方区域或点击选择文件</li>
          <li>文件上传成功后点击"解析文档"按钮</li>
          <li>支持 PDF、Word 文档和常见图片格式</li>
          <li>解析完成后可在右侧复制内容</li>
        </ul>
      </div>
    </div>
  );
};

export default FileUpload;
