import React, { useState, useRef, useEffect } from 'react';
import FileUpload from '../components/FileUpload';
import PreviewAndParseView from '../components/PreviewAndParseView';

// 导入PDF.js
import * as pdfjsLib from 'pdfjs-dist';

// 初始化 worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

// 定义存储数据的接口
interface StoredData {
  parsedImages: { image: string; content: string }[];
  fileName: string;
  fileType: string;
  fileSize: number;
}

const FileProcessor: React.FC = () => {
  const [parsedImages, setParsedImages] = useState<{ image: string; content: string }[]>([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<number>(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 页面加载时恢复数据
  useEffect(() => {
    const storedData = localStorage.getItem('fileProcessorData');
    if (storedData) {
      try {
        const data: StoredData = JSON.parse(storedData);
        setParsedImages(data.parsedImages);
        
        // 创建一个虚拟的File对象用于预览
        const dummyFile = new File([], data.fileName, { 
          type: data.fileType 
        });
        setUploadedFile(dummyFile);
      } catch (e) {
        console.error('Failed to restore data from localStorage', e);
      }
    }
  }, []);

  // 保存数据到localStorage
  const saveDataToStorage = (images: { image: string; content: string }[], file: File | null) => {
    if (images.length > 0 && file) {
      // 将images中的 image 字段设置为空字符串
      const processedImages = images.map(img => ({
        ...img,
        image: '' // 设置为空字符串
      }));
      const data: StoredData = {
        parsedImages: processedImages,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      };
      localStorage.setItem('fileProcessorData', JSON.stringify(data));
    }
  };

  const handleContentChange = (images: { image: string; content: string }[]) => {
    if (images.length > 0) {
      setParsedImages(images);
    }
    if (uploadedFile) {
      saveDataToStorage(images, uploadedFile);
    }
  };

  const handleFileUpload = (file: File) => {
    setUploadedFile(file);
    setPdfPages(0);
    setParsedImages([]); // 重置解析结果
    localStorage.removeItem('fileProcessorData'); // 清除旧数据
  };

  const handleStreamingStart = () => {
    setIsStreaming(true);
    setParsedImages([]); // 清空之前的结果
    localStorage.removeItem('fileProcessorData'); // 清除旧数据
  };

  const handleStreamingProgress = (progress: any) => {
    // 实时更新解析结果
    setParsedImages(prevImages => {
      const newImages = [
        ...prevImages,
        {
          image: progress.currentImage,
          content: progress.currentContent
        }
      ];
      
      // 保存到localStorage
      if (uploadedFile) {
        saveDataToStorage(newImages, uploadedFile);
      }
      
      return newImages;
    });
  };

  const handleStreamingComplete = (result: any) => {
    setIsStreaming(false);
    // 结果已经在PreviewAndParseView中处理
  };

  const handleStreamingError = (error: Error) => {
    setIsStreaming(false);
    console.error('Streaming error:', error);
    // 可以在这里添加错误处理逻辑
  };

  // 新增处理清空内容的函数
  const handleClearContent = () => {
    setParsedImages([]);
    localStorage.removeItem('fileProcessorData');
  };

  // 渲染PDF预览
  useEffect(() => {
    const renderPdfPreview = async () => {
      if (!uploadedFile) return;

      // 检查文件是否为空
      if (uploadedFile.size === 0) {
        console.error('PDF preview error: The file is empty');
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          const errorElement = document.createElement('div');
          errorElement.className = 'text-red-500 text-center p-4';
          errorElement.innerHTML = '';
          containerRef.current.appendChild(errorElement);
        }
        return;
      }

      try {
        const pdf = await pdfjsLib.getDocument(URL.createObjectURL(uploadedFile)).promise;
        const container = containerRef.current;
        if (!container) return;

        container.innerHTML = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;

          canvas.height = viewport.height;
          canvas.width = viewport.width;
          canvas.style.maxWidth = '100%';
          canvas.style.height = 'auto';

          const renderContext = {
            canvasContext: context,
            viewport: viewport
          };

          await page.render({ ...renderContext, canvas }).promise;
          const pageContainer = document.createElement('div');
          pageContainer.className = 'mb-4 border p-2 rounded';
          pageContainer.appendChild(canvas);
          container.appendChild(pageContainer);
        }
      } catch (error) {
        console.error('PDF preview error:', error);
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          const errorElement = document.createElement('div');
          errorElement.className = 'text-red-500 text-center p-4';
          // 根据错误类型显示不同的错误消息
          const errorMessage = error instanceof Error ? error.message : 'PDF预览失败';
          errorElement.innerHTML = `<span className="iconify ph--error-circle-bold text-2xl block mb-2"></span>${errorMessage}`;
          containerRef.current.appendChild(errorElement);
        }
      }
    };

    renderPdfPreview();
  }, [uploadedFile]);

  const renderFilePreview = () => {
    if (!uploadedFile) {
      return (
        <div className="h-full flex items-center justify-center text-gray-500">
          <div className="text-center">
            <span className="iconify ph--eye-bold text-4xl mb-2 block" />
            <p>上传文件后将在此处显示预览</p>
          </div>
        </div>
      );
    }

    // 根据文件类型渲染不同的预览
    if (uploadedFile.type.startsWith('image/')) {
      return (
        <div className="h-full flex items-center justify-center p-4">
          <img 
            src={URL.createObjectURL(uploadedFile)} 
            alt="Preview" 
            className="max-h-full max-w-full object-contain"
          />
        </div>
      );
    }

    // 对于PDF文件，显示PDF预览
    if (uploadedFile.type === 'application/pdf') {
      return (
        <div className="h-full overflow-auto p-4">
          <div ref={containerRef} className="flex flex-col items-center">
            {/* PDF页面将在这里动态渲染 */}
          </div>
          {pdfPages > 0 && (
            <div className="text-center text-gray-500 text-sm mt-4">
              共 {pdfPages} 页
            </div>
          )}
        </div>
      );
    }

    // 对于其他文档文件，显示文件信息
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <div className="text-center mb-6">
          <span className="iconify ph--file-bold text-6xl mb-4 text-blue-500" />
          <h3 className="text-xl font-semibold mb-2">{uploadedFile.name}</h3>
          <p className="text-gray-400 mb-4">
            {(uploadedFile.size / 1024).toFixed(2)} KB
          </p>
          <div className="inline-block px-4 py-2 bg-gray-700 rounded-lg">
            <span className="font-mono text-sm">{uploadedFile.type || '未知类型'}</span>
          </div>
        </div>
        <div className="text-gray-500 text-sm">
          <p>文件已上传成功，点击左侧"解析文档"按钮进行内容解析</p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      <div className="container mx-auto px-0">
        <header className="mb-8 text-center py-6">
          <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            智能文件解析器
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            上传PDF、Word文档或图片文件，系统将自动解析内容并以Markdown格式展示，便于复制和使用
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 mb-8">
          <div className="bg-gray-800 rounded-none p-6 h-[500px]">
            <div className="flex items-center mb-4">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full mr-4"></div>
              <h2 className="text-xl font-semibold">文件上传</h2>
            </div>
            <FileUpload 
              onContentChange={handleContentChange} 
              onFileUpload={handleFileUpload} 
              onStreamingStart={handleStreamingStart}
              onStreamingProgress={handleStreamingProgress}
              onStreamingComplete={handleStreamingComplete}
              onStreamingError={handleStreamingError}
              onClearContent={handleClearContent} // 新增清除内容的回调
            />
          </div>

          <div className="bg-gray-800 rounded-none p-6 h-[500px]">
            <div className="flex items-center mb-4">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full mr-4"></div>
              <h2 className="text-xl font-semibold">原始文件预览</h2>
            </div>
            <div className="h-[400px] flex items-center justify-center border-2 border-dashed border-gray-700 rounded-lg overflow-hidden">
              {renderFilePreview()}
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-none p-6">
          <div className="flex items-center mb-4">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full mr-4"></div>
            <h2 className="text-xl font-semibold">预览与解析内容</h2>
          </div>
          
          <div className="h-[500px]">
            <PreviewAndParseView 
              images={parsedImages} 
              fileName={uploadedFile?.name} 
              isStreaming={isStreaming}
              onStreamingComplete={handleStreamingComplete}
              uploadedFile={uploadedFile} // 传递上传的文件
            />
          </div>
        </div>

        <footer className="mt-16 text-center text-gray-500 text-sm py-6">
          <p>© {new Date().getFullYear()} 智能文件解析系统. 采用先进的AI技术解析文档内容.</p>
        </footer>
      </div>
    </div>
  );
};

export default FileProcessor;
