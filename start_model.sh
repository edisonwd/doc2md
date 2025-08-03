# 在下载前，请先通过如下命令安装ModelScope
pip install modelscope vllm

# 判断模型是否下载
if [ ! -d "./Nanonets-OCR-s" ]; then
    # 下载完整模型库
    modelscope download --model nanonets/Nanonets-OCR-s  --local_dir ./Nanonets-OCR-s
fi

# 如果模板文件不存在
if [ ! -f "./template_dse_qwen2_vl.jinja" ]; then
    # 下载模板文件
    wget https://github.com/vllm-project/vllm/blob/main/examples/template_dse_qwen2_vl.jinja -O ./template_dse_qwen2_vl.jinja
fi

# 启动模型
vllm serve ./Nanonets-OCR-s/ --served-model-name nanonets/Nanonets-OCR-s --chat-template ./template_dse_qwen2_vl.jinja
