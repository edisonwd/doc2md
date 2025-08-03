import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
// 删除路由相关导入
// import { useNavigate } from 'react-router-dom';

interface PreviewAndParseViewProps {
  images: { image: string; content: string }[];
  fileName?: string;
  isStreaming?: boolean;
  onStreamingComplete?: (result: any) => void;
  uploadedFile?: File | null; // 添加上传的文件
}

const PreviewAndParseView: React.FC<PreviewAndParseViewProps> = ({
  images,
  fileName = '文档',
  isStreaming = true,
  onStreamingComplete,
  uploadedFile = null
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalImage, setModalImage] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const previousImagesCount = useRef(0);
  const itemRefs = useRef<HTMLDivElement[]>([]);
  const [isFullScreenModalOpen, setIsFullScreenModalOpen] = useState(false);
  const [fullContent, setFullContent] = useState('');
  // 添加复制状态变量
  const [isFullContentCopied, setIsFullContentCopied] = useState(false);

  const copyToClipboard = (content: string, index: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const openModal = (imageSrc: string) => {
    setModalImage(imageSrc);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalImage('');
  };

  const viewFullScreen = () => {
    // 合并所有页面的内容
    const content = images.map(item => item.content).join('\n\n---\n\n');
    setFullContent(content);
    // 打开全屏模态框
    setIsFullScreenModalOpen(true);
  };

  // 在DOM更新后滚动到最新添加的项
  useLayoutEffect(() => {
    if (isStreaming && images.length > previousImagesCount.current) {
      // 确保在DOM更新完成后滚动到最新项
      const lastItemIndex = images.length - 1;
      if (itemRefs.current[lastItemIndex]) {
        itemRefs.current[lastItemIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
    previousImagesCount.current = images.length;
  }, [images, isStreaming]);

  if (images.length === 0 && !isStreaming) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <span className="iconify ph--file-text-bold text-4xl mb-2 block" />
          <p>解析成功后内容将显示在此处</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-800 rounded-none border border-gray-700 shadow-2xl">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-semibold">预览与解析内容</h2>
        <button
          onClick={viewFullScreen}
          className="flex items-center px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded text-sm transition-all duration-300 shadow-lg"
        >
          <span className="iconify ph--arrows-out-cardinal-bold mr-1" />
          全屏查看
        </button>
      </div>
      <div
        ref={containerRef}
        className="flex-grow overflow-auto p-0 bg-gray-900"
      >
        <div className="space-y-6">
          {images.map((item, index) => (
            <div
              key={index}
              ref={(el) => { if (el) itemRefs.current[index] = el; }}
              className="border border-gray-700 rounded-lg overflow-hidden"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 p-0">
                {/* 图片预览 */}
                <div className="flex flex-col">
                  <div
                    className="bg-gray-700 rounded-none overflow-hidden mb-2 flex items-center justify-center cursor-pointer"
                    onClick={() => openModal(item.image)}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={`Preview ${index + 1}`}
                        className="max-h-96 object-contain w-full"
                      />
                    ) : (
                      <div className="text-gray-400 text-center p-4">无预览图片</div>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 text-center py-2">第 {index + 1} 页 (点击图片放大)</p>
                </div>

                {/* 解析内容 */}
                <div className="flex flex-col">
                  <div className="flex justify-between items-center mb-3 p-4">
                    <h3 className="font-medium">第 {index + 1} 页内容</h3>
                    <button
                      onClick={() => copyToClipboard(item.content, index)}
                      className="flex items-center px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded text-sm transition-all duration-300 shadow-lg"
                    >
                      <span className="iconify ph--copy-bold mr-1" />
                      {copiedIndex === index ? '已复制' : '复制'}
                    </button>
                  </div>
                  <div className="prose max-w-none flex-grow p-4 pt-0 prose-invert prose-headings:text-white prose-p:text-gray-300 prose-a:text-blue-400 prose-strong:text-white prose-em:text-gray-300">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        // 自定义表格样式
                        table: ({ node, ...props }) => (
                          <table className="min-w-full border border-gray-700 my-4 rounded" {...props} />
                        ),
                        th: ({ node, ...props }) => (
                          <th className="border-b border-gray-700 bg-gray-800 px-4 py-2 text-left font-bold" {...props} />
                        ),
                        td: ({ node, ...props }) => (
                          <td className="border-b border-gray-700 px-4 py-2" {...props} />
                        ),
                        // 自定义引用块样式
                        blockquote: ({ node, ...props }) => (
                          <blockquote className="border-l-4 border-gray-500 pl-4 italic text-gray-400 my-4" {...props} />
                        )
                      }}
                    >
                      {item.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* 流式传输时的加载指示器 */}
          {isStreaming && (
            <div className="flex justify-center p-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2 animate-bounce"></div>
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                <span className="ml-2 text-gray-400">正在接收数据...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 图片放大模态框 */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="relative max-w-4xl max-h-full"
            onClick={(e) => e.stopPropagation()} // 防止点击图片时关闭模态框
          >
            <button
              className="absolute top-2 right-2 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition"
              onClick={closeModal}
            >
              <span className="iconify ph--x-bold text-2xl" />
            </button>
            {modalImage ? (
              <img
                src={modalImage}
                alt="放大图片"
                className="max-h-screen max-w-full object-contain"
              />
            ) : (
              <div className="text-white text-center p-4 text-lg">无图片可显示</div>
            )}
          </div>
        </div>
      )}

      {/* 全屏查看模态框 */}
      {isFullScreenModalOpen && (
        <div
          className="fixed inset-0 bg-gray-900 flex flex-col z-50 p-4"
        >
          <div className="flex justify-between items-center border-b border-gray-700 pb-4 mb-4">
            <div className="flex items-center">
              <button
                onClick={() => setIsFullScreenModalOpen(false)}
                className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all duration-300 shadow-lg mr-4"
              >
                <span className="iconify ph--arrow-left-bold mr-2" />
                返回
              </button>
              <h1 className="text-xl font-bold truncate max-w-md">{fileName}</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(fullContent)
                    .then(() => {
                      // 复制成功，设置状态
                      setIsFullContentCopied(true);
                      // 3秒后重置状态
                      setTimeout(() => setIsFullContentCopied(false), 3000);
                    })
                    .catch(err => {
                      console.error('复制失败:', err);
                    });
                }}
                className="flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-lg transition-all duration-300 shadow-lg mr-2"
              >
                <span className="iconify ph--copy-bold mr-2" />
                {/* 根据复制状态显示不同文本 */}
                {isFullContentCopied ? '已复制' : '复制全文'}
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-lg transition-all duration-300 shadow-lg"
              >
                <span className="iconify ph--printer-bold mr-2" />
                打印
              </button>
            </div>
          </div>
          {/* <div className="flex-grow overflow-auto prose max-w-none prose-invert prose-headings:text-white prose-p:text-gray-300 prose-a:text-blue-400 prose-strong:text-white prose-em:text-gray-300 p-4 bg-gray-800 rounded-lg">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                // 自定义表格样式
                table: ({ node, ...props }) => (
                  <table className="min-w-full border border-gray-700 my-4 rounded" {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th className="border-b border-gray-700 bg-gray-800 px-4 py-2 text-left font-bold" {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td className="border-b border-gray-700 px-4 py-2" {...props} />
                ),
                // 自定义引用块样式
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-4 border-gray-500 pl-4 italic text-gray-400 my-4" {...props} />
                )
              }}
            >
              {fullContent}
            </ReactMarkdown>
          </div> */}
          {/* 内容区域 */}
          <div className="flex-grow overflow-auto p-6 bg-gray-900">
            <div className="max-w-4xl mx-auto">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={{
                  // 自定义表格样式
                  table: ({ node, ...props }) => (
                    <table className="min-w-full border border-gray-700 my-4 rounded" {...props} />
                  ),
                  th: ({ node, ...props }) => (
                    <th className="border-b border-gray-700 bg-gray-800 px-4 py-2 text-left font-bold" {...props} />
                  ),
                  td: ({ node, ...props }) => (
                    <td className="border-b border-gray-700 px-4 py-2" {...props} />
                  ),
                  // 自定义引用块样式
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-4 border-gray-500 pl-4 italic text-gray-400 my-4" {...props} />
                  )
                }}
              >
                {fullContent}
              </ReactMarkdown>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default PreviewAndParseView;