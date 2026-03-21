# LLM Inference 论文收集

本文整理了 LLM inference 方向的一组代表性论文，偏向系统与推理优化，而不是基础模型训练。选题重点覆盖：

- 解码加速
- KV cache / 内存管理
- Serving 调度与批处理
- Prefill / Decode 解耦
- 量化与低资源推理

时间范围主要集中在 2022-2024，这是当前 LLM inference 工程体系快速成形的阶段。

## 一句话结论

如果你只想快速建立主线，建议先读这 8 篇：

1. Fast Inference from Transformers via Speculative Decoding
2. Efficient Memory Management for Large Language Model Serving with PagedAttention
3. SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills
4. DistServe: Disaggregating Prefill and Decoding for Goodput-optimized Large Language Model Serving
5. SGLang: Efficient Execution of Structured Language Model Programs
6. SmoothQuant: Accurate and Efficient Post-Training Quantization for Large Language Models
7. AWQ: Activation-aware Weight Quantization for LLM Compression and Acceleration
8. Mooncake: A KVCache-centric Disaggregated Architecture for LLM Serving

## 1. 解码加速

### 1. Fast Inference from Transformers via Speculative Decoding

- 时间：2022
- 链接：https://arxiv.org/abs/2211.17192
- 价值：Speculative decoding 的起点论文。核心思想是先让小模型草拟多个 token，再由大模型并行验证，保持输出分布不变。

### 2. EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty

- 时间：2024
- 链接：https://arxiv.org/abs/2401.15077
- 价值：Speculative decoding 的代表性改进工作，把“猜 token”转向“猜 feature”，是 2024 年这一方向里很值得跟进的一篇。

### 3. Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads

- 时间：2024
- 链接：https://arxiv.org/abs/2401.10774
- 价值：通过多个 decoding heads 并行预测未来 token，属于 self-speculative / multi-token generation 路线，工程上很有启发性。

### 4. FlashDecoding++: Faster Large Language Model Inference on GPUs

- 时间：2023
- 链接：https://arxiv.org/abs/2311.01282
- 价值：聚焦 GPU kernel 与 decode 阶段算子优化，适合补足“算法之外，底层 kernel 怎么提速”的视角。

## 2. KV Cache 与内存管理

### 5. Efficient Memory Management for Large Language Model Serving with PagedAttention

- 时间：2023
- 链接：https://arxiv.org/abs/2309.06180
- 价值：vLLM 的核心论文。PagedAttention 基本已经成为理解现代 LLM serving 的必读材料。

### 6. H2O: Heavy-Hitter Oracle for Efficient Generative Inference of Large Language Models

- 时间：2023
- 链接：https://arxiv.org/abs/2306.14048
- 价值：从“KV cache 该保留什么”切入，而不是只关心怎么存。对理解 cache eviction / token importance 很重要。

### 7. SnapKV: LLM Knows What You are Looking for Before Generation

- 时间：2024
- 链接：https://arxiv.org/abs/2404.14469
- 价值：长上下文下的 KV cache 压缩代表作，强调按 head 识别重要位置，在工程实践里讨论度很高。

### 8. CacheGen: KV Cache Compression and Streaming for Fast Large Language Model Serving

- 时间：2023
- 链接：https://arxiv.org/abs/2310.07240
- 价值：把 KV cache 当作需要传输和压缩的数据对象来处理，适合连接 inference 与分布式系统视角。

### 9. StreamingLLM: Efficient Streaming Language Models with Attention Sinks

- 时间：2023
- 链接：https://arxiv.org/abs/2309.17453
- 价值：长对话 / streaming 场景的经典工作，“attention sink” 已经成为一个常见术语。

## 3. Serving、批处理与调度

### 10. SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills

- 时间：2023
- 链接：https://arxiv.org/abs/2308.16369
- 价值：chunked prefill 的代表论文。现代 serving engine 里很多调度思路都能看到它的影子。

### 11. SGLang: Efficient Execution of Structured Language Model Programs

- 时间：2023
- 链接：https://arxiv.org/abs/2312.07104
- 价值：虽然不只是 inference 论文，但它把 structured generation、prefix reuse、runtime optimization 很好地串起来了，对真实 agent / RAG 系统很有参考价值。

### 12. DistServe: Disaggregating Prefill and Decoding for Goodput-optimized Large Language Model Serving

- 时间：2024
- 链接：https://arxiv.org/abs/2401.09670
- 价值：把 prefill 和 decode 明确拆开，是 serving 架构层面的关键转折点，尤其适合理解 TTFT 和 TPOT 的权衡。

