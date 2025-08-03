import os
import base64
import pymupdf

from PIL import Image

def encode_image(image_path: str):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

def get_image_encoding_type(image_path: str) -> str:
    if image_path.endswith(".png"):
        return "data:image/png;base64"
    elif image_path.endswith(".jpg") or image_path.endswith(".jpeg"):
        return "data:image/jpeg;base64"
    else:
        raise ValueError(f"Unsupported image format: {image_path}")

def pdf_to_images(pdf_path, output_folder, image_format='png', zoom=3):
    """
    将PDF每页转换为单独的图片

    参数:
        pdf_path: PDF文件路径
        output_folder: 输出图片的文件夹
        image_format: 图片格式 ('PNG' 或 'JPEG')
        zoom: 缩放因子(提高分辨率)，默认2=2倍
    """
    # 确保输出目录存在
    os.makedirs(output_folder, exist_ok=True)

    # 打开PDF文件
    pdf_document = pymupdf.open(pdf_path)
    page_image_paths = []
    # 遍历每一页
    for page_num in range(len(pdf_document)):
        page = pdf_document.load_page(page_num)

        # 创建缩放矩阵提高分辨率
        matrix = pymupdf.Matrix(zoom, zoom)

        # 渲染页面为图像 (pix对象)
        pix = page.get_pixmap(matrix=matrix)

        # 转换为PIL Image对象以便处理
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

        # 构建输出路径
        output_path = os.path.join(output_folder, f"page_{page_num+1}.{image_format.lower()}")

        # 保存图像
        img.save(output_path, format=image_format)
        page_image_paths.append(output_path)
        print(f"已保存: {output_path}")


    print(f"\n转换完成! 共转换 {len(pdf_document)} 页。")
    pdf_document.close()
    return page_image_paths
