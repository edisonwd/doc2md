import API_BASE_URL from './config';

export interface ParsedImage {
  image: string;
  content: string;
}

export interface ParseResult {
  images: ParsedImage[];
}

export interface ParseProgress {
  totalPages: number;
  currentPage: number;
  currentImage: string;
  currentContent: string;
}

export const parseFile = async (file: File): Promise<ParseResult> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/file/`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return {
    images: data || []
  };
};

export const parseFileWithSSE = (
  file: File,
  model: string, // 添加模型参数
  onProgress: (progress: ParseProgress) => void,
  onComplete: (result: ParseResult) => void,
  onError: (error: Error) => void
): (() => void) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', model); // 将模型名称添加到表单数据中

  const controller = new AbortController();

  fetch(`${API_BASE_URL}/file/stream`, {
    method: 'POST',
    headers: {
      'accept': 'text/event-stream',
    },
    body: formData,
    signal: controller.signal
  }).then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('ReadableStream not supported');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const read = () => {
      reader.read().then(({ done, value }) => {
        if (done) {
          console.log('Stream complete');
          // 流结束时也调用onComplete，防止后端没有发送complete事件
          onComplete({ images: [] });

          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let isComplete = false;

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const dataStr = line.slice(6);
              // 检查是否是结束信号
              if (dataStr.trim() === '[DONE]') {
                if (!isComplete) {
                  onComplete({ images: [] });
                }
                controller.abort();
                return;
              }
              const data = JSON.parse(dataStr);

              if (data.type === 'progress') {
                onProgress({
                  totalPages: data.totalPages,
                  currentPage: data.currentPage,
                  currentImage: data.currentImage,
                  currentContent: data.currentContent
                });
              } else if (data.type === 'complete') {
                isComplete = true;
                onComplete({
                  images: data.images
                });
                // 延迟关闭，确保所有数据都被处理
                setTimeout(() => {
                  controller.abort();
                }, 500);
                return;
              } else if (data.type === 'error') {
                onError(new Error(data.message || 'SSE处理错误'));
                controller.abort();
                return;
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }

        read();
      }).catch(error => {
        console.error('Error reading SSE stream:', error);
        if (error.name !== 'AbortError') {
          onError(error);
        }
      });
    };

    read();
  }).catch(error => {
    // 记录错误
    console.error('Error initializing SSE stream:', error);
    if (error.name !== 'AbortError') {
      onError(error);
    }
  });

  return () => {
    controller.abort();
  };
};