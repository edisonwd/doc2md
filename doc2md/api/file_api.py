from fastapi import APIRouter, UploadFile, HTTPException, Form
from fastapi.responses import StreamingResponse
import pymupdf  # PyMuPDF
import base64
import tempfile
from typing import List, Optional, Any
from pydantic import BaseModel
import asyncio
import os
from doc2md.pdf2md.pdf2md import process_single_image
from doc2md.util.utils import pdf_to_images


router = APIRouter(
    prefix="/file",
    tags=["file"],
    responses={404: {"description": "Not found"}},
)


# 使用 Pydantic 定义数据模型
class ParsedImage(BaseModel):
    image: str  # base64编码的图片
    content: str  # 图片解析后的内容


# 添加非流式接口以保持兼容性
class ParseResult(BaseModel):
    images: List[ParsedImage]


class ProgressEvent(BaseModel):
    type: str = "progress"
    totalPages: int
    currentPage: int
    currentImage: str
    currentContent: str


class CompleteEvent(BaseModel):
    type: str = "complete"
    images: List[ParsedImage]


class ErrorEvent(BaseModel):
    type: str = "error"
    message: str
    details: Optional[Any] = None


def generate_image_from_page(page, zoom=2.0) -> str:
    """将 PDF 页面转换为 base64 编码的 PNG 图片"""
    mat = pymupdf.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    img_bytes = pix.tobytes("png")
    return base64.b64encode(img_bytes).decode("utf-8")



async def process_file_stream(file_path: str, file_type: str, model_name: str):
    """处理文件并生成 SSE 事件流"""
    try:
        images = []

        if file_type == "application/pdf":
            doc = pymupdf.open(file_path)
            total_pages = len(doc)
            # 获取 file_path 的父目录
            parent_dir = os.path.dirname(file_path)
            output_dir = os.path.join(parent_dir, "images")
            # 调用转换函数
            page_image_paths = pdf_to_images(pdf_path=file_path, output_folder=output_dir)


            for page_num in range(total_pages):
                page = doc.load_page(page_num)
                # 生成图片,转换为 Base64
                image_base64 = generate_image_from_page(page)
                base64_data_url = f"data:image/png;base64,{image_base64}"

                # 模拟内容提取 (实际应用中可使用 OCR)
                # content = f"从第 {page_num+1} 页提取的文本内容"
                content = process_single_image(page_image_paths[page_num], model_name)

                # 创建进度事件
                progress = ProgressEvent(
                    totalPages=total_pages,
                    currentPage=page_num + 1,
                    currentImage=base64_data_url,
                    currentContent=content,
                )

                # 发送进度事件
                yield f"data: {progress.model_dump_json()}\n\n"

                # 保存当前结果
                images.append(ParsedImage(image=base64_data_url, content=content))

        elif file_type.startswith("image/"):
            # 处理图片文件
            total_pages = 1
            current_page = 1

            # 读取图片文件并转换为base64
            with open(file_path, "rb") as img_file:
                image_bytes = img_file.read()
                image_base64 = base64.b64encode(image_bytes).decode("utf-8")

            base64_data_url = f"data:{file_type};base64,{image_base64}"
            # 模拟内容提取 (实际应用中可使用 OCR)
            content = process_single_image(file_path, model_name)

            # 创建进度事件
            progress = ProgressEvent(
                totalPages=total_pages,
                currentPage=current_page,
                currentImage=base64_data_url,
                currentContent=content,
            )

            # 发送进度事件
            yield f"data: {progress.model_dump_json()}\n\n"

            # 保存当前结果
            images.append(ParsedImage(image=base64_data_url, content=content))

        else:
            raise ValueError(f"不支持的文档类型: {file_type}")

        # 添加结束信号
        yield "data: [DONE]\n\n"
        # 确保事件循环有时间处理关闭
        await asyncio.sleep(0.1)

    except Exception as e:
        # 发送错误事件
        error = ErrorEvent(message=str(e), details=str(type(e)))
        yield f"data: {error.model_dump_json()}\n\n"


@router.post("/stream")
async def stream_parse_file(
    file: UploadFile, model: str = Form(description="模型名称")
):
    """流式文件处理端点"""
    model_name = "hosted_vllm/nanonets/Nanonets-OCR-s"
    # 验证文件类型
    supported_types = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
    if file.content_type not in supported_types:
        raise HTTPException(
            400, detail=f"仅支持以下文件类型: {', '.join(supported_types)}"
        )

    try:
        # 根据文件类型设置后缀
        file_ext = {
            "application/pdf": ".pdf",
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/jpg": ".jpg",
        }.get(file.content_type, ".tmp")
        # 使用tempfile模块创建临时文件，更安全且跨平台
        with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as temp_file:
            file_path = temp_file.name
            content = await file.read()
            if not content:
                raise ValueError("上传的文件为空")
            temp_file.write(content)

            # 创建 SSE 响应
            return StreamingResponse(
                process_file_stream(file_path, file.content_type, model_name),
                media_type="text/event-stream",
                headers={"Connection": "keep-alive", "Cache-Control": "no-cache"},
            )

    except Exception as e:
        # 处理初始错误
        raise HTTPException(500, detail=f"文件处理错误: {str(e)}")


@router.post("/")
async def parse_file(file: UploadFile, model: str = Form(description="模型名称")):
    """非流式文件处理端点"""
    print(f"model: {model}")
    supported_types = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
    if file.content_type not in supported_types:
        raise HTTPException(
            400, detail=f"仅支持以下文件类型: {', '.join(supported_types)}"
        )

    try:
        file_ext = {
            "application/pdf": ".pdf",
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/jpg": ".jpg",
        }.get(file.content_type, ".tmp")
        # 使用tempfile模块创建临时文件，更安全且跨平台
        with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as temp_file:
            file_path = temp_file.name
            content = await file.read()
            if not content:
                raise ValueError("上传的文件为空")
            temp_file.write(content)

            images = []

            if file.content_type == "application/pdf":
                doc = pymupdf.open(file_path)
                for page_num in range(len(doc)):
                    page = doc.load_page(page_num)
                    image_base64 = generate_image_from_page(page)
                    base64_data_url = f"data:image/png;base64,{image_base64}"

                    content = f"从第 {page_num+1} 页提取的文本内容"
                    images.append(ParsedImage(image=base64_data_url, content=content))
            else:  # 图片文件
                with open(file_path, "rb") as img_file:
                    image_bytes = img_file.read()
                    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
                base64_data_url = f"data:{file.content_type};base64,{image_base64}"
                content = "从图片提取的文本内容"
                images.append(ParsedImage(image=base64_data_url, content=content))

            return ParseResult(images=images)

    except Exception as e:
        raise HTTPException(500, detail=f"文件处理错误: {str(e)}")