### 13. Mooncake: A KVCache-centric Disaggregated Architecture for LLM Serving

- 时间：2024
- 链接：https://arxiv.org/abs/2407.00079
- 价值：更偏生产系统视角，强调 KV cache-centric 的分离式架构，适合和 DistServe 对照阅读。

## 4. 量化与低资源推理

### 14. GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers

- 时间：2022
- 链接：https://arxiv.org/abs/2210.17323
- 价值：LLM PTQ 的基准级论文之一，很多后续 4-bit 推理工作都绕不开 GPTQ。

### 15. SmoothQuant: Accurate and Efficient Post-Training Quantization for Large Language Models

- 时间：2022
- 链接：https://arxiv.org/abs/2211.10438
- 价值：W8A8 路线的关键论文，工业落地影响很大，后续被多个推理框架吸收。

### 16. AWQ: Activation-aware Weight Quantization for LLM Compression and Acceleration

- 时间：2023
- 链接：https://arxiv.org/abs/2306.00978
- 价值：weight-only quantization 的代表作之一，工程上非常常见，和 GPTQ、SmoothQuant 一起构成量化入门主线。

### 17. QuaRot: Outlier-Free 4-Bit Inference in Rotated LLMs

- 时间：2024
- 链接：https://arxiv.org/abs/2404.00456
- 价值：把旋转与 outlier 处理引入端到端 4-bit inference，覆盖 weights、activations 和 KV cache，是 2024 年值得关注的量化方向。

### 18. FlexGen: High-Throughput Generative Inference of Large Language Models with a Single GPU

- 时间：2023
- 链接：https://arxiv.org/abs/2303.06865
- 价值：单卡 / 低资源推理经典工作。即使今天很多系统更强了，这篇仍然很适合理解 offloading 与 throughput-oriented inference。

## 建议阅读顺序

如果目标是建立完整框架，建议顺序如下：

1. 先读 PagedAttention，建立 KV cache 与 serving memory 的基本直觉。
2. 读 Speculative Decoding，理解“为什么 decode 是核心瓶颈”。
3. 读 SARATHI 和 DistServe，理解 prefill / decode 两阶段的调度问题。
4. 读 Mooncake 和 CacheGen，补齐分离式架构与跨设备 KV cache 传输。
5. 读 GPTQ、SmoothQuant、AWQ，建立量化主线。
6. 最后读 EAGLE、Medusa、SnapKV、QuaRot，跟进 2024 年之后的重要变体。

## 按目标选读

### 如果你关心 serving engine 怎么做

- PagedAttention
- SARATHI
- DistServe
- Mooncake
- SGLang

### 如果你关心 decode latency 怎么降

- Speculative Decoding
- EAGLE
- Medusa
- FlashDecoding++

### 如果你关心长上下文 / KV cache

- PagedAttention
- H2O
- SnapKV
- CacheGen
- StreamingLLM

### 如果你关心低成本部署

- GPTQ
- SmoothQuant
- AWQ
- QuaRot
- FlexGen

## 我对这个方向的简要判断

- 2022 年的主线是“让模型能跑起来”，重点在 speculative decoding 和量化。
- 2023 年的主线是“让 serving 更像一个系统问题”，重点转向 PagedAttention、chunked prefill、prefix reuse、offloading。
- 2024 年的主线是“把 inference 当成分阶段、分层级、分资源池来调度”，典型代表是 DistServe、Mooncake、SnapKV、EAGLE。
- 现在这个方向已经不只是模型压缩问题，而是算法、内存、调度、网络传输、系统架构联合优化问题。

## 参考来源

本清单主要基于论文原文或论文主页整理：

- https://arxiv.org/abs/2211.17192
- https://arxiv.org/abs/2309.06180
- https://arxiv.org/abs/2308.16369
- https://arxiv.org/abs/2401.09670
- https://arxiv.org/abs/2312.07104
- https://arxiv.org/abs/2407.00079
- https://arxiv.org/abs/2210.17323
- https://arxiv.org/abs/2211.10438
- https://arxiv.org/abs/2306.00978
- https://arxiv.org/abs/2404.00456
- https://arxiv.org/abs/2303.06865
- https://arxiv.org/abs/2401.15077
- https://arxiv.org/abs/2401.10774
- https://arxiv.org/abs/2311.01282
- https://arxiv.org/abs/2306.14048
- https://arxiv.org/abs/2404.14469
- https://arxiv.org/abs/2310.07240
- https://arxiv.org/abs/2309.17453
