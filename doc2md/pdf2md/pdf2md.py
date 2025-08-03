# -*- encoding: utf-8 -*-
import litellm
import tempfile
import concurrent.futures
from util.utils import encode_image, get_image_encoding_type, pdf_to_images
import logging

logger = logging.getLogger(__name__)

USER_PROMPT = """Extract the text from the above document as if you were reading it naturally. 
    Return the tables in html format. Watermarks should be wrapped in brackets. 
    Ex: <watermark>OFFICIAL COPY</watermark>. Page numbers should be wrapped in brackets. 
    Ex: <page_number>14</page_number> or <page_number>9/22</page_number>. 
    Prefer using ☐ and ☑ for check boxes."""


# 处理单个图像的函数
def process_single_image(
    image_path: str,
    model_name: str,
    user_prompt: str = USER_PROMPT,
    max_gen_tokens: int = 1000,
) -> str:
    try:
        img_base64 = encode_image(image_path)
        image_encoding_type = get_image_encoding_type(image_path)

        base64_data_url = f"{image_encoding_type},{img_base64}"

        # 构建消息
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": base64_data_url},
                    },
                    {"type": "text", "text": user_prompt},
                ],
            }
        ]

        # 调用模型
        response = litellm.completion(
            model=model_name,
            messages=messages,
            api_base="http://localhost:8000/v1",
            temperature=0.2,
            max_tokens=max_gen_tokens,
        )

        page_content = response["choices"][0]["message"]["content"]
        return page_content
    except Exception as e:
        logger.error(f"Error during conversion of page : {e}")
        return f"<error>Failed to process page: {str(e)}</error>"


def convert_image_to_markdown_stream(
    file_paths, model_name, concurrency_limit: int = 1, max_gen_tokens: int = 1000
):
    """
    将图像转换为Markdown格式，支持并发处理

    参数:
        file_paths: 图像文件路径列表
        model_name: 用于转换的模型名称
        concurrency_limit: 并发处理的最大线程数
        max_gen_tokens: 生成的最大token数

    返回:
        生成器，产生每个图像转换后的Markdown内容
    """
    # 创建系统提示
    system_prompt = USER_PROMPT

    # 使用线程池并发处理图像
    with concurrent.futures.ThreadPoolExecutor(
        max_workers=concurrency_limit
    ) as executor:
        # 提交所有任务，并保留索引以便按顺序返回结果
        future_to_index = {
            executor.submit(
                process_single_image,
                image_path,
                model_name,
                system_prompt,
                max_gen_tokens,
            ): i
            for i, image_path in enumerate(file_paths)
        }

        # 创建一个字典来存储结果，以保持原始顺序
        results = {}
        completed_count = 0

        # 处理完成的任务
        for future in concurrent.futures.as_completed(future_to_index):
            i = future_to_index[future]
            try:
                results[i] = future.result()
                completed_count += 1
                # 每当有新结果可用时，按顺序生成所有已完成的结果
                for j in range(len(file_paths)):
                    if results[j] is not None:
                        yield results[j]
                        results[j] = None  # 标记为已生成
            except Exception as e:
                logger.error(f"Task for page {i + 1} failed: {e}")
                results[i] = f"<error>Task failed: {str(e)}</error>"

    # 确保所有结果都被生成
    for j in range(len(file_paths)):
        if results[j] is not None:
            yield results[j]


def convert_image_to_markdown(
    file_inputs, model_name, concurrency_limit: int = 1, max_gen_tokens: int = 1000
):
    """
    非流式版本，用于向后兼容
    """
    # 从流式生成器获取最终结果
    final_results = []
    for result in convert_image_to_markdown_stream(
        file_inputs, model_name, concurrency_limit, max_gen_tokens
    ):
        final_results.append(result)
    return final_results


def convert_pdf_to_markdown(pdf_path, model_name):
    """
    将PDF转换为Markdown文件

    参数:
        pdf_path: PDF文件路径
        model_name: 用于转换的模型名称
    """
    # 创建临时目录
    with tempfile.TemporaryDirectory() as temp_dir:
        # 调用转换函数
        page_image_paths = pdf_to_images(pdf_path=pdf_path, output_folder=temp_dir)

        markdown_contents = convert_image_to_markdown(
            file_inputs=page_image_paths, model_name=model_name
        )

    # 将markdown内容写入文件
    with open("output.md", "w") as f:
        f.write("\n".join(markdown_contents))
    print("Markdown内容已保存到output.md")
    return "\n\n\n".join(markdown_contents)


# 使用示例
if __name__ == "__main__":
    # 配置参数
    pdf_file = "attention-is-all-you-need.pdf"  # 替换为你的PDF文件路径
    output_dir = "output_images"  # 输出文件夹

    convert_pdf_to_markdown(pdf_file, output_dir)
